import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IncidentCorrelatorService, isSiemXdrDuplicatePair, normalizeIncidentTitle } from '../server/services/incidentCorrelator';
import { UnifiedIncident } from '../server/types/security';

describe('SIEM & XDR Duplicate Chaining and Correlation Tests', () => {

  it('should normalize incident titles correctly', () => {
    const rawA = 'Microsoft 365 Defender: Exchange workflow MailItemsAccessed operation anomaly involving one user\u200B';
    const rawB = 'Exchange workflow MailItemsAccessed operation anomaly involving one user';
    assert.equal(normalizeIncidentTitle(rawA), 'exchange workflow mailitemsaccessed operation anomaly involving one user');
    assert.equal(normalizeIncidentTitle(rawB), 'exchange workflow mailitemsaccessed operation anomaly involving one user');
  });

  it('should detect SIEM and XDR duplicate pairs based on matching titles and timestamp proximity', () => {
    const sentinelIncident: UnifiedIncident = {
      id: 'sentinel-inc-1625',
      incidentNumber: 1625,
      title: 'Exchange workflow MailItemsAccessed operation anomaly involving one user',
      description: 'Sentinel detection rule fired for mailbox access anomaly',
      provider: 'SENTINEL_SIEM',
      severity: 'INFORMATIONAL',
      status: 'NEW',
      createdTime: '2026-09-14T12:06:19.000Z',
      lastUpdatedTime: '2026-09-14T12:15:00.000Z',
      entities: [
        { id: 'e1', type: 'USER', value: 'adele.vance@contoso.com', role: 'Victim' }
      ],
      mitreTechniques: [
        { tactic: 'Collection', techniqueId: 'T1114', techniqueName: 'Email Collection' }
      ],
      alerts: [],
      rawPayload: { id: 'sentinel-raw-1625' }
    };

    const defenderIncident: UnifiedIncident = {
      id: 'defender-inc-1863',
      incidentNumber: 1863,
      title: 'Exchange workflow MailItemsAccessed operation anomaly involving one user\u200B',
      description: 'Defender for Office 365 observed suspicious mail items accessed',
      provider: 'M365_DEFENDER',
      severity: 'INFORMATIONAL',
      status: 'ACTIVE',
      createdTime: '2026-09-14T12:06:18.000Z',
      lastUpdatedTime: '2026-09-14T12:15:00.000Z',
      entities: [
        { id: 'e2', type: 'USER', value: 'adele.vance@contoso.com', role: 'Impacted User' },
        { id: 'e3', type: 'IP', value: '198.51.100.45', role: 'Client IP' }
      ],
      mitreTechniques: [
        { tactic: 'Collection', techniqueId: 'T1114.002', techniqueName: 'Remote Email Collection' }
      ],
      alerts: [
        {
          id: 'alt-1863',
          title: 'MailItemsAccessed anomaly',
          description: 'High volume mailbox reading',
          severity: 'INFORMATIONAL',
          provider: 'DEFENDER_OFFICE365',
          createdTime: '2026-09-14T12:06:18.000Z',
          mitreTechniques: [],
          entities: []
        }
      ],
      rawPayload: { id: 'defender-raw-1863' }
    };

    const isMatch = isSiemXdrDuplicatePair(sentinelIncident, defenderIncident);
    assert.equal(isMatch, true, 'Sentinel #1625 and Defender #1863 must be recognized as a duplicate pair');
  });

  it('should not pair two incidents from the same provider', () => {
    const incA: UnifiedIncident = {
      id: 'def-1',
      title: 'Suspicious PowerShell Execution',
      provider: 'M365_DEFENDER',
      severity: 'HIGH',
      status: 'ACTIVE',
      createdTime: '2026-09-14T10:00:00Z',
      lastUpdatedTime: '2026-09-14T10:00:00Z',
      entities: [],
      mitreTechniques: [],
      alerts: [],
      rawPayload: {}
    };
    const incB: UnifiedIncident = {
      id: 'def-2',
      title: 'Suspicious PowerShell Execution',
      provider: 'M365_DEFENDER',
      severity: 'HIGH',
      status: 'ACTIVE',
      createdTime: '2026-09-14T10:00:00Z',
      lastUpdatedTime: '2026-09-14T10:00:00Z',
      entities: [],
      mitreTechniques: [],
      alerts: [],
      rawPayload: {}
    };

    assert.equal(isSiemXdrDuplicatePair(incA, incB), false, 'Two Defender incidents should not be chained as SIEM+XDR');
  });

  it('should merge duplicate pairs into a single unified incident with dual badging and linked refs', () => {
    const sentinelIncident: UnifiedIncident = {
      id: 'sentinel-inc-1625',
      incidentNumber: 1625,
      title: 'Exchange workflow MailItemsAccessed operation anomaly involving one user',
      description: 'Sentinel detection rule fired for mailbox access anomaly',
      provider: 'SENTINEL_SIEM',
      severity: 'INFORMATIONAL',
      status: 'NEW',
      incidentWebUrl: 'https://portal.azure.com/sentinel/1625',
      createdTime: '2026-09-14T12:06:19.000Z',
      lastUpdatedTime: '2026-09-14T12:15:00.000Z',
      entities: [
        { id: 'e1', type: 'USER', value: 'adele.vance@contoso.com', role: 'Victim' }
      ],
      mitreTechniques: [
        { tactic: 'Collection', techniqueId: 'T1114', techniqueName: 'Email Collection' }
      ],
      alerts: [],
      rawPayload: { provider: 'Azure Sentinel', id: '1625' }
    };

    const defenderIncident: UnifiedIncident = {
      id: 'defender-inc-1863',
      incidentNumber: 1863,
      title: 'Exchange workflow MailItemsAccessed operation anomaly involving one user',
      description: 'Defender for Office 365 observed suspicious mail items accessed',
      provider: 'M365_DEFENDER',
      severity: 'INFORMATIONAL',
      status: 'ACTIVE',
      incidentWebUrl: 'https://security.microsoft.com/incidents/1863',
      createdTime: '2026-09-14T12:06:18.000Z',
      lastUpdatedTime: '2026-09-14T12:15:00.000Z',
      entities: [
        { id: 'e2', type: 'USER', value: 'adele.vance@contoso.com', role: 'Impacted User' },
        { id: 'e3', type: 'IP', value: '198.51.100.45', role: 'Client IP' }
      ],
      mitreTechniques: [
        { tactic: 'Collection', techniqueId: 'T1114.002', techniqueName: 'Remote Email Collection' }
      ],
      alerts: [
        {
          id: 'alt-1863',
          title: 'MailItemsAccessed anomaly',
          description: 'High volume mailbox reading',
          severity: 'INFORMATIONAL',
          provider: 'DEFENDER_OFFICE365',
          createdTime: '2026-09-14T12:06:18.000Z',
          mitreTechniques: [],
          entities: []
        }
      ],
      rawPayload: { provider: 'M365 Defender', id: '1863' }
    };

    const unrelatedIncident: UnifiedIncident = {
      id: 'entra-999',
      incidentNumber: 999,
      title: 'Impossible Travel Detected from Nigeria',
      description: 'Risky sign in alert',
      provider: 'ENTRA_ID',
      severity: 'HIGH',
      status: 'NEW',
      createdTime: '2026-09-14T14:00:00.000Z',
      lastUpdatedTime: '2026-09-14T14:00:00.000Z',
      entities: [
        { id: 'e4', type: 'USER', value: 'alex.wilber@contoso.com' }
      ],
      mitreTechniques: [],
      alerts: [],
      rawPayload: {}
    };

    const input = [sentinelIncident, unrelatedIncident, defenderIncident];
    const { unified, mergedCount } = IncidentCorrelatorService.correlate(input);

    assert.equal(mergedCount, 1, 'Should have merged exactly 1 pair');
    assert.equal(unified.length, 2, 'Total output should be 2 incidents (1 chained, 1 independent)');

    const chained = unified.find(u => u.isChained);
    assert.ok(chained, 'Chained incident must exist in result');
    assert.equal(chained.isChained, true);
    assert.ok(chained.incidentNumber?.toString().includes('1863'));
    assert.ok(chained.incidentNumber?.toString().includes('1625'));
    assert.equal(chained.linkedIncidents?.length, 2);

    // Verify deduplicated entities: adele.vance@contoso.com and 198.51.100.45 = 2 entities
    assert.equal(chained.entities.length, 2);
    assert.ok(chained.entities.some(e => e.value === 'adele.vance@contoso.com'));
    assert.ok(chained.entities.some(e => e.value === '198.51.100.45'));

    // Verify alerts and MITRE techniques
    assert.equal(chained.alerts.length, 1);
    assert.equal(chained.mitreTechniques.length, 2);
  });
});
