import fs from 'fs';
import path from 'path';
import { 
  UnifiedIncident, 
  IncidentSeverity, 
  IncidentStatus, 
  IngestionStats, 
  GraphConnectorConfig, 
  SentinelConnectorConfig 
} from '../types/security';
import { SAMPLE_INCIDENTS } from './sampleData';

export interface StorageConfig {
  graph: GraphConnectorConfig;
  sentinel: SentinelConnectorConfig;
}

export class DataStore {
  private dataDir: string;
  private incidentsFile: string;
  private configFile: string;
  private incidents: Map<string, UnifiedIncident> = new Map();
  private config: StorageConfig;

  constructor() {
    this.dataDir = path.resolve(process.cwd(), '.msec_data');
    this.incidentsFile = path.join(this.dataDir, 'incidents.json');
    this.configFile = path.join(this.dataDir, 'connectors.json');

    const defaultTenantId = process.env.M365_TENANT_ID || process.env.GRAPH_TENANT_ID || '';
    const defaultClientId = process.env.M365_CLIENT_ID || process.env.GRAPH_CLIENT_ID || '';
    const defaultClientSecret = process.env.M365_CLIENT_SECRET || process.env.GRAPH_CLIENT_SECRET || '';

    this.config = {
      graph: {
        tenantId: defaultTenantId,
        clientId: defaultClientId,
        clientSecret: defaultClientSecret,
        enabled: Boolean(defaultClientId && defaultClientSecret),
        status: 'IDLE',
      },
      sentinel: {
        tenantId: defaultTenantId,
        clientId: defaultClientId,
        clientSecret: defaultClientSecret,
        subscriptionId: process.env.SENTINEL_SUBSCRIPTION_ID || '',
        resourceGroup: process.env.SENTINEL_RESOURCE_GROUP || '',
        workspaceName: process.env.SENTINEL_WORKSPACE_NAME || '',
        workspaceId: '',
        enabled: Boolean(process.env.SENTINEL_WORKSPACE_NAME),
        status: 'IDLE',
      }
    };

    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      // Load config if exists
      if (fs.existsSync(this.configFile)) {
        const rawConfig = fs.readFileSync(this.configFile, 'utf-8');
        this.config = { ...this.config, ...JSON.parse(rawConfig) };
      }

      // Load incidents if exists, otherwise load SAMPLE_INCIDENTS by default
      if (fs.existsSync(this.incidentsFile)) {
        const raw = fs.readFileSync(this.incidentsFile, 'utf-8');
        const parsed: UnifiedIncident[] = JSON.parse(raw);
        parsed.forEach(inc => this.incidents.set(inc.id, inc));
      } else {
        SAMPLE_INCIDENTS.forEach(inc => this.incidents.set(inc.id, inc));
        this.saveIncidents();
      }
    } catch (err) {
      console.error('Error initializing DataStore:', err);
      // Fallback in-memory
      SAMPLE_INCIDENTS.forEach(inc => this.incidents.set(inc.id, inc));
    }
  }

  private saveIncidents() {
    try {
      const arr = Array.from(this.incidents.values());
      fs.writeFileSync(this.incidentsFile, JSON.stringify(arr, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save incidents to disk:', err);
    }
  }

  private saveConfig() {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save config to disk:', err);
    }
  }

  public getAll(filters?: {
    severity?: string;
    provider?: string;
    status?: string;
    search?: string;
  }): UnifiedIncident[] {
    let list = Array.from(this.incidents.values());

    // Sort by createdTime descending (newest first)
    list.sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());

    if (!filters) return list;

    if (filters.severity && filters.severity !== 'ALL') {
      list = list.filter(i => i.severity === filters.severity);
    }

    if (filters.provider && filters.provider !== 'ALL') {
      list = list.filter(i => i.provider === filters.provider);
    }

    if (filters.status && filters.status !== 'ALL') {
      list = list.filter(i => i.status === filters.status);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(i => 
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.entities.some(e => e.value.toLowerCase().includes(q)) ||
        i.mitreTechniques.some(m => m.techniqueName.toLowerCase().includes(q) || m.techniqueId.toLowerCase().includes(q))
      );
    }

    return list;
  }

  public getById(id: string): UnifiedIncident | undefined {
    return this.incidents.get(id);
  }

  public addOrUpdate(incident: UnifiedIncident) {
    this.incidents.set(incident.id, incident);
    this.saveIncidents();
  }

  public batchAddOrUpdate(newIncidents: UnifiedIncident[]) {
    newIncidents.forEach(inc => this.incidents.set(inc.id, inc));
    this.saveIncidents();
  }

  public delete(id: string): boolean {
    const res = this.incidents.delete(id);
    if (res) this.saveIncidents();
    return res;
  }

  public clear() {
    this.incidents.clear();
    this.saveIncidents();
  }

  public resetToDemo() {
    this.incidents.clear();
    SAMPLE_INCIDENTS.forEach(inc => this.incidents.set(inc.id, inc));
    this.saveIncidents();
  }

  public updateIncidentStatus(id: string, status: IncidentStatus): UnifiedIncident | undefined {
    const inc = this.incidents.get(id);
    if (!inc) return undefined;
    inc.status = status;
    inc.lastUpdatedTime = new Date().toISOString();
    this.saveIncidents();
    return inc;
  }

  public executeContainmentAction(incidentId: string, actionId: string): boolean {
    const inc = this.incidents.get(incidentId);
    if (!inc || !inc.threatAssessment) return false;
    const action = inc.threatAssessment.containmentActions.find(a => a.id === actionId);
    if (!action) return false;

    action.status = 'EXECUTED';
    inc.lastUpdatedTime = new Date().toISOString();
    this.saveIncidents();
    return true;
  }

  public getStats(): IngestionStats {
    const list = Array.from(this.incidents.values());

    const bySeverity: Record<IncidentSeverity, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFORMATIONAL: 0
    };

    const byStatus: Record<IncidentStatus, number> = {
      NEW: 0,
      ACTIVE: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      CLOSED: 0
    };

    const byProvider: Record<string, number> = {};

    const uniqueUsers = new Set<string>();
    const uniqueHosts = new Set<string>();
    const uniqueIps = new Set<string>();
    const uniqueFiles = new Set<string>();

    list.forEach(i => {
      bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;
      byStatus[i.status] = (byStatus[i.status] || 0) + 1;
      byProvider[i.provider] = (byProvider[i.provider] || 0) + 1;

      i.entities.forEach(e => {
        if (e.type === 'USER') uniqueUsers.add(e.value.toLowerCase());
        if (e.type === 'HOST') uniqueHosts.add(e.value.toLowerCase());
        if (e.type === 'IP') uniqueIps.add(e.value);
        if (e.type === 'FILE') uniqueFiles.add(e.value.toLowerCase());
      });
    });

    return {
      totalIncidents: list.length,
      bySeverity,
      byProvider,
      byStatus,
      entitiesCount: {
        users: uniqueUsers.size,
        hosts: uniqueHosts.size,
        ips: uniqueIps.size,
        files: uniqueFiles.size
      }
    };
  }

  public getEntities(): { type: string; value: string; incidentCount: number; incidents: string[] }[] {
    const map = new Map<string, { type: string; value: string; incidents: Set<string> }>();

    this.incidents.forEach(inc => {
      inc.entities.forEach(e => {
        const key = `${e.type}:${e.value}`;
        if (!map.has(key)) {
          map.set(key, { type: e.type, value: e.value, incidents: new Set() });
        }
        map.get(key)!.incidents.add(inc.id);
      });
    });

    return Array.from(map.values()).map(item => ({
      type: item.type,
      value: item.value,
      incidentCount: item.incidents.size,
      incidents: Array.from(item.incidents)
    })).sort((a, b) => b.incidentCount - a.incidentCount);
  }

  public getConfig(): StorageConfig {
    return this.config;
  }

  public updateConfig(newConfig: Partial<StorageConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
  }
}

export const store = new DataStore();

