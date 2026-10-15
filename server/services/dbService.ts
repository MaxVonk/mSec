import fs from 'fs';
import path from 'path';
import { UnifiedIncident } from '../types/security.js';
import { PhishPilotReport } from '../types/phishpilot.js';

let DatabaseSyncClass: any = null;
try {
  // Use Node.js native embedded SQLite (Node 22.5+)
  const sqlite = await import('node:sqlite');
  DatabaseSyncClass = sqlite.DatabaseSync;
} catch (e) {
  // Native SQLite unavailable in environment
  DatabaseSyncClass = null;
}

export class DatabaseService {
  private static db: any = null;
  private static dbPath: string = '';
  private static isInitialized = false;

  public static init(customPath?: string): boolean {
    if (this.isInitialized && this.db) {
      return true;
    }

    if (!DatabaseSyncClass) {
      console.warn('[DatabaseService] node:sqlite is not available. Using fallback storage.');
      return false;
    }

    try {
      const dataDir = path.resolve(process.cwd(), '.msec_data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.dbPath = customPath || (process.env.MSEC_SQLITE_PATH || path.join(dataDir, 'msec.db'));
      this.db = new DatabaseSyncClass(this.dbPath);

      // Enable WAL mode for high concurrency
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA synchronous = NORMAL;');

      // Create schema
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS incidents (
          id TEXT PRIMARY KEY,
          title TEXT,
          severity TEXT,
          status TEXT,
          provider TEXT,
          created_at TEXT,
          updated_at TEXT,
          payload TEXT
        );

        CREATE TABLE IF NOT EXISTS phishpilot_reports (
          id TEXT PRIMARY KEY,
          verdict TEXT,
          risk_score INTEGER,
          timestamp TEXT,
          payload TEXT
        );

        CREATE TABLE IF NOT EXISTS connector_configs (
          key TEXT PRIMARY KEY,
          config TEXT,
          updated_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
        CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
        CREATE INDEX IF NOT EXISTS idx_phish_verdict ON phishpilot_reports(verdict);
      `);

      this.isInitialized = true;
      console.log(`[DatabaseService] SQLite persistence initialized successfully at ${this.dbPath}`);
      return true;
    } catch (err: any) {
      console.error('[DatabaseService] Failed to initialize SQLite:', err);
      this.db = null;
      return false;
    }
  }

  public static isAvailable(): boolean {
    return this.isInitialized && this.db !== null;
  }

  // --- INCIDENTS ---

  public static saveIncident(inc: UnifiedIncident): void {
    if (!this.isAvailable()) return;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO incidents (id, title, severity, status, provider, created_at, updated_at, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          severity = excluded.severity,
          status = excluded.status,
          provider = excluded.provider,
          updated_at = excluded.updated_at,
          payload = excluded.payload
      `);
      stmt.run(
        inc.id,
        inc.title,
        inc.severity,
        inc.status,
        inc.provider,
        inc.createdTime,
        inc.lastUpdatedTime || new Date().toISOString(),
        JSON.stringify(inc)
      );
    } catch (err: any) {
      console.error(`[DatabaseService] Error saving incident ${inc.id}:`, err.message);
    }
  }

  public static saveIncidentsBatch(incidents: UnifiedIncident[]): void {
    if (!this.isAvailable() || incidents.length === 0) return;
    try {
      this.db.exec('BEGIN TRANSACTION;');
      for (const inc of incidents) {
        this.saveIncident(inc);
      }
      this.db.exec('COMMIT;');
    } catch (err: any) {
      try { this.db.exec('ROLLBACK;'); } catch {}
      console.error('[DatabaseService] Error saving batch incidents:', err.message);
    }
  }

  public static getIncident(id: string): UnifiedIncident | null {
    if (!this.isAvailable()) return null;
    try {
      const stmt = this.db.prepare('SELECT payload FROM incidents WHERE id = ?');
      const row = stmt.get(id);
      return row ? JSON.parse(row.payload) : null;
    } catch {
      return null;
    }
  }

  public static getAllIncidents(): UnifiedIncident[] {
    if (!this.isAvailable()) return [];
    try {
      const stmt = this.db.prepare('SELECT payload FROM incidents ORDER BY created_at DESC');
      const rows = stmt.all();
      return rows.map((r: any) => JSON.parse(r.payload));
    } catch {
      return [];
    }
  }

  public static deleteIncident(id: string): boolean {
    if (!this.isAvailable()) return false;
    try {
      const stmt = this.db.prepare('DELETE FROM incidents WHERE id = ?');
      stmt.run(id);
      return true;
    } catch {
      return false;
    }
  }

  public static clearIncidents(): void {
    if (!this.isAvailable()) return;
    try {
      this.db.exec('DELETE FROM incidents;');
    } catch (err: any) {
      console.error('[DatabaseService] Failed to clear incidents:', err.message);
    }
  }

  // --- PHISHPILOT REPORTS ---

  public static savePhishReport(report: PhishPilotReport): void {
    if (!this.isAvailable()) return;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO phishpilot_reports (id, verdict, risk_score, timestamp, payload)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          verdict = excluded.verdict,
          risk_score = excluded.risk_score,
          payload = excluded.payload
      `);
      stmt.run(
        report.id,
        report.verdict,
        report.riskScore,
        report.timestamp,
        JSON.stringify(report)
      );
    } catch (err: any) {
      console.error(`[DatabaseService] Error saving phish report ${report.id}:`, err.message);
    }
  }

  public static getPhishReport(id: string): PhishPilotReport | null {
    if (!this.isAvailable()) return null;
    try {
      const stmt = this.db.prepare('SELECT payload FROM phishpilot_reports WHERE id = ?');
      const row = stmt.get(id);
      return row ? JSON.parse(row.payload) : null;
    } catch {
      return null;
    }
  }

  public static getAllPhishReports(): PhishPilotReport[] {
    if (!this.isAvailable()) return [];
    try {
      const stmt = this.db.prepare('SELECT payload FROM phishpilot_reports ORDER BY timestamp DESC');
      const rows = stmt.all();
      return rows.map((r: any) => JSON.parse(r.payload));
    } catch {
      return [];
    }
  }

  // --- CONNECTOR CONFIGS ---

  public static saveConnectorConfig(key: string, config: any): void {
    if (!this.isAvailable()) return;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO connector_configs (key, config, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          config = excluded.config,
          updated_at = excluded.updated_at
      `);
      stmt.run(key, JSON.stringify(config), new Date().toISOString());
    } catch (err: any) {
      console.error(`[DatabaseService] Error saving connector config ${key}:`, err.message);
    }
  }

  public static getConnectorConfig<T = any>(key: string): T | null {
    if (!this.isAvailable()) return null;
    try {
      const stmt = this.db.prepare('SELECT config FROM connector_configs WHERE key = ?');
      const row = stmt.get(key);
      return row ? JSON.parse(row.config) : null;
    } catch {
      return null;
    }
  }

  public static close(): void {
    if (this.db) {
      try {
        this.db.close();
      } catch {}
      this.db = null;
      this.isInitialized = false;
    }
  }
}
