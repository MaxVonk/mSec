import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import multer from 'multer';
import { parse as parseCsv } from 'csv-parse/sync';
import { store } from './services/store';
import { DataNormalizer } from './services/normalizer';
import { ThreatOversightService } from './services/threatOversightService';
import { GraphConnector } from './services/graphConnector';
import { SentinelConnector } from './services/sentinelConnector';
import phishpilotRoutes from './routes/phishpilotRoutes';
import { MailboxPollerService } from './services/phishpilot/mailboxPoller';
import { IngestionSchedulerService } from './services/ingestionScheduler';
import { SyncLogService } from './services/syncLogService';
import { WebhookNotifierService } from './services/webhookNotifier';
import { ThreatIntelService } from './services/threatIntelService';
import { SocReportService } from './services/socReportService';
import { ConfigService } from './services/configService';

import authRoutes, { userRouter } from './routes/authRoutes';

SyncLogService.init().catch(err => console.error('[SyncLog] Init error:', err));
MailboxPollerService.init().catch(err => console.error('[MailboxPoller] Init error:', err));
IngestionSchedulerService.init().catch(err => console.error('[Scheduler] Init error:', err));
WebhookNotifierService.init().catch(err => console.error('[WebhookNotifier] Init error:', err));
ThreatIntelService.init().catch(err => console.error('[ThreatIntel] Init error:', err));

const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 3310;

// Upload handler (memory storage)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Authentication routes (Microsoft Entra SSO & Local Auth)
app.use('/api/auth', authRoutes);

// User management routes
app.use('/api/users', userRouter);

// PhishPilot email threat analysis routes
app.use('/api/phishpilot', phishpilotRoutes);

export const isDemoMode = (): boolean => ConfigService.isDemoMode();

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// System configuration
app.get('/api/config', (req, res) => {
  res.json(ConfigService.getSystemConfig());
});

// Stats
app.get('/api/stats', (req, res) => {
  const stats = store.getStats();
  res.json({
    ...stats,
    demoMode: ConfigService.isDemoMode()
  });
});

// Entities list
app.get('/api/entities', (req, res) => {
  const entities = store.getEntities();
  res.json(entities);
});

// Analytics & Trend metrics
app.get('/api/analytics/trends', (req, res) => {
  const trends = store.getAnalyticsTrends();
  res.json(trends);
});

// Incidents list with filtering
app.get('/api/incidents', (req, res) => {
  const { severity, provider, status, search } = req.query;
  const incidents = store.getAll({
    severity: severity as string,
    provider: provider as string,
    status: status as string,
    search: search as string,
  });
  res.json(incidents);
});

// Single incident
app.get('/api/incidents/:id', (req, res) => {
  const incident = store.getById(req.params.id);
  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }
  res.json(incident);
});

// Update status
app.patch('/api/incidents/:id/status', (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }
  const updated = store.updateIncidentStatus(req.params.id, status);
  if (!updated) {
    return res.status(404).json({ error: 'Incident not found' });
  }
  res.json(updated);
});

// Execute containment action
app.post('/api/incidents/:id/actions/:actionId/execute', (req, res) => {
  const success = store.executeContainmentAction(req.params.id, req.params.actionId);
  if (!success) {
    return res.status(400).json({ error: 'Action execution failed or action not found' });
  }
  const updated = store.getById(req.params.id);
  res.json({ success: true, incident: updated });
});

// Delete a single incident
app.delete('/api/incidents/:id', (req, res) => {
  const deleted = store.delete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Incident not found' });
  }
  res.json({ success: true, message: `Incident ${req.params.id} deleted` });
});

// Bulk delete incidents
app.post('/api/incidents/bulk-delete', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Provide an array of incident ids' });
  }
  let deletedCount = 0;
  for (const id of ids) {
    if (store.delete(id)) deletedCount++;
  }
  res.json({ success: true, deletedCount, requestedCount: ids.length });
});

// Clear all incidents
app.delete('/api/incidents', (req, res) => {
  store.clear();
  res.json({ success: true, message: 'All incidents cleared' });
});

// Direct JSON ingestion
app.post('/api/import/json', (req, res) => {
  try {
    const rawData = req.body;
    if (!rawData) {
      return res.status(400).json({ error: 'No data provided' });
    }

    const normalized = DataNormalizer.parseUniversal(rawData);
    normalized.forEach(inc => {
      inc.threatAssessment = ThreatOversightService.analyzeIncident(inc);
    });

    store.batchAddOrUpdate(normalized);
    res.json({ success: true, count: normalized.length, incidents: normalized });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to parse JSON payload' });
  }
});

// File upload ingestion (JSON or CSV)
app.post('/api/import/file', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filename = req.file.originalname.toLowerCase();
    const contentStr = req.file.buffer.toString('utf-8');

    let parsedData: any = null;

    if (filename.endsWith('.json')) {
      parsedData = JSON.parse(contentStr);
    } else if (filename.endsWith('.csv')) {
      parsedData = parseCsv(contentStr, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
    } else {
      return res.status(400).json({ error: 'Unsupported file format. Please upload .json or .csv files.' });
    }

    const normalized = DataNormalizer.parseUniversal(parsedData);
    normalized.forEach(inc => {
      inc.threatAssessment = ThreatOversightService.analyzeIncident(inc);
    });

    store.batchAddOrUpdate(normalized);
    res.json({ success: true, count: normalized.length, filename: req.file.originalname });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to process uploaded file' });
  }
});

// Connector configurations
app.get('/api/connectors', (req, res) => {
  res.json(store.getConfig());
});

app.post('/api/connectors', (req, res) => {
  try {
    const current = store.getConfig();
    const updated = {
      graph: { ...current.graph, ...req.body?.graph },
      sentinel: { ...current.sentinel, ...req.body?.sentinel },
    };
    store.updateConfig(updated);
    res.json({ success: true, config: store.getConfig() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Test Graph Connection
app.post('/api/connectors/graph/test', async (req, res) => {
  const stored = store.getConfig().graph;
  const config = {
    tenantId: req.body?.tenantId || stored.tenantId,
    clientId: req.body?.clientId || stored.clientId,
    clientSecret: req.body?.clientSecret || stored.clientSecret,
  };
  const result = await GraphConnector.testConnection(config as any);
  if (result.success && req.body?.clientId) {
    store.updateConfig({
      graph: {
        ...stored,
        ...config,
        enabled: true,
        status: 'CONNECTED'
      }
    });
  }
  res.json(result);
});

// Sync Graph Incidents
app.post('/api/connectors/graph/sync', async (req, res) => {
  try {
    const stored = store.getConfig().graph;
    const config = {
      tenantId: req.body?.tenantId || stored.tenantId,
      clientId: req.body?.clientId || stored.clientId,
      clientSecret: req.body?.clientSecret || stored.clientSecret,
    };
    if (req.body?.clientId) {
      store.updateConfig({
        graph: {
          ...stored,
          ...config,
          enabled: true
        }
      });
    }
    const result = await GraphConnector.sync(config as any);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Test Sentinel Connection
app.post('/api/connectors/sentinel/test', async (req, res) => {
  const stored = store.getConfig().sentinel;
  const config = {
    tenantId: req.body?.tenantId || stored.tenantId,
    clientId: req.body?.clientId || stored.clientId,
    clientSecret: req.body?.clientSecret || stored.clientSecret,
    subscriptionId: req.body?.subscriptionId || stored.subscriptionId,
    resourceGroup: req.body?.resourceGroup || stored.resourceGroup,
    workspaceName: req.body?.workspaceName || stored.workspaceName,
  };
  const result = await SentinelConnector.testConnection(config as any);
  if (result.success && (req.body?.subscriptionId || req.body?.workspaceName)) {
    store.updateConfig({
      sentinel: {
        ...stored,
        ...config,
        enabled: true,
        status: 'CONNECTED'
      }
    });
  }
  res.json(result);
});

// Sync Sentinel Incidents
app.post('/api/connectors/sentinel/sync', async (req, res) => {
  try {
    const stored = store.getConfig().sentinel;
    const config = {
      tenantId: req.body?.tenantId || stored.tenantId,
      clientId: req.body?.clientId || stored.clientId,
      clientSecret: req.body?.clientSecret || stored.clientSecret,
      subscriptionId: req.body?.subscriptionId || stored.subscriptionId,
      resourceGroup: req.body?.resourceGroup || stored.resourceGroup,
      workspaceName: req.body?.workspaceName || stored.workspaceName,
    };
    if (req.body?.subscriptionId || req.body?.workspaceName) {
      store.updateConfig({
        sentinel: {
          ...stored,
          ...config,
          enabled: true
        }
      });
    }
    const result = await SentinelConnector.sync(config as any);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reset to demo data
app.post('/api/demo/reset', (req, res) => {
  if (!isDemoMode()) {
    return res.status(403).json({ error: 'Demo mode is disabled in production environment.' });
  }
  store.resetToDemo();
  res.json({ success: true, message: 'Demo incidents reset successfully' });
});

// Clear all incidents
app.post('/api/demo/clear', (req, res) => {
  if (!isDemoMode()) {
    return res.status(403).json({ error: 'Demo mode is disabled in production environment.' });
  }
  store.clear();
  res.json({ success: true, message: 'All incidents cleared' });
});

// Ingestion Scheduler API
app.get('/api/scheduler/config', (req, res) => {
  res.json(IngestionSchedulerService.getConfig());
});

app.patch('/api/scheduler/config', async (req, res) => {
  try {
    const updated = await IngestionSchedulerService.updateConfig(req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/scheduler/sync/sentinel', async (req, res) => {
  const result = await IngestionSchedulerService.syncSentinel();
  res.json(result);
});

app.post('/api/scheduler/sync/graph', async (req, res) => {
  const result = await IngestionSchedulerService.syncGraph();
  res.json(result);
});

// Synchronization Audit Logs & Unified Sync
app.get('/api/sync/logs', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const source = req.query.source as string;
  const status = req.query.status as string;
  const trigger = req.query.trigger as string;
  const logs = SyncLogService.getLogs(limit, { source, status, trigger });
  const stats = SyncLogService.getStats();
  res.json({ logs, stats });
});

app.post('/api/sync/all', async (req, res) => {
  try {
    const result = await IngestionSchedulerService.syncAll('MANUAL');
    const stats = SyncLogService.getStats();
    res.json({ success: true, ...result, stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sync/clear', async (req, res) => {
  await SyncLogService.clearLogs();
  res.json({ success: true, message: 'Synchronization logs cleared' });
});

app.delete('/api/sync/logs', async (req, res) => {
  await SyncLogService.clearLogs();
  res.json({ success: true, message: 'Synchronization logs cleared' });
});

// Webhook Notifications API
app.get('/api/webhooks/config', (req, res) => {
  res.json(WebhookNotifierService.getConfig());
});

app.patch('/api/webhooks/config', async (req, res) => {
  try {
    const updated = await WebhookNotifierService.updateConfig(req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/webhooks/test', async (req, res) => {
  const target = req.body?.target || 'teams';
  const url = req.body?.url;
  const result = await WebhookNotifierService.testWebhook(target, url);
  res.json(result);
});

// Threat Intelligence API
app.get('/api/threat-intel/lookup', async (req, res) => {
  const indicator = req.query.indicator as string;
  const type = req.query.type as string;
  if (!indicator) {
    return res.status(400).json({ error: 'Indicator parameter is required.' });
  }
  const result = await ThreatIntelService.lookup(indicator, type);
  res.json(result);
});

app.post('/api/threat-intel/batch', async (req, res) => {
  const indicators = req.body?.indicators;
  if (!Array.isArray(indicators)) {
    return res.status(400).json({ error: 'Provide indicators array.' });
  }
  const results = await ThreatIntelService.lookupBatch(indicators);
  res.json(results);
});

// Shift Handover & Forensic Reports API
app.get('/api/reports/shift-handover', (req, res) => {
  const hours = Number(req.query.hours) || 12;
  const analyst = req.query.analyst as string;
  const notes = req.query.notes as string;
  const result = SocReportService.generateShiftHandover(hours, analyst, notes);
  res.json(result);
});

app.get('/api/reports/incident/:id/markdown', (req, res) => {
  const incident = store.getById(req.params.id);
  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }
  const md = SocReportService.generateIncidentMarkdown(incident);
  res.type('text/markdown').send(md);
});

// Dynamic manifest generator for Office Outlook Add-in
app.get(['/outlook/manifest.xml', '/api/phishpilot/manifest.xml'], (req, res) => {
  let baseUrl = process.env.APP_URL || (req.query.baseUrl as string);
  if (!baseUrl) {
    const host = (req.query.host as string) || req.headers['x-forwarded-host'] || req.headers.host || 'security.example.com';
    const protocol = 'https'; // Microsoft Centralized Deployment strictly mandates HTTPS
    baseUrl = `${protocol}://${host}`;
  }
  // Trim trailing slash
  baseUrl = baseUrl.replace(/\/+$/, '');

  const manifestPath = path.resolve(process.cwd(), 'public/outlook/manifest.xml');
  if (!fs.existsSync(manifestPath)) {
    return res.status(404).send('manifest.xml not found');
  }
  let content = fs.readFileSync(manifestPath, 'utf-8');
  // Dynamically replace default/placeholder domains with active deployment URL
  content = content.replace(/https:\/\/(security\.example\.com|localhost:3310|127\.0\.0\.1:3310)/g, baseUrl);

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="phishpilot-outlook-manifest.xml"');
  res.send(content);
});

// Configure framing headers specifically for Outlook Add-in taskpanes
app.use('/outlook', (req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://*.office.com https://*.office365.com https://*.outlook.com https://*.live.com https://outlook.office.com;");
  next();
});

// Serve public directory for static assets (icons, manifest, taskpane)
const publicPath = path.resolve(process.cwd(), 'public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
}

// Serve frontend build in production
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // Express 5 compatible SPA routing fallback
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/outlook')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

app.listen(port, () => {
  console.log(`[mSec Engine] Server listening on http://localhost:${port}`);
});

