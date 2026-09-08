import { GraphConnectorConfig, UnifiedIncident } from '../types/security';
import { DataNormalizer } from './normalizer';
import { ThreatOversightService } from './threatOversightService';
import { store } from './store';

export class GraphConnector {
  /**
   * Acquires OAuth2 access token for Microsoft Graph via Client Credentials
   */
  public static async getAccessToken(config: GraphConnectorConfig): Promise<string> {
    if (!config.tenantId || !config.clientId || !config.clientSecret) {
      throw new Error('Tenant ID, Client ID, and Client Secret are required.');
    }

    const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: 'https://graph.microsoft.com/.default'
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Graph authentication failed (${res.status}): ${errText}`);
    }

    const data = await res.json() as any;
    return data.access_token;
  }

  /**
   * Tests connection to Microsoft Graph Security API
   */
  public static async testConnection(config: GraphConnectorConfig): Promise<{ success: boolean; message: string }> {
    try {
      const token = await this.getAccessToken(config);
      // Verify token by querying basic org info
      const res = await fetch('https://graph.microsoft.com/v1.0/organization', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error(`Failed to query Graph API: ${res.status} ${res.statusText}`);
      }

      const data = await res.json() as any;
      const orgName = data.value?.[0]?.displayName || 'Verified Tenant';
      return { success: true, message: `Successfully connected to Microsoft 365 Tenant: "${orgName}"` };
    } catch (err: any) {
      return { success: false, message: err.message || 'Connection test failed' };
    }
  }

  /**
   * Syncs M365 Defender incidents, alerts, and Entra sign-ins
   */
  public static async sync(config: GraphConnectorConfig): Promise<{ importedCount: number; errors: string[] }> {
    const token = await this.getAccessToken(config);
    const headers = { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const newIncidents: UnifiedIncident[] = [];
    const errors: string[] = [];

    // 1. Fetch M365 Security Incidents
    try {
      const incRes = await fetch('https://graph.microsoft.com/v1.0/security/incidents?$top=50&$expand=alerts', { headers });
      if (incRes.ok) {
        const incData = await incRes.json() as any;
        if (Array.isArray(incData.value)) {
          for (const rawInc of incData.value) {
            const inc = DataNormalizer.normalizeGraphIncident(rawInc);
            inc.threatAssessment = ThreatOversightService.analyzeIncident(inc);
            newIncidents.push(inc);
          }
        }
      } else {
        errors.push(`Incidents API returned ${incRes.status}`);
      }
    } catch (err: any) {
      errors.push(`Error fetching Defender incidents: ${err.message}`);
    }

    // 2. Fetch M365 Security Alerts
    try {
      const altRes = await fetch('https://graph.microsoft.com/v1.0/security/alerts_v2?$top=50', { headers });
      if (altRes.ok) {
        const altData = await altRes.json() as any;
        if (Array.isArray(altData.value)) {
          for (const rawAlt of altData.value) {
            const alert = DataNormalizer.normalizeGraphAlert(rawAlt);
            // Check if alert already attached to an incident
            const exists = newIncidents.some(i => i.alerts.some(a => a.id === alert.id));
            if (!exists) {
              const standaloneInc: UnifiedIncident = {
                id: `inc-alert-${alert.id}`,
                incidentNumber: alert.id.substring(0, 8),
                title: alert.title,
                description: alert.description,
                provider: alert.provider,
                severity: alert.severity,
                status: 'ACTIVE',
                createdTime: alert.createdTime,
                lastUpdatedTime: alert.createdTime,
                entities: alert.entities,
                mitreTechniques: alert.mitreTechniques,
                alerts: [alert],
                rawPayload: rawAlt
              };
              standaloneInc.threatAssessment = ThreatOversightService.analyzeIncident(standaloneInc);
              newIncidents.push(standaloneInc);
            }
          }
        }
      }
    } catch (err: any) {
      errors.push(`Error fetching Defender alerts: ${err.message}`);
    }

    // 3. Fetch Entra ID Risky Sign-ins
    try {
      const signinRes = await fetch('https://graph.microsoft.com/v1.0/auditLogs/signIns?$top=50&$filter=riskLevelAggregated ne \'none\'', { headers });
      if (signinRes.ok) {
        const signinData = await signinRes.json() as any;
        if (Array.isArray(signinData.value)) {
          for (const rawSign of signinData.value) {
            const inc = DataNormalizer.normalizeEntraSignIn(rawSign);
            inc.threatAssessment = ThreatOversightService.analyzeIncident(inc);
            newIncidents.push(inc);
          }
        }
      }
    } catch (err: any) {
      // Entra signin logs might need AuditLog.Read.All permission
      errors.push(`Notice: Could not query sign-in logs (${err.message})`);
    }

    // Save to store
    if (newIncidents.length > 0) {
      store.batchAddOrUpdate(newIncidents);
    }

    // Update connector status
    store.updateConfig({
      graph: {
        ...config,
        lastSync: new Date().toISOString(),
        status: newIncidents.length > 0 ? 'CONNECTED' : (errors.length > 0 ? 'ERROR' : 'CONNECTED'),
        statusMessage: `Synced ${newIncidents.length} incidents from Microsoft Graph.`
      }
    });

    return { importedCount: newIncidents.length, errors };
  }
}

