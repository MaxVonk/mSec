import { 
  UnifiedIncident, 
  LinkedIncidentRef, 
  SecurityEntity, 
  MitreAttackInfo, 
  UnifiedAlert, 
  IncidentSeverity,
  EmailMessageEvidence
} from '../types';

/**
 * Formats incident timestamps to show date and time (e.g. "Sep 14 • 12:06")
 */
export function formatIncidentDateTime(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const now = new Date();
  const isSameYear = d.getFullYear() === now.getFullYear();

  const dateFormatted = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(isSameYear ? {} : { year: 'numeric' })
  });
  const timeFormatted = d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
  return `${dateFormatted} • ${timeFormatted}`;
}

/**
 * Normalizes title strings for fuzzy matching
 * Strips zero-width characters, common platform prefixes, and redundant whitespace
 */
export function normalizeIncidentTitle(title?: string): string {
  if (!title) return '';
  return title
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width spaces
    .toLowerCase()
    .replace(/^(microsoft\s+365\s+defender|m365\s+defender|defender|microsoft\s+sentinel|sentinel|azure\s+sentinel)[\s:_\-]+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Severity ranking helper
 */
const SEVERITY_WEIGHT: Record<IncidentSeverity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFORMATIONAL: 1
};

function getHighestSeverity(sevA: IncidentSeverity, sevB: IncidentSeverity): IncidentSeverity {
  return (SEVERITY_WEIGHT[sevA] || 0) >= (SEVERITY_WEIGHT[sevB] || 0) ? sevA : sevB;
}

/**
 * Checks if two incidents represent the same underlying security event
 * between Microsoft Sentinel (SIEM) and Microsoft 365 Defender (XDR)
 */
export function isSiemXdrDuplicatePair(incA: UnifiedIncident, incB: UnifiedIncident): boolean {
  if (incA.id === incB.id) return false;

  const isSentinelA = incA.provider === 'SENTINEL_SIEM';
  const isSentinelB = incB.provider === 'SENTINEL_SIEM';

  const isDefenderA = incA.provider.startsWith('DEFENDER') || incA.provider === 'M365_DEFENDER';
  const isDefenderB = incB.provider.startsWith('DEFENDER') || incB.provider === 'M365_DEFENDER';

  // One must be Sentinel and the other Defender
  if (!((isSentinelA && isDefenderB) || (isDefenderA && isSentinelB))) {
    return false;
  }

  const sentinel = isSentinelA ? incA : incB;
  const defender = isDefenderA ? incA : incB;

  // 1. Explicit Incident ID linkage check
  const defenderId = String(defender.incidentNumber || defender.id || '').trim();
  if (defenderId) {
    const sentinelRawStr = JSON.stringify(sentinel.rawPayload || {});
    if (
      sentinelRawStr.includes(`"incidentId":"${defenderId}"`) ||
      sentinelRawStr.includes(`"IncidentId": "${defenderId}"`) ||
      sentinelRawStr.includes(`Incident ID: ${defenderId}`) ||
      sentinelRawStr.includes(`Defender ID: ${defenderId}`) ||
      sentinelRawStr.includes(`/${defenderId}`)
    ) {
      return true;
    }
  }

  // 2. Title similarity matching
  const normTitleA = normalizeIncidentTitle(sentinel.title);
  const normTitleB = normalizeIncidentTitle(defender.title);

  if (!normTitleA || !normTitleB) return false;

  const titleMatch = 
    normTitleA === normTitleB ||
    normTitleA.includes(normTitleB) ||
    normTitleB.includes(normTitleA);

  if (!titleMatch) return false;

  // 3. Time proximity check (within 24 hours of each other, typically minutes)
  const timeA = new Date(sentinel.createdTime).getTime();
  const timeB = new Date(defender.createdTime).getTime();

  if (!isNaN(timeA) && !isNaN(timeB)) {
    const diffHours = Math.abs(timeA - timeB) / (1000 * 60 * 60);
    if (diffHours <= 24) {
      return true;
    }
  }

  // 4. Entity overlap check (if timestamps are slightly distant or unparseable)
  const entitiesA = new Set(sentinel.entities.map(e => `${e.type}:${e.value.toLowerCase().trim()}`));
  const hasSharedEntity = defender.entities.some(e => entitiesA.has(`${e.type}:${e.value.toLowerCase().trim()}`));

  return hasSharedEntity;
}

/**
 * Merges a pair of Sentinel SIEM and Defender XDR incidents into a unified incident
 */
export function mergeIncidentPair(incA: UnifiedIncident, incB: UnifiedIncident): UnifiedIncident {
  const isDefenderA = incA.provider.startsWith('DEFENDER') || incA.provider === 'M365_DEFENDER';
  const primary = isDefenderA ? incA : incB;
  const secondary = isDefenderA ? incB : incA;

  // Build linked references
  const linkedIncidents: LinkedIncidentRef[] = [
    {
      id: primary.id,
      incidentNumber: primary.incidentNumber,
      provider: primary.provider,
      title: primary.title,
      createdTime: primary.createdTime,
      incidentWebUrl: primary.incidentWebUrl,
      rawPayload: primary.rawPayload,
      entities: primary.entities,
      alerts: primary.alerts,
      threatAssessment: primary.threatAssessment,
      emailEvidence: primary.emailEvidence
    },
    {
      id: secondary.id,
      incidentNumber: secondary.incidentNumber,
      provider: secondary.provider,
      title: secondary.title,
      createdTime: secondary.createdTime,
      incidentWebUrl: secondary.incidentWebUrl,
      rawPayload: secondary.rawPayload,
      entities: secondary.entities,
      alerts: secondary.alerts,
      threatAssessment: secondary.threatAssessment,
      emailEvidence: secondary.emailEvidence
    }
  ];

  // Merge entities deduplicated by type and value
  const entityMap = new Map<string, SecurityEntity>();
  for (const ent of [...primary.entities, ...secondary.entities]) {
    const key = `${ent.type}:${ent.value.toLowerCase().trim()}`;
    if (!entityMap.has(key)) {
      entityMap.set(key, ent);
    } else {
      // Merge details if available
      const existing = entityMap.get(key)!;
      if (!existing.role && ent.role) existing.role = ent.role;
      if (!existing.details && ent.details) existing.details = ent.details;
      if ((ent.riskScore || 0) > (existing.riskScore || 0)) existing.riskScore = ent.riskScore;
    }
  }

  // Merge alerts
  const alertMap = new Map<string, UnifiedAlert>();
  for (const alt of [...primary.alerts, ...secondary.alerts]) {
    const key = alt.id || `${alt.title}:${alt.createdTime}`;
    if (!alertMap.has(key)) {
      alertMap.set(key, alt);
    }
  }

  // Merge MITRE techniques
  const mitreMap = new Map<string, MitreAttackInfo>();
  for (const m of [...primary.mitreTechniques, ...secondary.mitreTechniques]) {
    const key = `${m.techniqueId}:${m.techniqueName}`;
    if (!mitreMap.has(key)) {
      mitreMap.set(key, m);
    }
  }

  // Merge email evidence
  const emailMap = new Map<string, EmailMessageEvidence>();
  for (const em of [...(primary.emailEvidence || []), ...(secondary.emailEvidence || [])]) {
    const key = em.networkMessageId || em.internetMessageId || `${em.subject}|${em.senderEmail}`;
    if (!emailMap.has(key)) {
      emailMap.set(key, em);
    }
  }

  // Highest severity
  const severity = getHighestSeverity(primary.severity, secondary.severity);

  // Status preference: ACTIVE or in progress over NEW; RESOLVED/CLOSED if both resolved
  const status = primary.status === 'RESOLVED' || primary.status === 'CLOSED'
    ? primary.status
    : (secondary.status === 'RESOLVED' || secondary.status === 'CLOSED' ? secondary.status : primary.status);

  // Dual incident numbers
  const defNum = primary.incidentNumber || primary.id;
  const senNum = secondary.incidentNumber || secondary.id;
  const dualIncidentNumber = `${defNum} ⮀ ${senNum}`;

  return {
    ...primary,
    id: `chained-${primary.id}-${secondary.id}`,
    incidentNumber: dualIncidentNumber,
    title: primary.title || secondary.title,
    description: primary.description || secondary.description,
    severity,
    status,
    isChained: true,
    primaryProvider: primary.provider,
    secondaryProvider: secondary.provider,
    linkedIncidents,
    entities: Array.from(entityMap.values()),
    alerts: Array.from(alertMap.values()),
    mitreTechniques: Array.from(mitreMap.values()),
    emailEvidence: emailMap.size > 0 ? Array.from(emailMap.values()) : undefined,
    threatAssessment: primary.threatAssessment || secondary.threatAssessment,
    rawPayload: {
      _mergedType: 'CHAINED_SIEM_XDR',
      primaryProvider: primary.provider,
      secondaryProvider: secondary.provider,
      defenderPayload: primary.rawPayload,
      sentinelPayload: secondary.rawPayload
    }
  };
}

/**
 * Correlates an array of unified incidents, merging duplicates between Sentinel and Defender
 */
export function correlateSiemXdrIncidents(incidents: UnifiedIncident[]): {
  unified: UnifiedIncident[];
  mergedCount: number;
} {
  if (!Array.isArray(incidents) || incidents.length === 0) {
    return { unified: [], mergedCount: 0 };
  }

  const mergedIds = new Set<string>();
  const results: UnifiedIncident[] = [];
  let mergedCount = 0;

  for (let i = 0; i < incidents.length; i++) {
    const incA = incidents[i];
    if (mergedIds.has(incA.id)) continue;

    let matchedB: UnifiedIncident | null = null;
    let matchedIndex = -1;

    for (let j = i + 1; j < incidents.length; j++) {
      const incB = incidents[j];
      if (mergedIds.has(incB.id)) continue;

      if (isSiemXdrDuplicatePair(incA, incB)) {
        matchedB = incB;
        matchedIndex = j;
        break;
      }
    }

    if (matchedB) {
      mergedIds.add(incA.id);
      mergedIds.add(matchedB.id);
      results.push(mergeIncidentPair(incA, matchedB));
      mergedCount++;
    } else {
      results.push(incA);
    }
  }

  return {
    unified: results,
    mergedCount
  };
}
