export type PlaybookCategory = 'IDENTITY' | 'ENDPOINT' | 'EMAIL' | 'NETWORK';

export type SoarActionType =
  | 'REVOKE_ENTRA_SESSIONS'
  | 'RESET_PASSWORD'
  | 'ENFORCE_MFA'
  | 'ISOLATE_HOST'
  | 'KILL_PROCESS'
  | 'BLOCK_IP_FIREWALL'
  | 'PURGE_MAILBOX'
  | 'BLOCK_DOMAIN_TABL'
  | 'NOTIFY_RECIPIENTS'
  | 'BLOCK_EGRESS'
  | 'QUARANTINE_OAUTH_APP';

export interface PlaybookStep {
  id: string;
  title: string;
  description: string;
  actionType: SoarActionType;
  target?: string;
  estimatedSeconds: number;
}

export interface PlaybookDefinition {
  id: string;
  title: string;
  description: string;
  category: PlaybookCategory;
  recommendedFor: string[]; // e.g. ['Mimikatz', 'Phishing', 'C2', 'Ransomware']
  severityThreshold: ('CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW')[];
  steps: PlaybookStep[];
}

export interface StepExecutionState {
  stepId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  startedAt?: number;
  completedAt?: number;
  log?: string;
}

export interface PlaybookExecutionLog {
  id: string;
  playbookId: string;
  playbookTitle: string;
  incidentId?: string;
  executedBy: string;
  timestamp: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  stepResults: StepExecutionState[];
}

export interface PlaybookRecommendation {
  playbook: PlaybookDefinition;
  score: number; // 0 - 100
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  rationale: string;
  matchedSignals: string[];
  suggestedTarget?: {
    type: 'USER' | 'HOST' | 'IP';
    value: string;
    label: string;
  };
  keyActionSummary: string;
}

