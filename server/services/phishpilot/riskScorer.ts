import { 
  RiskScoreBreakdown, 
  RiskScoreItem, 
  HeaderAnalysisResult, 
  UrlAnalysisResult, 
  AttachmentAnalysisResult, 
  PhishPilotVerdict, 
  ParsedEmail,
  MicrosoftSecurityEnrichment 
} from '../../types/phishpilot.js';

export class RiskScorerService {
  public static analyze(
    parsed: ParsedEmail,
    headerAnalysis: HeaderAnalysisResult,
    urlAnalysis: UrlAnalysisResult[],
    attachmentAnalysis: AttachmentAnalysisResult[],
    microsoftEnrichment?: MicrosoftSecurityEnrichment
  ): RiskScoreBreakdown {
    const items: RiskScoreItem[] = [];

    // 1. Authentication checks
    const spfFailed = headerAnalysis.spf.result === 'fail';
    items.push({
      condition: 'SPF Authentication Failure',
      points: 20,
      triggered: spfFailed,
      detail: headerAnalysis.spf.detail || `SPF status: ${headerAnalysis.spf.result}`
    });

    const dkimFailed = headerAnalysis.dkim.result === 'fail';
    items.push({
      condition: 'DKIM Signature Failure',
      points: 15,
      triggered: dkimFailed,
      detail: headerAnalysis.dkim.detail || `DKIM status: ${headerAnalysis.dkim.result}`
    });

    const dmarcFailed = headerAnalysis.dmarc.result === 'fail';
    items.push({
      condition: 'DMARC Policy Failure',
      points: 20,
      triggered: dmarcFailed,
      detail: headerAnalysis.dmarc.detail || `DMARC status: ${headerAnalysis.dmarc.result}`
    });

    items.push({
      condition: 'Reply-To Header Mismatch',
      points: 15,
      triggered: headerAnalysis.replyToMismatch,
      detail: headerAnalysis.replyToMismatch ? `Reply-To differs from sender domain: ${parsed.replyTo}` : 'Reply-To matches sender domain'
    });

    items.push({
      condition: 'Return-Path Mismatch',
      points: 10,
      triggered: headerAnalysis.returnPathMismatch,
      detail: headerAnalysis.returnPathMismatch ? `Return-Path differs from sender domain: ${parsed.returnPath}` : 'Return-Path matches sender domain'
    });

    // 2. Content & language heuristics
    const urgentRegex = /(urgent|immediately|account suspended|verify your|click here or|within 24 hours|action required|suspended within)/i;
    const hasUrgentLanguage = urgentRegex.test(parsed.plainTextBody) || urgentRegex.test(parsed.htmlBody) || urgentRegex.test(parsed.subject);
    items.push({
      condition: 'Urgent or Coercive Language',
      points: 10,
      triggered: hasUrgentLanguage,
      detail: hasUrgentLanguage ? 'High urgency/deadline phrases found in subject or body' : 'No coercive urgency patterns identified'
    });

    const credRegex = /(password|login|credentials|SSN|social security|bank account|credit card|verify access|confirm your account)/i;
    const hasCredLanguage = credRegex.test(parsed.plainTextBody) || credRegex.test(parsed.htmlBody);
    items.push({
      condition: 'Credential Harvesting Language',
      points: 20,
      triggered: hasCredLanguage,
      detail: hasCredLanguage ? 'Phrases requesting credentials or account validation found' : 'No explicit credential prompts detected'
    });

    // 3. URL checks
    const hasYoungDomain = urlAnalysis.some(u => u.domainAgeDays !== null && u.domainAgeDays < 30);
    const youngUrl = urlAnalysis.find(u => u.domainAgeDays !== null && u.domainAgeDays < 30);
    items.push({
      condition: 'Newly Registered Domain (<30 days)',
      points: 15,
      triggered: hasYoungDomain,
      detail: hasYoungDomain && youngUrl ? `${youngUrl.domain} estimated age: ${youngUrl.domainAgeDays} days` : 'All referenced domains are established'
    });

    const hasMaliciousUrl = urlAnalysis.some(u => u.isMalicious);
    const malUrl = urlAnalysis.find(u => u.isMalicious);
    items.push({
      condition: 'Known Malicious URL',
      points: 50,
      triggered: hasMaliciousUrl,
      detail: hasMaliciousUrl && malUrl ? `Threat flagged on: ${malUrl.url}` : 'No known malicious URLs detected'
    });

    const hasDeceptiveUrl = urlAnalysis.some(u => u.isDeceptive);
    items.push({
      condition: 'Display URL Deception',
      points: 15,
      triggered: hasDeceptiveUrl,
      detail: hasDeceptiveUrl ? 'Anchor link text displays different domain than href target' : 'Anchor text aligns with link destinations'
    });

    const hasHomoglyph = urlAnalysis.some(u => !!u.homoglyph?.isSuspicious);
    const homoglyphItem = urlAnalysis.find(u => !!u.homoglyph?.isSuspicious);
    items.push({
      condition: 'Homoglyph / Brand Typosquatting Deception',
      points: 25,
      triggered: hasHomoglyph,
      detail: hasHomoglyph && homoglyphItem?.homoglyph?.explanation
        ? homoglyphItem.homoglyph.explanation
        : 'No confusable characters or brand typosquats detected'
    });

    // 4. Attachment checks
    const hasMaliciousAtt = attachmentAnalysis.some(a => a.isMalicious);
    items.push({
      condition: 'Known Malicious Attachment',
      points: 50,
      triggered: hasMaliciousAtt,
      detail: hasMaliciousAtt ? 'Attachment matches malicious threat database' : 'No known malicious hashes'
    });

    const hasDangerousExt = attachmentAnalysis.some(a => a.isSuspiciousExtension);
    items.push({
      condition: 'Dangerous File Extension',
      points: 15,
      triggered: hasDangerousExt,
      detail: hasDangerousExt ? 'Executable or script extension detected' : 'Standard file formats only'
    });

    const hasPasswordZip = attachmentAnalysis.some(a => a.isPasswordProtected);
    items.push({
      condition: 'Password-Protected Archive',
      points: 10,
      triggered: hasPasswordZip,
      detail: hasPasswordZip ? 'Encrypted archive bypasses gateway inspection' : 'No encrypted archives'
    });

    // 5. Microsoft Security & Entra ID signals (if available)
    if (microsoftEnrichment) {
      const hasImpersonation = !!microsoftEnrichment.senderEntraStatus?.impersonationDetected;
      items.push({
        condition: 'Microsoft Entra VIP / Brand Impersonation',
        points: 30,
        triggered: hasImpersonation,
        detail: hasImpersonation
          ? microsoftEnrichment.senderEntraStatus?.riskDetail || 'Sender claims executive identity without internal Entra ID record'
          : 'No internal executive impersonation detected'
      });

      const mdtiMalicious = microsoftEnrichment.defenderTiResults?.verdict === 'malicious';
      items.push({
        condition: 'Microsoft Defender TI Malicious Domain',
        points: 50,
        triggered: mdtiMalicious,
        detail: mdtiMalicious
          ? `Microsoft Defender Threat Intelligence flagged ${microsoftEnrichment.defenderTiResults?.checkedDomain}`
          : 'Microsoft Defender TI verified clean / neutral'
      });

      const scl = microsoftEnrichment.eopDeliveryStatus?.spamConfidenceLevel;
      const isHighScl = scl !== undefined && scl >= 5;
      items.push({
        condition: 'Exchange EOP Spam/Phish Verdict (SCL >= 5)',
        points: 25,
        triggered: isHighScl,
        detail: isHighScl
          ? `Exchange Online SCL is ${scl}: ${microsoftEnrichment.eopDeliveryStatus?.verdictDescription}`
          : (scl !== undefined ? `Exchange Online SCL is ${scl} (Clean)` : 'No Exchange EOP SCL header present')
      });
    }

    // Calculate total score and max possible
    const totalScore = items.filter(i => i.triggered).reduce((acc, curr) => acc + curr.points, 0);
    const maxPossible = items.reduce((acc, curr) => acc + curr.points, 0);

    let deterministicVerdict: PhishPilotVerdict = 'LEGITIMATE';
    if (totalScore >= 61) {
      deterministicVerdict = 'PHISHING';
    } else if (totalScore >= 31) {
      deterministicVerdict = 'SUSPICIOUS';
    }

    return {
      totalScore,
      maxPossible,
      items,
      deterministicVerdict
    };
  }
}
