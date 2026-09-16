import { UnifiedIncident } from '../types';
import { PlaybookDefinition, PlaybookRecommendation } from '../types/soar';
import { PREBUILT_PLAYBOOKS } from './soarPlaybooks';

interface RecommendationCandidate {
  playbook: PlaybookDefinition;
  score: number;
  matchedSignals: string[];
  suggestedTarget?: {
    type: 'USER' | 'HOST' | 'IP';
    value: string;
    label: string;
  };
  keyActionSummary: string;
}

/**
 * Recommends the optimal SOAR containment playbook for a given security incident.
 * By default, automatically triggers for High and Critical severity incidents.
 */
export function recommendPlaybook(
  incident: UnifiedIncident | null | undefined,
  options: { forceRecommend?: boolean } = {}
): PlaybookRecommendation | null {
  if (!incident) return null;

  const severityUpper = (incident.severity || '').toUpperCase();
  const isHighOrCritical = severityUpper === 'CRITICAL' || severityUpper === 'HIGH';

  if (!isHighOrCritical && !options.forceRecommend) {
    return null;
  }

  // Pre-extract metadata and searchable text
  const mitreList = incident.mitreTechniques || [];
  const entities = incident.entities || [];
  const emailEv = incident.emailEvidence || [];
  const combinedText = `
    ${incident.title || ''} 
    ${incident.description || ''} 
    ${incident.classification || ''} 
    ${incident.determination || ''} 
    ${incident.threatAssessment?.attackScenario || ''} 
    ${incident.threatAssessment?.summary || ''} 
    ${incident.threatAssessment?.remediationGuidance?.join(' ') || ''} 
    ${JSON.stringify(incident.rawPayload || '')}
  `.toLowerCase();

  const userEntity = entities.find(e => e.type === 'USER' && e.value)?.value;
  const hostEntity = entities.find(e => e.type === 'HOST' && e.value)?.value;
  const ipEntity = entities.find(e => e.type === 'IP' && e.value)?.value;

  const candidates: RecommendationCandidate[] = [];

  // =========================================================================
  // 1. Phishing Campaign Tenant Neutralization ('phishing-campaign-purge')
  // =========================================================================
  const phishingPlaybook = PREBUILT_PLAYBOOKS.find(p => p.id === 'phishing-campaign-purge');
  if (phishingPlaybook) {
    let score = 5;
    const signals: string[] = [];

    // MITRE T1566
    const t1566 = mitreList.find(m => m.techniqueId?.startsWith('T1566'));
    if (t1566) {
      score += 45;
      signals.push(`MITRE ATT&CK ${t1566.techniqueId} (${t1566.techniqueName || 'Phishing'})`);
    } else if (mitreList.some(m => m.tactic?.toLowerCase().includes('initial access'))) {
      score += 15;
      signals.push('MITRE Initial Access Tactic');
    }

    // Email evidence presence
    if (emailEv.length > 0) {
      score += 35;
      signals.push(`${emailEv.length} Analyzed Email Delivery Record${emailEv.length > 1 ? 's' : ''}`);
    }

    if (incident.provider === 'DEFENDER_OFFICE365' || incident.primaryProvider === 'DEFENDER_OFFICE365') {
      score += 15;
      signals.push('Defender for Office 365 Ingestion Signal');
    }

    // Keyword heuristics
    if (combinedText.includes('phish')) {
      score += 20;
      signals.push('Keyword: Phishing Pattern');
    }
    if (combinedText.includes('email') || combinedText.includes('mailbox') || combinedText.includes('message')) {
      score += 10;
    }
    if (combinedText.includes('credential harvest') || combinedText.includes('impersonat')) {
      score += 15;
      signals.push('Keyword: Credential Harvesting / Impersonation');
    }
    if (combinedText.includes('quarantin') || combinedText.includes('spoof') || combinedText.includes('sender')) {
      score += 10;
    }

    // Determine target
    let targetValue = userEntity || 'user@company.com';
    if (emailEv.length > 0) {
      const ev = emailEv[0];
      targetValue = ev.recipientEmail || targetValue;
    }

    candidates.push({
      playbook: phishingPlaybook,
      score: Math.min(score, 98),
      matchedSignals: signals,
      suggestedTarget: {
        type: 'USER',
        value: targetValue,
        label: 'Targeted / Compromised Recipient Mailbox'
      },
      keyActionSummary: 'Purge tenant mailboxes by InternetMessageId → Block sender in TABL → Dispatch user coaching'
    });
  }

  // =========================================================================
  // 2. Ransomware & Endpoint Host Isolation ('ransomware-host-isolation')
  // =========================================================================
  const ransomwarePlaybook = PREBUILT_PLAYBOOKS.find(p => p.id === 'ransomware-host-isolation');
  if (ransomwarePlaybook) {
    let score = 5;
    const signals: string[] = [];

    // MITRE T1486 (Data Encrypted for Impact), T1059 (Execution), T1003 (Credential Dumping)
    const t1486 = mitreList.find(m => m.techniqueId?.startsWith('T1486'));
    if (t1486) {
      score += 50;
      signals.push('MITRE ATT&CK T1486 (Data Encrypted for Impact)');
    }

    const t1003 = mitreList.find(m => m.techniqueId?.startsWith('T1003'));
    if (t1003) {
      score += 35;
      signals.push('MITRE ATT&CK T1003 (OS Credential Dumping / Mimikatz)');
    }

    const t1059 = mitreList.find(m => m.techniqueId?.startsWith('T1059'));
    if (t1059) {
      score += 20;
      signals.push('MITRE ATT&CK T1059 (Command & Script Execution)');
    }

    if (mitreList.some(m => m.tactic?.toLowerCase().includes('impact') || m.tactic?.toLowerCase().includes('lateral movement'))) {
      score += 15;
      signals.push('MITRE Impact / Lateral Movement Tactic');
    }

    // Host entity presence
    if (hostEntity) {
      score += 15;
      signals.push(`Compromised Host Device Identified (${hostEntity})`);
    }

    // Keywords
    if (combinedText.includes('ransom')) {
      score += 35;
      signals.push('Keyword: Ransomware / Encryptor Signature');
    }
    if (combinedText.includes('mimikatz') || combinedText.includes('lsass') || combinedText.includes('cobalt')) {
      score += 30;
      signals.push('Keyword: Advanced Post-Exploitation Tooling');
    }
    if (combinedText.includes('encrypt') || combinedText.includes('shadow copy') || combinedText.includes('vssadmin')) {
      score += 25;
      signals.push('Keyword: Shadow Copy Tampering / Mass Encryption');
    }
    if (combinedText.includes('isolate') || combinedText.includes('endpoint') || combinedText.includes('trojan')) {
      score += 10;
    }

    candidates.push({
      playbook: ransomwarePlaybook,
      score: Math.min(score, 98),
      matchedSignals: signals,
      suggestedTarget: {
        type: 'HOST',
        value: hostEntity || 'DESKTOP-SEC-8901',
        label: 'Infected Endpoint Host Device'
      },
      keyActionSummary: 'Network-isolate endpoint device → Kill malicious shell process tree → Block C2 destination IP'
    });
  }

  // =========================================================================
  // 3. Compromised Identity Rapid Lockdown ('compromised-identity')
  // =========================================================================
  const identityPlaybook = PREBUILT_PLAYBOOKS.find(p => p.id === 'compromised-identity');
  if (identityPlaybook) {
    let score = 5;
    const signals: string[] = [];

    // MITRE T1078 (Valid Accounts), T1110 (Brute Force)
    const t1078 = mitreList.find(m => m.techniqueId?.startsWith('T1078'));
    if (t1078) {
      score += 40;
      signals.push('MITRE ATT&CK T1078 (Valid Accounts / Token Abuse)');
    }

    const t1110 = mitreList.find(m => m.techniqueId?.startsWith('T1110'));
    if (t1110) {
      score += 35;
      signals.push('MITRE ATT&CK T1110 (Brute Force / Password Spray)');
    }

    if (mitreList.some(m => m.tactic?.toLowerCase().includes('credential access') || m.tactic?.toLowerCase().includes('persistence'))) {
      score += 15;
      signals.push('MITRE Credential Access Tactic');
    }

    // User entity presence
    if (userEntity) {
      score += 15;
      signals.push(`Target User Account Identified (${userEntity})`);
    }

    // Keywords
    if (combinedText.includes('impossible travel') || combinedText.includes('risky sign-in') || combinedText.includes('unfamiliar sign-in')) {
      score += 35;
      signals.push('Detection: Impossible Travel / Risky Sign-in');
    }
    if (combinedText.includes('token theft') || combinedText.includes('refresh token') || combinedText.includes('session token')) {
      score += 30;
      signals.push('Detection: Primary Refresh Token (PRT) / Session Hijack');
    }
    if (combinedText.includes('password spray') || combinedText.includes('mfa fatigue') || combinedText.includes('mfa prompt')) {
      score += 25;
      signals.push('Detection: Password Spray / MFA Prompt Fatigue');
    }
    if (combinedText.includes('compromised account') || combinedText.includes('identity')) {
      score += 10;
    }

    candidates.push({
      playbook: identityPlaybook,
      score: Math.min(score, 98),
      matchedSignals: signals,
      suggestedTarget: {
        type: 'USER',
        value: userEntity || 'analyst@company.com',
        label: 'Compromised Microsoft Entra ID User'
      },
      keyActionSummary: 'Revoke active Entra ID tokens & cookies → Flag forced password reset → Enforce step-up MFA'
    });
  }

  // =========================================================================
  // 4. Data Exfiltration & Illicit App Blockade ('data-exfiltration-blockade')
  // =========================================================================
  const exfilPlaybook = PREBUILT_PLAYBOOKS.find(p => p.id === 'data-exfiltration-blockade');
  if (exfilPlaybook) {
    let score = 5;
    const signals: string[] = [];

    // MITRE T1048 (Exfil over alt protocol), T1567 (Exfil over web service), T1041 (Exfil over C2)
    const t1048 = mitreList.find(m => m.techniqueId?.startsWith('T1048') || m.techniqueId?.startsWith('T1567') || m.techniqueId?.startsWith('T1041'));
    if (t1048) {
      score += 45;
      signals.push(`MITRE ATT&CK ${t1048.techniqueId} (${t1048.techniqueName || 'Data Exfiltration'})`);
    } else if (mitreList.some(m => m.tactic?.toLowerCase().includes('exfiltration'))) {
      score += 20;
      signals.push('MITRE Exfiltration Tactic');
    }

    if (ipEntity) {
      score += 10;
      signals.push(`External Destination Indicator (${ipEntity})`);
    }

    // Keywords
    if (combinedText.includes('exfiltrat') || combinedText.includes('data theft') || combinedText.includes('egress')) {
      score += 35;
      signals.push('Keyword: Data Exfiltration / Egress Pattern');
    }
    if (combinedText.includes('consent grant') || combinedText.includes('illicit app') || combinedText.includes('oauth')) {
      score += 35;
      signals.push('Keyword: Suspicious Multi-Tenant OAuth Application');
    }
    if (combinedText.includes('mass download') || combinedText.includes('large download') || combinedText.includes('bulk export')) {
      score += 25;
      signals.push('Keyword: High Volume Data Download');
    }

    candidates.push({
      playbook: exfilPlaybook,
      score: Math.min(score, 98),
      matchedSignals: signals,
      suggestedTarget: {
        type: 'IP',
        value: ipEntity || userEntity || '194.26.29.112',
        label: 'External Destination IP / Illicit App Principal'
      },
      keyActionSummary: 'Drop perimeter egress to destination IP → Revoke OAuth application grants → Lock service account'
    });
  }

  // Sort candidates by score descending
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  if (!best || best.score < 20) {
    // If no strong signal was found, pick identity lockdown as fallback default for High/Critical
    const defaultPlaybook = identityPlaybook || PREBUILT_PLAYBOOKS[0];
    return {
      playbook: defaultPlaybook,
      score: 40,
      confidence: 'LOW',
      rationale: `High-severity alert raised without definitive tactic signatures. Rapid identity lockdown is recommended as precautionary posture containment for ${userEntity || 'affected identities'}.`,
      matchedSignals: ['High/Critical Triage Protocol'],
      suggestedTarget: {
        type: 'USER',
        value: userEntity || 'analyst@company.com',
        label: 'Affected Identity'
      },
      keyActionSummary: 'Revoke active Entra ID tokens & cookies → Flag forced password reset → Enforce step-up MFA'
    };
  }

  // Determine confidence level
  const confidence: 'HIGH' | 'MEDIUM' | 'LOW' =
    best.score >= 70 ? 'HIGH' : best.score >= 40 ? 'MEDIUM' : 'LOW';

  // Construct a concise, informative rationale statement
  const topSignals = best.matchedSignals.slice(0, 3).join(', ');
  const rationale = `Recommended with ${confidence} confidence (${best.score}% match). Detection correlates with ${topSignals || 'observed threat indicators'}. Pre-configured containment targets are ready for rapid execution.`;

  return {
    playbook: best.playbook,
    score: best.score,
    confidence,
    rationale,
    matchedSignals: best.matchedSignals,
    suggestedTarget: best.suggestedTarget,
    keyActionSummary: best.keyActionSummary
  };
}
