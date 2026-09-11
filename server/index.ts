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

import authRoutes from './routes/authRoutes';

MailboxPollerService.init().catch(err => console.error('[MailboxPoller] Init error:', err));

const app = express();
const port = process.env.PORT || 3310;

// Upload handler (memory storage)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Authentication routes (Microsoft Entra SSO)
app.use('/api/auth', authRoutes);

// PhishPilot email threat analysis routes
app.use('/api/phishpilot', phishpilotRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Stats
app.get('/api/stats', (req, res) => {
  const stats = store.getStats();
  res.json(stats);
});

// Entities list
app.get('/api/entities', (req, res) => {
  const entities = store.getEntities();
  res.json(entities);
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

// Test Graph Connection
app.post('/api/connectors/graph/test', async (req, res) => {
  const stored = store.getConfig().graph;
  const config = {
    tenantId: req.body?.tenantId || stored.tenantId,
    clientId: req.body?.clientId || stored.clientId,
    clientSecret: req.body?.clientSecret || stored.clientSecret,
  };
  const result = await GraphConnector.testConnection(config as any);
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
    const result = await SentinelConnector.sync(config as any);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reset to demo data
app.post('/api/demo/reset', (req, res) => {
  store.resetToDemo();
  res.json({ success: true, message: 'Demo incidents reset successfully' });
});

// Clear all incidents
app.post('/api/demo/clear', (req, res) => {
  store.clear();
  res.json({ success: true, message: 'All incidents cleared' });
});

// Serve frontend build in production
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // Express 5 compatible SPA routing fallback
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

app.listen(port, () => {
  console.log(`[mSec Engine] Server listening on http://localhost:${port}`);
});

