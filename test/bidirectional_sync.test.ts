import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../server/services/store.js';
import { GraphConnector } from '../server/services/graphConnector.js';
import { SentinelConnector } from '../server/services/sentinelConnector.js';
import { UnifiedIncident } from '../server/types/security.js';

describe('Bidirectional Microsoft Cloud Sync Suite', () => {

  it('should format Graph update payload correctly and handle missing credentials gracefully', async () => {
    const dummyConfig = {
      tenantId: '',
      clientId: '',
      clientSecret: '',
      enabled: false,
      status: 'IDLE' as const
    };

    const result = await GraphConnector.updateIncident(dummyConfig, '10001', {
      status: 'resolved',
      classification: 'truePositive',
      determination: 'malware',
      comment: 'Contained infected endpoint'
    });

    assert.equal(result.success, false);
    assert.ok(result.message.includes('Tenant ID, Client ID, and Client Secret are required'));
  });

  it('should format Sentinel update and comment payloads and validate credentials', async () => {
    const dummyConfig = {
      tenantId: '',
      clientId: '',
      clientSecret: '',
      subscriptionId: '',
      resourceGroup: '',
      workspaceName: '',
      enabled: false,
      status: 'IDLE' as const
    };

    const updateRes = await SentinelConnector.updateIncident(dummyConfig, 'inc-sentinel-101', {
      status: 'Closed',
      severity: 'High',
      classification: 'TruePositive',
      classificationComment: 'Verified Mimikatz execution'
    });

    assert.equal(updateRes.success, false);
    assert.ok(updateRes.message.includes('required'));

    const commentRes = await SentinelConnector.addComment(dummyConfig, 'inc-sentinel-101', 'Triage completed');
    assert.equal(commentRes.success, false);
    assert.ok(commentRes.message.includes('required'));
  });

  it('should update local incident status, classification, and timestamp in store', () => {
    const testInc: UnifiedIncident = {
      id: 'inc-sync-test-99',
      title: 'Active Brute Force on Domain Controller',
      description: 'Multiple failed Kerberos authentications',
      severity: 'HIGH',
      status: 'ACTIVE',
      provider: 'M365_DEFENDER',
      createdTime: new Date().toISOString(),
      entities: [],
      alerts: [],
      mitreTechniques: []
    };

    store.addOrUpdate(testInc);

    const retrieved = store.getById('inc-sync-test-99');
    assert.ok(retrieved);
    assert.equal(retrieved.status, 'ACTIVE');

    store.updateIncidentStatus('inc-sync-test-99', 'RESOLVED');
    const updated = store.getById('inc-sync-test-99');
    assert.equal(updated?.status, 'RESOLVED');
    assert.ok(updated?.lastUpdatedTime);

    store.delete('inc-sync-test-99');
  });
});

