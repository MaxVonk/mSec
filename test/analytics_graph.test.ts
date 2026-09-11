import { describe, it } from 'node:test';
import assert from 'node:assert';
import { store } from '../server/services/store.js';
import { buildIncidentGraph, buildCrossIncidentCorrelationGraph } from '../src/utils/graphBuilder.js';
import { UnifiedIncident } from '../server/types/security.js';

describe('SOC Analytics Trends & Graph Visualizer Tests', () => {
  it('should generate structured analytics trends from stored incidents', () => {
    store.resetToDemo();
    const trends = store.getAnalyticsTrends();

    assert.ok(trends, 'Trends object should be defined');
    assert.ok(Array.isArray(trends.timeline), 'Timeline should be an array');
    assert.ok(trends.timeline.length >= 7, 'Timeline should have at least 7 days of points');

    // Verify timeline point structure
    const samplePoint = trends.timeline[0];
    assert.ok(samplePoint.date, 'Timeline point should have a formatted date');
    assert.ok(samplePoint.isoDate, 'Timeline point should have an ISO date');
    assert.strictEqual(typeof samplePoint.count, 'number');
    assert.ok(samplePoint.byProvider, 'Timeline point should have provider breakdown');
    assert.ok(samplePoint.bySeverity, 'Timeline point should have severity breakdown');

    // Verify MITRE tactics
    assert.ok(Array.isArray(trends.mitreTactics), 'Mitre tactics should be an array');
    assert.ok(trends.mitreTactics.length > 0, 'Should aggregate demo MITRE tactics');
    const firstTactic = trends.mitreTactics[0];
    assert.ok(firstTactic.tactic, 'Tactic should have a name');
    assert.ok(firstTactic.count > 0, 'Tactic count should be > 0');
    assert.ok(Array.isArray(firstTactic.techniques), 'Tactic should have techniques array');

    // Verify Distributions
    assert.ok(Array.isArray(trends.severityBreakdown), 'Severity breakdown should be an array');
    assert.ok(Array.isArray(trends.statusBreakdown), 'Status breakdown should be an array');
    assert.ok(Array.isArray(trends.providerBreakdown), 'Provider breakdown should be an array');
  });

  it('should construct valid node-link graph for an incident', () => {
    const sampleIncident: UnifiedIncident = {
      id: 'test-inc-100',
      incidentNumber: 100,
      title: 'Suspicious PowerShell Execution & Network Beaconing',
      description: 'Host beaconing to external IP',
      provider: 'DEFENDER_ENDPOINT',
      severity: 'HIGH',
      status: 'ACTIVE',
      createdTime: new Date().toISOString(),
      lastUpdatedTime: new Date().toISOString(),
      entities: [
        { id: 'ent-1', type: 'USER', value: 'john.doe@company.com', role: 'Targeted User' },
        { id: 'ent-2', type: 'HOST', value: 'DESKTOP-001', role: 'Infected Host' },
        { id: 'ent-3', type: 'IP', value: '198.51.100.42', role: 'C2 Beacon' }
      ],
      mitreTechniques: [
        { tactic: 'Execution', techniqueId: 'T1059.001', techniqueName: 'PowerShell' }
      ],
      alerts: [
        {
          id: 'alt-1',
          title: 'PowerShell Beaconing Alert',
          description: 'Outbound traffic',
          severity: 'HIGH',
          provider: 'DEFENDER_ENDPOINT',
          createdTime: new Date().toISOString(),
          mitreTechniques: [],
          entities: [
            { id: 'ent-2', type: 'HOST', value: 'DESKTOP-001' }
          ]
        }
      ],
      rawPayload: {}
    };

    const graph = buildIncidentGraph(sampleIncident);
    assert.ok(graph.nodes.length > 0, 'Graph should contain nodes');
    assert.ok(graph.edges.length > 0, 'Graph should contain edges');

    // Central incident node
    const incidentNode = graph.nodes.find(n => n.type === 'incident');
    assert.ok(incidentNode, 'Central incident node must exist');
    assert.strictEqual(incidentNode.severity, 'HIGH');

    // Entity nodes
    const userNode = graph.nodes.find(n => n.type === 'user');
    const hostNode = graph.nodes.find(n => n.type === 'host');
    const ipNode = graph.nodes.find(n => n.type === 'ip');
    const mitreNode = graph.nodes.find(n => n.type === 'mitre');

    assert.ok(userNode, 'User node should exist');
    assert.strictEqual(userNode.label, 'john.doe@company.com');
    assert.ok(hostNode, 'Host node should exist');
    assert.ok(ipNode, 'IP node should exist');
    assert.ok(mitreNode, 'MITRE node should exist');

    // Edges
    const incidentToUserEdge = graph.edges.find(e => e.source === incidentNode.id && e.target === userNode.id);
    assert.ok(incidentToUserEdge, 'Edge connecting incident to user node must exist');
  });

  it('should construct cross-incident correlation graph across multiple entities', () => {
    const mockIncidents: UnifiedIncident[] = [
      {
        id: 'inc-a',
        incidentNumber: 1,
        title: 'Phishing Campaign Alpha',
        description: 'Email phishing',
        provider: 'DEFENDER_OFFICE365',
        severity: 'HIGH',
        status: 'ACTIVE',
        createdTime: new Date().toISOString(),
        lastUpdatedTime: new Date().toISOString(),
        entities: [],
        mitreTechniques: [],
        alerts: [],
        rawPayload: {}
      },
      {
        id: 'inc-b',
        incidentNumber: 2,
        title: 'Suspicious Sign-in Beta',
        description: 'Impossible travel',
        provider: 'SENTINEL_SIEM',
        severity: 'MEDIUM',
        status: 'ACTIVE',
        createdTime: new Date().toISOString(),
        lastUpdatedTime: new Date().toISOString(),
        entities: [],
        mitreTechniques: [],
        alerts: [],
        rawPayload: {}
      }
    ];

    const mockEntities = [
      {
        type: 'USER',
        value: 'shared.victim@company.com',
        incidentCount: 2,
        incidents: ['inc-a', 'inc-b']
      }
    ];

    const correlationGraph = buildCrossIncidentCorrelationGraph(mockIncidents, mockEntities);

    assert.ok(correlationGraph.nodes.length >= 3, 'Should contain 1 entity node and 2 incident nodes');
    assert.strictEqual(correlationGraph.edges.length, 2, 'Entity should connect to both incidents');

    const entityNode = correlationGraph.nodes.find(n => n.type === 'user');
    assert.ok(entityNode);
    assert.strictEqual(entityNode.label, 'shared.victim@company.com');
  });
});
