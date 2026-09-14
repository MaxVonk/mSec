import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AuthService } from '../server/services/authService.js';
import { MicrosoftSecurityLookupService } from '../server/services/phishpilot/microsoftSecurityLookup.js';
import { ParsedEmail } from '../server/types/phishpilot.js';

describe('Microsoft Authentication & Security Lookups', () => {
  it('should generate valid Microsoft OAuth2 PKCE URL with correct parameters', () => {
    process.env.GRAPH_CLIENT_ID = '00000000-0000-0000-0000-000000000000';
    const origin = 'http://localhost:3310';
    const { url, state } = AuthService.generateAuthUrl(origin);

    assert.ok(url.startsWith('https://login.microsoftonline.com/'));
    assert.ok(url.includes('response_type=code'));
    assert.ok(url.includes('code_challenge='));
    assert.ok(url.includes('code_challenge_method=S256'));
    assert.ok(url.includes(`state=${state}`));
    assert.ok(url.includes('redirect_uri=http%3A%2F%2Flocalhost%3A3310%2Fapi%2Fauth%2Fcallback'));
  });

  it('should automatically prepend https scheme to bare domain for valid absolute redirect_uri', () => {
    delete process.env.AUTH_REDIRECT_URI;
    const uri = AuthService.resolveRedirectUri('msec.vermiculus.work');
    assert.strictEqual(uri, 'https://msec.vermiculus.work/api/auth/callback');

    const uriWithSlash = AuthService.resolveRedirectUri('msec.vermiculus.work/');
    assert.strictEqual(uriWithSlash, 'https://msec.vermiculus.work/api/auth/callback');

    process.env.AUTH_REDIRECT_URI = 'https://msec.vermiculus.work';
    const uriFromEnv = AuthService.resolveRedirectUri();
    assert.strictEqual(uriFromEnv, 'https://msec.vermiculus.work/api/auth/callback');
    delete process.env.AUTH_REDIRECT_URI;

  });

  it('should provide default unauthenticated guest session', () => {
    const session = AuthService.getSession(undefined);
    assert.strictEqual(session.isAuthenticated, false);
    assert.strictEqual(session.id, 'guest');
  });

  it('should detect Exchange Online SCL headers in Microsoft security lookup', async () => {
    const mockEmail: ParsedEmail = {
      from: 'Spoofed Executive <ceo@fakecorp.xyz>',
      to: 'victim@company.com',
      subject: 'URGENT: Wire Transfer',
      date: new Date(),
      messageId: '<123@fakecorp.xyz>',
      replyTo: null,
      returnPath: null,
      headersMap: {
        'x-ms-exchange-organization-scl': '7',
        'x-ms-exchange-organization-bcl': '2',
        'x-ms-exchange-organization-messagedirectionality': 'Inbound'
      },
      plainTextBody: 'Please wire funds.',
      htmlBody: '<p>Please wire funds.</p>',
      urls: [],
      attachments: []
    };

    const enrichment = await MicrosoftSecurityLookupService.enrich(mockEmail);
    assert.ok(enrichment.eopDeliveryStatus);
    assert.strictEqual(enrichment.eopDeliveryStatus.spamConfidenceLevel, 7);
    assert.strictEqual(enrichment.eopDeliveryStatus.antispamDirection, 'Inbound');
    assert.ok(enrichment.eopDeliveryStatus.verdictDescription?.includes('High Confidence'));
  });
});
