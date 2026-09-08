import { randomUUID } from 'crypto';
import { PhishPilotReport } from '../../types/phishpilot.js';

export class ExportService {
  /**
   * Generates a comprehensive JSON export of the PhishPilot analysis report
   */
  public static generateJsonReport(report: PhishPilotReport): object {
    return {
      schemaVersion: '1.0.0',
      generator: 'PhishPilot Threat Analysis Platform',
      exportedAt: new Date().toISOString(),
      report: {
        id: report.id,
        timestamp: report.timestamp,
        verdict: report.verdict,
        riskScore: report.riskScore,
        confidence: report.confidence,
        email: {
          subject: report.emailSummary.subject,
          from: report.emailSummary.from,
          to: report.emailSummary.to,
          date: report.emailSummary.date,
          returnPath: report.emailSummary.returnPath,
          replyTo: report.emailSummary.replyTo,
          bodyPreview: report.emailSummary.bodyPreview,
          urlCount: report.emailSummary.urlCount,
          attachmentCount: report.emailSummary.attachmentCount
        },
        authentication: {
          spf: report.headerAnalysis.spf,
          dkim: report.headerAnalysis.dkim,
          dmarc: report.headerAnalysis.dmarc,
          originIps: report.headerAnalysis.originIps,
          receivedHops: report.headerAnalysis.receivedHops,
          dnsAuth: report.headerAnalysis.dnsAuth
        },
        urls: report.urlAnalysis.map(u => ({
          url: u.url,
          domain: u.domain,
          domainAgeDays: u.domainAgeDays,
          isMalicious: u.isMalicious,
          isDeceptive: u.isDeceptive,
          reputationSources: u.reputationSources,
          homoglyph: u.homoglyph
        })),
        attachments: report.attachmentAnalysis.map(a => ({
          filename: a.filename,
          mimeType: a.mimeType,
          size: a.size,
          sha256: a.sha256,
          md5: a.md5,
          isSuspiciousExtension: a.isSuspiciousExtension,
          isPasswordProtected: a.isPasswordProtected,
          isMalicious: a.isMalicious
        })),
        aiClassification: report.aiClassification,
        riskBreakdown: report.riskBreakdown,
        recommendedActions: report.recommendedActions,
        correlations: report.correlations || [],
        remediationLogs: report.remediationLogs || []
      }
    };
  }

  /**
   * Generates an OASIS STIX 2.1 compliant bundle from the PhishPilot report
   */
  public static generateStixBundle(report: PhishPilotReport): object {
    const bundleId = `bundle--${randomUUID()}`;
    const objects: any[] = [];
    const objectRefs: string[] = [];

    const createdTime = report.timestamp || new Date().toISOString();

    // 1. Identity Object (Reporting Organization / Tool)
    const identityId = `identity--${randomUUID()}`;
    objects.push({
      type: 'identity',
      spec_version: '2.1',
      id: identityId,
      created: createdTime,
      modified: createdTime,
      name: 'PhishPilot Analysis Platform',
      identity_class: 'system'
    });
    objectRefs.push(identityId);

    // 2. Report SDO
    const reportSdoId = `report--${randomUUID()}`;
    const confidenceScore = Math.round(report.confidence * 100);

    // 3. Attack Pattern SDOs (MITRE ATT&CK)
    const spearphishLink = {
      type: 'attack-pattern',
      spec_version: '2.1',
      id: `attack-pattern--${randomUUID()}`,
      created: createdTime,
      modified: createdTime,
      name: 'Spearphishing Link',
      description: 'Adversaries may send spearphishing messages with a malicious link to gain initial access.',
      external_references: [
        {
          source_name: 'mitre-attack',
          external_id: 'T1566.002',
          url: 'https://attack.mitre.org/techniques/T1566/002/'
        }
      ]
    };
    objects.push(spearphishLink);
    objectRefs.push(spearphishLink.id);

    // 4. Indicators for malicious or suspicious URLs
    for (const u of report.urlAnalysis) {
      if (u.isMalicious || u.isDeceptive || (u.homoglyph && u.homoglyph.isSuspicious)) {
        const indId = `indicator--${randomUUID()}`;
        const escapedUrl = u.url.replace(/'/g, "\\'");
        objects.push({
          type: 'indicator',
          spec_version: '2.1',
          id: indId,
          created: createdTime,
          modified: createdTime,
          name: `Malicious / Deceptive URL: ${u.domain}`,
          description: `Identified by PhishPilot during email threat analysis. Deceptive: ${u.isDeceptive}`,
          pattern_type: 'stix',
          pattern: `[url:value = '${escapedUrl}']`,
          valid_from: createdTime,
          confidence: confidenceScore,
          indicator_types: ['malicious-activity']
        });
        objectRefs.push(indId);
      }
    }

    // 5. Indicators for attachments (SHA-256)
    for (const a of report.attachmentAnalysis) {
      if (a.sha256) {
        const indId = `indicator--${randomUUID()}`;
        objects.push({
          type: 'indicator',
          spec_version: '2.1',
          id: indId,
          created: createdTime,
          modified: createdTime,
          name: `Malicious Attachment: ${a.filename}`,
          description: `Attachment with SHA-256 hash ${a.sha256} identified in email threat report.`,
          pattern_type: 'stix',
          pattern: `[file:hashes.'SHA-256' = '${a.sha256}']`,
          valid_from: createdTime,
          confidence: a.isSuspiciousExtension || a.isMalicious ? 90 : 50,
          indicator_types: ['malicious-activity']
        });
        objectRefs.push(indId);
      }
    }

    // 6. Indicator for origin IP
    for (const ip of report.headerAnalysis.originIps) {
      if (!ip.startsWith('10.') && !ip.startsWith('192.168.') && !ip.startsWith('127.')) {
        const indId = `indicator--${randomUUID()}`;
        objects.push({
          type: 'indicator',
          spec_version: '2.1',
          id: indId,
          created: createdTime,
          modified: createdTime,
          name: `Origin IP: ${ip}`,
          description: `Originating IP address from email headers.`,
          pattern_type: 'stix',
          pattern: `[ipv4-addr:value = '${ip}']`,
          valid_from: createdTime,
          confidence: confidenceScore,
          indicator_types: ['malicious-activity']
        });
        objectRefs.push(indId);
      }
    }

    // Report object referencing all indicators
    const reportObject = {
      type: 'report',
      spec_version: '2.1',
      id: reportSdoId,
      created: createdTime,
      modified: createdTime,
      name: `PhishPilot Analysis: ${report.emailSummary.subject || 'Threat Report'}`,
      description: `Analysis verdict: ${report.verdict} (Risk Score: ${report.riskScore}/100). Sender: ${report.emailSummary.from}.`,
      report_types: ['threat-report'],
      published: createdTime,
      confidence: confidenceScore,
      object_refs: objectRefs
    };
    objects.unshift(reportObject);

    return {
      type: 'bundle',
      id: bundleId,
      objects
    };
  }
}

