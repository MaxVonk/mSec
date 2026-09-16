import { describe, it } from 'node:test';
import assert from 'node:assert';
import { recommendPlaybook } from '../src/utils/playbookRecommender.js';
import { UnifiedIncident } from '../server/types/security.js';

describe('SOAR Playbook Recommendation Engine Tests', () => {

  it('should ignore Low and Informational incidents by default unless forceRecommend is specified', () => {
    const lowIncident: UnifiedIncident = {
      id: 'inc-low-001',
      title: 'Unusual volume of file downloads',
      description: 'Benign user backup process triggered baseline anomaly',
      provider: 'DEFENDER_XDR',
      severity: 'LOW',
      status: 'ACTIVE',
      createdTime: new Date().toISOString(),
      lastUpdatedTime: new Date().toISOString(),
      entities: [{ id: 'e1', name: 'User', type: 'USER', value: 'backup.service@corp.com' }],
      mitreTechniques: [],
      alerts: [],
      rawPayload: {}
    };

    const result = recommendPlaybook(lowIncident);
    assert.strictEqual(result, null, 'Low severity incidents should not trigger auto-recommendation');

    const forcedResult = recommendPlaybook(lowIncident, { forceRecommend: true });
    assert.ok(forcedResult !== null, 'forceRecommend flag should bypass severity check');
  });

  it('should recommend Phishing Campaign Purge for email attacks with MITRE T1566 and email evidence', () => {
    const phishIncident: UnifiedIncident = {
      id: 'inc-high-phish',
      title: 'High confidence phishing email delivery involving multiple recipients',
      description: 'Phishing campaign impersonating Microsoft 365 login detected across finance department',
      provider: 'DEFENDER_OFFICE365',
      severity: 'HIGH',
      status: 'ACTIVE',
      createdTime: new Date().toISOString(),
      lastUpdatedTime: new Date().toISOString(),
      entities: [
        { id: 'e1', name: 'User', type: 'USER', value: 'cfo@company.com' }
      ],
      mitreTechniques: [
        { tactic: 'Initial Access', techniqueId: 'T1566.002', techniqueName: 'Spearphishing Link' }
      ],
      emailEvidence: [
        {
          networkMessageId: 'net-msg-123',
          internetMessageId: '<phish-123@evil.com>',
          sender: 'security@micr0soft.com',
          senderAddress: 'security@micr0soft.com',
          recipient: 'cfo@company.com',
          recipientEmail: 'cfo@company.com',
          deliveryAction: 'Delivered',
          threats: ['Phish']
        }
      ],
      alerts: [],
      rawPayload: {}
    };

    const rec = recommendPlaybook(phishIncident);
    assert.ok(rec !== null);
    assert.strictEqual(rec.playbook.id, 'phishing-campaign-purge');
    assert.strictEqual(rec.confidence, 'HIGH');
    assert.ok(rec.score >= 75);
    assert.strictEqual(rec.suggestedTarget?.value, 'cfo@company.com');
    assert.ok(rec.rationale.includes('T1566'));
  });

  it('should recommend Ransomware & Endpoint Host Isolation for Mimikatz / Encryptor threats with host entities', () => {
    const ransomwareIncident: UnifiedIncident = {
      id: 'inc-crit-ransom',
      title: 'Ransomware precursor detected: Mimikatz credential dumping and shadow copy tampering',
      description: 'vssadmin.exe delete shadows executed by compromised host with Cobalt Strike beacon',
      provider: 'DEFENDER_XDR',
      severity: 'CRITICAL',
      status: 'ACTIVE',
      createdTime: new Date().toISOString(),
      lastUpdatedTime: new Date().toISOString(),
      entities: [
        { id: 'e1', name: 'Host', type: 'HOST', value: 'WIN-DC-PROD-01' },
        { id: 'e2', name: 'User', type: 'USER', value: 'svc-admin' }
      ],
      mitreTechniques: [
        { tactic: 'Credential Access', techniqueId: 'T1003.001', techniqueName: 'LSASS Memory' },
        { tactic: 'Impact', techniqueId: 'T1486', techniqueName: 'Data Encrypted for Impact' }
      ],
      alerts: [],
      rawPayload: { commandLine: 'vssadmin.exe delete shadows /all /quiet' }
    };

    const rec = recommendPlaybook(ransomwareIncident);
    assert.ok(rec !== null);
    assert.strictEqual(rec.playbook.id, 'ransomware-host-isolation');
    assert.strictEqual(rec.confidence, 'HIGH');
    assert.strictEqual(rec.suggestedTarget?.type, 'HOST');
    assert.strictEqual(rec.suggestedTarget?.value, 'WIN-DC-PROD-01');
    assert.ok(rec.rationale.includes('T1486'));
  });

  it('should recommend Compromised Identity Rapid Lockdown for risky sign-ins and token theft', () => {
    const identityIncident: UnifiedIncident = {
      id: 'inc-high-identity',
      title: 'Impossible travel sign-in from unfamiliar location with Primary Refresh Token abuse',
      description: 'User sign-in from Lagos, Nigeria followed 5 minutes later by access from Tokyo, Japan',
      provider: 'SENTINEL_SIEM',
      severity: 'HIGH',
      status: 'ACTIVE',
      createdTime: new Date().toISOString(),
      lastUpdatedTime: new Date().toISOString(),
      entities: [
        { id: 'e1', name: 'User', type: 'USER', value: 'alice.johnson@company.com' }
      ],
      mitreTechniques: [
        { tactic: 'Credential Access', techniqueId: 'T1078.004', techniqueName: 'Cloud Accounts' }
      ],
      alerts: [],
      rawPayload: {}
    };

    const rec = recommendPlaybook(identityIncident);
    assert.ok(rec !== null);
    assert.strictEqual(rec.playbook.id, 'compromised-identity');
    assert.strictEqual(rec.suggestedTarget?.type, 'USER');
    assert.strictEqual(rec.suggestedTarget?.value, 'alice.johnson@company.com');
    assert.ok(rec.rationale.includes('T1078'));
  });

  it('should recommend Data Exfiltration Blockade for illicit consent grants and anomalous egress', () => {
    const exfilIncident: UnifiedIncident = {
      id: 'inc-high-exfil',
      title: 'Illicit OAuth application consent grant followed by mass file export',
      description: 'Suspicious third-party application granted Mail.ReadWrite and large egress data transfer initiated',
      provider: 'DEFENDER_XDR',
      severity: 'HIGH',
      status: 'ACTIVE',
      createdTime: new Date().toISOString(),
      lastUpdatedTime: new Date().toISOString(),
      entities: [
        { id: 'e1', name: 'IP', type: 'IP', value: '185.220.101.5' },
        { id: 'e2', name: 'User', type: 'USER', value: 'finance-lead@company.com' }
      ],
      mitreTechniques: [
        { tactic: 'Exfiltration', techniqueId: 'T1567', techniqueName: 'Exfiltration Over Web Service' }
      ],
      alerts: [],
      rawPayload: {}
    };

    const rec = recommendPlaybook(exfilIncident);
    assert.ok(rec !== null);
    assert.strictEqual(rec.playbook.id, 'data-exfiltration-blockade');
    assert.strictEqual(rec.suggestedTarget?.value, '185.220.101.5');
    assert.ok(rec.rationale.includes('T1567'));
  });

});
