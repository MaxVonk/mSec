import { 
  UnifiedIncident, 
  UnifiedAlert, 
  IncidentSeverity, 
  IncidentStatus, 
  ProviderSource, 
  SecurityEntity, 
  MitreAttackInfo 
} from '../types/security';

export class DataNormalizer {

  /**
   * Normalizes arbitrary severity string to standard enum
   */
  public static normalizeSeverity(input: any): IncidentSeverity {
    if (!input) return 'INFORMATIONAL';
    const s = String(input).toUpperCase().trim();
    if (s.includes('CRIT')) return 'CRITICAL';
    if (s.includes('HIGH')) return 'HIGH';
    if (s.includes('MED')) return 'MEDIUM';
    if (s.includes('LOW')) return 'LOW';
    return 'INFORMATIONAL';
  }

  /**
   * Normalizes arbitrary status string to standard enum
   */
  public static normalizeStatus(input: any): IncidentStatus {
    if (!input) return 'ACTIVE';
    const s = String(input).toUpperCase().trim();
    if (s.includes('RESOLV') || s.includes('SOLVED') || s.includes('CLOSE')) return 'RESOLVED';
    if (s.includes('PROGRESS') || s.includes('INVESTIGAT')) return 'IN_PROGRESS';
    if (s.includes('NEW')) return 'NEW';
    return 'ACTIVE';
  }

  /**
   * Helper to parse granular evidence items (process, device, user, ip, file, mailbox, url)
   */
  private static extractEvidenceEntities(
    evidenceList: any[],
    addEntity: (type: SecurityEntity['type'], value: string, role?: string, details?: any) => void
  ) {
    if (!Array.isArray(evidenceList)) return;

    for (const ev of evidenceList) {
      if (!ev) continue;
      const evType = String(ev['@odata.type'] || '').toLowerCase();

      // 1. Process Evidence
      if (evType.includes('processevidence') || ev.processCommandLine || ev.parentProcessCommandLine || (ev.processId !== undefined && ev.imageFile)) {
        const cmdLine = ev.processCommandLine || (ev.imageFile?.fileName ? `${ev.imageFile.filePath || ''}/${ev.imageFile.fileName}` : 'Unknown process');
        addEntity('PROCESS', cmdLine, 'Suspicious Process Execution', {
          commandLine: ev.processCommandLine,
          fileName: ev.imageFile?.fileName,
          filePath: ev.imageFile?.filePath,
          sha256: ev.imageFile?.sha256,
          sha1: ev.imageFile?.sha1,
          md5: ev.imageFile?.md5,
          processId: ev.processId,
          parentProcessId: ev.parentProcessId,
          parentProcessCommandLine: ev.parentProcessCommandLine,
          detectionStatus: ev.detectionStatus,
          integrityLevel: ev.integrityLevel
        });

        // Also add SHA256 if present as a FILE entity
        if (ev.imageFile?.sha256 || ev.imageFile?.fileName) {
          addEntity('FILE', ev.imageFile?.sha256 || ev.imageFile?.fileName, 'Executed Binary Image', {
            fileName: ev.imageFile?.fileName,
            filePath: ev.imageFile?.filePath,
            sha256: ev.imageFile?.sha256,
            sha1: ev.imageFile?.sha1
          });
        }
      }

      // 2. User Evidence
      if (evType.includes('userevidence') || ev.userAccount) {
        const acc = ev.userAccount || {};
        const upn = acc.userPrincipalName || (acc.accountName ? (acc.domainName ? `${acc.accountName}@${acc.domainName}` : acc.accountName) : null) || ev.upn || ev.accountName;
        if (upn) {
          addEntity('USER', upn, 'Compromised / Impacted Account', {
            accountName: acc.accountName,
            domainName: acc.domainName,
            userSid: acc.userSid,
            userPrincipalName: acc.userPrincipalName
          });
        }
      }

      // 3. Device / Host Evidence
      if (evType.includes('deviceevidence') || ev.deviceDnsName || ev.deviceName || ev.mdeDeviceId) {
        const hostName = ev.deviceDnsName || ev.deviceName || ev.mdeDeviceId;
        if (hostName) {
          addEntity('HOST', hostName, 'Impacted Endpoint', {
            deviceDnsName: ev.deviceDnsName,
            deviceName: ev.deviceName,
            mdeDeviceId: ev.mdeDeviceId,
            osPlatform: ev.osPlatform,
            version: ev.version,
            osBuild: ev.osBuild,
            riskScore: ev.riskScore,
            healthStatus: ev.healthStatus,
            lastIpAddress: ev.lastIpAddress,
            lastExternalIpAddress: ev.lastExternalIpAddress,
            ipInterfaces: ev.ipInterfaces,
            rbacGroupName: ev.rbacGroupName
          });
        }

        // Add internal IP if present
        if (ev.lastIpAddress) {
          addEntity('IP', ev.lastIpAddress, 'Endpoint Internal IP', {
            host: hostName,
            type: 'internal'
          });
        }
        // Add external IP if present
        if (ev.lastExternalIpAddress) {
          addEntity('IP', ev.lastExternalIpAddress, 'Endpoint Public Egress IP', {
            host: hostName,
            type: 'external'
          });
        }
        // Add IP interfaces
        if (Array.isArray(ev.ipInterfaces)) {
          for (const ip of ev.ipInterfaces) {
            if (typeof ip === 'string' && ip && ip !== '127.0.0.1' && ip !== '::1') {
              addEntity('IP', ip, 'Endpoint Network Interface', { host: hostName });
            }
          }
        }
      }

      // 4. IP Evidence
      if (evType.includes('ipevidence') || ev.ipAddress) {
        if (ev.ipAddress) {
          addEntity('IP', ev.ipAddress, 'Network Indicator', ev);
        }
      }

      // 5. File Evidence
      if (evType.includes('fileevidence') || (ev.fileName && !evType.includes('process'))) {
        const fileVal = ev.fileName || ev.fileDetails?.fileName || ev.sha256;
        if (fileVal) {
          addEntity('FILE', fileVal, 'Malicious Artifact', {
            fileName: ev.fileName || ev.fileDetails?.fileName,
            filePath: ev.filePath || ev.fileDetails?.filePath,
            sha256: ev.sha256 || ev.fileDetails?.sha256,
            sha1: ev.sha1 || ev.fileDetails?.sha1
          });
        }
      }

      // 6. Mailbox Evidence
      if (evType.includes('mailboxevidence') || ev.primaryAddress) {
        if (ev.primaryAddress || ev.upn) {
          addEntity('MAILBOX', ev.primaryAddress || ev.upn, 'Target Mailbox', ev);
        }
      }

      // 7. URL Evidence
      if (evType.includes('urlevidence') || ev.url) {
        if (ev.url) {
          addEntity('URL', ev.url, 'Malicious / Suspicious URL', ev);
        }
      }
    }
  }

  /**
   * Normalizes Microsoft Graph Security Incidents (api: /v1.0/security/incidents)
   */
  public static normalizeGraphIncident(raw: any): UnifiedIncident {
    const id = String(raw.id || `m365-${Math.random().toString(36).substring(2, 9)}`);
    const incidentNumber = raw.incidentId || raw.incidentNumber || id;
    const title = raw.displayName || raw.incidentName || raw.title || 'M365 Defender Security Incident';
    const description = raw.description || `Incident involving ${raw.alertsCount || (raw.alerts ? raw.alerts.length : 1)} alerts across Microsoft 365 Defender.`;
    const severity = this.normalizeSeverity(raw.severity);
    const status = this.normalizeStatus(raw.status);
    const createdTime = raw.createdDateTime || raw.firstActivityDateTime || new Date().toISOString();
    const lastUpdatedTime = raw.lastUpdateDateTime || raw.lastActivityDateTime || createdTime;

    const entities: SecurityEntity[] = [];
    const entityMap = new Set<string>();

    const addEntity = (type: SecurityEntity['type'], value: string, role?: string, details?: any) => {
      if (!value || typeof value !== 'string') return;
      const cleanVal = value.trim();
      const key = `${type}:${cleanVal}`;
      if (!entityMap.has(key)) {
        entityMap.add(key);
        entities.push({
          id: `ent-${entities.length + 1}`,
          type,
          value: cleanVal,
          role,
          details
        });
      }
    };

    // Extract entities from M365 incident evidence
    if (Array.isArray(raw.evidence)) {
      this.extractEvidenceEntities(raw.evidence, addEntity);
    }

    // Alerts parsing
    const alerts: UnifiedAlert[] = [];
    if (Array.isArray(raw.alerts)) {
      for (const a of raw.alerts) {
        alerts.push(this.normalizeGraphAlert(a));
      }
    }

    // ALSO aggregate entities from child alerts!
    for (const alt of alerts) {
      if (alt.entities && Array.isArray(alt.entities)) {
        for (const ent of alt.entities) {
          addEntity(ent.type, ent.value, ent.role, ent.details);
        }
      }
    }

    // Extract MITRE ATT&CK techniques
    const mitreTechniques: MitreAttackInfo[] = [];
    const mitreMap = new Set<string>();

    const addMitre = (tactic: string, id: string, name: string) => {
      const key = `${id}:${name}`;
      if (!mitreMap.has(key)) {
        mitreMap.add(key);
        mitreTechniques.push({
          tactic: tactic || 'Unknown',
          techniqueId: id || 'T1000',
          techniqueName: name || id
        });
      }
    };

    // M365 provides attackTechniques or mitreTactics
    if (Array.isArray(raw.mitreTechniques)) {
      for (const t of raw.mitreTechniques) {
        addMitre(t.tactic || 'Execution', t.techniqueId || t.id, t.techniqueName || t.name);
      }
    } else if (Array.isArray(raw.systemTags)) {
      for (const tag of raw.systemTags) {
        if (tag.startsWith('ATT&CK:')) {
          addMitre('MITRE ATT&CK', tag.replace('ATT&CK:', '').trim(), tag);
        }
      }
    }

    // Infer provider
    let provider: ProviderSource = 'M365_DEFENDER';
    const alertProviders = alerts.map(a => a.provider);
    if (alertProviders.some(p => p === 'DEFENDER_ENDPOINT')) provider = 'DEFENDER_ENDPOINT';
    else if (alertProviders.some(p => p === 'DEFENDER_OFFICE365')) provider = 'DEFENDER_OFFICE365';
    else if (alertProviders.some(p => p === 'DEFENDER_IDENTITY')) provider = 'DEFENDER_IDENTITY';

    // Classification and Determination:
    // If raw is unknown or empty, look in alerts
    let classification = raw.classification;
    if (!classification || classification === 'unknown') {
      const altWithClass = alerts.find(a => a.classification && a.classification !== 'unknown');
      if (altWithClass) classification = altWithClass.classification;
    }
    if (!classification) classification = 'unknown';

    let determination = raw.determination;
    if (!determination || determination === 'unknown') {
      const altWithDet = alerts.find(a => a.determination && a.determination !== 'unknown');
      if (altWithDet) determination = altWithDet.determination;
    }

    // Comments aggregation:
    const comments: { comment: string; createdByDisplayName?: string; createdDateTime?: string }[] = [];
    if (raw.resolvingComment) {
      comments.push({
        comment: typeof raw.resolvingComment === 'string' ? raw.resolvingComment : JSON.stringify(raw.resolvingComment),
        createdByDisplayName: 'Incident Resolution Note',
        createdDateTime: raw.lastUpdateDateTime
      });
    }
    if (Array.isArray(raw.comments)) {
      for (const c of raw.comments) {
        comments.push({
          comment: typeof c === 'string' ? c : (c.comment || c.message || JSON.stringify(c)),
          createdByDisplayName: c.createdByDisplayName || c.author || 'Analyst',
          createdDateTime: c.createdDateTime || c.createdTime
        });
      }
    }
    // Also include alert comments
    for (const alt of alerts) {
      if (alt.comments && alt.comments.length > 0) {
        for (const c of alt.comments) {
          comments.push({
            comment: c.comment,
            createdByDisplayName: c.createdByDisplayName ? `${c.createdByDisplayName} (${alt.title})` : `Alert: ${alt.title}`,
            createdDateTime: c.createdDateTime
          });
        }
      }
    }

    const assignedTo = raw.assignedTo || alerts.find(a => a.assignedTo)?.assignedTo;
    const incidentWebUrl = raw.incidentWebUrl;
    const priorityScore = typeof raw.priorityScore === 'number' ? raw.priorityScore : undefined;
    const resolvingComment = typeof raw.resolvingComment === 'string' ? raw.resolvingComment : (raw.resolvingComment ? JSON.stringify(raw.resolvingComment) : undefined);

    return {
      id,
      incidentNumber,
      title,
      description,
      provider,
      severity,
      status,
      classification,
      determination,
      assignedTo,
      incidentWebUrl,
      priorityScore,
      resolvingComment,
      comments: comments.length > 0 ? comments : undefined,
      createdTime,
      lastUpdatedTime,
      entities,
      mitreTechniques,
      alerts,
      rawPayload: raw
    };
  }

  /**
   * Normalizes Microsoft Graph Alert (/v1.0/security/alerts_v2)
   */
  public static normalizeGraphAlert(raw: any): UnifiedAlert {
    const id = String(raw.id || `alt-${Math.random().toString(36).substring(2, 9)}`);
    const title = raw.title || raw.alertDisplayName || 'M365 Security Alert';
    const description = raw.description || raw.category || 'Alert triggered by Microsoft 365 Security';
    const severity = this.normalizeSeverity(raw.severity);
    const createdTime = raw.createdDateTime || raw.alertCreationTime || new Date().toISOString();

    let provider: ProviderSource = 'M365_DEFENDER';
    const serviceSource = String(raw.serviceSource || raw.productName || '').toLowerCase();
    if (serviceSource.includes('endpoint')) provider = 'DEFENDER_ENDPOINT';
    else if (serviceSource.includes('office') || serviceSource.includes('email')) provider = 'DEFENDER_OFFICE365';
    else if (serviceSource.includes('identity')) provider = 'DEFENDER_IDENTITY';
    else if (serviceSource.includes('cloudapp')) provider = 'DEFENDER_CLOUD_APPS';

    const entities: SecurityEntity[] = [];
    const entityMap = new Set<string>();
    const addEntity = (type: SecurityEntity['type'], value: string, role?: string, details?: any) => {
      if (!value || typeof value !== 'string') return;
      const cleanVal = value.trim();
      const key = `${type}:${cleanVal}`;
      if (!entityMap.has(key)) {
        entityMap.add(key);
        entities.push({
          id: `ev-${entities.length + 1}`,
          type,
          value: cleanVal,
          role,
          details
        });
      }
    };

    if (Array.isArray(raw.evidence)) {
      this.extractEvidenceEntities(raw.evidence, addEntity);
    }

    const mitreTechniques: MitreAttackInfo[] = [];
    if (Array.isArray(raw.mitreTechniques)) {
      raw.mitreTechniques.forEach((t: string | any) => {
        if (typeof t === 'string') {
          mitreTechniques.push({ tactic: 'Technique', techniqueId: t, techniqueName: t });
        } else {
          mitreTechniques.push({ tactic: t.tactic || 'General', techniqueId: t.id || 'T0000', techniqueName: t.name || t.id });
        }
      });
    }

    // Extract comments
    let comments: { comment: string; createdByDisplayName?: string; createdDateTime?: string }[] | undefined;
    if (Array.isArray(raw.comments) && raw.comments.length > 0) {
      comments = raw.comments.map((c: any) => ({
        comment: typeof c === 'string' ? c : (c.comment || c.message || JSON.stringify(c)),
        createdByDisplayName: c.createdByDisplayName || c.author || c.createdByUser,
        createdDateTime: c.createdDateTime || c.createdTime
      }));
    }

    return {
      id,
      title,
      description,
      severity,
      provider,
      createdTime,
      mitreTechniques,
      entities,
      classification: raw.classification,
      determination: raw.determination,
      assignedTo: raw.assignedTo,
      alertWebUrl: raw.alertWebUrl,
      recommendedActions: raw.recommendedActions,
      comments,
      rawData: raw
    };
  }

  /**
   * Normalizes Microsoft Sentinel Incident (Azure ARM / SecurityInsights)
   */
  public static normalizeSentinelIncident(raw: any): UnifiedIncident {
    const props = raw.properties || raw;
    const id = String(raw.name || raw.id || props.incidentNumber || `sentinel-${Math.random().toString(36).substring(2, 9)}`);
    const incidentNumber = props.incidentNumber || id;
    const title = props.title || 'Microsoft Sentinel SIEM Incident';
    const description = props.description || 'Security incident detected by Microsoft Sentinel analytics rule.';
    const severity = this.normalizeSeverity(props.severity);
    const status = this.normalizeStatus(props.status);
    const createdTime = props.createdTimeUtc || props.firstActivityTimeUtc || new Date().toISOString();
    const lastUpdatedTime = props.lastModifiedTimeUtc || props.lastActivityTimeUtc || createdTime;

    const entities: SecurityEntity[] = [];
    const mitreTechniques: MitreAttackInfo[] = [];

    // Parse Sentinel tactics & techniques
    if (Array.isArray(props.tactics)) {
      props.tactics.forEach((tac: string) => {
        mitreTechniques.push({
          tactic: tac,
          techniqueId: 'Sentinel-Tactic',
          techniqueName: tac
        });
      });
    }

    // Parse related alerts or entities in Sentinel
    if (Array.isArray(props.additionalData?.alertsCount)) {
      // count
    }

    // If relatedEntities or owner is present
    if (props.owner?.userPrincipalName) {
      entities.push({
        id: 'owner-1',
        type: 'USER',
        value: props.owner.userPrincipalName,
        role: 'Assigned Analyst'
      });
    }

    return {
      id,
      incidentNumber,
      title,
      description,
      provider: 'SENTINEL_SIEM',
      severity,
      status,
      classification: props.classification || props.classificationReason || 'Undetermined',
      createdTime,
      lastUpdatedTime,
      entities,
      mitreTechniques,
      alerts: [],
      rawPayload: raw
    };
  }

  /**
   * Normalizes Microsoft Entra ID Sign-In Log (/v1.0/auditLogs/signIns)
   */
  public static normalizeEntraSignIn(raw: any): UnifiedIncident {
    const id = String(raw.id || `entra-${Math.random().toString(36).substring(2, 9)}`);
    const upn = raw.userPrincipalName || raw.userId || 'Unknown User';
    const ip = raw.ipAddress || '0.0.0.0';
    const location = raw.location?.city ? `${raw.location.city}, ${raw.location.countryOrRegion}` : (raw.location?.countryOrRegion || 'Unknown Location');
    const app = raw.appDisplayName || 'Azure / M365 App';
    const riskLevel = String(raw.riskLevelAggregated || raw.riskLevelDuringSignIn || 'none').toUpperCase();
    const isFailure = raw.status?.errorCode !== 0 && raw.status?.errorCode !== undefined;

    const severity: IncidentSeverity = 
      riskLevel.includes('HIGH') ? 'HIGH' :
      riskLevel.includes('MED') ? 'MEDIUM' :
      isFailure ? 'LOW' : 'INFORMATIONAL';

    const title = `Entra ID: ${riskLevel !== 'NONE' ? `${riskLevel} Risk Sign-In` : (isFailure ? 'Failed Sign-In Attempt' : 'Sign-In Activity')} (${upn})`;
    const description = `User '${upn}' attempted sign-in to '${app}' from IP ${ip} (${location}). Status: ${raw.status?.failureReason || 'Success'}. Risk detail: ${raw.riskDetail || 'None'}.`;

    const entities: SecurityEntity[] = [
      { id: 'user-1', type: 'USER', value: upn, role: 'Target Account' },
      { id: 'ip-1', type: 'IP', value: ip, role: 'Source IP Address', details: { location } },
      { id: 'app-1', type: 'CLOUD_RESOURCE', value: app, role: 'Target Application' }
    ];

    if (raw.deviceDetail?.displayName) {
      entities.push({
        id: 'host-1',
        type: 'HOST',
        value: raw.deviceDetail.displayName,
        role: 'Client Device',
        details: { os: raw.deviceDetail.operatingSystem, browser: raw.deviceDetail.browser }
      });
    }

    const mitreTechniques: MitreAttackInfo[] = [
      { tactic: 'Initial Access', techniqueId: 'T1078', techniqueName: 'Valid Accounts' }
    ];

    return {
      id,
      incidentNumber: id.substring(0, 8),
      title,
      description,
      provider: 'ENTRA_ID',
      severity,
      status: isFailure ? 'ACTIVE' : 'RESOLVED',
      createdTime: raw.createdDateTime || new Date().toISOString(),
      lastUpdatedTime: raw.createdDateTime || new Date().toISOString(),
      entities,
      mitreTechniques,
      alerts: [],
      rawPayload: raw
    };
  }

  /**
   * Universal Auto-Detection Parser for JSON/CSV imports
   */
  public static parseUniversal(data: any): UnifiedIncident[] {
    const results: UnifiedIncident[] = [];

    const items = Array.isArray(data) ? data : [data];

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;

      // Check if it's an already normalized UnifiedIncident
      if (item.provider && item.severity && item.title && item.id && item.entities) {
        results.push(item as UnifiedIncident);
        continue;
      }

      // Check for M365 Graph Security Incident
      if (item.alertsCount !== undefined || item.incidentId !== undefined || item.incidentWebUrl !== undefined || (item.displayName && (item.evidence || item.alerts))) {
        results.push(this.normalizeGraphIncident(item));
        continue;
      }

      // Check for Microsoft Sentinel Incident
      if (item.type === 'Microsoft.SecurityInsights/Incidents' || item.properties?.incidentNumber !== undefined || item.tactics !== undefined) {
        results.push(this.normalizeSentinelIncident(item));
        continue;
      }

      // Check for Entra ID Sign-In
      if (item.userPrincipalName && (item.ipAddress || item.riskLevelAggregated || item.appDisplayName)) {
        results.push(this.normalizeEntraSignIn(item));
        continue;
      }

      // Check for Graph Alert
      if (item.serviceSource || item.alertDisplayName || item.productName) {
        const alert = this.normalizeGraphAlert(item);
        results.push({
          id: alert.id,
          incidentNumber: alert.id,
          title: alert.title,
          description: alert.description,
          provider: alert.provider,
          severity: alert.severity,
          status: 'ACTIVE',
          createdTime: alert.createdTime,
          lastUpdatedTime: alert.createdTime,
          entities: alert.entities,
          mitreTechniques: alert.mitreTechniques,
          alerts: [alert],
          rawPayload: item
        });
        continue;
      }

      // Fallback: Generic Security Event / Incident Parser
      const id = String(item.id || item.IncidentId || item.AlertId || `imp-${Math.random().toString(36).substring(2, 9)}`);
      const title = item.title || item.Title || item.IncidentName || item.Name || 'Imported Security Event';
      const description = item.description || item.Description || item.Details || item.Message || 'Imported external security record';
      const severity = this.normalizeSeverity(item.severity || item.Severity || item.Risk || item.Priority);
      const status = this.normalizeStatus(item.status || item.Status || item.State);
      const createdTime = item.createdTime || item.timestamp || item.Timestamp || item.TimeGenerated || item.Date || new Date().toISOString();

      const entities: SecurityEntity[] = [];
      const userVal = item.user || item.User || item.Account || item.UserPrincipalName;
      if (userVal) entities.push({ id: `ent-u-${entities.length}`, type: 'USER', value: String(userVal), role: 'Target Account' });

      const hostVal = item.host || item.Host || item.Device || item.Computer || item.DeviceName;
      if (hostVal) entities.push({ id: `ent-h-${entities.length}`, type: 'HOST', value: String(hostVal), role: 'Host / Endpoint' });

      const ipVal = item.ip || item.IP || item.IpAddress || item.SourceIp;
      if (ipVal) entities.push({ id: `ent-i-${entities.length}`, type: 'IP', value: String(ipVal), role: 'IP Address' });

      results.push({
        id,
        incidentNumber: id,
        title,
        description,
        provider: 'GENERIC_IMPORT',
        severity,
        status,
        createdTime,
        lastUpdatedTime: createdTime,
        entities,
        mitreTechniques: [],
        alerts: [],
        rawPayload: item
      });
    }

    return results;
  }
}

