import { SentinelConnectorConfig, UnifiedIncident } from '../types/security';
import { DataNormalizer } from './normalizer';
import { ThreatOversightService } from './threatOversightService';
import { store } from './store';

export class SentinelConnector {
  /**
   * Acquires ARM token for Azure Management
   */
  public static async getArmToken(config: SentinelConnectorConfig): Promise<string> {
    const tenantId = config.tenantId?.trim();
    const clientId = config.clientId?.trim();
    const clientSecret = config.clientSecret?.trim();

    if (!tenantId || !clientId || !clientSecret) {
      throw new Error('Tenant ID, Client ID, and Client Secret are required for Sentinel.');
    }

    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://management.azure.com/.default'
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Sentinel Azure ARM authentication failed (${res.status}): ${errText}`);
    }

    const data = await res.json() as any;
    return data.access_token;
  }

  /**
   * Tests Sentinel connection and workspace access
   */
  public static async testConnection(config: SentinelConnectorConfig): Promise<{ success: boolean; message: string }> {
    try {
      const token = await this.getArmToken(config);
      const subId = config.subscriptionId?.trim();
      const rg = config.resourceGroup?.trim();
      const ws = config.workspaceName?.trim();

      if (!subId || !rg || !ws) {
        throw new Error('Azure Subscription ID, Resource Group Name, and Workspace Name are all required.');
      }

      const url = `https://management.azure.com/subscriptions/${subId}/resourceGroups/${rg}/providers/Microsoft.OperationalInsights/workspaces/${ws}/providers/Microsoft.SecurityInsights/incidents?api-version=2023-11-01&$top=1`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        let detail = res.statusText;
        try {
          const errData = await res.json() as any;
          detail = errData?.error?.message || errData?.message || JSON.stringify(errData);
        } catch {
          detail = await res.text();
        }

        if (res.status === 403) {
          throw new Error(
            `Access Denied (403): Azure RBAC role missing. Assign 'Microsoft Sentinel Reader' to App (${config.clientId}) on workspace '${ws}' in Azure. Details: ${detail}`
          );
        }
        throw new Error(`Failed to access Sentinel incidents (${res.status}): ${detail}`);
      }

      return { success: true, message: `Successfully connected to Microsoft Sentinel Workspace: "${ws}"` };
    } catch (err: any) {
      return { success: false, message: err.message || 'Sentinel connection test failed' };
    }
  }

  /**
   * Syncs incidents from Microsoft Sentinel workspace
   */
  public static async sync(config: SentinelConnectorConfig): Promise<{ importedCount: number; errors: string[] }> {
    const token = await this.getArmToken(config);
    const subId = config.subscriptionId?.trim();
    const rg = config.resourceGroup?.trim();
    const ws = config.workspaceName?.trim();

    if (!subId || !rg || !ws) {
      throw new Error('Azure Subscription ID, Resource Group Name, and Workspace Name are all required.');
    }

    const url = `https://management.azure.com/subscriptions/${subId}/resourceGroups/${rg}/providers/Microsoft.OperationalInsights/workspaces/${ws}/providers/Microsoft.SecurityInsights/incidents?api-version=2023-11-01&$top=50`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      let detail = res.statusText;
      try {
        const errData = await res.json() as any;
        detail = errData?.error?.message || errData?.message || JSON.stringify(errData);
      } catch {
        detail = await res.text();
      }

      if (res.status === 403) {
        throw new Error(
          `Access Denied (403): Azure RBAC role missing. Assign 'Microsoft Sentinel Reader' to App (${config.clientId}) on workspace scope. Details: ${detail}`
        );
      }
      throw new Error(`Failed to fetch Sentinel incidents (${res.status}): ${detail}`);
    }

    const data = await res.json() as any;
    const newIncidents: UnifiedIncident[] = [];
    const errors: string[] = [];

    if (Array.isArray(data.value)) {
      for (const raw of data.value) {
        try {
          const inc = DataNormalizer.normalizeSentinelIncident(raw);
          inc.threatAssessment = ThreatOversightService.analyzeIncident(inc);
          newIncidents.push(inc);
        } catch (err: any) {
          errors.push(`Error parsing Sentinel incident: ${err.message}`);
        }
      }
    }

    if (newIncidents.length > 0) {
      store.batchAddOrUpdate(newIncidents);
    }

    store.updateConfig({
      sentinel: {
        ...config,
        lastSync: new Date().toISOString(),
        status: newIncidents.length > 0 ? 'CONNECTED' : 'IDLE',
        statusMessage: `Synced ${newIncidents.length} incidents from Microsoft Sentinel.`
      }
    });

    return { importedCount: newIncidents.length, errors };
  }
}

