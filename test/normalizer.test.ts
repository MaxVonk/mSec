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

  it('should deeply normalize Defender XDR incident with alert-level evidence, process command lines, device details, non-UPN accounts, and SOC comments', () => {
    const rawDefender1852 = {
      id: '1852',
      tenantId: 'f18c705c-7147-4a08-a9d5-38b406f68b79',
      status: 'resolved',
      incidentWebUrl: 'https://security.microsoft.com/incident2/1852/overview?tid=f18c705c-7147-4a08-a9d5-38b406f68b79',
      displayName: 'Suspicious hack tool',
      createdDateTime: '2026-09-09T11:05:17.6566667Z',
      lastUpdateDateTime: '2026-09-09T11:36:50.58Z',
      classification: 'unknown',
      determination: 'unknown',
      severity: 'medium',
      alerts: [
        {
          id: 'da63924709-alert-1',
          title: 'Suspicious hack tool execution',
          category: 'HackTool',
          classification: 'falsePositive',
          determination: 'notMalicious',
          recommendedActions: 'Investigate the command line executed by curl',
          alertWebUrl: 'https://security.microsoft.com/alerts/da63924709-alert-1',
          comments: [
            {
              comment: 'SOC Lead Analyst: False positive trufflehog checksum download.',
              createdByDisplayName: 'SOC Lead Analyst',
              createdDateTime: '2026-09-09T11:35:00Z'
            }
          ],
          evidence: [
            {
              '@odata.type': '#microsoft.graph.security.processEvidence',
              processCommandLine: 'curl -sL https://github.com/trufflesecurity/trufflehog/releases/download/v3.88.2/trufflehog_3.88.2_checksums.txt',
              processId: 80946,
              parentProcessId: 80945,
              imageFile: {
                fileName: 'curl',
                filePath: '/usr/bin/curl',
                sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
              }
            },
            {
              '@odata.type': '#microsoft.graph.security.deviceEvidence',
              deviceDnsName: 'VFT141',
              osPlatform: 'Ubuntu',
              version: '25.10',
              lastIpAddress: '192.168.1.57',
              lastExternalIpAddress: '213.102.72.73',
              ipInterfaces: ['192.168.1.57']
            },
            {
              '@odata.type': '#microsoft.graph.security.userEvidence',
              userAccount: {
                accountName: 'henrik',
                domainName: 'vft141',
                userPrincipalName: null
              }
            }
          ]
        }
      ]
    };

    const normalized = DataNormalizer.normalizeGraphIncident(rawDefender1852);

    assert.strictEqual(normalized.id, '1852');
    assert.strictEqual(normalized.status, 'RESOLVED');
    assert.strictEqual(normalized.severity, 'MEDIUM');
    assert.strictEqual(normalized.incidentWebUrl, 'https://security.microsoft.com/incident2/1852/overview?tid=f18c705c-7147-4a08-a9d5-38b406f68b79');
    
    // Inherited from alert since incident level was 'unknown'
    assert.strictEqual(normalized.classification, 'falsePositive');
    assert.strictEqual(normalized.determination, 'notMalicious');

    // Comments extracted
    assert.ok(normalized.comments && normalized.comments.length > 0);
    assert.ok(normalized.comments.some(c => c.comment.includes('SOC Lead Analyst')));

    // Entities extracted from alert evidence
    const procEntity = normalized.entities.find(e => e.type === 'PROCESS');
    assert.ok(procEntity, 'Process entity should be extracted');
    assert.ok(procEntity?.value.includes('trufflehog_3.88.2_checksums.txt'));
    assert.strictEqual(procEntity?.details?.processId, 80946);
    assert.strictEqual(procEntity?.details?.sha256, '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');

    const hostEntity = normalized.entities.find(e => e.type === 'HOST');
    assert.ok(hostEntity, 'Host entity should be extracted');
    assert.strictEqual(hostEntity?.value, 'VFT141');
    assert.strictEqual(hostEntity?.details?.osPlatform, 'Ubuntu');
    assert.strictEqual(hostEntity?.details?.version, '25.10');

    const userEntity = normalized.entities.find(e => e.type === 'USER');
    assert.ok(userEntity, 'User entity should be extracted even if userPrincipalName is null');
    assert.strictEqual(userEntity?.value, 'henrik@vft141');

    const ipEntities = normalized.entities.filter(e => e.type === 'IP');
    assert.ok(ipEntities.some(e => e.value === '192.168.1.57'), 'Internal IP extracted');
    assert.ok(ipEntities.some(e => e.value === '213.102.72.73'), 'External IP extracted');
  });

  it('should normalize Defender for Office 365 incident with analyzedMessageEvidence, mailbox evidence, and extracted URLs', () => {
    const rawOfficeIncident = {
      id: '1864',
      displayName: 'Email messages removed after delivery involving one user',
      description: 'Malicious emails were delivered and later removed -V1.0.0.2',
      severity: 'informational',
      status: 'resolved',
      createdDateTime: '2026-09-14T13:56:19.5366667Z',
      alerts: [
        {
          id: 'da147d34-c360-642d-2ba0-2580556942ad',
          title: 'Email messages removed after delivery',
          serviceSource: 'microsoftDefenderForOffice365',
          evidence: [
            {
              '@odata.type': '#microsoft.graph.security.mailboxEvidence',
              primaryAddress: 'target-user@example.com',
              userAccount: {
                accountName: 'target-user',
                domainName: 'example.com'
              }
            },
            {
              '@odata.type': '#microsoft.graph.security.analyzedMessageEvidence',
              networkMessageId: 'a908d132-7204-4b5b-0ec2-08dd0402ae58',
              internetMessageId: '<BL3PR02MB9058@namprd02.prod.outlook.com>',
              subject: 'Urgent Wire Transfer Invoice #84920',
              threats: ['ZapPhish'],
              detectionMethods: ['heuristic'],
              direction: 'inbound',
              receivedDateTime: '2026-09-14T12:00:23Z',
              deliveryAction: 'delivered',
              deliveryLocation: 'quarantine',
              p1Sender: {
                displayName: null,
                emailAddress: 'bounce@spoofed-sender.com',
                domainName: 'spoofed-sender.com'
              },
              p2Sender: {
                displayName: 'Accounts Payable',
                emailAddress: 'invoicing@spoofed-sender.com',
                domainName: 'spoofed-sender.com'
              },
              recipientEmailAddress: 'target-user@example.com',
              senderIp: '198.51.100.42',
              urls: [
                'https://credential-stealer.fake/login',
                'https://tracking-pixel.fake/beacon'
              ]
            }
          ]
        }
      ]
    };

    const normalized = DataNormalizer.normalizeGraphIncident(rawOfficeIncident);
    assert.strictEqual(normalized.id, '1864');
    assert.strictEqual(normalized.provider, 'DEFENDER_OFFICE365');
    assert.ok(normalized.emailEvidence && normalized.emailEvidence.length === 1);

    const email = normalized.emailEvidence[0];
    assert.strictEqual(email.subject, 'Urgent Wire Transfer Invoice #84920');
    assert.strictEqual(email.senderEmail, 'invoicing@spoofed-sender.com');
    assert.strictEqual(email.senderDisplayName, 'Accounts Payable');
    assert.strictEqual(email.returnPathEmail, 'bounce@spoofed-sender.com');
    assert.strictEqual(email.recipientEmail, 'target-user@example.com');
    assert.strictEqual(email.senderIp, '198.51.100.42');
    assert.strictEqual(email.deliveryAction, 'delivered');
    assert.strictEqual(email.deliveryLocation, 'quarantine');
    assert.deepStrictEqual(email.threats, ['ZapPhish']);
    assert.strictEqual(email.urls?.length, 2);

    // Verify entities extracted
    const senderEntity = normalized.entities.find(e => e.type === 'USER' && e.value === 'invoicing@spoofed-sender.com');
    assert.ok(senderEntity, 'P2 Sender should be extracted as USER entity');

    const returnPathEntity = normalized.entities.find(e => e.type === 'USER' && e.value === 'bounce@spoofed-sender.com');
    assert.ok(returnPathEntity, 'P1 Sender should be extracted as USER entity');

    const recipientEntity = normalized.entities.find(e => e.type === 'USER' && e.value === 'target-user@example.com');
    assert.ok(recipientEntity, 'Recipient should be extracted as USER entity');

    const ipEntity = normalized.entities.find(e => e.type === 'IP' && e.value === '198.51.100.42');
    assert.ok(ipEntity, 'Sender IP should be extracted as IP entity');

    const urlEntities = normalized.entities.filter(e => e.type === 'URL');
    assert.strictEqual(urlEntities.length, 2, 'Extracted URLs should be URL entities');
  });
});

