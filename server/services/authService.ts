import crypto from 'crypto';
import { UserSessionProfile } from '../types/phishpilot.js';
import { store } from './store.js';

interface OAuthState {
  codeVerifier: string;
  createdAt: number;
}

export class AuthService {
  private static stateStore = new Map<string, OAuthState>();
  private static sessions = new Map<string, UserSessionProfile>();

  /**
   * Generates Microsoft OAuth 2.0 authorization URL with PKCE
   */
  public static generateAuthUrl(origin: string): { url: string; state: string } {
    const graphConfig = store.getConfig().graph;
    const tenantId = graphConfig.tenantId || process.env.GRAPH_TENANT_ID || 'common';
    const clientId = graphConfig.clientId || process.env.GRAPH_CLIENT_ID;

    if (!clientId) {
      throw new Error('Microsoft Client ID not configured. Please add it in Connectors or environment.');
    }

    // PKCE parameters
    const state = crypto.randomBytes(16).toString('hex');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    this.stateStore.set(state, { codeVerifier, createdAt: Date.now() });

    // Clean up old states (>15 mins)
    for (const [key, val] of this.stateStore.entries()) {
      if (Date.now() - val.createdAt > 15 * 60 * 1000) {
        this.stateStore.delete(key);
      }
    }

    const redirectUri = `${origin.replace(/\/+$/, '')}/api/auth/callback`;
    const scopes = ['openid', 'profile', 'email', 'User.Read', 'offline_access'];

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: scopes.join(' '),
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
    return { url, state };
  }

  /**
   * Handles OAuth2 redirect callback and exchanges code for user session
   */
  public static async handleCallback(code: string, state: string, origin: string): Promise<{ sessionId: string; user: UserSessionProfile }> {
    const oauthState = this.stateStore.get(state);
    if (!oauthState) {
      throw new Error('Invalid or expired OAuth state parameter.');
    }
    this.stateStore.delete(state);

    const graphConfig = store.getConfig().graph;
    const tenantId = graphConfig.tenantId || process.env.GRAPH_TENANT_ID || 'common';
    const clientId = graphConfig.clientId || process.env.GRAPH_CLIENT_ID || '';
    const clientSecret = graphConfig.clientSecret || process.env.GRAPH_CLIENT_SECRET || '';

    const redirectUri = `${origin.replace(/\/+$/, '')}/api/auth/callback`;

    const bodyParams = new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      code_verifier: oauthState.codeVerifier
    });

    if (clientSecret) {
      bodyParams.append('client_secret', clientSecret);
    }

    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyParams.toString()
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`Microsoft token exchange failed (${tokenRes.status}): ${errText}`);
    }

    const tokenData = await tokenRes.json() as any;
    const accessToken = tokenData.access_token;

    // Fetch user profile from Graph /v1.0/me
    const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    let meData: any = {};
    if (meRes.ok) {
      meData = await meRes.json();
    }

    const sessionId = crypto.randomUUID();
    const user: UserSessionProfile = {
      id: meData.id || crypto.randomUUID(),
      displayName: meData.displayName || meData.userPrincipalName || 'Security Analyst',
      email: meData.mail || meData.userPrincipalName || 'analyst@company.com',
      jobTitle: meData.jobTitle || 'SOC Analyst',
      isAuthenticated: true,
      tenantId: tenantId
    };

    this.sessions.set(sessionId, user);
    return { sessionId, user };
  }

  public static getSession(sessionId?: string): UserSessionProfile {
    if (sessionId && this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }
    // Return unauthenticated guest profile
    return {
      id: 'guest',
      displayName: 'SecOps Analyst (Guest)',
      email: 'guest@local',
      isAuthenticated: false
    };
  }

  public static destroySession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}

