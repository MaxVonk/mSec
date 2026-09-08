export type IncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';

export type IncidentStatus = 'NEW' | 'ACTIVE' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export type ProviderSource = 
  | 'M365_DEFENDER' 
  | 'DEFENDER_ENDPOINT' 
  | 'DEFENDER_OFFICE365' 
  | 'DEFENDER_IDENTITY' 
  | 'DEFENDER_CLOUD_APPS' 
  | 'SENTINEL_SIEM' 
  | 'ENTRA_ID' 
  | 'PURVIEW_COMPLIANCE' 
  | 'GENERIC_IMPORT';

export type EntityType = 'USER' | 'HOST' | 'IP' | 'FILE' | 'MAILBOX' | 'CLOUD_RESOURCE' | 'URL';

export interface SecurityEntity {
  id: string;
  type: EntityType;
  value: string;
  role?: string;
  riskScore?: number;
  details?: Record<string, any>;
}

export interface MitreAttackInfo {
  tactic: string;
  techniqueId: string;
  techniqueName: string;
}

export interface UnifiedAlert {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  provider: ProviderSource;
  createdTime: string;
  mitreTechniques: MitreAttackInfo[];
  entities: SecurityEntity[];
  rawData?: any;
}

export interface ContainmentAction {
  id: string;
  title: string;
  actionType: 'REVOKE_SESSIONS' | 'ISOLATE_HOST' | 'BLOCK_IP' | 'RESET_PASSWORD' | 'QUARANTINE_FILE' | 'ENFORCE_MFA' | 'CUSTOM';
  target: string;
  status: 'PENDING' | 'EXECUTED';
  automated: boolean;
}

export interface ThreatOversightAssessment {
  assessedAt: string;
  overallRiskLevel: IncidentSeverity;
  summary: string;
  trustBoundariesViolated: string[];
  attackScenario: string;
  evidence: string[];
  frontendRisks: string[];
  containmentActions: ContainmentAction[];
  remediationGuidance: string[];
}

export interface UnifiedIncident {
  id: string;
  incidentNumber?: string | number;
  title: string;
  description: string;
  provider: ProviderSource;
  severity: IncidentSeverity;
  status: IncidentStatus;
  classification?: string;
  createdTime: string;
  lastUpdatedTime: string;
  entities: SecurityEntity[];
  mitreTechniques: MitreAttackInfo[];
  alerts: UnifiedAlert[];
  threatAssessment?: ThreatOversightAssessment;
  rawPayload: any;
}

export interface IngestionStats {
  totalIncidents: number;
  bySeverity: Record<IncidentSeverity, number>;
  byProvider: Record<string, number>;
  byStatus: Record<IncidentStatus, number>;
  entitiesCount: {
    users: number;
    hosts: number;
    ips: number;
    files: number;
  };
}

export interface ConnectorConfig {
  graph: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    enabled: boolean;
    lastSync?: string;
    status?: 'CONNECTED' | 'ERROR' | 'IDLE';
    statusMessage?: string;
  };
  sentinel: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    subscriptionId: string;
    resourceGroup: string;
    workspaceName: string;
    workspaceId: string;
    enabled: boolean;
    lastSync?: string;
    status?: 'CONNECTED' | 'ERROR' | 'IDLE';
    statusMessage?: string;
  };
}

