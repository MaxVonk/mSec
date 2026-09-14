import { Router } from 'express';
import { UnifiedIncident } from '../types/security.js';

const router = Router();

interface CopilotChatRequest {
  prompt: string;
  incident?: UnifiedIncident;
  socStats?: { total: number; critical: number; high: number; active: number };
}

/**
 * Smart Offline SecOps Intelligence Engine
 * Generates tailored KQL queries, incident blast radius analyses, and containment scripts.
 */
function generateOfflineSecOpsResponse(prompt: string, incident?: UnifiedIncident): string {
  const p = prompt.toLowerCase();
  const incTitle = incident?.title || 'Active Cyber Incident';
  const incId = incident?.id || 'INC-CURRENT';
  const user = incident?.entities?.find(e => e.type === 'USER')?.value || 'jdoe@example.com';
  const host = incident?.entities?.find(e => e.type === 'HOST')?.value || 'DESKTOP-SEC-8901';
  const ip = incident?.entities?.find(e => e.type === 'IP')?.value || '194.26.29.112';

  if (p.includes('kql') || p.includes('query') || p.includes('hunting')) {
    return `### 🔍 Microsoft Sentinel / Defender Advanced Hunting KQL Query

\`\`\`kql
// Hunting query for Incident ${incId}: ${incTitle}
let TargetUser = "${user}";
let TargetDevice = "${host}";
let MaliciousIp = "${ip}";

// 1. Correlate Process Execution & Command Line Activity
DeviceProcessEvents
| where Timestamp >= ago(24h)
| where DeviceName =~ TargetDevice or AccountUpn =~ TargetUser
| where ProcessCommandLine has_any ("powershell", "cmd.exe", "rundll32", "certutil", "mimikatz")
| project Timestamp, DeviceName, AccountUpn, FileName, ProcessCommandLine, InitiatingProcessFileName

// 2. Identify Outbound Network Connections to C2 / External IP
union (
    DeviceNetworkEvents
    | where Timestamp >= ago(24h)
    | where RemoteIP == MaliciousIp or DeviceName =~ TargetDevice
    | project Timestamp, ActionType, DeviceName, RemoteIP, RemotePort, RemoteUrl
), (
    SigninLogs
    | where TimeGenerated >= ago(24h)
    | where UserPrincipalName =~ TargetUser or IPAddress == MaliciousIp
    | project TimeGenerated, UserPrincipalName, IPAddress, AppDisplayName, Status
)
| sort by Timestamp desc
\`\`\`

**Recommendation:** Run this in the Microsoft Defender Portal under *Hunting* > *Advanced Hunting* or Sentinel *Logs* to establish lateral movement timelines.`;
  }

  if (p.includes('summary') || p.includes('blast radius') || p.includes('executive')) {
    const mitreDisplay = incident?.mitreTechniques?.map(m => `${m.techniqueId} (${m.tactic})`).join(', ') || 'Initial Access, Credential Access, Command & Control';
    return `### 📋 Executive Incident Assessment & Blast Radius Analysis

* **Incident Identifier:** \`${incId}\`
* **Threat Classification:** **${incTitle}** (${incident?.severity || 'HIGH'} Severity)
* **Primary Scope & Blast Radius:**
  * **Identities at Risk:** ${user} (Privilege level inspection recommended)
  * **Affected Endpoints:** ${host}
  * **External Threat Actor Infrastructure:** ${ip} (C2 / Malicious Egress)
  * **MITRE ATT&CK Mapping:** ${mitreDisplay}

**Operational Impact:**
Potential lateral credential theft and token extraction detected. Host has active connections to external infrastructure. Containment is advised before next shift rotation.`;
  }

  if (p.includes('containment') || p.includes('contain') || p.includes('remediat') || p.includes('isolate')) {
    return `### ⚡ Actionable Containment & Mitigation Playbook

1. **Identity Protection (Microsoft Entra ID)**:
   * Execute immediate session revocation to kill attacker-controlled browser cookies and refresh tokens:
     \`\`\`powershell
     Revoke-AzureADUserAllRefreshToken -ObjectId (Get-AzureADUser -SearchString "${user}").ObjectId
     \`\`\`
   * Set user password reset flag: \`forceChangePasswordNextSignIn = $true\`.

2. **Endpoint Defense (Defender for Endpoint)**:
   * Network-isolate host **${host}** via Defender portal or Live Response.
   * Terminate active anomalous child shells and extract memory dump for forensic analysis.

3. **Perimeter Firewall & Egress Blockade**:
   * Add drop indicator rule for IP **${ip}** in Microsoft Defender Network Protection indicators.`;
  }

  if (p.includes('email') || p.includes('draft') || p.includes('notify')) {
    return `### ✉️ Draft Security Advisory to Affected Employee

**Subject:** Action Required: Urgent Security Verification for ${user}

Dear ${user.split('@')[0]},

Our Security Operations Center (SOC) detected anomalous security events associated with your account on endpoint **${host}**.

As a precautionary security measure:
1. All active Microsoft 365 sessions and mobile email logins have been temporarily revoked.
2. Please do not approve any multi-factor authentication (MFA) prompts you did not initiate.
3. Upon your next login, you will be prompted to reset your password.

If you suspect you received a suspicious phishing email or prompt, please contact the Security Operations Team immediately at soc@example.com.

Sincerely,  
*mSec Unified Security Operations Center*`;
  }

  return `### 🛡️ mSec SecOps Analysis for: ${incTitle}

* **Target Asset:** ${host} (${user})
* **Status:** Under Active Investigation
* **Key Observations:**
  * Telemetry indicates correlation between alert evidence and external indicators (${ip}).
  * Recommend executing the automated **Compromised Identity Rapid Lockdown** or **Ransomware Host Isolation** playbook.
  * You can ask me to:
    * *"Generate KQL hunting query"*
    * *"Summarize blast radius"*
    * *"Draft notification email"*
    * *"Provide containment steps"*`;
}

router.post('/chat', async (req, res) => {
  const { prompt, incident } = req.body as CopilotChatRequest;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_FULL || process.env.AZURE_OPENAI_DEPLOYMENT_MINI || 'gpt-4o';

  // If Azure OpenAI is configured, attempt cloud LLM completion
  if (endpoint && apiKey) {
    try {
      const apiVersion = '2024-02-15-preview';
      const cleanEndpoint = endpoint.replace(/\/+$/, '');
      const url = `${cleanEndpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

      const systemPrompt = `You are mSec Copilot, an elite Tier-3 Cyber Security Operations Center (SOC) AI Analyst.
You assist incident responders analyzing Microsoft 365 Defender XDR, Microsoft Sentinel SIEM, and Entra ID telemetry.
Provide concise, tactical, and immediately actionable answers with KQL queries, containment steps, or clear threat explanations.`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Incident Context: ${JSON.stringify(incident || {})}\n\nAnalyst Question: ${prompt}`
            }
          ],
          temperature: 0.2,
          max_tokens: 800
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          return res.json({ reply: content, source: 'azure-openai' });
        }
      }
    } catch {
      // Fall through to offline SecOps engine
    }
  }

  // Fallback to rich offline SecOps reasoning engine
  const offlineReply = generateOfflineSecOpsResponse(prompt, incident);
  res.json({ reply: offlineReply, source: 'offline-secops-engine' });
});

export default router;
