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
    const subject = `[PhishPilot Analysis] ${isPhish ? 'Threat Confirmed: ' : isSuspicious ? 'Caution Recommended: ' : 'Verified Safe: '}${report.emailSummary.subject || 'Reported Email'}`;

    const badgeColor = isPhish ? '#ef4444' : isSuspicious ? '#f59e0b' : '#10b981';
    const badgeText = report.verdict;

    const triggeredReasons = report.riskBreakdown.items
      .filter(i => i.triggered)
      .map(i => `<li style="margin-bottom: 6px;"><strong>${i.condition}</strong>: <span style="color: #64748b;">${i.detail || ''}</span></li>`)
      .join('');

    const actionsHtml = report.recommendedActions
      .map(a => `<li style="margin-bottom: 4px;">${a}</li>`)
      .join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { background: #0f172a; padding: 24px; text-align: center; color: #ffffff; }
    .logo { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #38bdf8; margin-bottom: 4px; }
    .badge { display: inline-block; padding: 6px 16px; border-radius: 9999px; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #ffffff; background-color: ${badgeColor}; margin-top: 12px; }
    .content { padding: 24px; line-height: 1.6; font-size: 14px; }
    .box { background: #f1f5f9; border-left: 4px solid ${badgeColor}; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">PhishPilot SecOps</div>
      <div style="font-size: 13px; color: #94a3b8;">Automated Threat Evaluation & Coaching</div>
      <div class="badge">Verdict: ${badgeText} (Score: ${report.riskScore}/100)</div>
    </div>
    <div class="content">
      <p>Hello ${reporterName || 'Colleague'},</p>
      <p>Thank you for reporting the suspicious message: <em>"${report.emailSummary.subject}"</em>.</p>
      
      <div class="box">
        <strong>Security Analysis Summary:</strong>
        <p style="margin: 6px 0 0 0;">Our multi-layered AI and deterministic engine evaluated this message with <strong>${(report.confidence * 100).toFixed(0)}% confidence</strong>.</p>
      </div>

      ${triggeredReasons ? `
      <p><strong>Key Indicators Identified:</strong></p>
      <ul style="padding-left: 20px;">
        ${triggeredReasons}
      </ul>
      ` : ''}

      <p><strong>Recommended Actions:</strong></p>
      <ul style="padding-left: 20px;">
        ${actionsHtml}
      </ul>

      <p style="margin-top: 20px; font-size: 13px; color: #475569;">
        <em>Security Tip:</em> Cyber attackers frequently use fake urgency and executive names. Always verify unexpected payment or login requests through an alternate verified channel (such as Microsoft Teams or phone).
      </p>
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

