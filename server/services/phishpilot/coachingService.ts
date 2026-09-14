import { PhishPilotReport } from '../../types/phishpilot.js';
import { GraphConnector } from '../graphConnector.js';
import { store } from '../store.js';

export class CoachingService {
  /**
   * Generates a branded, educational security response email for the reporting employee
   */
  public static generateCoachingHtml(report: PhishPilotReport, reporterName?: string): { subject: string; html: string } {
    const isPhish = report.verdict === 'PHISHING';
    const isSuspicious = report.verdict === 'SUSPICIOUS';
    const isLegit = report.verdict === 'LEGITIMATE';

    const subject = `[PhishPilot Analysis] ${isPhish ? 'Threat Confirmed: ' : isSuspicious ? 'Caution Recommended: ' : 'Verified Safe: '}${report.emailSummary.subject || 'Reported Email'}`;

    // Verdict Badge styling & copy
    const badgeColor = isPhish ? '#ef4444' : isSuspicious ? '#f59e0b' : '#10b981';
    const badgeTitle = isPhish 
      ? '🚨 MALICIOUS THREAT BLOCKED' 
      : isSuspicious 
      ? '⚠️ CAUTION RECOMMENDED' 
      : '✅ VERIFIED SAFE • NO THREAT DETECTED';

    const riskSubtext = isPhish 
      ? `Verdict: PHISHING (Threat Risk Score: ${report.riskScore}/100 - High Risk)`
      : isSuspicious 
      ? `Verdict: SUSPICIOUS (Threat Risk Score: ${report.riskScore}/100 - Caution)`
      : `Verdict: LEGITIMATE (Risk Score: ${report.riskScore}/100 - Clean)`;

    // Human-friendly greeting
    let greetingName = 'there';
    if (reporterName) {
      if (reporterName.includes('@')) {
        const localPart = reporterName.split('@')[0];
        greetingName = localPart.split('.')[0];
        greetingName = greetingName.charAt(0).toUpperCase() + greetingName.slice(1);
      } else {
        greetingName = reporterName.split(' ')[0];
      }
    }

    // Verdict-aware Security Analysis Summary
    const analysisSummary = isLegit
      ? '<strong>This email passed all security inspections.</strong> The sender\'s identity, domain authentication (SPF, DKIM, DMARC), and embedded links have been verified as legitimate with zero malicious indicators detected.'
      : isSuspicious
      ? '<strong>This email contains suspicious or unusual characteristics.</strong> While not conclusively malware, factors such as mismatched display names or newly registered domains suggest you should proceed with high caution.'
      : '<strong>This email was confirmed as a malicious phishing attack.</strong> It was designed to deceive you into disclosing confidential login credentials or downloading untrusted files.';

    // Verdict-aware Actionable Steps
    const actionableSteps = isLegit
      ? [
          '<strong>Safe to proceed:</strong> You can safely open, read, and reply to this email in your inbox.',
          '<strong>General safety:</strong> If any email ever asks for unexpected bank account changes, passwords, or gift card purchases, always verify by calling the sender.'
        ]
      : isSuspicious
      ? [
          '<strong>Do not click links or open attachments</strong> until you verify the sender directly via Microsoft Teams or phone.',
          'If you did not expect this communication, consider deleting it or leaving it in your Junk folder.'
        ]
      : [
          '<strong>No action needed by you:</strong> The threat has been safely quarantined and blocked across the organization.',
          '<strong>If you already clicked a link:</strong> Please reset your Microsoft 365 password immediately and inform the Security Team (soc@example.com).'
        ];

    // Verdict-aware Tip / Reinforcement
    const coachingTip = isLegit
      ? '<strong>👏 Great job staying vigilant!</strong> Even though this email turned out to be safe, reporting emails whenever you feel unsure is exactly what keeps our entire organization protected. Thank you for your diligence!'
      : isSuspicious
      ? '<strong>💡 Security Tip:</strong> Attackers often impersonate trusted vendor display names while using unrelated external email addresses. Always check the actual sender address behind the name.'
      : '<strong>💡 Security Tip:</strong> Cyber attackers frequently use fake urgency and executive names. Always verify unexpected payment or login requests through an alternate verified channel.';

    const triggeredReasons = report.riskBreakdown.items
      .filter(i => i.triggered)
      .map(i => `<li style="margin-bottom: 6px;"><strong>${i.condition}</strong>: <span style="color: #64748b;">${i.detail || ''}</span></li>`)
      .join('');

    const actionsHtml = actionableSteps
      .map(a => `<li style="margin-bottom: 6px;">${a}</li>`)
      .join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08); }
    .header { background: #0f172a; padding: 28px 24px; text-align: center; color: #ffffff; }
    .logo { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #38bdf8; margin-bottom: 4px; font-family: inherit; }
    .badge { display: inline-block; padding: 8px 18px; border-radius: 9999px; font-weight: 800; font-size: 13px; letter-spacing: 0.5px; color: #ffffff; background-color: ${badgeColor}; margin-top: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2); }
    .risk-subtitle { font-size: 12px; color: #94a3b8; margin-top: 8px; font-family: monospace; }
    .content { padding: 28px 24px; line-height: 1.6; font-size: 14px; }
    .box { background: #f8fafc; border-left: 4px solid ${badgeColor}; padding: 14px 18px; margin: 18px 0; border-radius: 0 10px 10px 0; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
    .tip-box { background: ${isLegit ? '#ecfdf5' : '#f8fafc'}; border: 1px solid ${isLegit ? '#a7f3d0' : '#e2e8f0'}; border-radius: 10px; padding: 14px 18px; margin-top: 24px; font-size: 13px; color: ${isLegit ? '#065f46' : '#475569'}; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">PhishPilot SecOps</div>
      <div style="font-size: 13px; color: #94a3b8;">Automated Threat Evaluation & Coaching</div>
      <div>
        <span class="badge">${badgeTitle}</span>
      </div>
      <div class="risk-subtitle">${riskSubtext}</div>
    </div>
    <div class="content">
      <p style="font-size: 15px; margin-top: 0;">Hello ${greetingName},</p>
      <p>Thank you for reporting the email: <em>"${report.emailSummary.subject || 'Reported Email'}"</em>.</p>
      
      <div class="box">
        <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px;">Security Analysis Summary:</div>
        <div style="color: #334155;">${analysisSummary}</div>
      </div>

      ${triggeredReasons ? `
      <p style="margin-top: 20px;"><strong>Key Indicators Identified:</strong></p>
      <ul style="padding-left: 20px; color: #334155;">
        ${triggeredReasons}
      </ul>
      ` : ''}

      <p style="margin-top: 20px; font-weight: 700; color: #0f172a;">What you should do:</p>
      <ul style="padding-left: 20px; color: #334155;">
        ${actionsHtml}
      </ul>

      <div class="tip-box">
        ${coachingTip}
      </div>
    </div>
    <div class="footer">
      Generated automatically by <strong>PhishPilot</strong> &bull; mSec Security Operations Center
    </div>
  </div>
</body>
</html>
    `;

    return { subject, html };
  }

  /**
   * Sends the coaching reply back via Microsoft Graph if mailbox credentials exist
   */
  public static async sendCoachingFeedback(report: PhishPilotReport, recipientEmail: string): Promise<boolean> {
    const { subject, html } = this.generateCoachingHtml(report);
    const graphConfig = store.getConfig().graph;
    const hasLiveGraph = !!(graphConfig.tenantId && graphConfig.clientId && graphConfig.clientSecret);

    if (hasLiveGraph) {
      try {
        const token = await GraphConnector.getAccessToken(graphConfig);
        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

        const sendUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(recipientEmail)}/sendMail`;
        const res = await fetch(sendUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            message: {
              subject,
              body: {
                contentType: 'HTML',
                content: html
              },
              toRecipients: [
                { emailAddress: { address: recipientEmail } }
              ]
            },
            saveToSentItems: false
          })
        });

        return res.ok;
      } catch (err) {
        console.error('[CoachingService] Error sending feedback email:', err);
      }
    } else {
      console.log(`[CoachingService] (Simulation) Automated feedback email generated for ${recipientEmail}: "${subject}"`);
      return true;
    }

    return false;
  }
}

