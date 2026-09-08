import { 
  UnifiedIncident, 
  ThreatOversightAssessment, 
  ContainmentAction, 
  IncidentSeverity 
} from '../types/security';

export class ThreatOversightService {
  /**
   * Performs an in-depth security threat analysis conforming to the
   * Threat Oversight persona guidelines (.github/agents/threat-oversight.agent.md).
   */
  public static analyzeIncident(incident: UnifiedIncident): ThreatOversightAssessment {
    const titleLower = incident.title.toLowerCase();
    const descLower = incident.description.toLowerCase();
    const combined = `${titleLower} ${descLower}`;

    const trustBoundariesViolated: string[] = [];
    const evidence: string[] = [];
    const frontendRisks: string[] = [];
    const containmentActions: ContainmentAction[] = [];
    const remediationGuidance: string[] = [];

    // Extract key entities
    const users = incident.entities.filter(e => e.type === 'USER');
    const hosts = incident.entities.filter(e => e.type === 'HOST');
    const ips = incident.entities.filter(e => e.type === 'IP');
    const files = incident.entities.filter(e => e.type === 'FILE');

    // Trust boundary analysis
    if (ips.some(ip => !ip.value.startsWith('10.') && !ip.value.startsWith('192.168.') && !ip.value.startsWith('127.'))) {
      trustBoundariesViolated.push('Untrusted External Network to Corporate Perimeter (External IP communication)');
    }
    if (users.length > 0) {
      trustBoundariesViolated.push('Identity Trust Boundary: User credential & session integrity compromised');
    }
    if (hosts.length > 0) {
      trustBoundariesViolated.push('Host Execution Boundary: Malicious process execution or unauthorized tool activity detected');
    }
    if (incident.provider === 'SENTINEL_SIEM') {
      trustBoundariesViolated.push('Cloud Management Plane: Unauthorized Azure/Cloud resource modification attempted');
    }

    // Evidence gathering
    evidence.push(`Provider alert source: ${incident.provider}`);
    evidence.push(`Initial severity score assigned: ${incident.severity}`);
    if (users.length > 0) {
      evidence.push(`Impacted identity assets: ${users.map(u => u.value).join(', ')}`);
    }
    if (hosts.length > 0) {
      evidence.push(`Impacted endpoints: ${hosts.map(h => h.value).join(', ')}`);
    }
    if (ips.length > 0) {
      evidence.push(`Observed source/destination IPs: ${ips.map(i => i.value).join(', ')}`);
    }
    if (incident.mitreTechniques.length > 0) {
      evidence.push(`Mapped MITRE ATT&CK techniques: ${incident.mitreTechniques.map(m => `${m.techniqueId} (${m.techniqueName})`).join(', ')}`);
    }

    // Attack scenario synthesis
    let attackScenario = '';
    if (combined.includes('ransom') || combined.includes('encrypt') || combined.includes('shadow')) {
      attackScenario = 'Multi-stage ransomware deployment: Threat actor achieved execution, attempted volume shadow copy deletion and lateral payload distribution.';
    } else if (combined.includes('phish') || combined.includes('consent') || combined.includes('oauth')) {
      attackScenario = 'Credential harvesting & OAuth consent phishing: Targeted user received fraudulent communication leading to credential disclosure or illicit app delegation.';
    } else if (combined.includes('brute') || combined.includes('sign-in') || combined.includes('password') || combined.includes('travel')) {
      attackScenario = 'Identity takeover / Credential stuffing: Unauthorized authentication attempt bypassed basic controls or leveraged leaked corporate credentials.';
    } else if (combined.includes('exfiltration') || combined.includes('download') || combined.includes('dlp')) {
      attackScenario = 'Data exfiltration: Sensitive enterprise assets or confidential records accessed and moved across corporate boundaries.';
    } else {
      attackScenario = `Adversarial activity observed by ${incident.provider}: Potential breach progression targeting corporate identities and systems.`;
    }

    // Frontend & Web App Security Risks
    if (combined.includes('phish') || combined.includes('redirect') || combined.includes('oauth')) {
      frontendRisks.push('Unsafe OAuth redirect URIs allowing authorization code interception');
      frontendRisks.push('Lookalike domain phishing bypassing web browser origin isolation');
      frontendRisks.push('DOM injection / Cross-Site Scripting (XSS) vectors in internal notification portals');
    }
    if (users.length > 0) {
      frontendRisks.push('Insecure token storage (e.g. localStorage / unflagged cookies) vulnerable to session hijacking via client script injection');
      frontendRisks.push('Missing server-side session invalidation on user password change or sign-in state update');
    }
    if (combined.includes('cors') || combined.includes('api') || combined.includes('token')) {
      frontendRisks.push('Overly permissive CORS headers allowing cross-origin credentialed requests from attacker infrastructure');
      frontendRisks.push('Absence of strict Content-Security-Policy (CSP) headers allowing external script execution');
    }
    if (frontendRisks.length === 0) {
      frontendRisks.push('Review client-side session timeout enforcement and MFA step-up authentication on sensitive operations');
    }

    // Actionable Containment Actions
    users.forEach(u => {
      containmentActions.push({
        id: `act-revoke-${u.id}`,
        title: `Revoke all active sessions and refresh tokens for ${u.value}`,
        actionType: 'REVOKE_SESSIONS',
        target: u.value,
        status: 'PENDING',
        automated: true
      });
      containmentActions.push({
        id: `act-pwd-${u.id}`,
        title: `Force password reset & verify MFA registration for ${u.value}`,
        actionType: 'RESET_PASSWORD',
        target: u.value,
        status: 'PENDING',
        automated: false
      });
    });

    hosts.forEach(h => {
      containmentActions.push({
        id: `act-iso-${h.id}`,
        title: `Isolate endpoint ${h.value} via Defender for Endpoint`,
        actionType: 'ISOLATE_HOST',
        target: h.value,
        status: 'PENDING',
        automated: true
      });
    });

    ips.forEach(ip => {
      containmentActions.push({
        id: `act-blk-${ip.id}`,
        title: `Add IP ${ip.value} to perimeter firewall & Sentinel blocklist`,
        actionType: 'BLOCK_IP',
        target: ip.value,
        status: 'PENDING',
        automated: true
      });
    });

    files.forEach(f => {
      containmentActions.push({
        id: `act-quar-${f.id}`,
        title: `Quarantine file artifact ${f.value} across all fleet devices`,
        actionType: 'QUARANTINE_FILE',
        target: f.value,
        status: 'PENDING',
        automated: true
      });
    });

    // Remediation Guidance (Root-cause focused, strict defensive best practices)
    remediationGuidance.push('Ensure conditional access policies strictly enforce Phishing-Resistant MFA (FIDO2 / Windows Hello for Business).');
    remediationGuidance.push('Verify Endpoint Detection and Response (MDE) automated investigation and remediation (AIR) is set to Full Remediation mode.');
    remediationGuidance.push('Implement strict Content-Security-Policy (CSP) and HttpOnly/SameSite=Strict cookie flags across customer-facing and employee web interfaces.');
    remediationGuidance.push('Audit Azure App Registrations and verify that no unauthorized service principals hold Mail.ReadWrite or Directory.ReadWrite permissions.');

    // Overall Risk Level calculation
    let riskLevel: IncidentSeverity = incident.severity;
    if (containmentActions.some(a => a.actionType === 'ISOLATE_HOST' || a.actionType === 'REVOKE_SESSIONS') && riskLevel === 'LOW') {
      riskLevel = 'MEDIUM';
    }

    return {
      assessedAt: new Date().toISOString(),
      overallRiskLevel: riskLevel,
      summary: `Threat Oversight Assessment for Incident ${incident.incidentNumber || incident.id}: High confidence adversarial activity evaluated across ${trustBoundariesViolated.length} trust boundaries with ${containmentActions.length} immediate containment measures recommended.`,
      trustBoundariesViolated,
      attackScenario,
      evidence,
      frontendRisks,
      containmentActions,
      remediationGuidance
    };
  }
}

