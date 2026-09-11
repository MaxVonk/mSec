import { describe, it } from 'node:test';
import assert from 'node:assert';
import { store } from '../server/services/store.js';
import { IngestionSchedulerService } from '../server/services/ingestionScheduler.js';
import { WebhookNotifierService } from '../server/services/webhookNotifier.js';
import { ThreatIntelService } from '../server/services/threatIntelService.js';
import { SocReportService } from '../server/services/socReportService.js';
import { UnifiedIncident } from '../server/types/security.js';

describe('Advanced SOC Operations Suite Tests', () => {
  // Reset store to demo data before running tests
  store.resetToDemo();

  describe('IngestionSchedulerService', () => {
    it('should retrieve default scheduler configuration', () => {
      const config = IngestionSchedulerService.getConfig();
      assert.ok(config, 'Configuration must exist');
      assert.strictEqual(typeof config.sentinelIntervalMinutes, 'number');
      assert.strictEqual(typeof config.graphIntervalMinutes, 'number');
      assert.ok(['IDLE', 'RUNNING', 'ERROR'].includes(config.status));
    });

    it('should update scheduler configuration settings safely', async () => {
      const updated = await IngestionSchedulerService.updateConfig({
        sentinelIntervalMinutes: 15,
        graphIntervalMinutes: 10,
        sentinelEnabled: false,
        graphEnabled: false
      });

      assert.strictEqual(updated.sentinelIntervalMinutes, 15);
      assert.strictEqual(updated.graphIntervalMinutes, 10);
      assert.strictEqual(updated.sentinelEnabled, false);
      assert.strictEqual(updated.graphEnabled, false);
    });
  });

  describe('WebhookNotifierService', () => {
    it('should maintain configuration and handle empty URLs gracefully on test', async () => {
      await WebhookNotifierService.updateConfig({
        teamsWebhookUrl: '',
        slackWebhookUrl: '',
        enabled: false,
        minSeverity: 'HIGH'
      });

      const teamsTest = await WebhookNotifierService.testWebhook('teams');
      assert.strictEqual(teamsTest.success, false);
      assert.ok(teamsTest.message.includes('No URL configured'));

      const slackTest = await WebhookNotifierService.testWebhook('slack');
      assert.strictEqual(slackTest.success, false);
      assert.ok(slackTest.message.includes('No URL configured'));
    });

    it('should respect enabled toggle and minimum severity filter', async () => {
      await WebhookNotifierService.updateConfig({
        enabled: false,
        minSeverity: 'CRITICAL'
      });

      const sampleIncident: UnifiedIncident = {
        id: 'test-inc-low',
        incidentNumber: 999,
        title: 'Minor suspicious activity',
        description: 'Test incident',
        provider: 'SENTINEL',
        severity: 'LOW',
        status: 'ACTIVE',
        createdTime: new Date().toISOString(),
        lastUpdatedTime: new Date().toISOString(),
        entities: [],
        mitreTechniques: [],
        alerts: []
      };

      const res = await WebhookNotifierService.notifyIncidents([sampleIncident]);
      assert.strictEqual(res.sent, 0, 'Should not dispatch alerts when disabled');
    });
  });

  describe('ThreatIntelService & Reputation Engine', () => {
    it('should evaluate private RFC 1918 and loopback IPs as clean with 0 score', async () => {
      const privateIp1 = await ThreatIntelService.lookup('10.1.50.2');
      assert.strictEqual(privateIp1.reputation, 'CLEAN');
      assert.strictEqual(privateIp1.riskScore, 0);

      const privateIp2 = await ThreatIntelService.lookup('192.168.1.1');
      assert.strictEqual(privateIp2.reputation, 'CLEAN');
      assert.strictEqual(privateIp2.riskScore, 0);

      const loopback = await ThreatIntelService.lookup('127.0.0.1');
      assert.strictEqual(loopback.reputation, 'CLEAN');
      assert.strictEqual(loopback.riskScore, 0);
    });

    it('should identify known C2 / malicious IPs via heuristics', async () => {
      const c2Ip = await ThreatIntelService.lookup('194.26.29.112');
      assert.ok(c2Ip.riskScore >= 70, `Expected riskScore >= 70, got ${c2Ip.riskScore}`);
      assert.ok(['HIGH', 'MALICIOUS'].includes(c2Ip.reputation));
      assert.ok(c2Ip.details.tags?.some(t => t.includes('C2')));
    });

    it('should identify known Mimikatz / malicious hash indicators', async () => {
      const mimikatzHash = await ThreatIntelService.lookup('cc2248439366e60b29c51a023b7ff4ff');
      assert.ok(['SUSPICIOUS', 'MALICIOUS'].includes(mimikatzHash.reputation));
      assert.ok(mimikatzHash.riskScore >= 60);
      assert.ok(mimikatzHash.details.tags?.some(t => t.includes('Mimikatz')));
    });

    it('should evaluate reputable domains as clean', async () => {
      const msDomain = await ThreatIntelService.lookup('microsoft.com');
      assert.ok(msDomain.riskScore <= 10);
      assert.strictEqual(msDomain.reputation, 'CLEAN');
    });

    it('should batch lookup multiple indicators and leverage cache', async () => {
      const indicators = ['10.200.1.1', '194.26.29.112', 'login.microsoftonline.com'];
      const batchResults = await ThreatIntelService.lookupBatch(indicators);

      assert.strictEqual(batchResults['10.200.1.1'].reputation, 'CLEAN');
      assert.ok(['HIGH', 'MALICIOUS'].includes(batchResults['194.26.29.112'].reputation));

      // Re-querying should return from in-memory cache instantly
      const cached = await ThreatIntelService.lookup('194.26.29.112');
      assert.strictEqual(cached.indicator, '194.26.29.112');
    });
  });

  describe('SocReportService', () => {
    it('should generate structured shift handover report and markdown briefing', () => {
      const { report, markdown } = SocReportService.generateShiftHandover(24, 'Lead Analyst John', 'Night shift handover');

      assert.ok(report, 'Report object should be present');
      assert.strictEqual(typeof report.timeframeHours, 'number');
      assert.strictEqual(report.analystName, 'Lead Analyst John');
      assert.strictEqual(report.notes, 'Night shift handover');

      // Verify KPI counts
      assert.ok(report.metrics.totalIncidents >= 0);
      assert.ok(report.metrics.criticalIncidents >= 0);
      assert.ok(report.metrics.highIncidents >= 0);
      assert.ok(Array.isArray(report.keyIncidents));
      assert.ok(Array.isArray(report.topTargetedUsers));
      assert.ok(Array.isArray(report.topAttackerIps));
      assert.ok(Array.isArray(report.pendingActions));

      // Verify Markdown briefing output
      assert.ok(markdown.includes('# SOC Shift Handover Report'));
      assert.ok(markdown.includes('Operational Telemetry Metrics'));
      assert.ok(markdown.includes('**Analyst:** Lead Analyst John'));
      assert.ok(markdown.includes('Analyst Handover Observations'));
    });

    it('should generate complete incident forensic markdown dossier', () => {
      const incident = store.getAll()[0];
      assert.ok(incident, 'Demo incident should exist');

      const dossier = SocReportService.generateIncidentMarkdown(incident);

      assert.ok(dossier.includes(`# Incident Forensic Report: #${incident.incidentNumber || incident.id}`));
      assert.ok(dossier.includes(`**Severity:** ${incident.severity}`));
      assert.ok(dossier.includes(`**Status:** ${incident.status}`));
      assert.ok(dossier.includes('## 1. Executive Summary & Attack Scenario'));
      assert.ok(dossier.includes('## 2. Correlated Entities & Evidence'));
    });
  });
});
