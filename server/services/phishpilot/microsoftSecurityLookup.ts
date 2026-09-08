import { ParsedEmail, MicrosoftSecurityEnrichment } from '../../types/phishpilot.js';
import { GraphConnector } from '../graphConnector.js';
import { store } from '../store.js';

export class MicrosoftSecurityLookupService {
  /**
   * Cross-references email attributes with Microsoft Entra ID & Microsoft Defender services
   */
  public static async enrich(parsed: ParsedEmail): Promise<MicrosoftSecurityEnrichment> {
    const enrichment: MicrosoftSecurityEnrichment = {};

    // 1. Evaluate Exchange Online Protection (EOP) Spam Confidence Level (SCL) from headers
    const sclHeader = parsed.headersMap['x-ms-exchange-organization-scl'];
    const bclHeader = parsed.headersMap['x-ms-exchange-organization-bcl'];
    const directionHeader = parsed.headersMap['x-ms-exchange-organization-messagedirectionality'];

    if (sclHeader !== undefined) {
      const scl = parseInt(sclHeader, 10);
      const bcl = bclHeader ? parseInt(bclHeader, 10) : undefined;
      let verdictDesc = 'Delivered (Clean)';
      if (scl === -1) verdictDesc = 'Internal safe sender / Bypass';
      else if (scl >= 5 && scl <= 6) verdictDesc = 'Suspected Spam / Phish';
      else if (scl >= 7) verdictDesc = 'High Confidence Phishing / Quarantine';

      enrichment.eopDeliveryStatus = {
        spamConfidenceLevel: isNaN(scl) ? undefined : scl,
        bulkConfidenceLevel: bcl !== undefined && !isNaN(bcl) ? bcl : undefined,
        antispamDirection: (directionHeader as any) || 'Inbound',
        verdictDescription: verdictDesc
      };
    }

    // 2. Query Microsoft Graph for Entra ID Sender Identity & User Risk (if Graph is configured)
    const graphConfig = store.getConfig().graph;
    if (graphConfig.tenantId && graphConfig.clientId && graphConfig.clientSecret) {
      try {
        const token = await GraphConnector.getAccessToken(graphConfig);
        const headers = { Authorization: `Bearer ${token}` };

        // Extract sender email address
        const emailMatch = parsed.from.match(/<([^>]+)>/) || parsed.from.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        const senderEmail = emailMatch ? emailMatch[1].toLowerCase() : null;

        // Check if sender claims to be a VIP / Executive in display name
        const executiveKeywords = /(ceo|cfo|cto|president|director|executive|payroll|finance|human resources|hr dept)/i;
        const isVipClaim = executiveKeywords.test(parsed.from);

        if (senderEmail) {
          const userUrl = `https://graph.microsoft.com/v1.0/users?$filter=mail eq '${encodeURIComponent(senderEmail)}' or userPrincipalName eq '${encodeURIComponent(senderEmail)}'&$select=id,displayName,userPrincipalName,accountEnabled,jobTitle`;
          const userRes = await fetch(userUrl, { headers, signal: AbortSignal.timeout(4000) });

          if (userRes.ok) {
            const userData = await userRes.json() as any;
            const users = userData.value || [];

            if (users.length > 0) {
              const matchedUser = users[0];
              enrichment.senderEntraStatus = {
                isInternalUser: true,
                userPrincipalName: matchedUser.userPrincipalName,
                displayName: matchedUser.displayName,
                accountEnabled: matchedUser.accountEnabled,
                isVipOrExecutive: executiveKeywords.test(matchedUser.jobTitle || '') || executiveKeywords.test(matchedUser.displayName || ''),
                impersonationDetected: false,
                riskLevel: 'none',
                riskDetail: 'Verified internal employee in Microsoft Entra ID'
              };
            } else {
              // Sender is NOT in directory, but uses executive/internal claims
              const isExternal = !senderEmail.endsWith(graphConfig.tenantId.toLowerCase());
              const impersonationDetected = isVipClaim && isExternal;

              enrichment.senderEntraStatus = {
                isInternalUser: false,
                userPrincipalName: senderEmail,
                displayName: parsed.from,
                isVipOrExecutive: isVipClaim,
                impersonationDetected,
                riskLevel: impersonationDetected ? 'high' : 'none',
                riskDetail: impersonationDetected
                  ? 'CRITICAL: External sender claims executive/VIP authority without matching Entra ID identity!'
                  : 'External sender; not an internal Entra ID account'
              };
            }
          }
        }

        // 3. Query Microsoft Defender Threat Intelligence (MDTI) for extracted host reputation
        if (parsed.urls.length > 0) {
          try {
            const firstUrl = new URL(parsed.urls[0]);
            const targetHost = firstUrl.hostname;
            const mdtiUrl = `https://graph.microsoft.com/v1.0/security/threatIntelligence/hosts/${encodeURIComponent(targetHost)}`;
            const tiRes = await fetch(mdtiUrl, { headers, signal: AbortSignal.timeout(3000) });

            if (tiRes.ok) {
              const tiData = await tiRes.json() as any;
              enrichment.defenderTiResults = {
                checkedDomain: targetHost,
                reputationScore: tiData.reputationScore || 0,
                verdict: tiData.reputationScore > 50 ? 'malicious' : (tiData.reputationScore > 20 ? 'suspicious' : 'clean'),
                tags: tiData.tags || []
              };
            }
          } catch {
            // MDTI endpoint requires specific licensing / permissions; gracefully skip if unavailable
          }
        }
      } catch (err) {
        // Microsoft Graph lookup failed gracefully
      }
    }

    return enrichment;
  }
}
