import { UnifiedIncident, GraphData, GraphNode, GraphEdge, SecurityEntity } from '../types';

/**
 * Builds a node-link graph data structure for a single incident investigation
 */
export function buildIncidentGraph(incident: UnifiedIncident): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seenNodeIds = new Set<string>();

  // 1. Central Incident Hub Node
  const incidentNodeId = `inc-${incident.id}`;
  nodes.push({
    id: incidentNodeId,
    label: `#${incident.incidentNumber || incident.id}: ${incident.title.slice(0, 30)}...`,
    sublabel: incident.provider,
    type: 'incident',
    severity: incident.severity,
    data: { incidentId: incident.id, fullTitle: incident.title }
  });
  seenNodeIds.add(incidentNodeId);

  // 2. Correlated Alert Nodes
  (incident.alerts || []).forEach((alert, idx) => {
    const alertNodeId = `alt-${alert.id || idx}`;
    if (!seenNodeIds.has(alertNodeId)) {
      nodes.push({
        id: alertNodeId,
        label: alert.title.slice(0, 26) + (alert.title.length > 26 ? '...' : ''),
        sublabel: alert.provider,
        type: 'alert',
        severity: alert.severity,
        data: { alertId: alert.id, fullTitle: alert.title }
      });
      seenNodeIds.add(alertNodeId);

      edges.push({
        id: `e-${incidentNodeId}-${alertNodeId}`,
        source: incidentNodeId,
        target: alertNodeId,
        label: 'alert'
      });
    }

    // Connect alert entities
    (alert.entities || []).forEach(ent => {
      const entNodeId = `ent-${ent.type.toLowerCase()}-${ent.value}`;
      if (!seenNodeIds.has(entNodeId)) {
        nodes.push({
          id: entNodeId,
          label: ent.value,
          sublabel: ent.role,
          type: (ent.type.toLowerCase() as any) || 'host',
          data: ent
        });
        seenNodeIds.add(entNodeId);
      }

      const edgeId = `e-${alertNodeId}-${entNodeId}`;
      if (!edges.some(e => e.id === edgeId)) {
        edges.push({
          id: edgeId,
          source: alertNodeId,
          target: entNodeId,
          label: ent.role || 'observed'
        });
      }
    });

    // Alert MITRE techniques
    (alert.mitreTechniques || []).forEach(m => {
      const mitreNodeId = `mitre-${m.techniqueId || m.techniqueName}`;
      if (!seenNodeIds.has(mitreNodeId)) {
        nodes.push({
          id: mitreNodeId,
          label: m.techniqueId || m.techniqueName,
          sublabel: m.tactic,
          type: 'mitre',
          data: m
        });
        seenNodeIds.add(mitreNodeId);
      }

      const edgeId = `e-${alertNodeId}-${mitreNodeId}`;
      if (!edges.some(e => e.id === edgeId)) {
        edges.push({
          id: edgeId,
          source: alertNodeId,
          target: mitreNodeId,
          label: m.tactic
        });
      }
    });
  });

  // 3. Incident-level entities
  (incident.entities || []).forEach(ent => {
    const entNodeId = `ent-${ent.type.toLowerCase()}-${ent.value}`;
    if (!seenNodeIds.has(entNodeId)) {
      nodes.push({
        id: entNodeId,
        label: ent.value,
        sublabel: ent.role,
        type: (ent.type.toLowerCase() as any) || 'host',
        data: ent
      });
      seenNodeIds.add(entNodeId);
    }

    const edgeId = `e-${incidentNodeId}-${entNodeId}`;
    if (!edges.some(e => e.id === edgeId)) {
      edges.push({
        id: edgeId,
        source: incidentNodeId,
        target: entNodeId,
        label: ent.role || 'involved'
      });
    }
  });

  // 4. Incident MITRE techniques
  (incident.mitreTechniques || []).forEach(m => {
    const mitreNodeId = `mitre-${m.techniqueId || m.techniqueName}`;
    if (!seenNodeIds.has(mitreNodeId)) {
      nodes.push({
        id: mitreNodeId,
        label: m.techniqueId || m.techniqueName,
        sublabel: m.tactic,
        type: 'mitre',
        data: m
      });
      seenNodeIds.add(mitreNodeId);
    }

    const edgeId = `e-${incidentNodeId}-${mitreNodeId}`;
    if (!edges.some(e => e.id === edgeId)) {
      edges.push({
        id: edgeId,
        source: incidentNodeId,
        target: mitreNodeId,
        label: m.tactic
      });
    }
  });

  return { nodes, edges };
}

/**
 * Builds a cross-incident entity correlation graph for the EntityExplorer view
 */
export function buildCrossIncidentCorrelationGraph(
  incidents: UnifiedIncident[],
  entities: { type: string; value: string; incidentCount: number; incidents: string[] }[]
): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seenNodeIds = new Set<string>();

  // Take top correlated entities (with highest incident count, max 25)
  const topEntities = entities.slice(0, 25);
  const relevantIncidentIds = new Set<string>();

  topEntities.forEach(ent => {
    const entNodeId = `ent-${ent.type.toLowerCase()}-${ent.value}`;
    if (!seenNodeIds.has(entNodeId)) {
      nodes.push({
        id: entNodeId,
        label: ent.value,
        sublabel: `${ent.incidentCount} incident(s)`,
        type: (ent.type.toLowerCase() as any) || 'host',
        data: ent
      });
      seenNodeIds.add(entNodeId);
    }

    ent.incidents.forEach(id => relevantIncidentIds.add(id));
  });

  // Add Incident nodes that connect these entities
  incidents
    .filter(inc => relevantIncidentIds.has(inc.id))
    .slice(0, 15) // limit incident hubs to prevent clutter
    .forEach(inc => {
      const incNodeId = `inc-${inc.id}`;
      if (!seenNodeIds.has(incNodeId)) {
        nodes.push({
          id: incNodeId,
          label: `#${inc.incidentNumber || inc.id}: ${inc.title.slice(0, 22)}...`,
          sublabel: inc.provider,
          type: 'incident',
          severity: inc.severity,
          data: { incidentId: inc.id, fullTitle: inc.title }
        });
        seenNodeIds.add(incNodeId);
      }

      // Connect each related entity
      topEntities.forEach(ent => {
        if (ent.incidents.includes(inc.id)) {
          const entNodeId = `ent-${ent.type.toLowerCase()}-${ent.value}`;
          const edgeId = `e-${incNodeId}-${entNodeId}`;
          if (!edges.some(e => e.id === edgeId)) {
            edges.push({
              id: edgeId,
              source: incNodeId,
              target: entNodeId,
              label: 'correlated'
            });
          }
        }
      });
    });

  return { nodes, edges };
}

