import { UnifiedIncident } from '../types/security';
import { ThreatOversightService } from './threatOversightService';

const RAW_SAMPLE_INCIDENTS: UnifiedIncident[] = [
  {
    id: 'inc-m365-9842',
    incidentNumber: 9842,
    title: 'Multi-stage Ransomware Activity: Phishing, LSASS Dumping & Volume Shadow Deletion',
    description: 'Correlated multi-stage attack detected by Microsoft Defender XDR. Began with a malicious macro attachment received via Outlook, followed by credential theft execution on WKSTN-FIN-042 and attempt to inhibit recovery mechanisms.',
    provider: 'M365_DEFENDER',
    severity: 'CRITICAL',
    status: 'ACTIVE',
    classification: 'TruePositive',
    createdTime: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 min ago
    lastUpdatedTime: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    entities: [
      { id: 'ent-1', type: 'USER', value: 'sarah.jenkins@contoso.com', role: 'Targeted User (Finance)' },
      { id: 'ent-2', type: 'USER', value: 'admin.corp@contoso.com', role: 'Impersonated / Harvested Account' },
      { id: 'ent-3', type: 'HOST', value: 'WKSTN-FIN-042.corp.contoso.com', role: 'Initial Compromised Workstation' },
      { id: 'ent-4', type: 'HOST', value: 'DC01.corp.contoso.com', role: 'Domain Controller Target' },
      { id: 'ent-5', type: 'IP', value: '194.26.29.112', role: 'C2 Command & Control Server' },
      { id: 'ent-6', type: 'FILE', value: 'Invoice_Payment_Batch_Q3.xlsm', role: 'Phishing Payload' },
      { id: 'ent-7', type: 'FILE', value: 'mimi64.exe', role: 'Credential Dumper' }
    ],
    mitreTechniques: [
      { tactic: 'Initial Access', techniqueId: 'T1566.001', techniqueName: 'Spearphishing Attachment' },
      { tactic: 'Execution', techniqueId: 'T1059.001', techniqueName: 'PowerShell' },
      { tactic: 'Credential Access', techniqueId: 'T1003.001', techniqueName: 'LSASS Memory' },
      { tactic: 'Impact', techniqueId: 'T1490', techniqueName: 'Inhibit System Recovery' }
    ],
    alerts: [
      {
        id: 'alt-phish-101',
        title: 'Phishing Email with Malicious Macro Delivered',
        description: 'Defender for Office 365 identified a high-confidence phishing campaign targeting executive finance users.',
        severity: 'HIGH',
        provider: 'DEFENDER_OFFICE365',
        createdTime: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        mitreTechniques: [{ tactic: 'Initial Access', techniqueId: 'T1566.001', techniqueName: 'Spearphishing Attachment' }],
        entities: [
          { id: 'ev-1', type: 'USER', value: 'sarah.jenkins@contoso.com' },
          { id: 'ev-2', type: 'FILE', value: 'Invoice_Payment_Batch_Q3.xlsm' }
        ]
      },
      {
        id: 'alt-mde-202',
        title: 'Suspicious Process Attempted LSASS Memory Access',
        description: 'Defender for Endpoint blocked unauthorized memory read into lsass.exe initiated by spawned PowerShell process.',
        severity: 'CRITICAL',
        provider: 'DEFENDER_ENDPOINT',
        createdTime: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        mitreTechniques: [{ tactic: 'Credential Access', techniqueId: 'T1003.001', techniqueName: 'LSASS Memory' }],
        entities: [
          { id: 'ev-3', type: 'HOST', value: 'WKSTN-FIN-042.corp.contoso.com' },
          { id: 'ev-4', type: 'FILE', value: 'mimi64.exe' }
        ]
      },
      {
        id: 'alt-mde-303',
        title: 'Deletion of Volume Shadow Copies (vssadmin)',
        description: 'Command line execution detected: vssadmin.exe Delete Shadows /All /Quiet indicating active ransomware defense suppression.',
        severity: 'CRITICAL',
        provider: 'DEFENDER_ENDPOINT',
        createdTime: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        mitreTechniques: [{ tactic: 'Impact', techniqueId: 'T1490', techniqueName: 'Inhibit System Recovery' }],
        entities: [
          { id: 'ev-5', type: 'HOST', value: 'WKSTN-FIN-042.corp.contoso.com' }
        ]
      }
    ],
    rawPayload: {
      tenantId: '72f988bf-86f1-41af-91ab-2d7cd011db47',
      incidentUri: 'https://security.microsoft.com/incidents/9842',
      alertCategories: ['Malware', 'CredentialAccess', 'InitialAccess', 'Ransomware']
    }
  },
  {
    id: 'inc-sentinel-4412',
    incidentNumber: 4412,
    title: 'Microsoft Sentinel: Suspicious Azure KeyVault Secrets Retrieval & Elevated Role Assignment',
    description: 'Sentinel analytics rule [SEC-AZ-049] triggered: Anomalous spike in secret GET requests on production KeyVault kv-prod-secrets followed by Add-AzureADDirectoryRoleMember.',
    provider: 'SENTINEL_SIEM',
    severity: 'HIGH',
    status: 'IN_PROGRESS',
    classification: 'TruePositive',
    createdTime: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
    lastUpdatedTime: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    entities: [
      { id: 's-ent-1', type: 'USER', value: 'automation-cicd-sp@contoso.onmicrosoft.com', role: 'Compromised Service Principal' },
      { id: 's-ent-2', type: 'USER', value: 'alex.chen@contoso.com', role: 'Target Security Principal' },
      { id: 's-ent-3', type: 'CLOUD_RESOURCE', value: 'kv-prod-secrets.vault.azure.net', role: 'Exfiltrated KeyVault' },
      { id: 's-ent-4', type: 'IP', value: '185.191.171.42', role: 'External Attacker IP' }
    ],
    mitreTechniques: [
      { tactic: 'Credential Access', techniqueId: 'T1555', techniqueName: 'Credentials from Password Stores' },
      { tactic: 'Persistence', techniqueId: 'T1098', techniqueName: 'Account Manipulation' }
    ],
    alerts: [
      {
        id: 'alt-kv-1',
        title: 'Anomalous KeyVault Secret Get Spike',
        description: 'Over 140 secrets read in under 90 seconds from non-standard IP subnet.',
        severity: 'HIGH',
        provider: 'SENTINEL_SIEM',
        createdTime: new Date(Date.now() - 1000 * 60 * 115).toISOString(),
        mitreTechniques: [{ tactic: 'Credential Access', techniqueId: 'T1555', techniqueName: 'Credentials from Password Stores' }],
        entities: [
          { id: 's-ev-1', type: 'CLOUD_RESOURCE', value: 'kv-prod-secrets.vault.azure.net' },
          { id: 's-ev-2', type: 'IP', value: '185.191.171.42' }
        ]
      }
    ],
    rawPayload: {
      subscriptionId: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
      workspaceId: 'sentinel-prod-workspace-01',
      kqlQueryExecuted: 'AzureDiagnostics | where ResourceProvider == "MICROSOFT.KEYVAULT" | summarize count() by bin(TimeGenerated, 5m), CallerIPAddress'
    }
  },
  {
    id: 'inc-entra-3301',
    incidentNumber: 3301,
    title: 'Microsoft Entra ID: Impossible Travel and Anonymous IP (TOR) Sign-in Detected',
    description: 'User successfully signed in from Seattle, WA (US) and then 18 minutes later from Amsterdam (NL) via known Tor Exit Node.',
    provider: 'ENTRA_ID',
    severity: 'HIGH',
    status: 'ACTIVE',
    classification: 'TruePositive',
    createdTime: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    lastUpdatedTime: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    entities: [
      { id: 'e-ent-1', type: 'USER', value: 'marcus.vance@contoso.com', role: 'Compromised Executive Account' },
      { id: 'e-ent-2', type: 'IP', value: '185.220.101.5', role: 'Tor Exit Node (Amsterdam, NL)' },
      { id: 'e-ent-3', type: 'IP', value: '24.16.89.12', role: 'Legitimate Corporate IP (Seattle, US)' },
      { id: 'e-ent-4', type: 'CLOUD_RESOURCE', value: 'Microsoft 365 Exchange Online', role: 'Accessed Cloud App' }
    ],
    mitreTechniques: [
      { tactic: 'Initial Access', techniqueId: 'T1078.004', techniqueName: 'Cloud Accounts' },
      { tactic: 'Defense Evasion', techniqueId: 'T1090.003', techniqueName: 'Multi-hop Proxy' }
    ],
    alerts: [],
    rawPayload: {
      riskLevel: 'high',
      riskEventTypes: ['unlikelyTravel', 'anonymizedIPAddress'],
      correlationId: 'c7b5a190-2e38-46cb-8349-14a938cf7822'
    }
  },
  {
    id: 'inc-purview-1190',
    incidentNumber: 1190,
    title: 'Microsoft Purview DLP: Mass Exfiltration of Sensitive Customer PII to Cloud Storage',
    description: 'Data Loss Prevention policy triggered for user downloading 2,400 confidential customer records containing credit cards and National IDs, followed by upload to external unsanctioned cloud storage.',
    provider: 'PURVIEW_COMPLIANCE',
    severity: 'MEDIUM',
    status: 'ACTIVE',
    classification: 'Suspicious',
    createdTime: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    lastUpdatedTime: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
    entities: [
      { id: 'p-ent-1', type: 'USER', value: 'elena.rostova@contoso.com', role: 'Customer Support Lead' },
      { id: 'p-ent-2', type: 'HOST', value: 'MACBOOK-PRO-ER.corp.contoso.com', role: 'Endpoint Device' },
      { id: 'p-ent-3', type: 'FILE', value: 'Customer_Export_2026_Full.csv', role: 'Sensitive Database Export' },
      { id: 'p-ent-4', type: 'URL', value: 'https://mega.nz/upload/transfer', role: 'Unsanctioned Cloud Destination' }
    ],
    mitreTechniques: [
      { tactic: 'Collection', techniqueId: 'T1005', techniqueName: 'Data from Local System' },
      { tactic: 'Exfiltration', techniqueId: 'T1567.002', techniqueName: 'Exfiltration to Cloud Storage' }
    ],
    alerts: [],
    rawPayload: {
      dlpPolicyName: 'GDPR and Financial PII Protection',
      matchCount: 2450,
      severity: 'Medium'
    }
  }
];

export const SAMPLE_INCIDENTS: UnifiedIncident[] = RAW_SAMPLE_INCIDENTS.map((inc: UnifiedIncident) => {
  inc.threatAssessment = ThreatOversightService.analyzeIncident(inc);
  return inc;
});
