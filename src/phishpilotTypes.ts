export type PhishPilotVerdict = 'LEGITIMATE' | 'SUSPICIOUS' | 'PHISHING';

export interface ParsedEmailSummary {
  from: string;
  to: string;
  subject: string;
  date: string;
  replyTo: string;
  returnPath: string;
  bodyPreview: string;
  urlCount: number;
  attachmentCount: number;
  isForwarded?: boolean;
  forwardedBy?: string;
}

export interface HeaderCheck {
  name: string;
  result: 'pass' | 'fail' | 'softfail' | 'none' | 'unknown';
  detail?: string;
  dnsRecord?: string;
}

export interface DnsAuthDetails {
  spfRecord?: string;
  spfEvaluated?: string;
  dkimSelector?: string;
  dkimDomain?: string;
  dkimKeyFound?: boolean;
  dmarcRecord?: string;
  dmarcPolicy?: string;
  dmarcAlignment?: 'aligned' | 'unaligned' | 'none';
}

export interface HeaderAnalysisResult {
  spf: HeaderCheck;
  dkim: HeaderCheck;
  dmarc: HeaderCheck;
  replyToMismatch: boolean;
  returnPathMismatch: boolean;
  receivedHops: number;
  originIps: string[];
  checks: HeaderCheck[];
  dnsAuth?: DnsAuthDetails;
}

export interface ReputationSource {
  source: string;
  result: string;
  detail?: string;
  maliciousCount?: number;
  totalEngines?: number;
}

export interface HomoglyphResult {
  isSuspicious: boolean;
  impersonatedBrand?: string;
  matchedTarget?: string;
  punycode?: string;
  similarityScore?: number;
  explanation?: string;
}

export interface UrlAnalysisResult {
  url: string;
  domain: string;
  domainAgeDays: number | null;
  isMalicious: boolean;
  isDeceptive: boolean;
  reputationSources: ReputationSource[];
  homoglyph?: HomoglyphResult;
}

export interface AttachmentAnalysisResult {
  filename: string;
  mimeType: string;
  size: number;
  sha256: string;
  md5: string;
  isSuspiciousExtension: boolean;
  isPasswordProtected: boolean;
  isMalicious: boolean;
  reputationSources: ReputationSource[];
}

export interface AiClassification {
  classification: PhishPilotVerdict;
  confidence: number;
  keyFindings: string[];
  indicators: string[];
  recommendedActions: string[];
  modelUsed: string;
}

export interface MicrosoftSecurityEnrichment {
  senderEntraStatus?: {
    isInternalUser: boolean;
    userPrincipalName?: string;
    displayName?: string;
    accountEnabled?: boolean;
    isVipOrExecutive?: boolean;
    impersonationDetected?: boolean;
    riskLevel?: 'none' | 'low' | 'medium' | 'high' | 'hidden' | 'unknown';
    riskDetail?: string;
  };
  defenderTiResults?: {
    checkedDomain?: string;
    reputationScore?: number;
    verdict?: 'clean' | 'suspicious' | 'malicious' | 'unknown';
    tags?: string[];
  };
  eopDeliveryStatus?: {
    spamConfidenceLevel?: number;
    bulkConfidenceLevel?: number;
    antispamDirection?: 'Inbound' | 'Outbound' | 'IntraOrg';
    verdictDescription?: string;
  };
}

export interface RiskScoreItem {
  condition: string;
  points: number;
  triggered: boolean;
  detail?: string;
}

export interface RiskScoreBreakdown {
  totalScore: number;
  maxPossible: number;
  items: RiskScoreItem[];
  deterministicVerdict: PhishPilotVerdict;
}

export interface RemediationLog {
  action: 'PURGE_TENANT' | 'BLOCK_SENDER' | 'REVOKE_SESSION';
  timestamp: string;
  status: 'SUCCESS' | 'SIMULATED' | 'FAILED';
  target: string;
  details: string;
  operator: string;
}

export interface ThreatCorrelation {
  incidentId: string;
  incidentTitle: string;
  severity: string;
  provider: string;
  matchedEntity: string;
  matchType: 'IP' | 'DOMAIN' | 'HASH' | 'USER';
}

export interface PhishPilotReport {
  id: string;
  timestamp: string;
  verdict: PhishPilotVerdict;
  riskScore: number;
  confidence: number;
  emailSummary: ParsedEmailSummary;
  headerAnalysis: HeaderAnalysisResult;
  urlAnalysis: UrlAnalysisResult[];
  attachmentAnalysis: AttachmentAnalysisResult[];
  aiClassification: AiClassification | null;
  riskBreakdown: RiskScoreBreakdown;
  recommendedActions: string[];
  microsoftEnrichment?: MicrosoftSecurityEnrichment;
  remediationLogs?: RemediationLog[];
  correlations?: ThreatCorrelation[];
  escalatedIncidentId?: string;
}

export interface PhishPilotStats {
  totalAnalyzed: number;
  verdictCounts: Record<PhishPilotVerdict, number>;
  topMaliciousDomains: string[];
  recentReports: PhishPilotReport[];
}

export interface MailboxPollerConfig {
  mailbox: string;
  enabled: boolean;
  enableAutoReply?: boolean;
  pollingIntervalMinutes: number;
  lastPollTimestamp?: string;
  lastStatus?: 'SUCCESS' | 'ERROR' | 'IDLE';
  lastError?: string;
  totalImportedCount: number;
}

export interface UserSessionProfile {
  id: string;
  displayName: string;
  email: string;
  jobTitle?: string;
  avatarUrl?: string;
  isAuthenticated: boolean;
  tenantId?: string;
}
