import fs from 'fs';
import path from 'path';
import { 
  UnifiedIncident, 
  IncidentSeverity, 
  IncidentStatus, 
  IngestionStats, 
  GraphConnectorConfig, 
  SentinelConnectorConfig,
  AnalyticsTrends,
  TimelinePoint,
  MitreTacticMetric,
  DistributionMetric,
  EntityType
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
        const fileConfig = JSON.parse(rawConfig);
        this.config = {
          graph: {
            ...this.config.graph,
            ...fileConfig.graph,
            ...(process.env.M365_TENANT_ID || process.env.GRAPH_TENANT_ID ? { tenantId: (process.env.M365_TENANT_ID || process.env.GRAPH_TENANT_ID)!.trim() } : {}),
            ...(process.env.M365_CLIENT_ID || process.env.GRAPH_CLIENT_ID ? { clientId: (process.env.M365_CLIENT_ID || process.env.GRAPH_CLIENT_ID)!.trim() } : {}),
            ...(process.env.M365_CLIENT_SECRET || process.env.GRAPH_CLIENT_SECRET ? { clientSecret: (process.env.M365_CLIENT_SECRET || process.env.GRAPH_CLIENT_SECRET)!.trim() } : {})
          },
          sentinel: {
            ...this.config.sentinel,
            ...fileConfig.sentinel,
            ...(process.env.M365_TENANT_ID || process.env.GRAPH_TENANT_ID ? { tenantId: (process.env.M365_TENANT_ID || process.env.GRAPH_TENANT_ID)!.trim() } : {}),
            ...(process.env.M365_CLIENT_ID || process.env.GRAPH_CLIENT_ID ? { clientId: (process.env.M365_CLIENT_ID || process.env.GRAPH_CLIENT_ID)!.trim() } : {}),
            ...(process.env.M365_CLIENT_SECRET || process.env.GRAPH_CLIENT_SECRET ? { clientSecret: (process.env.M365_CLIENT_SECRET || process.env.GRAPH_CLIENT_SECRET)!.trim() } : {}),
            ...(process.env.SENTINEL_SUBSCRIPTION_ID ? { subscriptionId: process.env.SENTINEL_SUBSCRIPTION_ID.trim() } : {}),
            ...(process.env.SENTINEL_RESOURCE_GROUP ? { resourceGroup: process.env.SENTINEL_RESOURCE_GROUP.trim() } : {}),
            ...(process.env.SENTINEL_WORKSPACE_NAME ? { workspaceName: process.env.SENTINEL_WORKSPACE_NAME.trim() } : {})
          }
        };
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

  public getAnalyticsTrends(): AnalyticsTrends {
    const list = Array.from(this.incidents.values());
    const total = list.length || 1;

    // 1. Build 7-day timeline (from 6 days ago up to today)
    const timelineMap = new Map<string, TimelinePoint>();
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const isoDate = d.toISOString().split('T')[0];
      const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      timelineMap.set(isoDate, {
        date: dateLabel,
        isoDate,
        count: 0,
        byProvider: {},
        bySeverity: {
          CRITICAL: 0,
          HIGH: 0,
          MEDIUM: 0,
          LOW: 0,
          INFORMATIONAL: 0
        }
      });
    }

    // Tally incidents into timeline
    list.forEach(inc => {
      const incDate = (inc.createdTime ? new Date(inc.createdTime) : now).toISOString().split('T')[0];
      let point = timelineMap.get(incDate);
      if (!point) {
        const d = new Date(inc.createdTime || now);
        point = {
          date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          isoDate: incDate,
          count: 0,
          byProvider: {},
          bySeverity: {
            CRITICAL: 0,
            HIGH: 0,
            MEDIUM: 0,
            LOW: 0,
            INFORMATIONAL: 0
          }
        };
        timelineMap.set(incDate, point);
      }
      point.count++;
      point.byProvider[inc.provider] = (point.byProvider[inc.provider] || 0) + 1;
      if (point.bySeverity[inc.severity] !== undefined) {
        point.bySeverity[inc.severity]++;
      }
    });

    const timeline = Array.from(timelineMap.values()).sort((a, b) => a.isoDate.localeCompare(b.isoDate));

    // 2. MITRE ATT&CK Tactics aggregation
    const tacticsMap = new Map<string, { count: number; techniques: Map<string, { name: string; count: number }> }>();
    list.forEach(inc => {
      const techniques = [...(inc.mitreTechniques || [])];
      inc.alerts?.forEach(a => {
        if (a.mitreTechniques) techniques.push(...a.mitreTechniques);
      });

      techniques.forEach(m => {
        if (!m.tactic) return;
        const tacticName = m.tactic.trim();
        if (!tacticsMap.has(tacticName)) {
          tacticsMap.set(tacticName, { count: 0, techniques: new Map() });
        }
        const tac = tacticsMap.get(tacticName)!;
        tac.count++;
        const techId = m.techniqueId || m.techniqueName;
        if (!tac.techniques.has(techId)) {
          tac.techniques.set(techId, { name: m.techniqueName || m.techniqueId, count: 0 });
        }
        tac.techniques.get(techId)!.count++;
      });
    });

    const mitreTactics: MitreTacticMetric[] = Array.from(tacticsMap.entries()).map(([tactic, data]) => ({
      tactic,
      count: data.count,
      techniques: Array.from(data.techniques.entries()).map(([id, tech]) => ({
        id,
        name: tech.name,
        count: tech.count
      })).sort((a, b) => b.count - a.count)
    })).sort((a, b) => b.count - a.count);

    // 3. Severity breakdown
    const sevCounts: Record<IncidentSeverity, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFORMATIONAL: 0
    };
    list.forEach(i => {
      if (sevCounts[i.severity] !== undefined) sevCounts[i.severity]++;
    });

    const severityBreakdown: DistributionMetric[] = [
      { name: 'CRITICAL', count: sevCounts.CRITICAL, percentage: Math.round((sevCounts.CRITICAL / total) * 100), color: '#ef4444' },
      { name: 'HIGH', count: sevCounts.HIGH, percentage: Math.round((sevCounts.HIGH / total) * 100), color: '#f97316' },
      { name: 'MEDIUM', count: sevCounts.MEDIUM, percentage: Math.round((sevCounts.MEDIUM / total) * 100), color: '#f59e0b' },
      { name: 'LOW', count: sevCounts.LOW, percentage: Math.round((sevCounts.LOW / total) * 100), color: '#3b82f6' },
      { name: 'INFORMATIONAL', count: sevCounts.INFORMATIONAL, percentage: Math.round((sevCounts.INFORMATIONAL / total) * 100), color: '#64748b' }
    ];

    // 4. Status breakdown
    const statCounts: Record<IncidentStatus, number> = {
      NEW: 0,
      ACTIVE: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      CLOSED: 0
    };
    list.forEach(i => {
      if (statCounts[i.status] !== undefined) statCounts[i.status]++;
    });

    const statusBreakdown: DistributionMetric[] = [
      { name: 'Active', count: statCounts.ACTIVE, percentage: Math.round((statCounts.ACTIVE / total) * 100), color: '#06b6d4' },
      { name: 'In Progress', count: statCounts.IN_PROGRESS, percentage: Math.round((statCounts.IN_PROGRESS / total) * 100), color: '#a855f7' },
      { name: 'New', count: statCounts.NEW, percentage: Math.round((statCounts.NEW / total) * 100), color: '#3b82f6' },
      { name: 'Resolved', count: statCounts.RESOLVED + statCounts.CLOSED, percentage: Math.round(((statCounts.RESOLVED + statCounts.CLOSED) / total) * 100), color: '#10b981' }
    ];

    // 5. Provider breakdown
    const provCounts: Record<string, number> = {};
    list.forEach(i => {
      provCounts[i.provider] = (provCounts[i.provider] || 0) + 1;
    });

    const providerColors: Record<string, string> = {
      M365_DEFENDER: '#0284c7',
      SENTINEL_SIEM: '#0ea5e9',
      DEFENDER_ENDPOINT: '#8b5cf6',
      DEFENDER_OFFICE365: '#ec4899',
      DEFENDER_IDENTITY: '#f59e0b',
      DEFENDER_CLOUD_APPS: '#10b981',
      GENERIC_IMPORT: '#64748b'
    };

    const providerBreakdown: DistributionMetric[] = Object.entries(provCounts).map(([provider, count]) => ({
      name: provider.replace(/_/g, ' '),
      count,
      percentage: Math.round((count / total) * 100),
      color: providerColors[provider] || '#06b6d4'
    })).sort((a, b) => b.count - a.count);

    // 6. Top entities
    const entityCounts = this.getEntities().slice(0, 8).map(e => ({
      type: e.type as EntityType,
      value: e.value,
      count: e.incidentCount
    }));

    return {
      timeline,
      mitreTactics,
      severityBreakdown,
      statusBreakdown,
      providerBreakdown,
      topEntities: entityCounts
    };
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

