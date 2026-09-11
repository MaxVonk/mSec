import fs from 'fs/promises';
import path from 'path';
import { MailboxPollerConfig, PhishPilotReport } from '../../types/phishpilot.js';
import { GraphConnector } from '../graphConnector.js';
import { store } from '../store.js';
import { ReportGeneratorService } from './reportGenerator.js';
import { CoachingService } from './coachingService.js';

const CONFIG_FILE = path.resolve('.msec_data/phishpilot_mailbox_config.json');

export class MailboxPollerService {
  private static pollTimer: NodeJS.Timeout | null = null;
  private static config: MailboxPollerConfig = {
    mailbox: process.env.PHISHPILOT_MAILBOX || 'phish@company.com',
    enabled: false,
    pollingIntervalMinutes: 5,
    lastStatus: 'IDLE',
    totalImportedCount: 0
  };

  public static async init(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
      const raw = await fs.readFile(CONFIG_FILE, 'utf-8');
      this.config = { ...this.config, ...JSON.parse(raw) };
    } catch {
      // Default config
    }

    if (this.config.enabled) {
      this.startBackgroundPoller();
    }
  }

  public static getConfig(): MailboxPollerConfig {
    return this.config;
  }

  public static async updateConfig(newConfig: Partial<MailboxPollerConfig>): Promise<MailboxPollerConfig> {
    this.config = { ...this.config, ...newConfig };
    await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
    await fs.writeFile(CONFIG_FILE, JSON.stringify(this.config, null, 2));

    if (this.config.enabled) {
      this.startBackgroundPoller();
    } else {
      this.stopBackgroundPoller();
    }

    return this.config;
  }

  public static startBackgroundPoller(): void {
    this.stopBackgroundPoller();
    const intervalMs = Math.max(1, this.config.pollingIntervalMinutes) * 60 * 1000;
    this.pollTimer = setInterval(() => {
      this.syncMailbox().catch(err => console.error('[MailboxPoller] Background sync error:', err));
    }, intervalMs);
    console.log(`[MailboxPoller] Started background polling for ${this.config.mailbox} every ${this.config.pollingIntervalMinutes}m`);
  }

  public static stopBackgroundPoller(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Syncs unread messages from target mailbox in Microsoft 365
   */
  public static async syncMailbox(): Promise<{ processedCount: number; reports: PhishPilotReport[]; error?: string }> {
    const graphConfig = store.getConfig().graph;
    if (!graphConfig.tenantId || !graphConfig.clientId || !graphConfig.clientSecret) {
      const err = 'Microsoft Graph credentials not configured in Connectors settings.';
      this.config.lastStatus = 'ERROR';
      this.config.lastError = err;
      return { processedCount: 0, reports: [], error: err };
    }

    const mailbox = this.config.mailbox;
    if (!mailbox) {
      const err = 'No target mailbox address specified.';
      this.config.lastStatus = 'ERROR';
      this.config.lastError = err;
      return { processedCount: 0, reports: [], error: err };
    }

    try {
      const token = await GraphConnector.getAccessToken(graphConfig);
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // 1. Fetch unread messages from Inbox
      const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/mailFolders/inbox/messages?$top=15&$filter=isRead eq false&$expand=attachments`;
      const res = await fetch(url, { headers });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Graph API mailbox read error (${res.status}): ${errText}`);
      }

      const data = await res.json() as any;
      const messages = Array.isArray(data.value) ? data.value : [];
      const generatedReports: PhishPilotReport[] = [];

      for (const msg of messages) {
        let emlContentToAnalyze: string | Buffer = '';

        // 1. Try to fetch raw MIME ($value) from Graph API (contains all nested .eml attachments intact)
        try {
          const mimeUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages/${msg.id}/$value`;
          const mimeRes = await fetch(mimeUrl, { headers });
          if (mimeRes.ok) {
            const buf = await mimeRes.arrayBuffer();
            emlContentToAnalyze = Buffer.from(buf);
          }
        } catch (mimeErr) {
          console.warn('[MailboxPoller] Could not fetch raw MIME, falling back to message metadata:', mimeErr);
        }

        if (!emlContentToAnalyze) {
          // Check if message contains forwarded .eml attachment in JSON metadata
          const emlAttachment = msg.attachments?.find((att: any) => 
            (att['@odata.type']?.includes('fileAttachment') || att['@odata.type']?.includes('itemAttachment')) && 
            (att.name?.toLowerCase().endsWith('.eml') || att.contentType === 'message/rfc822')
          );

          if (emlAttachment?.contentBytes) {
            emlContentToAnalyze = Buffer.from(emlAttachment.contentBytes, 'base64');
          } else {
            // Construct RFC 822 format from Graph message metadata
            const fromAddr = msg.from?.emailAddress?.address || 'unknown';
            const toAddr = (msg.toRecipients || []).map((r: any) => r.emailAddress?.address).join(', ');
            const subject = msg.subject || '(No Subject)';
            const date = msg.receivedDateTime || new Date().toISOString();
            const body = msg.body?.content || msg.bodyPreview || '';

            emlContentToAnalyze = [
              `From: ${fromAddr}`,
              `To: ${toAddr}`,
              `Subject: ${subject}`,
              `Date: ${date}`,
              `Content-Type: text/html; charset=UTF-8`,
              '',
              body
            ].join('\n');
          }
        }

        if (emlContentToAnalyze) {
          const report = await ReportGeneratorService.generateReport(emlContentToAnalyze);
          generatedReports.push(report);

          // Automated Coaching Reply-Back if enabled
          const reporterEmail = msg.from?.emailAddress?.address;
          if (this.config.enableAutoReply !== false && reporterEmail) {
            CoachingService.sendCoachingFeedback(report, reporterEmail).catch(err => {
              console.error('[MailboxPoller] Error sending coaching reply:', err);
            });
          }

          // Mark message as read in Graph
          await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages/${msg.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ isRead: true })
          }).catch(() => {});
        }
      }

      this.config.lastPollTimestamp = new Date().toISOString();
      this.config.lastStatus = 'SUCCESS';
      this.config.lastError = undefined;
      this.config.totalImportedCount += generatedReports.length;
      await this.updateConfig(this.config);

      return { processedCount: generatedReports.length, reports: generatedReports };
    } catch (e: any) {
      this.config.lastStatus = 'ERROR';
      this.config.lastError = e.message;
      return { processedCount: 0, reports: [], error: e.message };
    }
  }
}

