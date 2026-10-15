import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import { QrCodeAnalyzerService } from '../server/services/phishpilot/qrCodeAnalyzer.js';
import { RiskScorerService } from '../server/services/phishpilot/riskScorer.js';
import { ParsedEmail, HeaderAnalysisResult } from '../server/types/phishpilot.js';

describe('PhishPilot Quishing & Embedded QR Forensics Suite', () => {

  it('should decode a valid QR barcode from a PNG buffer', async () => {
    const testUrl = 'https://login-microsoft-secure.xyz/auth';
    const qrPngBuffer = await QRCode.toBuffer(testUrl, { type: 'png', width: 250 });

    const decoded = QrCodeAnalyzerService.decodeQrFromPngBuffer(qrPngBuffer);
    assert.equal(decoded, testUrl);
  });

  it('should detect and analyze a QR code embedded in an image attachment', async () => {
    const phishingUrl = 'https://update-account-bank.top/login';
    const qrBuffer = await QRCode.toBuffer(phishingUrl, { type: 'png', width: 200 });

    const mockEmail: ParsedEmail = {
      from: 'billing@service-alert.com',
      to: 'analyst@company.com',
      subject: 'Action Required: Scan your MFA QR Code',
      date: new Date(),
      messageId: '<mfa-alert-123@service-alert.com>',
      replyTo: null,
      returnPath: null,
      headersMap: {},
      plainTextBody: 'Please scan the attached QR code to verify your multi-factor credentials.',
      htmlBody: '<p>Please scan the attached QR code to verify your multi-factor credentials.</p>',
      urls: [],
      attachments: [
        {
          filename: 'authenticator_qr.png',
          mimeType: 'image/png',
          size: qrBuffer.length,
          content: qrBuffer
        }
      ]
    };

    const results = await QrCodeAnalyzerService.analyze(mockEmail);
    assert.equal(results.length, 1);
    assert.equal(results[0].source, 'ATTACHMENT');
    assert.equal(results[0].filename, 'authenticator_qr.png');
    assert.equal(results[0].decodedUrl, phishingUrl);
    assert.equal(results[0].domain, 'update-account-bank.top');
    assert.equal(results[0].isMalicious, true); // flagged by heuristic TLD & keyword
    assert.ok(results[0].riskPoints >= 45);
  });

  it('should detect inline base64 QR codes inside HTML email bodies', async () => {
    const targetUrl = 'https://legitimate-portal.internal.company.com/verify';
    const qrBuffer = await QRCode.toBuffer(targetUrl, { type: 'png', width: 180 });
    const b64 = qrBuffer.toString('base64');

    const mockEmail: ParsedEmail = {
      from: 'it@company.com',
      to: 'user@company.com',
      subject: 'Your New 2FA Enrollment',
      date: new Date(),
      messageId: '<2fa-456@company.com>',
      replyTo: null,
      returnPath: null,
      headersMap: {},
      plainTextBody: 'Scan this code.',
      htmlBody: `<p>Enrollment code:</p><img src="data:image/png;base64,${b64}" alt="QR" />`,
      urls: [],
      attachments: []
    };

    const results = await QrCodeAnalyzerService.analyze(mockEmail);
    assert.equal(results.length, 1);
    assert.equal(results[0].source, 'BODY_IMAGE');
    assert.equal(results[0].decodedUrl, targetUrl);
    assert.equal(results[0].domain, 'legitimate-portal.internal.company.com');
  });

  it('should score Quishing vectors and escalate risk breakdown', async () => {
    const phishingUrl = 'https://verify-account.xyz/login';
    const qrBuffer = await QRCode.toBuffer(phishingUrl, { type: 'png' });

    const mockEmail: ParsedEmail = {
      from: 'security@alert.com',
      to: 'victim@company.com',
      subject: 'Urgent Security Update',
      date: new Date(),
      messageId: '<sec-789@alert.com>',
      replyTo: null,
      returnPath: null,
      headersMap: {},
      plainTextBody: 'Urgent login needed.',
      htmlBody: '<p>Urgent login needed.</p>',
      urls: [],
      attachments: [
        {
          filename: 'qr.png',
          mimeType: 'image/png',
          size: qrBuffer.length,
          content: qrBuffer
        }
      ]
    };

    const dummyHeader: HeaderAnalysisResult = {
      spf: { name: 'SPF', result: 'none' },
      dkim: { name: 'DKIM', result: 'none' },
      dmarc: { name: 'DMARC', result: 'none' },
      replyToMismatch: false,
      returnPathMismatch: false,
      receivedHops: 1,
      originIps: [],
      checks: []
    };

    const qrResults = await QrCodeAnalyzerService.analyze(mockEmail);
    const score = RiskScorerService.analyze(mockEmail, dummyHeader, [], [], undefined, qrResults);

    assert.ok(score.items.some(i => i.condition.includes('Quishing') && i.triggered));
    assert.ok(score.totalScore >= 50);
  });
});

