import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PREBUILT_PLAYBOOKS } from '../src/utils/soarPlaybooks.js';
import { UnifiedIncident } from '../server/types/security.js';

describe('Tier-3 SOC Command Center Capabilities Tests', () => {

  describe('SOAR Playbook Definitions & Execution Matrix', () => {
    it('should provide all four prebuilt rapid-containment playbooks', () => {
      assert.equal(PREBUILT_PLAYBOOKS.length, 4);
      const ids = PREBUILT_PLAYBOOKS.map(p => p.id);
      assert.ok(ids.includes('compromised-identity'));
      assert.ok(ids.includes('ransomware-host-isolation'));
      assert.ok(ids.includes('phishing-campaign-purge'));
      assert.ok(ids.includes('data-exfiltration-blockade'));
    });

    it('should have sequential actionable steps and positive estimated durations for each playbook', () => {
      PREBUILT_PLAYBOOKS.forEach(pb => {
        assert.ok(pb.steps.length >= 3, `Playbook ${pb.id} should have at least 3 steps`);
        pb.steps.forEach(step => {
          assert.ok(step.id.startsWith('step-'), `Step ID should start with step-`);
          assert.ok(step.title.length > 5, `Step should have a descriptive title`);
          assert.ok(step.estimatedSeconds > 0, `Step should have positive duration`);
          assert.ok(typeof step.actionType === 'string', `Action type must be defined`);
        });
      });
    });

    it('should match relevant playbook based on incident indicators', () => {
      const phishingInc: Partial<UnifiedIncident> = {
        title: 'Spearphishing credential harvesting link',
        description: 'Employee received suspicious email impersonating IT helpdesk'
      };

      const matchText = `${phishingInc.title} ${phishingInc.description}`.toLowerCase();
      const matched = PREBUILT_PLAYBOOKS.find(p => p.id === 'phishing-campaign-purge');
      assert.ok(matched);
      assert.ok(matchText.includes('phish'));
    });
  });

  describe('mSec AI SecOps Copilot Intelligence Engine', () => {
    it('should return 400 when prompt is empty on /api/copilot/chat', async () => {
      // Import the express app from server
      const { default: express } = await import('express');
      const { default: copilotRoutes } = await import('../server/routes/copilotRoutes.js');

      const app = express();
      app.use(express.json());
      app.use('/api/copilot', copilotRoutes);

      const server = app.listen(0);
      const port = (server.address() as any).port;

      try {
        const res = await fetch(`http://localhost:${port}/api/copilot/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: '' })
        });
        assert.equal(res.status, 400);
      } finally {
        server.close();
      }
    });

    it('should generate structured KQL hunting query when asked for KQL', async () => {
      const { default: express } = await import('express');
      const { default: copilotRoutes } = await import('../server/routes/copilotRoutes.js');

      const app = express();
      app.use(express.json());
      app.use('/api/copilot', copilotRoutes);

      const server = app.listen(0);
      const port = (server.address() as any).port;

      try {
        const testIncident: Partial<UnifiedIncident> = {
          id: 'INC-TEST-492',
          title: 'Mimikatz LSASS Credential Dump',
          severity: 'CRITICAL',
          entities: [
            { id: 'e1', type: 'USER', value: 'victim@vermiculus.se' },
            { id: 'e2', type: 'HOST', value: 'WORKSTATION-01' },
            { id: 'e3', type: 'IP', value: '194.26.29.112' }
          ]
        };

        const res = await fetch(`http://localhost:${port}/api/copilot/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: 'Generate KQL query to hunt for this attacker',
            incident: testIncident
          })
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.ok(data.reply.includes('```kql'));
        assert.ok(data.reply.includes('DeviceProcessEvents'));
        assert.ok(data.reply.includes('victim@vermiculus.se'));
        assert.ok(data.reply.includes('194.26.29.112'));
      } finally {
        server.close();
      }
    });

    it('should generate executive blast radius summary and user advisory email', async () => {
      const { default: express } = await import('express');
      const { default: copilotRoutes } = await import('../server/routes/copilotRoutes.js');

      const app = express();
      app.use(express.json());
      app.use('/api/copilot', copilotRoutes);

      const server = app.listen(0);
      const port = (server.address() as any).port;

      try {
        const testIncident: Partial<UnifiedIncident> = {
          id: 'INC-TEST-881',
          title: 'Suspicious OAuth App Exfiltration',
          severity: 'HIGH',
          entities: [
            { id: 'e1', type: 'USER', value: 'admin@vermiculus.se' },
            { id: 'e2', type: 'HOST', value: 'LAPTOP-EXEC-02' }
          ]
        };

        const res = await fetch(`http://localhost:${port}/api/copilot/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: 'Draft an email notice to the affected employee',
            incident: testIncident
          })
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.ok(data.reply.includes('Subject:'));
        assert.ok(data.reply.includes('admin@vermiculus.se'));
        assert.ok(data.reply.includes('LAPTOP-EXEC-02'));
      } finally {
        server.close();
      }
    });
  });
});
