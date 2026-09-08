import { PhishPilotReport, ThreatCorrelation } from '../../types/phishpilot.js';
import { UnifiedIncident, SecurityEntity } from '../../types/security.js';
import { store } from '../store.js';

export class ThreatCorrelationService {
  /**
   * Scans active mSec Defender/Sentinel incidents for shared entities (IPs, domains, hashes, sender accounts)
   */
  public static findCorrelations(report: PhishPilotReport): ThreatCorrelation[] {
    const allIncidents = store.getAll();
    const correlations: ThreatCorrelation[] = [];

    // Collect IOCs from the PhishPilotReport
    const emailSender = report.emailSummary.from.toLowerCase();
    const urls = report.urlAnalysis.map(u => u.domain.toLowerCase());
    const originIps = report.headerAnalysis.originIps;
    const hashes = report.attachmentAnalysis.map(a => a.sha256.toLowerCase());

    for (const inc of allIncidents) {
      for (const ent of inc.entities) {
        const entVal = ent.value.toLowerCase();

        // 1. IP correlation
        if (ent.type === 'IP' && originIps.includes(entVal)) {
          correlations.push({
            incidentId: inc.id,
            incidentTitle: inc.title,
            severity: inc.severity,
            provider: inc.provider,
            matchedEntity: ent.value,
            matchType: 'IP'
          });
          break;
        }

        // 2. Domain / URL correlation
        if ((ent.type === 'HOST' || ent.type === 'CLOUD_RESOURCE') && urls.some(u => u.includes(entVal) || entVal.includes(u))) {
          correlations.push({
            incidentId: inc.id,
            incidentTitle: inc.title,
            severity: inc.severity,
            provider: inc.provider,
            matchedEntity: ent.value,
            matchType: 'DOMAIN'
          });
          break;
        }

        // 3. File Hash correlation
        if (ent.type === 'FILE' && hashes.includes(entVal)) {
          correlations.push({
            incidentId: inc.id,
            incidentTitle: inc.title,
            severity: inc.severity,
            provider: inc.provider,
            matchedEntity: ent.value,
            matchType: 'HASH'
          });
          break;
        }

        // 4. Targeted User correlation
        if (ent.type === 'USER' && (emailSender.includes(entVal) || (report.emailSummary.to && report.emailSummary.to.toLowerCase().includes(entVal)))) {
          correlations.push({
            incidentId: inc.id,
            incidentTitle: inc.title,
            severity: inc.severity,
            provider: inc.provider,
            matchedEntity: ent.value,
            matchType: 'USER'
          });
          break;
        }
      }
    }

    return correlations;
  }

  /**
   * Escalates a PhishPilotReport into a first-class UnifiedIncident in mSec
   */
  public static escalateToIncident(report: PhishPilotReport): UnifiedIncident {
    const entities: SecurityEntity[] = [];

    // Add sender user entity
    if (report.emailSummary.from) {
      entities.push({
        id: `ent-usr-${Date.now()}-1`,
        type: 'USER',
        value: report.emailSummary.from,
        riskScore: report.verdict === 'PHISHING' ? 90 : 60,
        details: { firstSeen: report.timestamp, lastSeen: report.timestamp }
      });
    }

    // Add recipient user entity
    if (report.emailSummary.to) {
      entities.push({
        id: `ent-usr-${Date.now()}-2`,
        type: 'USER',
        value: report.emailSummary.to,
        details: { firstSeen: report.timestamp, lastSeen: report.timestamp }
      });
    }

    // Add domains & URLs
    for (let i = 0; i < report.urlAnalysis.length; i++) {
      const u = report.urlAnalysis[i];
      entities.push({
        id: `ent-host-${Date.now()}-${i}`,
        type: 'HOST',
        value: u.domain,
        riskScore: u.isMalicious ? 95 : 50,
        details: { firstSeen: report.timestamp, lastSeen: report.timestamp, url: u.url }
      });
    }

    // Add origin IPs
    for (let i = 0; i < report.headerAnalysis.originIps.length; i++) {
      const ip = report.headerAnalysis.originIps[i];
      entities.push({
        id: `ent-ip-${Date.now()}-${i}`,
        type: 'IP',
        value: ip,
        details: { firstSeen: report.timestamp, lastSeen: report.timestamp }
      });
    }

    // Add attachment hashes
    for (let i = 0; i < report.attachmentAnalysis.length; i++) {
      const att = report.attachmentAnalysis[i];
      entities.push({
        id: `ent-file-${Date.now()}-${i}`,
        type: 'FILE',
        value: att.sha256,
        details: { filename: att.filename, mimeType: att.mimeType, size: att.size }
      });
    }

    const mitreTechniques = [
      {
        techniqueId: 'T1566.001',
        techniqueName: 'Phishing: Spearphishing Attachment',
        tactic: 'Initial Access'
      },
      {
        techniqueId: 'T1566.002',
        techniqueName: 'Phishing: Spearphishing Link',
        tactic: 'Initial Access'
      }
    ];

    const newIncident: UnifiedIncident = {
      id: `INC-PHISH-${Date.now().toString().slice(-6)}`,
      incidentNumber: `PP-${report.id.slice(0, 6).toUpperCase()}`,
      title: `[PhishPilot Escalation] ${report.emailSummary.subject || 'Malicious Email Campaign'}`,
      description: `Escalated PhishPilot Report #${report.id}. Multi-engine verdict: ${report.verdict} (Risk Score: ${report.riskScore}/100, Confidence: ${(report.confidence * 100).toFixed(0)}%). Sender: ${report.emailSummary.from}.`,
      severity: report.verdict === 'PHISHING' ? 'HIGH' : 'MEDIUM',
      status: 'ACTIVE',
      provider: 'M365_DEFENDER',
      createdTime: report.timestamp,
      lastUpdatedTime: new Date().toISOString(),
      entities,
      alerts: [
        {
          id: `ALT-PP-${report.id.slice(0, 8)}`,
          title: `PhishPilot Detected ${report.verdict}: ${report.emailSummary.subject}`,
          description: `PhishPilot automated escalation: High-risk phishing indicators detected.`,
          severity: report.verdict === 'PHISHING' ? 'HIGH' : 'MEDIUM',
          provider: 'M365_DEFENDER',
          createdTime: report.timestamp,
          mitreTechniques,
          entities
        }
      ],
      mitreTechniques,
      rawPayload: report
    };

    store.addOrUpdate(newIncident);
    return newIncident;
  }
}
