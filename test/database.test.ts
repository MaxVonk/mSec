import test, { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService } from '../server/services/dbService.js';
import { UnifiedIncident } from '../server/types/security.js';
import { PhishPilotReport } from '../server/types/phishpilot.js';

describe('SQLite Native Database Persistence Suite', () => {

  before(() => {
    // Initialize in-memory SQLite database for isolated test execution
    DatabaseService.init(':memory:');
  });

  after(() => {
    DatabaseService.close();
  });

  it('should initialize successfully and confirm availability', () => {
    assert.equal(DatabaseService.isAvailable(), true);
  });

  it('should save, retrieve, and delete a UnifiedIncident with JSON payload', () => {
    const mockIncident: UnifiedIncident = {
      id: 'inc-test-sqlite-101',
      title: 'Suspicious PowerShell Execution Detected',
      description: 'Encoded PowerShell command executed on endpoint WKSTN-09',
      severity: 'HIGH',
      status: 'ACTIVE',
      provider: 'M365 Defender',
      createdTime: new Date().toISOString(),
      entities: [
        { id: 'e1', type: 'HOST', value: 'WKSTN-09' },
        { id: 'e2', type: 'USER', value: 'victim@company.com' }
      ],
      alerts: [],
      mitreTechniques: [
        { tacticName: 'Execution', techniqueId: 'T1059.001', techniqueName: 'PowerShell' }
      ]
    };

    // Save
    DatabaseService.saveIncident(mockIncident);

    // Retrieve
    const retrieved = DatabaseService.getIncident('inc-test-sqlite-101');
    assert.ok(retrieved);
    assert.equal(retrieved.id, 'inc-test-sqlite-101');
    assert.equal(retrieved.title, 'Suspicious PowerShell Execution Detected');
    assert.equal(retrieved.severity, 'HIGH');
    assert.equal(retrieved.entities.length, 2);

    // Update
    mockIncident.status = 'RESOLVED';
    DatabaseService.saveIncident(mockIncident);
    const updated = DatabaseService.getIncident('inc-test-sqlite-101');
    assert.equal(updated?.status, 'RESOLVED');

    // Delete
    const deleted = DatabaseService.deleteIncident('inc-test-sqlite-101');
    assert.equal(deleted, true);
    assert.equal(DatabaseService.getIncident('inc-test-sqlite-101'), null);
  });

  it('should handle batch incident inserts with transactions', () => {
    const batch: UnifiedIncident[] = [
      {
        id: 'inc-batch-1',
        title: 'Batch Incident 1',
        description: 'Test 1',
        severity: 'MEDIUM',
        status: 'NEW',
        provider: 'Sentinel',
        createdTime: new Date().toISOString(),
        entities: [],
        alerts: [],
        mitreTechniques: []
      },
      {
        id: 'inc-batch-2',
        title: 'Batch Incident 2',
        description: 'Test 2',
        severity: 'CRITICAL',
        status: 'ACTIVE',
        provider: 'M365 Defender',
        createdTime: new Date().toISOString(),
        entities: [],
        alerts: [],
        mitreTechniques: []
      }
    ];

    DatabaseService.saveIncidentsBatch(batch);
    const inc1 = DatabaseService.getIncident('inc-batch-1');
    const inc2 = DatabaseService.getIncident('inc-batch-2');
    assert.ok(inc1);
    assert.ok(inc2);
    assert.equal(inc1.severity, 'MEDIUM');
    assert.equal(inc2.severity, 'CRITICAL');
  });

  it('should save and retrieve PhishPilot reports and connector configs', () => {
    const mockReport: Partial<PhishPilotReport> = {
      id: 'phish-rep-sqlite-1',
      timestamp: new Date().toISOString(),
      verdict: 'PHISHING',
      riskScore: 85,
      confidence: 0.95
    };

    DatabaseService.savePhishReport(mockReport as PhishPilotReport);
    const retrievedReport = DatabaseService.getPhishReport('phish-rep-sqlite-1');
    assert.ok(retrievedReport);
    assert.equal(retrievedReport.verdict, 'PHISHING');
    assert.equal(retrievedReport.riskScore, 85);

    // Connector config
    DatabaseService.saveConnectorConfig('graph', { tenantId: 'tenant-123', enabled: true });
    const config = DatabaseService.getConnectorConfig('graph');
    assert.ok(config);
    assert.equal(config.tenantId, 'tenant-123');
    assert.equal(config.enabled, true);
  });
});

