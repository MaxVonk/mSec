import fs from 'fs/promises';
import path from 'path';
import { SyncLogEntry, SyncLogStats } from '../types/security.js';

const LOG_FILE = path.resolve('.msec_data/sync_logs.json');
const MAX_LOGS = 200;

export class SyncLogService {
  private static logs: SyncLogEntry[] = [];
  private static isInitialized = false;

  public static async init(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
      const raw = await fs.readFile(LOG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.logs = parsed.slice(0, MAX_LOGS);
      }
    } catch {
      this.logs = [];
    }
    this.isInitialized = true;
  }

  public static addLog(entry: Omit<SyncLogEntry, 'id'>): SyncLogEntry {
    const newLog: SyncLogEntry = {
      ...entry,
      id: `sync-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    };

    this.logs.unshift(newLog);
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(0, MAX_LOGS);
    }

    this.saveState().catch(err => console.error('[SyncLogService] Failed to persist log:', err));
    return newLog;
  }

  public static getLogs(limit = 100, filter?: { source?: string; status?: string; trigger?: string }): SyncLogEntry[] {
    let result = this.logs;
    if (filter) {
      if (filter.source && filter.source !== 'ALL') {
        result = result.filter(l => l.source === filter.source);
      }
      if (filter.status && filter.status !== 'ALL') {
        result = result.filter(l => l.status === filter.status);
      }
      if (filter.trigger && filter.trigger !== 'ALL') {
        result = result.filter(l => l.trigger === filter.trigger);
      }
    }
    return result.slice(0, Math.max(1, limit));
  }

  public static getStats(): SyncLogStats {
    let successCount = 0;
    let errorCount = 0;
    let totalImported = 0;

    for (const log of this.logs) {
      if (log.status === 'SUCCESS') successCount++;
      if (log.status === 'ERROR') errorCount++;
      totalImported += log.importedCount || 0;
    }

    return {
      totalRuns: this.logs.length,
      successCount,
      errorCount,
      totalImported,
      lastSync: this.logs[0] || undefined
    };
  }

  public static async clearLogs(): Promise<void> {
    this.logs = [];
    await this.saveState();
  }

  private static async saveState(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
      await fs.writeFile(LOG_FILE, JSON.stringify(this.logs, null, 2));
    } catch (err) {
      // Ignore write errors
    }
  }
}
