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

export type EntityType = 'USER' | 'HOST' | 'IP' | 'FILE' | 'MAILBOX' | 'CLOUD_RESOURCE' | 'URL' | 'PROCESS';

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
  classification?: string;
  determination?: string;
  assignedTo?: string;
  alertWebUrl?: string;
  recommendedActions?: string;
  comments?: { comment: string; createdByDisplayName?: string; createdDateTime?: string }[];
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
  determination?: string;
  assignedTo?: string;
  incidentWebUrl?: string;
  priorityScore?: number;
  resolvingComment?: string;
  comments?: { comment: string; createdByDisplayName?: string; createdDateTime?: string }[];
  createdTime: string;
  lastUpdatedTime: string;
  entities: SecurityEntity[];
  mitreTechniques: MitreAttackInfo[];
  alerts: UnifiedAlert[];
  threatAssessment?: ThreatOversightAssessment;
  rawPayload: any;
}

export interface GraphConnectorConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  enabled: boolean;
  lastSync?: string;
  status?: 'CONNECTED' | 'ERROR' | 'IDLE';
  statusMessage?: string;
}

export interface SentinelConnectorConfig {
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
  demoMode?: boolean;
}

export interface TimelinePoint {
  date: string;
  isoDate: string;
  count: number;
  byProvider: Record<string, number>;
  bySeverity: Record<IncidentSeverity, number>;
}

export interface MitreTacticMetric {
  tactic: string;
  count: number;
  techniques: { id: string; name: string; count: number }[];
}

export interface DistributionMetric {
  name: string;
  count: number;
  percentage: number;
  color?: string;
}

export interface AnalyticsTrends {
  timeline: TimelinePoint[];
  mitreTactics: MitreTacticMetric[];
  severityBreakdown: DistributionMetric[];
  statusBreakdown: DistributionMetric[];
  providerBreakdown: DistributionMetric[];
  topEntities: { type: EntityType; value: string; count: number }[];
}

export interface GraphNode {
  id: string;
  label: string;
  sublabel?: string;
  type: 'incident' | 'alert' | 'user' | 'host' | 'ip' | 'file' | 'url' | 'mitre';
  severity?: IncidentSeverity;
  data?: any;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface IngestionSchedulerConfig {
  sentinelEnabled: boolean;
  sentinelIntervalMinutes: number;
  graphEnabled: boolean;
  graphIntervalMinutes: number;
  lastSentinelSync?: string;
  lastGraphSync?: string;
  status: 'IDLE' | 'RUNNING' | 'SYNCING' | 'SUCCESS' | 'ERROR';
  lastError?: string;
  totalAutoIngested: number;
}

export interface WebhookConfig {
  teamsWebhookUrl?: string;
  slackWebhookUrl?: string;
  customWebhookUrl?: string;
  enabled: boolean;
  minSeverity: IncidentSeverity;
  notifyOnPhishing: boolean;
  notifyOnContainmentAction: boolean;
}

export interface ThreatIntelItem {
  indicator: string;
  type: 'IP' | 'DOMAIN' | 'URL' | 'FILE_HASH';
  reputation: 'MALICIOUS' | 'SUSPICIOUS' | 'CLEAN' | 'UNKNOWN';
  riskScore: number; // 0 to 100
  source: string;
  details: {
    country?: string;
    isp?: string;
    totalReports?: number;
    detectionEngines?: { malicious: number; total: number };
    tags?: string[];
    lastReported?: string;
  };
  cachedAt: string;
}

export interface ThreatIntelConfig {
  abuseIpDbApiKey?: string;
  virusTotalApiKey?: string;
  alienVaultApiKey?: string;
  autoEnrichIncoming: boolean;
}

export interface ShiftHandoverReport {
  shiftId: string;
  generatedAt: string;
  timeframeHours: number;
  analystName?: string;
  notes?: string;
  metrics: {
    totalIncidents: number;
    criticalIncidents: number;
    highIncidents: number;
    resolvedIncidents: number;
    containmentExecuted: number;
    containmentPending: number;
  };
  keyIncidents: {
    id: string;
    incidentNumber?: string | number;
    title: string;
    severity: IncidentSeverity;
    provider: ProviderSource;
    status: IncidentStatus;
    affectedUsers: string[];
    attackScenario?: string;
  }[];
  topTargetedUsers: { user: string; incidentCount: number }[];
  topAttackerIps: { ip: string; count: number }[];
  pendingActions: {
    incidentId: string;
    incidentTitle: string;
    action: ContainmentAction;
  }[];
}

export type UserRole = 'ADMIN' | 'ANALYST' | 'READONLY';

export interface UserSessionProfile {
  id: string;
  username?: string;
  displayName: string;
  email: string;
  role: UserRole;
  jobTitle?: string;
  avatarUrl?: string;
  isAuthenticated: boolean;
  tenantId?: string;
  mustChangePassword?: boolean;
}

export interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  passwordHash: string;
  salt: string;
  isActive: boolean;
  mustChangePassword?: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword?: boolean;
  createdAt: string;
  lastLogin?: string;
}

