import fs from 'fs/promises';
import path from 'path';
import { IngestionSchedulerConfig, UnifiedIncident } from '../types/security.js';
import { SentinelConnector } from './sentinelConnector.js';
import { GraphConnector } from './graphConnector.js';
import { store } from './store.js';
import { WebhookNotifierService } from './webhookNotifier.js';

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
      this.syncSentinel().catch(err => console.error('[Scheduler] Sentinel auto-sync error:', err));
    }, intervalMs);
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
      this.syncGraph().catch(err => console.error('[Scheduler] Graph/Defender auto-sync error:', err));
    }, intervalMs);
    console.log(`[Scheduler] Started background Graph/Defender polling every ${this.config.graphIntervalMinutes}m`);
  }

  public static stopGraphPoller(): void {
    if (this.graphTimer) {
      clearInterval(this.graphTimer);
      this.graphTimer = null;
    }
  }

  public static async syncSentinel(): Promise<{ importedCount: number; errors: string[] }> {
    const sentinelConfig = store.getConfig().sentinel;
    if (!sentinelConfig.workspaceName || !sentinelConfig.subscriptionId) {
      return { importedCount: 0, errors: ['Sentinel workspace or subscription not configured.'] };
    }

    this.config.status = 'SYNCING';
    try {
      const beforeCount = store.getAll().length;
      const res = await SentinelConnector.sync(sentinelConfig);
      this.config.lastSentinelSync = new Date().toISOString();
      this.config.status = 'SUCCESS';
      this.config.lastError = undefined;
      this.config.totalAutoIngested += res.importedCount;

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
      this.config.status = 'ERROR';
      this.config.lastError = e.message;
      await this.saveState();
      return { importedCount: 0, errors: [e.message] };
    }
  }

  public static async syncGraph(): Promise<{ importedCount: number; errors: string[] }> {
    const graphConfig = store.getConfig().graph;
    if (!graphConfig.tenantId || !graphConfig.clientId) {
      return { importedCount: 0, errors: ['Graph credentials not configured.'] };
    }

    this.config.status = 'SYNCING';
    try {
      const res = await GraphConnector.sync(graphConfig);
      this.config.lastGraphSync = new Date().toISOString();
      this.config.status = 'SUCCESS';
      this.config.lastError = undefined;
      this.config.totalAutoIngested += res.importedCount;

      if (res.importedCount > 0) {
        const latestIncidents = store.getAll().slice(0, res.importedCount);
        WebhookNotifierService.notifyIncidents(latestIncidents).catch(err => {
          console.error('[Scheduler] Webhook notification error:', err);
        });
      }

      await this.saveState();
      return res;
    } catch (e: any) {
      this.config.status = 'ERROR';
      this.config.lastError = e.message;
      await this.saveState();
      return { importedCount: 0, errors: [e.message] };
    }
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
