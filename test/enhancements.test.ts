import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

import { HomoglyphDetector } from '../server/services/phishpilot/homoglyphDetector.js';
import { CoachingService } from '../server/services/phishpilot/coachingService.js';
import { RemediationService } from '../server/services/phishpilot/remediationService.js';
import { ThreatCorrelationService } from '../server/services/phishpilot/correlationService.js';
import { ExportService } from '../server/services/phishpilot/exportService.js';
import { PhishPilotStore } from '../server/services/phishpilot/phishpilotStore.js';
import { store } from '../server/services/store.js';
import { PhishPilotReport } from '../server/types/phishpilot.js';
import { UnifiedIncident } from '../server/types/security.js';

describe('PhishPilot Comprehensive Enhancements Suite', () => {

  // Sample test report
  const sampleReport: PhishPilotReport = {
    id: 'test-rpt-enhancement-001',
    timestamp: new Date().toISOString(),
    verdict: 'PHISHING',
    riskScore: 85,
    confidence: 0.95,
    emailSummary: {
      from: 'security@micr0soft-update.com',
      to: 'target.employee@company.com',
      subject: 'Critical: Immediate Account Verification Required',
      date: new Date().toISOString(),
      replyTo: 'phisher@evil-domain.com',
      returnPath: 'bounce@evil-domain.com',
      bodyPreview: 'Please verify your credentials immediately at the link below.',
      urlCount: 1,
      attachmentCount: 1
    },
    headerAnalysis: {
      spf: { name: 'SPF', result: 'fail', detail: 'SPF softfail' },
      dkim: { name: 'DKIM', result: 'fail', detail: 'No DKIM signature' },
      dmarc: { name: 'DMARC', result: 'fail', detail: 'DMARC failed' },
      replyToMismatch: true,
      returnPathMismatch: true,
      receivedHops: 3,
      originIps: ['198.51.100.42']
    },
    urlAnalysis: [
      {
        url: 'http://micr0soft-update.com/login',
        domain: 'micr0soft-update.com',
        domainAgeDays: 2,
        isMalicious: true,
        isDeceptive: true,
        reputationSources: [{ source: 'VirusTotal', result: 'malicious' }],
        homoglyph: {
          isSuspicious: true,
          impersonatedBrand: 'Microsoft',
          matchedTarget: 'microsoft.com',
          similarityScore: 0.85,
          explanation: 'Detected typosquatting / leetspeak mimic of brand "Microsoft"'
        }
      }
    ],
    attachmentAnalysis: [
      {
        filename: 'invoice_malicious.exe',
        mimeType: 'application/x-msdownload',
        size: 45000,
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        md5: 'd41d8cd98f00b204e9800998ecf8427e',
        isSuspiciousExtension: true,
        isPasswordProtected: false,
        isMalicious: true,
        reputationSources: [{ source: 'VirusTotal', result: 'malicious' }]
      }
    ],
    aiClassification: {
      classification: 'PHISHING',
      confidence: 0.95,
      keyFindings: ['Brand impersonation', 'Urgent credential harvesting prompt'],
      indicators: ['micr0soft-update.com', 'invoice_malicious.exe'],
      recommendedActions: ['Block sender', 'Purge from all mailboxes', 'Revoke user credentials'],
      modelUsed: 'Azure OpenAI GPT-4o'
    },
    riskBreakdown: {
      totalScore: 85,
      maxPossible: 100,
      deterministicVerdict: 'PHISHING',
      items: [
        { condition: 'SPF / DMARC Authentication Failures', points: 30, triggered: true },
        { condition: 'Homoglyph / Brand Typosquatting Deception', points: 25, triggered: true }
      ]
    },
    recommendedActions: ['Purge message', 'Block sender in TABL', 'Revoke target user sessions']
  };

  // 1. Homoglyph & Brand Impersonation Engine Tests
  describe('Homoglyph & Brand Impersonation Engine', () => {
    it('should detect Cyrillic/Greek Unicode confusables in spoofed domains', () => {
      // 'а' is Cyrillic \u0430
      const cyrillicPaypal = 'p\u0430yp\u0430l.com';
      const result = HomoglyphDetector.detect(cyrillicPaypal);
      assert.strictEqual(result.isSuspicious, true);
      assert.ok(result.explanation && result.explanation.includes('Confusable'));
    });

    it('should detect typosquatting and leetspeak substitution for monitored brands', () => {
      const typosquatMicrosoft = 'micr0soft-login.com';
      const result = HomoglyphDetector.detect(typosquatMicrosoft);
      assert.strictEqual(result.isSuspicious, true);
      assert.strictEqual(result.impersonatedBrand?.toLowerCase(), 'microsoft');
    });

    it('should not flag benign legitimate domains', () => {
      const cleanDomain = 'github.com';
      const result = HomoglyphDetector.detect(cleanDomain);
      assert.strictEqual(result.isSuspicious, false);
    });
  });

  // 2. Automated Remediation & Containment Tests
  describe('Automated Remediation & Containment', () => {
    it('should execute and log tenant-wide mailbox purge', async () => {
      await PhishPilotStore.save(sampleReport);

      const log = await RemediationService.purgeTenantMailboxes(sampleReport.id, 'SOC Lead Analyst');
      assert.strictEqual(log.action, 'PURGE_TENANT');
      assert.ok(log.status === 'SUCCESS' || log.status === 'SIMULATED');
      assert.ok(log.details.length > 0);

      const updated = await PhishPilotStore.getById(sampleReport.id);
      assert.ok(updated?.remediationLogs && updated.remediationLogs.length > 0);
      assert.strictEqual(updated.remediationLogs[0].action, 'PURGE_TENANT');
    });

    it('should execute and log Tenant Allow/Block List (TABL) block', async () => {
      const log = await RemediationService.blockSenderOrDomain(sampleReport.id, 'domain', 'SOC Lead Analyst');
      assert.strictEqual(log.action, 'BLOCK_SENDER');
      assert.ok(log.status === 'SUCCESS' || log.status === 'SIMULATED');
      assert.ok(log.target.includes('micr0soft-update.com'));
    });

    it('should execute and log recipient Entra ID session revocation', async () => {
      const log = await RemediationService.revokeUserSessions(sampleReport.id, 'SOC Lead Analyst');
      assert.strictEqual(log.action, 'REVOKE_SESSION');
      assert.ok(log.status === 'SUCCESS' || log.status === 'SIMULATED');
      assert.strictEqual(log.target, 'target.employee@company.com');
    });
  });

  // 3. Automated User Feedback & Coaching Loop Tests
  describe('Automated User Feedback & Coaching Loop', () => {
    it('should generate responsive educational HTML for phishing email reports', () => {
      const feedback = CoachingService.generateCoachingHtml(sampleReport, 'target.employee@company.com');
      assert.ok(feedback.subject.includes('[PhishPilot Analysis]'));
      assert.ok(feedback.html.includes('PhishPilot SecOps'));
      assert.ok(feedback.html.includes('PHISHING'));
      assert.ok(feedback.html.includes('85/100'));
      assert.ok(feedback.html.includes('Critical: Immediate Account Verification Required'));
    });

    it('should generate positive reinforcement coaching for legitimate email reports', () => {
      const legitReport: PhishPilotReport = {
        ...sampleReport,
        id: 'test-legit-001',
        verdict: 'LEGITIMATE',
        riskScore: 5
      };
      const feedback = CoachingService.generateCoachingHtml(legitReport, 'target.employee@company.com');
      assert.ok(feedback.subject.includes('Verified Safe'));
      assert.ok(feedback.html.includes('LEGITIMATE'));
    });
  });

  // 4. Cross-Platform Threat Correlation & Incident Escalation
  describe('Cross-Platform Threat Correlation & Escalation', () => {
    it('should correlate email IOCs with active mSec SIEM incidents', () => {
      const mockIncident: UnifiedIncident = {
        id: 'INC-MOCK-CORRELATION-01',
        incidentNumber: 9991,
        title: 'Suspicious Command Execution from 198.51.100.42',
        description: 'Endpoint beaconing observed from attacker IP.',
        provider: 'DEFENDER_ENDPOINT',
        severity: 'HIGH',
        status: 'ACTIVE',
        createdTime: new Date().toISOString(),
        lastUpdatedTime: new Date().toISOString(),
        entities: [
          { id: 'e1', type: 'IP', value: '198.51.100.42' }
        ],
        alerts: [],
        mitreTechniques: [],
        rawPayload: {}
      };
      store.addOrUpdate(mockIncident);

      const correlations = ThreatCorrelationService.findCorrelations(sampleReport);
      assert.ok(correlations.length > 0);
      const ipMatch = correlations.find(c => c.matchType === 'IP');
      assert.ok(ipMatch);
      assert.strictEqual(ipMatch.matchedEntity, '198.51.100.42');
      assert.strictEqual(ipMatch.incidentId, 'INC-MOCK-CORRELATION-01');
    });

    it('should escalate PhishPilotReport into a first-class UnifiedIncident', () => {
      const escalated = ThreatCorrelationService.escalateToIncident(sampleReport);
      assert.ok(escalated.id.startsWith('INC-PHISH-'));
      assert.strictEqual(escalated.severity, 'HIGH');
      assert.strictEqual(escalated.provider, 'M365_DEFENDER');
      assert.ok(escalated.entities.length >= 3);
      assert.ok(escalated.alerts.length >= 1);

      const saved = store.getById(escalated.id);
      assert.ok(saved);
      assert.strictEqual(saved.id, escalated.id);
    });
  });

  // 5. Outlook 365 Add-in Assets Tests
  describe('Microsoft Outlook 365 Web Add-in Assets', () => {
    it('should have valid Office.js manifest.xml file', () => {
      const manifestPath = path.resolve(process.cwd(), 'public/outlook/manifest.xml');
      assert.ok(fs.existsSync(manifestPath), 'manifest.xml should exist in public/outlook');

      const xml = fs.readFileSync(manifestPath, 'utf8');
      assert.ok(xml.includes('<OfficeApp'), 'Must contain OfficeApp root element');
      assert.ok(xml.includes('Host Name="Mailbox"'), 'Must target Mailbox host');
      assert.ok(xml.includes('PhishPilot Security Reporter'), 'Must include PhishPilot DisplayName');
    });

    it('should have valid taskpane.html with Office.js integration', () => {
      const taskpanePath = path.resolve(process.cwd(), 'public/outlook/taskpane.html');
      assert.ok(fs.existsSync(taskpanePath), 'taskpane.html should exist in public/outlook');

      const html = fs.readFileSync(taskpanePath, 'utf8');
      assert.ok(html.includes('appsforoffice.microsoft.com/lib/1/hosted/office.js'), 'Must import Office.js');
      assert.ok(html.includes('Office.onReady'), 'Must call Office.onReady');
      assert.ok(html.includes('/api/phishpilot/analyze'), 'Must call PhishPilot analysis endpoint');
    });
  });

  // 6. Forensic Reporting & STIX 2.1 Export Tests
  describe('Forensic Reporting & STIX 2.1 Export', () => {
    it('should generate valid formatted JSON export', () => {
      const json: any = ExportService.generateJsonReport(sampleReport);
      assert.strictEqual(json.schemaVersion, '1.0.0');
      assert.strictEqual(json.generator, 'PhishPilot Threat Analysis Platform');
      assert.strictEqual(json.report.id, sampleReport.id);
      assert.strictEqual(json.report.verdict, 'PHISHING');
      assert.ok(json.report.urls.length > 0);
      assert.ok(json.report.attachments.length > 0);
      assert.ok(json.report.authentication.originIps.includes('198.51.100.42'));
    });

    it('should generate OASIS STIX 2.1 compliant threat bundle', () => {
      const bundle: any = ExportService.generateStixBundle(sampleReport);
      assert.strictEqual(bundle.type, 'bundle');
      assert.ok(bundle.id.startsWith('bundle--'));
      assert.ok(Array.isArray(bundle.objects));

      const reportSdo = bundle.objects.find((o: any) => o.type === 'report');
      assert.ok(reportSdo, 'STIX bundle must contain a report SDO');
      assert.strictEqual(reportSdo.spec_version, '2.1');

      const indicators = bundle.objects.filter((o: any) => o.type === 'indicator');
      assert.ok(indicators.length >= 2, 'STIX bundle must contain indicators for URL, Hash, or IP');

      const urlIndicator = indicators.find((i: any) => i.pattern.includes('url:value'));
      assert.ok(urlIndicator);

      const fileIndicator = indicators.find((i: any) => i.pattern.includes('file:hashes'));
      assert.ok(fileIndicator);
    });
  });

});

