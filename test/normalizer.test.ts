import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DataNormalizer } from '../server/services/normalizer';
import { ThreatOversightService } from '../server/services/threatOversightService';
import { SAMPLE_INCIDENTS } from '../server/services/sampleData';

describe('mSec Security Ingestion & Normalization Tests', () => {
  it('should normalize M365 Defender XDR incidents with entities and alerts', () => {
    const rawGraphIncident = {
      id: 'm365-test-1',
      displayName: 'Test Cobalt Strike Beacon Activity',
      severity: 'high',
      status: 'active',
      createdDateTime: '2026-09-04T10:00:00Z',
      evidence: [
        { '@odata.type': '#microsoft.graph.security.userEvidence', userAccount: { userPrincipalName: 'victim@contoso.com' } },
        { '@odata.type': '#microsoft.graph.security.deviceEvidence', deviceDnsName: 'CORP-LAPTOP-99' },
        { '@odata.type': '#microsoft.graph.security.ipEvidence', ipAddress: '198.51.100.44' }
      ],
      systemTags: ['ATT&CK:T1059', 'ATT&CK:T1071']
    };

    const normalized = DataNormalizer.normalizeGraphIncident(rawGraphIncident);
    assert.strictEqual(normalized.id, 'm365-test-1');
    assert.strictEqual(normalized.severity, 'HIGH');
    assert.strictEqual(normalized.status, 'ACTIVE');
    assert.strictEqual(normalized.entities.length, 3);
    assert.ok(normalized.entities.some(e => e.type === 'USER' && e.value === 'victim@contoso.com'));
    assert.ok(normalized.entities.some(e => e.type === 'HOST' && e.value === 'CORP-LAPTOP-99'));
    assert.ok(normalized.entities.some(e => e.type === 'IP' && e.value === '198.51.100.44'));
  });

  it('should normalize Microsoft Sentinel SIEM incident properties', () => {
    const rawSentinel = {
      name: 'sentinel-inc-555',
      properties: {
        incidentNumber: 555,
        title: 'Brute force attack on Azure Storage Account',
        severity: 'Medium',
        status: 'New',
        tactics: ['InitialAccess', 'CredentialAccess'],
        createdTimeUtc: '2026-09-04T11:00:00Z'
      }
    };

    const normalized = DataNormalizer.normalizeSentinelIncident(rawSentinel);
    assert.strictEqual(normalized.id, 'sentinel-inc-555');
    assert.strictEqual(normalized.provider, 'SENTINEL_SIEM');
    assert.strictEqual(normalized.severity, 'MEDIUM');
    assert.strictEqual(normalized.status, 'NEW');
    assert.strictEqual(normalized.mitreTechniques.length, 2);
  });

  it('should normalize Microsoft Entra ID risky sign-in logs', () => {
    const rawSignIn = {
      id: 'signin-777',
      userPrincipalName: 'finance.lead@contoso.com',
      ipAddress: '185.220.101.99',
      riskLevelAggregated: 'high',
      riskDetail: 'atRiskUser',
      appDisplayName: 'Microsoft 365 Admin Center',
      location: { city: 'Reykjavik', countryOrRegion: 'IS' },
      status: { errorCode: 50126, failureReason: 'Invalid username or password' }
    };

    const normalized = DataNormalizer.normalizeEntraSignIn(rawSignIn);
    assert.strictEqual(normalized.provider, 'ENTRA_ID');
    assert.strictEqual(normalized.severity, 'HIGH');
    assert.ok(normalized.title.includes('finance.lead@contoso.com'));
    assert.ok(normalized.entities.some(e => e.type === 'USER' && e.value === 'finance.lead@contoso.com'));
    assert.ok(normalized.entities.some(e => e.type === 'IP' && e.value === '185.220.101.99'));
  });

  it('should generate structured Threat Oversight assessment with actionable containment', () => {
    const incident = SAMPLE_INCIDENTS[0];
    const assessment = ThreatOversightService.analyzeIncident(incident);

    assert.ok(assessment.trustBoundariesViolated.length > 0);
    assert.ok(assessment.evidence.length > 0);
    assert.ok(assessment.containmentActions.length > 0);
    assert.ok(assessment.remediationGuidance.length > 0);

    // Verify containment action types
    assert.ok(assessment.containmentActions.some(a => a.actionType === 'REVOKE_SESSIONS'));
    assert.ok(assessment.containmentActions.some(a => a.actionType === 'ISOLATE_HOST'));
    assert.ok(assessment.containmentActions.some(a => a.actionType === 'BLOCK_IP'));
  });
});

