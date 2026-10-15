import fs from 'fs/promises';
import path from 'path';
import { IngestionSchedulerConfig, SyncTrigger, UnifiedIncident } from '../types/security.js';
import { SentinelConnector } from './sentinelConnector.js';
import { GraphConnector } from './graphConnector.js';
import { store } from './store.js';
import { WebhookNotifierService } from './webhookNotifier.js';
import { SyncLogService } from './syncLogService.js';
import { MailboxPollerService } from './phishpilot/mailboxPoller.js';

const CONFIG_FILE = path.resolve('.msec_data/scheduler_config.json');

export class IngestionSchedulerService {
  private static sentinelTimer: NodeJS.Timeout | null = null;
  private static graphTimer: NodeJS.Timeout | null = null;

  private static config: IngestionSchedulerConfig = {
    sentinelEnabled: false,
    sentinelIntervalMinutes: 5,
    graphEnabled: false,
    graphIntervalMinutes: 5,
    status: 'IDLE',
    totalAutoIngested: 0
  };

  public static async init(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
      const raw = await fs.readFile(CONFIG_FILE, 'utf-8');
      this.config = { ...this.config, ...JSON.parse(raw) };
    } catch {
      // Default config
    }

    if (this.config.sentinelEnabled) {
      this.startSentinelPoller();
    }
    if (this.config.graphEnabled) {
      this.startGraphPoller();
    }
  }

  public static getConfig(): IngestionSchedulerConfig {
    return this.config;
  }

  public static async updateConfig(newConfig: Partial<IngestionSchedulerConfig>): Promise<IngestionSchedulerConfig> {
    this.config = { ...this.config, ...newConfig };
    await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
    await fs.writeFile(CONFIG_FILE, JSON.stringify(this.config, null, 2));

    if (this.config.sentinelEnabled) {
      this.startSentinelPoller();
    } else {
      this.stopSentinelPoller();
    }

    if (this.config.graphEnabled) {
      this.startGraphPoller();
    } else {
      this.stopGraphPoller();
    }

    return this.config;
  }

  public static startSentinelPoller(): void {
    this.stopSentinelPoller();
    const intervalMs = Math.max(1, this.config.sentinelIntervalMinutes) * 60 * 1000;
    this.sentinelTimer = setInterval(() => {
      this.syncSentinel('SCHEDULED').catch(err => console.error('[Scheduler] Sentinel auto-sync error:', err));
    }, intervalMs);
    this.sentinelTimer.unref();
    console.log(`[Scheduler] Started background Sentinel polling every ${this.config.sentinelIntervalMinutes}m`);
  }

  public static stopSentinelPoller(): void {
    if (this.sentinelTimer) {
      clearInterval(this.sentinelTimer);
      this.sentinelTimer = null;
    }
  }

  public static startGraphPoller(): void {
    this.stopGraphPoller();
    const intervalMs = Math.max(1, this.config.graphIntervalMinutes) * 60 * 1000;
    this.graphTimer = setInterval(() => {
      this.syncGraph('SCHEDULED').catch(err => console.error('[Scheduler] Graph/Defender auto-sync error:', err));
    }, intervalMs);
    this.graphTimer.unref();
    console.log(`[Scheduler] Started background Graph/Defender polling every ${this.config.graphIntervalMinutes}m`);
  }

  public static stopGraphPoller(): void {
    if (this.graphTimer) {
      clearInterval(this.graphTimer);
      this.graphTimer = null;
    }
  }

  public static async syncSentinel(trigger: SyncTrigger = 'MANUAL'): Promise<{ importedCount: number; errors: string[] }> {
    const startTime = Date.now();
    const sentinelConfig = store.getConfig().sentinel;
    if (!sentinelConfig.workspaceName || !sentinelConfig.subscriptionId) {
      const err = 'Sentinel workspace or subscription not configured.';
      SyncLogService.addLog({
        timestamp: new Date().toISOString(),
        source: 'SENTINEL',
        sourceLabel: 'Microsoft Sentinel SIEM',
        trigger,
        status: 'ERROR',
        importedCount: 0,
        durationMs: Date.now() - startTime,
        message: 'Sentinel sync failed: workspace or subscription not configured.',
        errors: [err]
      });
      return { importedCount: 0, errors: [err] };
    }

    this.config.status = 'SYNCING';
    try {
      const res = await SentinelConnector.sync(sentinelConfig);
      const durationMs = Date.now() - startTime;
      this.config.lastSentinelSync = new Date().toISOString();
      this.config.status = 'SUCCESS';
      this.config.lastError = undefined;
      this.config.totalAutoIngested += res.importedCount;

      SyncLogService.addLog({
        timestamp: new Date().toISOString(),
        source: 'SENTINEL',
        sourceLabel: 'Microsoft Sentinel SIEM',
        trigger,
        status: res.errors?.length && res.importedCount === 0 ? 'ERROR' : 'SUCCESS',
        importedCount: res.importedCount,
        durationMs,
        message: res.importedCount > 0
          ? `Ingested ${res.importedCount} incident(s) from Sentinel workspace "${sentinelConfig.workspaceName}".`
          : `Sentinel sync completed. No new incidents found in "${sentinelConfig.workspaceName}".`,
        details: `Workspace: ${sentinelConfig.workspaceName} | Subscription: ${sentinelConfig.subscriptionId?.substring(0, 8)}...`,
        errors: res.errors?.length ? res.errors : undefined
      });

      // Notify webhooks if any new critical/high incidents arrived
      if (res.importedCount > 0) {
        const latestIncidents = store.getAll().slice(0, res.importedCount);
        WebhookNotifierService.notifyIncidents(latestIncidents).catch(err => {
          console.error('[Scheduler] Webhook notification error:', err);
        });
      }

      await this.saveState();
      return res;
    } catch (e: any) {
      const durationMs = Date.now() - startTime;
      this.config.status = 'ERROR';
      this.config.lastError = e.message;
      SyncLogService.addLog({
        timestamp: new Date().toISOString(),
        source: 'SENTINEL',
        sourceLabel: 'Microsoft Sentinel SIEM',
        trigger,
        status: 'ERROR',
        importedCount: 0,
        durationMs,
        message: `Sentinel sync failed: ${e.message}`,
        errors: [e.message]
      });
      await this.saveState();
      return { importedCount: 0, errors: [e.message] };
    }
  }

  public static async syncGraph(trigger: SyncTrigger = 'MANUAL'): Promise<{ importedCount: number; errors: string[] }> {
    const startTime = Date.now();
    const graphConfig = store.getConfig().graph;
    if (!graphConfig.tenantId || !graphConfig.clientId) {
      const err = 'Graph credentials not configured.';
      SyncLogService.addLog({
        timestamp: new Date().toISOString(),
        source: 'GRAPH_DEFENDER',
        sourceLabel: 'M365 Defender (Graph)',
        trigger,
        status: 'ERROR',
        importedCount: 0,
        durationMs: Date.now() - startTime,
        message: 'Graph Defender sync failed: credentials not configured in Connectors.',
        errors: [err]
      });
      return { importedCount: 0, errors: [err] };
    }

    this.config.status = 'SYNCING';
    try {
      const res = await GraphConnector.sync(graphConfig);
      const durationMs = Date.now() - startTime;
      this.config.lastGraphSync = new Date().toISOString();
      this.config.status = 'SUCCESS';
      this.config.lastError = undefined;
      this.config.totalAutoIngested += res.importedCount;

      SyncLogService.addLog({
        timestamp: new Date().toISOString(),
        source: 'GRAPH_DEFENDER',
        sourceLabel: 'M365 Defender (Graph)',
        trigger,
        status: res.errors?.length && res.importedCount === 0 ? 'ERROR' : 'SUCCESS',
        importedCount: res.importedCount,
        durationMs,
        message: res.importedCount > 0
          ? `Ingested ${res.importedCount} alert(s)/incident(s) from Microsoft Graph Security API.`
          : 'Graph Defender sync completed. No new alerts found.',
        details: `Tenant: ${graphConfig.tenantId?.substring(0, 8)}... | Client ID: ${graphConfig.clientId?.substring(0, 8)}...`,
        errors: res.errors?.length ? res.errors : undefined
      });

      if (res.importedCount > 0) {
        const latestIncidents = store.getAll().slice(0, res.importedCount);
        WebhookNotifierService.notifyIncidents(latestIncidents).catch(err => {
          console.error('[Scheduler] Webhook notification error:', err);
        });
      }

      await this.saveState();
      return res;
    } catch (e: any) {
      const durationMs = Date.now() - startTime;
      this.config.status = 'ERROR';
      this.config.lastError = e.message;
      SyncLogService.addLog({
        timestamp: new Date().toISOString(),
        source: 'GRAPH_DEFENDER',
        sourceLabel: 'M365 Defender (Graph)',
        trigger,
        status: 'ERROR',
        importedCount: 0,
        durationMs,
        message: `Graph Defender sync failed: ${e.message}`,
        errors: [e.message]
      });
      await this.saveState();
      return { importedCount: 0, errors: [e.message] };
    }
  }

  public static async syncAll(trigger: SyncTrigger = 'MANUAL'): Promise<{
    sentinel: { importedCount: number; errors: string[] };
    graph: { importedCount: number; errors: string[] };
    mailbox?: { processedCount: number; error?: string };
    totalImported: number;
  }> {
    const [sentinelRes, graphRes] = await Promise.all([
      this.syncSentinel(trigger),
      this.syncGraph(trigger)
    ]);

    let mailboxRes: { processedCount: number; error?: string } | undefined = undefined;
    try {
      const mailboxConfig = MailboxPollerService.getConfig();
      if (mailboxConfig.enabled) {
        const mRes = await MailboxPollerService.syncMailbox(trigger);
        mailboxRes = { processedCount: mRes.processedCount, error: mRes.error };
      }
    } catch (mErr: any) {
      mailboxRes = { processedCount: 0, error: mErr.message };
    }

    const totalImported = (sentinelRes.importedCount || 0) + (graphRes.importedCount || 0) + (mailboxRes?.processedCount || 0);

    return {
      sentinel: sentinelRes,
      graph: graphRes,
      mailbox: mailboxRes,
      totalImported
    };
  }

  private static async saveState(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
      await fs.writeFile(CONFIG_FILE, JSON.stringify(this.config, null, 2));
    } catch {
      // Ignore write errors
    }
  }
}

