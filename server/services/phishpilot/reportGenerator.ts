import crypto from 'crypto';
import { PhishPilotReport, ParsedEmail, ParsedEmailSummary, PhishPilotVerdict } from '../../types/phishpilot.js';
import { EmailParserService } from './emailParser.js';
import { HeaderAnalyzerService } from './headerAnalyzer.js';
import { UrlAnalyzerService } from './urlAnalyzer.js';
import { AttachmentAnalyzerService } from './attachmentAnalyzer.js';
import { AiAnalyzerService } from './aiAnalyzer.js';
import { RiskScorerService } from './riskScorer.js';
import { MicrosoftSecurityLookupService } from './microsoftSecurityLookup.js';
import { ThreatCorrelationService } from './correlationService.js';
import { PhishPilotStore } from './phishpilotStore.js';

export class ReportGeneratorService {
  public static async generateReport(emlContent: string | Buffer): Promise<PhishPilotReport> {
    const parsed: ParsedEmail = await EmailParserService.parse(emlContent);
    
    const [headerAnalysis, urlAnalysis, attachmentAnalysis, microsoftEnrichment] = await Promise.all([
      HeaderAnalyzerService.analyze(parsed),
      UrlAnalyzerService.analyze(parsed),
      AttachmentAnalyzerService.analyze(parsed),
      MicrosoftSecurityLookupService.enrich(parsed)
    ]);

    const riskBreakdown = RiskScorerService.analyze(parsed, headerAnalysis, urlAnalysis, attachmentAnalysis, microsoftEnrichment);
    
    const aiClassification = await AiAnalyzerService.analyze(parsed, headerAnalysis, urlAnalysis, attachmentAnalysis);

    let verdict: PhishPilotVerdict = riskBreakdown.deterministicVerdict;

    if (aiClassification) {
      // Upgrade verdict if AI indicates higher risk
      if (aiClassification.classification === 'PHISHING' && verdict !== 'PHISHING') {
        verdict = 'PHISHING';
      } else if (aiClassification.classification === 'SUSPICIOUS' && verdict === 'LEGITIMATE') {
        verdict = 'SUSPICIOUS';
      }
    }

    const recommendedActions: string[] = [];
    if (verdict === 'PHISHING') {
      recommendedActions.push(
        'Delete email immediately',
        'Do not click any embedded links or buttons',
        'Do not open or download attachments',
        'Reset password if credentials were submitted'
      );
      if (microsoftEnrichment.senderEntraStatus?.impersonationDetected) {
        recommendedActions.push('Report internal executive impersonation attempt to SecOps');
      }
    } else if (verdict === 'SUSPICIOUS') {
      recommendedActions.push(
        'Verify sender via an independent trusted channel (e.g. phone/Teams)',
        'Check links carefully before clicking',
        'Do not enter credentials on unverified login pages'
      );
    } else {
      recommendedActions.push(
        'Email appears legitimate based on current authentication and reputation signals',
        'Standard caution still applies'
      );
    }

    const emailSummary: ParsedEmailSummary = {
      from: parsed.from,
      to: parsed.to,
      subject: parsed.subject,
      date: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
      replyTo: parsed.replyTo || parsed.from,
      returnPath: parsed.returnPath || parsed.from,
      bodyPreview: parsed.plainTextBody ? parsed.plainTextBody.slice(0, 3000) : (parsed.htmlBody.slice(0, 3000)),
      urlCount: urlAnalysis.length,
      attachmentCount: attachmentAnalysis.length
    };

    // Normalized riskScore 0-100
    const riskScore = Math.min(100, riskBreakdown.totalScore);
    const confidence = aiClassification ? aiClassification.confidence : (verdict === 'PHISHING' ? 0.94 : verdict === 'SUSPICIOUS' ? 0.82 : 0.91);

    const report: PhishPilotReport = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      verdict,
      riskScore,
      confidence,
      emailSummary,
      headerAnalysis,
      urlAnalysis,
      attachmentAnalysis,
      aiClassification,
      riskBreakdown,
      recommendedActions,
      microsoftEnrichment
    };

    // Correlate with active mSec Defender/Sentinel incidents
    try {
      const correlations = ThreatCorrelationService.findCorrelations(report);
      if (correlations.length > 0) {
        report.correlations = correlations;
      }
    } catch {
      // Ignore correlation error
    }

    await PhishPilotStore.save(report);
    return report;
  }
}
