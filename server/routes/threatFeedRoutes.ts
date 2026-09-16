import { Router, Request, Response } from 'express';
import { ThreatFeedService } from '../services/threatFeedService';

const router = Router();

// GET /api/threat-feeds/sources - List all configured feeds
router.get('/sources', (req: Request, res: Response) => {
  try {
    const sources = ThreatFeedService.getSources();
    res.json(sources);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve feed sources' });
  }
});

// POST /api/threat-feeds/sources - Add a new feed source
router.post('/sources', async (req: Request, res: Response) => {
  try {
    const { name, url, category } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Feed URL is required' });
    }
    const newSource = await ThreatFeedService.addSource({ name, url, category });
    res.status(201).json(newSource);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to add feed source' });
  }
});

// PATCH /api/threat-feeds/sources/:id - Update or toggle feed source
router.patch('/sources/:id', (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updated = ThreatFeedService.updateSource(id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update feed source' });
  }
});

// DELETE /api/threat-feeds/sources/:id - Delete a custom feed source
router.delete('/sources/:id', (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const deleted = ThreatFeedService.deleteSource(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Feed source not found' });
    }
    res.json({ success: true, message: `Feed ${id} deleted` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete feed source' });
  }
});

// GET /api/threat-feeds/items - List cached threat feed articles with filtering
router.get('/items', (req: Request, res: Response) => {
  try {
    const { feedId, search, category, severity, hasCves, limit, offset } = req.query;
    const result = ThreatFeedService.getItems({
      feedId: feedId as string,
      search: search as string,
      category: category as string,
      severity: severity as string,
      hasCves: hasCves === 'true',
      limit: limit ? parseInt(limit as string, 10) : 100,
      offset: offset ? parseInt(offset as string, 10) : 0
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to load feed items' });
  }
});

// POST /api/threat-feeds/refresh - Manually refresh all enabled feeds
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const result = await ThreatFeedService.refreshFeeds();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to refresh feeds' });
  }
});

// POST /api/threat-feeds/preview - Test a feed URL before saving
router.post('/preview', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Feed URL is required for preview' });
    }
    const preview = await ThreatFeedService.previewFeed(url);
    res.json(preview);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to preview feed URL' });
  }
});

export default router;
