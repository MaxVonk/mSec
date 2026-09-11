import fs from 'fs/promises';
import path from 'path';
import { WebhookConfig, UnifiedIncident, IncidentSeverity } from '../types/security.js';

const CONFIG_FILE = path.resolve('.msec_data/webhook_config.json');

const SEVERITY_ORDER: Record<IncidentSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  INFORMATIONAL: 0
};

export class WebhookNotifierService {
  private static config: WebhookConfig = {
    teamsWebhookUrl: process.env.TEAMS_WEBHOOK_URL || '',
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',
    customWebhookUrl: process.env.CUSTOM_WEBHOOK_URL || '',
    enabled: Boolean(process.env.TEAMS_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL),
    minSeverity: 'HIGH',
    notifyOnPhishing: true,
    notifyOnContainmentAction: true
  };

  public static async init(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
      const raw = await fs.readFile(CONFIG_FILE, 'utf-8');
      this.config = { ...this.config, ...JSON.parse(raw) };
    } catch {
      // Default config
    }
  }

  public static getConfig(): WebhookConfig {
    return this.config;
  }

  public static async updateConfig(newConfig: Partial<WebhookConfig>): Promise<WebhookConfig> {
    this.config = { ...this.config, ...newConfig };
    await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
    await fs.writeFile(CONFIG_FILE, JSON.stringify(this.config, null, 2));
    return this.config;
  }

  /**
   * Dispatches alerts for new or escalated incidents
   */
  public static async notifyIncidents(incidents: UnifiedIncident[]): Promise<{ sent: number; errors: string[] }> {
    if (!this.config.enabled) return { sent: 0, errors: [] };

    const minRank = SEVERITY_ORDER[this.config.minSeverity] || 3;
    const qualifying = incidents.filter(i => (SEVERITY_ORDER[i.severity] || 0) >= minRank);

    let sent = 0;
    const errors: string[] = [];

    for (const inc of qualifying) {
      try {
        await this.dispatchIncident(inc);
        sent++;
      } catch (e: any) {
        errors.push(`Failed to dispatch webhook for ${inc.id}: ${e.message}`);
      }
    }

    return { sent, errors };
  }

  /**
   * Dispatches alert for confirmed phishing email report
   */
  public static async notifyPhishing(report: any): Promise<void> {
    if (!this.config.enabled || !this.config.notifyOnPhishing) return;
    if (report.verdict !== 'PHISHING') return;

    const promises: Promise<any>[] = [];

    if (this.config.teamsWebhookUrl) {
      const teamsPayload = {
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        summary: `🚨 PhishPilot Alert: Phishing Email Detected [${report.riskScore}/100]`,
        themeColor: 'EF4444',
        title: `🚨 PhishPilot Detections: Phishing Reported`,
        sections: [
          {
            activityTitle: report.subject || '(No Subject)',
            activitySubtitle: `From: ${report.from || 'Unknown'} | Reporter: ${report.reporterEmail || 'Internal Employee'}`,
            facts: [
              { name: 'Risk Score', value: `${report.riskScore} / 100` },
              { name: 'SPF / DKIM / DMARC', value: `SPF: ${report.authResults?.spf || 'N/A'}, DMARC: ${report.authResults?.dmarc || 'N/A'}` },
              { name: 'Malicious URLs', value: `${(report.urlAnalysis || []).filter((u: any) => u.isMalicious).length} flagged` },
              { name: 'Primary Indicators', value: (report.reasons || []).slice(0, 3).join('; ') || 'Heuristic threat indicators' }
            ]
          }
        ]
      };
      promises.push(this.postJson(this.config.teamsWebhookUrl, teamsPayload));
    }

    if (this.config.slackWebhookUrl) {
      const slackPayload = {
        text: `🚨 *PhishPilot Phishing Detection* (${report.riskScore}/100): ${report.subject}`,
        attachments: [
          {
            color: '#ef4444',
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Subject:* ${report.subject}\n*Sender:* \`${report.from}\`\n*Risk Score:* *${report.riskScore}/100*\n*Summary:* ${(report.reasons || []).slice(0, 2).join(', ')}`
                }
              }
            ]
          }
        ]
      };
      promises.push(this.postJson(this.config.slackWebhookUrl, slackPayload));
    }

    await Promise.allSettled(promises);
  }

  private static async dispatchIncident(inc: UnifiedIncident): Promise<void> {
    const promises: Promise<any>[] = [];

    const affectedUsers = inc.entities.filter(e => e.type === 'USER').map(e => e.value).slice(0, 4);
    const attackerIps = inc.entities.filter(e => e.type === 'IP').map(e => e.value).slice(0, 3);
    const mitreTactics = inc.mitreTechniques.map(m => m.tactic).filter(Boolean).slice(0, 3);

    // Microsoft Teams
    if (this.config.teamsWebhookUrl) {
      const color = inc.severity === 'CRITICAL' ? 'DC2626' : inc.severity === 'HIGH' ? 'EA580C' : '0284C7';
      const teamsCard = {
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        summary: `🚨 [${inc.severity}] ${inc.title}`,
        themeColor: color,
        title: `🚨 [${inc.severity}] ${inc.title}`,
        sections: [
          {
            activityTitle: `Provider: ${inc.provider} | Status: ${inc.status}`,
            text: inc.threatAssessment?.attackScenario || inc.description,
            facts: [
              { name: 'Incident ID', value: `#${inc.incidentNumber || inc.id}` },
              { name: 'Targeted Users', value: affectedUsers.join(', ') || 'None identified' },
              { name: 'Attacker IPs / C2', value: attackerIps.join(', ') || 'None identified' },
              { name: 'MITRE Tactics', value: mitreTactics.join(', ') || 'Generic Alert' }
            ]
          }
        ]
      };
      promises.push(this.postJson(this.config.teamsWebhookUrl, teamsCard));
    }

    // Slack
    if (this.config.slackWebhookUrl) {
      const color = inc.severity === 'CRITICAL' ? '#dc2626' : inc.severity === 'HIGH' ? '#ea580c' : '#0284c7';
      const slackMsg = {
        text: `🚨 *[${inc.severity}] ${inc.title}* (#${inc.incidentNumber || inc.id})`,
        attachments: [
          {
            color,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Severity:* \`${inc.severity}\` | *Provider:* \`${inc.provider}\`\n*Description:* ${inc.threatAssessment?.attackScenario || inc.description}\n*Users:* ${affectedUsers.join(', ') || 'N/A'}\n*IPs:* ${attackerIps.join(', ') || 'N/A'}`
                }
              }
            ]
          }
        ]
      };
      promises.push(this.postJson(this.config.slackWebhookUrl, slackMsg));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Sends simulated test card to verify webhook URL configuration
   */
  public static async testWebhook(target: 'teams' | 'slack' | 'custom', overrideUrl?: string): Promise<{ success: boolean; message: string }> {
    try {
      const url = overrideUrl || (target === 'teams' ? this.config.teamsWebhookUrl 
        : target === 'slack' ? this.config.slackWebhookUrl 
        : this.config.customWebhookUrl);

      if (!url) {
        return { success: false, message: `No URL configured for ${target} webhook.` };
      }

      if (target === 'teams') {
        const payload = {
          '@type': 'MessageCard',
          '@context': 'https://schema.org/extensions',
          summary: 'mSec SOC Webhook Connectivity Test',
          themeColor: '06B6D4',
          title: '✅ mSec SIEM Webhook Connectivity Test',
          text: 'This test message confirms that Microsoft Teams incoming webhook integration is configured and active.'
        };
        await this.postJson(url, payload);
      } else {
        const payload = {
          text: '✅ *mSec SIEM Webhook Connectivity Test*: Slack incoming webhook integration is active!'
        };
        await this.postJson(url, payload);
      }

      return { success: true, message: `Successfully sent test webhook card to ${target}.` };
    } catch (e: any) {
      return { success: false, message: `Webhook delivery failed: ${e.message}` };
    }
  }

  private static async postJson(url: string, body: any): Promise<void> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Webhook endpoint returned HTTP ${res.status}: ${errText}`);
    }
  }
}

