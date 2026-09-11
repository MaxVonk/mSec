import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { EmailParserService } from '../server/services/phishpilot/emailParser.js';
import { HeaderAnalyzerService } from '../server/services/phishpilot/headerAnalyzer.js';
import { UrlAnalyzerService } from '../server/services/phishpilot/urlAnalyzer.js';
import { AttachmentAnalyzerService } from '../server/services/phishpilot/attachmentAnalyzer.js';
import { RiskScorerService } from '../server/services/phishpilot/riskScorer.js';
import { ReportGeneratorService } from '../server/services/phishpilot/reportGenerator.js';
import { PhishPilotStore } from '../server/services/phishpilot/phishpilotStore.js';
import { MailboxPollerService } from '../server/services/phishpilot/mailboxPoller.js';

describe('PhishPilot Email Threat Analysis Suite', () => {
  const phishingEmlPath = path.resolve('samples/sample_phishing.eml');
  const legitEmlPath = path.resolve('samples/sample_legitimate.eml');

  it('should parse phishing .eml file correctly', async () => {
    const content = fs.readFileSync(phishingEmlPath);
    const parsed = await EmailParserService.parse(content);

    assert.ok(parsed.from.includes('admin@it-secure-dept.com'));
    assert.strictEqual(parsed.subject, 'URGENT: Verify your account immediately');
    assert.ok(parsed.replyTo?.includes('attacker@hacker-mail.ru'));
    assert.ok(parsed.urls.length > 0);
    assert.ok(parsed.urls.some(u => u.includes('account-verify.xyz')));
  });

  it('should detect authentication failures and Reply-To mismatch', async () => {
    const content = fs.readFileSync(phishingEmlPath);
    const parsed = await EmailParserService.parse(content);
    const headers = await HeaderAnalyzerService.analyze(parsed);

    assert.strictEqual(headers.spf.result, 'fail');
    assert.strictEqual(headers.dmarc.result, 'fail');
    assert.strictEqual(headers.replyToMismatch, true);
    assert.strictEqual(headers.returnPathMismatch, true);
  });

  it('should perform live DNS resolution for legitimate domain', async () => {
    const spfRecord = await HeaderAnalyzerService.resolveLiveSpf('microsoft.com');
    assert.ok(spfRecord !== null, 'Expected live SPF record for microsoft.com');
    assert.ok(spfRecord.includes('v=spf1'), 'Expected v=spf1 in TXT record');

    const dmarcRecord = await HeaderAnalyzerService.resolveLiveDmarc('microsoft.com');
    assert.ok(dmarcRecord !== null, 'Expected live DMARC record for microsoft.com');
    assert.ok(dmarcRecord.includes('v=DMARC1'), 'Expected v=DMARC1 in TXT record');
  });

  it('should score phishing email and classify as PHISHING', async () => {
    const content = fs.readFileSync(phishingEmlPath);
    const parsed = await EmailParserService.parse(content);
    const headers = await HeaderAnalyzerService.analyze(parsed);
    const urls = await UrlAnalyzerService.analyze(parsed);
    const attachments = await AttachmentAnalyzerService.analyze(parsed);

    const breakdown = RiskScorerService.analyze(parsed, headers, urls, attachments);

    assert.strictEqual(breakdown.deterministicVerdict, 'PHISHING');
    assert.ok(breakdown.totalScore >= 61, `Expected totalScore >= 61, got ${breakdown.totalScore}`);
    
    // Check that key conditions triggered
    assert.ok(breakdown.items.some(i => i.condition.includes('SPF') && i.triggered));
    assert.ok(breakdown.items.some(i => i.condition.includes('DMARC') && i.triggered));
    assert.ok(breakdown.items.some(i => i.condition.includes('Reply-To') && i.triggered));
    assert.ok(breakdown.items.some(i => i.condition.includes('Urgent') && i.triggered));
    assert.ok(breakdown.items.some(i => i.condition.includes('Credential') && i.triggered));
  });

  it('should score legitimate email and classify as LEGITIMATE', async () => {
    const content = fs.readFileSync(legitEmlPath);
    const parsed = await EmailParserService.parse(content);
    const headers = await HeaderAnalyzerService.analyze(parsed);
    const urls = await UrlAnalyzerService.analyze(parsed);
    const attachments = await AttachmentAnalyzerService.analyze(parsed);

    const breakdown = RiskScorerService.analyze(parsed, headers, urls, attachments);

    assert.strictEqual(breakdown.deterministicVerdict, 'LEGITIMATE');
    assert.ok(breakdown.totalScore <= 30, `Expected totalScore <= 30, got ${breakdown.totalScore}`);
    assert.strictEqual(headers.spf.result, 'pass');
    assert.strictEqual(headers.dmarc.result, 'pass');
    assert.strictEqual(headers.replyToMismatch, false);
  });

  it('should generate a complete PhishPilotReport and persist to store', async () => {
    const content = fs.readFileSync(phishingEmlPath);
    const report = await ReportGeneratorService.generateReport(content);

    assert.ok(report.id);
    assert.strictEqual(report.verdict, 'PHISHING');
    assert.ok(report.riskScore >= 61);
    assert.ok(report.confidence > 0);
    assert.ok(report.emailSummary.subject);
    assert.ok(report.recommendedActions.length > 0);

    // Verify stored
    const retrieved = await PhishPilotStore.getById(report.id);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.id, report.id);

    // Verify stats
    const stats = await PhishPilotStore.getStats();
    assert.ok(stats.totalAnalyzed >= 1);
    assert.ok(stats.verdictCounts.PHISHING >= 1);
  });

  it('should manage mailbox poller configuration', async () => {
    const config = MailboxPollerService.getConfig();
    assert.ok(config);
    assert.strictEqual(typeof config.enabled, 'boolean');

    const updated = await MailboxPollerService.updateConfig({ mailbox: 'test-phish@example.com' });
    assert.strictEqual(updated.mailbox, 'test-phish@example.com');
  });

  it('should detect and unwrap inline forwarded emails from internal reporters', async () => {
    const inlineForwardRaw = [
      'From: Max <max@vermiculus.se>',
      'To: phish-reports@vermiculus.se',
      'Subject: FW: Action Required: Reset Password Now',
      'Date: Fri, 11 Sep 2026 10:00:00 +0200',
      'Authentication-Results: spf=pass dkim=pass',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      'Hey SOC team, please check this email.',
      '',
      '-----Original Message-----',
      'From: Security Alert <phisher@evil-bank-login.xyz>',
      'Sent: Friday, September 11, 2026 9:55 AM',
      'To: Max <max@vermiculus.se>',
      'Subject: Action Required: Reset Password Now',
      '',
      'Your account is compromised. Click here: http://evil-bank-login.xyz/login to reset.'
    ].join('\r\n');

    const parsed = await EmailParserService.parse(inlineForwardRaw);
    assert.strictEqual(parsed.isForwarded, true);
    assert.ok(parsed.from.includes('phisher@evil-bank-login.xyz'));
    assert.ok(parsed.forwardedBy?.includes('max@vermiculus.se'));
    assert.strictEqual(parsed.subject, 'Action Required: Reset Password Now');
    assert.ok(parsed.urls.some(u => u.includes('evil-bank-login.xyz')));

    const headers = await HeaderAnalyzerService.analyze(parsed);
    // Should NOT credit internal vermiculus.se SPF pass to the evil external domain
    assert.notStrictEqual(headers.spf.detail, 'Sender Policy Framework gateway status: pass');
  });
});
