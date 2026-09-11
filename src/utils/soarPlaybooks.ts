import { PlaybookDefinition } from '../types/soar';

export const PREBUILT_PLAYBOOKS: PlaybookDefinition[] = [
  {
    id: 'compromised-identity',
    title: 'Compromised Identity Rapid Lockdown',
    description: 'Instantly revokes all active session tokens in Microsoft Entra ID, invalidates cached refresh tokens, and enforces password reset on next sign-in.',
    category: 'IDENTITY',
    recommendedFor: ['Credential Theft', 'Impossible Travel', 'Mimikatz', 'Risky Sign-in', 'Token Theft'],
    severityThreshold: ['CRITICAL', 'HIGH'],
    steps: [
      {
        id: 'step-revoke-tokens',
        title: 'Revoke Entra ID Sessions',
        description: 'Call Graph API /revokeSignInSessions to invalidate all active refresh tokens and browser cookies.',
        actionType: 'REVOKE_ENTRA_SESSIONS',
        estimatedSeconds: 2
      },
      {
        id: 'step-reset-pwd',
        title: 'Flag Account for Forced Password Change',
        description: 'Set forceChangePasswordNextSignIn to true on the target user in Entra ID.',
        actionType: 'RESET_PASSWORD',
        estimatedSeconds: 1
      },
      {
        id: 'step-enforce-mfa',
        title: 'Require MFA Re-Registration',
        description: 'Trigger Entra ID Identity Protection risky user remediation policy requiring Step-Up MFA challenge.',
        actionType: 'ENFORCE_MFA',
        estimatedSeconds: 2
      }
    ]
  },
  {
    id: 'ransomware-host-isolation',
    title: 'Ransomware & Endpoint Host Isolation',
    description: 'Cuts endpoint network access via Defender for Endpoint except for security cloud telemetry, stops suspicious process trees, and blocks egress C2 destinations.',
    category: 'ENDPOINT',
    recommendedFor: ['Ransomware', 'Cobalt Strike', 'C2', 'Trojan', 'Lateral Movement'],
    severityThreshold: ['CRITICAL', 'HIGH'],
    steps: [
      {
        id: 'step-isolate-device',
        title: 'Network-Isolate Endpoint Host',
        description: 'Issue Defender for Endpoint API isolateMachine command with full network blockade.',
        actionType: 'ISOLATE_HOST',
        estimatedSeconds: 3
      },
      {
        id: 'step-kill-process',
        title: 'Terminate Malicious Process Tree',
        description: 'Issue remote live-response process kill for suspicious command lines and parent shells.',
        actionType: 'KILL_PROCESS',
        estimatedSeconds: 2
      },
      {
        id: 'step-block-c2',
        title: 'Push C2 Firewall Drop Rules',
        description: 'Add attacker IP / domain indicators to Defender perimeter Network Protection custom indicators.',
        actionType: 'BLOCK_IP_FIREWALL',
        estimatedSeconds: 2
      }
    ]
  },
  {
    id: 'phishing-campaign-purge',
    title: 'Phishing Campaign Tenant Neutralization',
    description: 'Purges identical phishing emails across all tenant mailboxes via Exchange Online, blocks the sender in TABL, and dispatches employee coaching notifications.',
    category: 'EMAIL',
    recommendedFor: ['Phishing', 'Credential Harvesting', 'Brand Impersonation', 'Malicious Link'],
    severityThreshold: ['CRITICAL', 'HIGH', 'MEDIUM'],
    steps: [
      {
        id: 'step-purge-mailboxes',
        title: 'Execute Tenant-Wide Hard Delete',
        description: 'Trigger Exchange Security Search & Purge across all internal mailboxes matching InternetMessageId.',
        actionType: 'PURGE_MAILBOX',
        estimatedSeconds: 3
      },
      {
        id: 'step-block-tabl',
        title: 'Block Sender Domain in TABL',
        description: 'Submit sender domain and phishing URLs to Microsoft Tenant Allow/Block List (action: Block).',
        actionType: 'BLOCK_DOMAIN_TABL',
        estimatedSeconds: 2
      },
      {
        id: 'step-notify-recipients',
        title: 'Dispatch Security Alert to Recipients',
        description: 'Send automated security coaching notice advising targeted employees not to interact with links.',
        actionType: 'NOTIFY_RECIPIENTS',
        estimatedSeconds: 1
      }
    ]
  },
  {
    id: 'data-exfiltration-blockade',
    title: 'Data Exfiltration & Illicit App Blockade',
    description: 'Quarantines anomalous OAuth consent grants, severs high-volume outbound data transfers, and freezes affected service principals.',
    category: 'NETWORK',
    recommendedFor: ['Data Exfiltration', 'Illicit Consent Grant', 'Mass Download', 'Anomalous Egress'],
    severityThreshold: ['CRITICAL', 'HIGH'],
    steps: [
      {
        id: 'step-block-egress',
        title: 'Drop Egress Traffic to Destination IP',
        description: 'Deploy perimeter ACL dropping outbound sessions to identified external staging IP.',
        actionType: 'BLOCK_EGRESS',
        estimatedSeconds: 2
      },
      {
        id: 'step-quarantine-app',
        title: 'Revoke Third-Party OAuth App Permissions',
        description: 'Revoke oauth2PermissionGrants for suspicious third-party multi-tenant application.',
        actionType: 'QUARANTINE_OAUTH_APP',
        estimatedSeconds: 2
      },
      {
        id: 'step-lock-service-account',
        title: 'Lock Identity & Invalidate Refresh Tokens',
        description: 'Suspend user account and revoke Entra ID session tokens to halt active exfiltration pipeline.',
        actionType: 'REVOKE_ENTRA_SESSIONS',
        estimatedSeconds: 1
      }
    ]
  }
];
