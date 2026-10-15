import fs from 'fs/promises';
import path from 'path';
import { PhishPilotReport, PhishPilotStats } from '../../types/phishpilot.js';
import { DatabaseService } from '../dbService.js';

const DATA_FILE = path.resolve('.msec_data/phishpilot_reports.json');

export class PhishPilotStore {
  private static async ensureFile(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
      try {
        await fs.access(DATA_FILE);
      } catch {
        await fs.writeFile(DATA_FILE, JSON.stringify([]));
      }
    } catch (e) {
      console.error('Error ensuring PhishPilot store file:', e);
    }
  }

  public static async getAll(filters?: { verdict?: string }): Promise<PhishPilotReport[]> {
    await this.ensureFile();
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    let reports: PhishPilotReport[] = JSON.parse(data);
    if (filters?.verdict && filters.verdict !== 'ALL') {
      reports = reports.filter(r => r.verdict === filters.verdict);
    }
    // Sort descending by timestamp
    reports.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return reports;
  }

  public static async getById(id: string): Promise<PhishPilotReport | null> {
    const reports = await this.getAll();
    return reports.find(r => r.id === id) || null;
  }

  public static async save(report: PhishPilotReport): Promise<void> {
    const reports = await this.getAll();
    reports.unshift(report);
    DatabaseService.savePhishReport(report);
    await fs.writeFile(DATA_FILE, JSON.stringify(reports, null, 2));
  }

  public static async delete(id: string): Promise<void> {
    let reports = await this.getAll();
    reports = reports.filter(r => r.id !== id);
    await fs.writeFile(DATA_FILE, JSON.stringify(reports, null, 2));
  }

  public static async bulkDelete(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    let reports = await this.getAll();
    reports = reports.filter(r => !idSet.has(r.id));
    await fs.writeFile(DATA_FILE, JSON.stringify(reports, null, 2));
  }

  public static async clear(): Promise<void> {
    await this.ensureFile();
    await fs.writeFile(DATA_FILE, JSON.stringify([]));
  }

  public static async getStats(): Promise<PhishPilotStats> {
    const reports = await this.getAll();
    const counts = { LEGITIMATE: 0, SUSPICIOUS: 0, PHISHING: 0 };
    for (const r of reports) {
      if (counts[r.verdict] !== undefined) {
        counts[r.verdict]++;
      }
    }

    const domainCounts: Record<string, number> = {};
    for (const r of reports) {
      if (r.verdict === 'PHISHING') {
        for (const u of r.urlAnalysis) {
          if (u.domain) {
            domainCounts[u.domain] = (domainCounts[u.domain] || 0) + 1;
          }
        }
      }
    }

    const topMaliciousDomains = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([domain]) => domain);

    return {
      totalAnalyzed: reports.length,
      verdictCounts: counts,
      topMaliciousDomains,
      recentReports: reports.slice(0, 5)
    };
  }
}
