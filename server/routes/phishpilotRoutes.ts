import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { ReportGeneratorService } from '../services/phishpilot/reportGenerator.js';
import { PhishPilotStore } from '../services/phishpilot/phishpilotStore.js';
import { MailboxPollerService } from '../services/phishpilot/mailboxPoller.js';
import { RemediationService } from '../services/phishpilot/remediationService.js';
import { ThreatCorrelationService } from '../services/phishpilot/correlationService.js';
import { ExportService } from '../services/phishpilot/exportService.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.post('/analyze', async (req, res, next) => {
  try {
    const { rawEmail, emailBody, emailHeaders } = req.body;
    let content = rawEmail;
    if (!content && emailBody) {
      content = emailHeaders ? `${emailHeaders}\n\n${emailBody}` : emailBody;
    }
    if (!content) {
      res.status(400).json({ error: 'Missing email content to analyze' });
      return;
    }
    const report = await ReportGeneratorService.generateReport(content);
    res.json(report);
  } catch (e) {
    next(e);
  }
});

router.post('/analyze/file', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    const report = await ReportGeneratorService.generateReport(req.file.buffer);
    res.json(report);
  } catch (e) {
    next(e);
  }
});

router.get('/samples/:type', async (req, res, next) => {
  try {
    const type = req.params.type;
    const filename = type === 'legitimate' ? 'sample_legitimate.eml' : 'sample_phishing.eml';
    const filePath = path.join(process.cwd(), 'samples', filename);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      res.setHeader('Content-Type', 'text/plain');
      res.send(content);
    } else {
      res.status(404).json({ error: 'Sample file not found' });
    }
  } catch (e) {
    next(e);
  }
});

router.post('/samples/:type/analyze', async (req, res, next) => {
  try {
    const type = req.params.type;
    const filename = type === 'legitimate' ? 'sample_legitimate.eml' : 'sample_phishing.eml';
    const filePath = path.join(process.cwd(), 'samples', filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Sample file not found' });
      return;
    }
    const buffer = fs.readFileSync(filePath);
    const report = await ReportGeneratorService.generateReport(buffer);
    res.json(report);
  } catch (e) {
    next(e);
  }
});

router.get('/reports', async (req, res, next) => {
  try {
    const verdict = req.query.verdict as string;
    const reports = await PhishPilotStore.getAll({ verdict });
    res.json(reports);
  } catch (e) {
    next(e);
  }
});

router.get('/reports/:id', async (req, res, next) => {
  try {
    const report = await PhishPilotStore.getById(req.params.id);
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    res.json(report);
  } catch (e) {
    next(e);
  }
});

router.post('/reports/:id/purge', async (req, res, next) => {
  try {
    const operator = req.body?.operator || 'SOC Analyst';
    const log = await RemediationService.purgeTenantMailboxes(req.params.id, operator);
    const updated = await PhishPilotStore.getById(req.params.id);
    res.json({ success: true, log, report: updated });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/reports/:id/block-sender', async (req, res, next) => {
  try {
    const operator = req.body?.operator || 'SOC Analyst';
    const targetType = req.body?.targetType === 'domain' ? 'domain' : 'sender';
    const log = await RemediationService.blockSenderOrDomain(req.params.id, targetType, operator);
    const updated = await PhishPilotStore.getById(req.params.id);
    res.json({ success: true, log, report: updated });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/reports/:id/revoke-sessions', async (req, res, next) => {
  try {
    const operator = req.body?.operator || 'SOC Analyst';
    const log = await RemediationService.revokeUserSessions(req.params.id, operator);
    const updated = await PhishPilotStore.getById(req.params.id);
    res.json({ success: true, log, report: updated });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/reports/:id/escalate', async (req, res, next) => {
  try {
    const report = await PhishPilotStore.getById(req.params.id);
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    const incident = ThreatCorrelationService.escalateToIncident(report);
    res.json({ success: true, incident });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/reports/:id/export', async (req, res, next) => {
  try {
    const report = await PhishPilotStore.getById(req.params.id);
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    const format = (req.query.format as string)?.toLowerCase();
    if (format === 'stix') {
      const bundle = ExportService.generateStixBundle(report);
      res.setHeader('Content-Disposition', `attachment; filename="phishpilot-${report.id.slice(0, 8)}-stix2.1.json"`);
      res.setHeader('Content-Type', 'application/json');
      res.json(bundle);
    } else {
      const jsonReport = ExportService.generateJsonReport(report);
      res.setHeader('Content-Disposition', `attachment; filename="phishpilot-${report.id.slice(0, 8)}.json"`);
      res.setHeader('Content-Type', 'application/json');
      res.json(jsonReport);
    }
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/reports/bulk-delete', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (Array.isArray(ids)) {
      await PhishPilotStore.bulkDelete(ids);
    }
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

router.delete('/reports/:id', async (req, res, next) => {
  try {
    await PhishPilotStore.delete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

router.delete('/reports', async (req, res, next) => {
  try {
    await PhishPilotStore.clear();
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const stats = await PhishPilotStore.getStats();
    res.json(stats);
  } catch (e) {
    next(e);
  }
});

// Mailbox Poller API
router.get('/mailbox/status', (req, res) => {
  const config = MailboxPollerService.getConfig();
  res.json(config);
});

router.post('/mailbox/config', async (req, res, next) => {
  try {
    const config = await MailboxPollerService.updateConfig(req.body);
    res.json(config);
  } catch (e) {
    next(e);
  }
});

router.post('/mailbox/sync', async (req, res, next) => {
  try {
    const result = await MailboxPollerService.syncMailbox();
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export default router;
