import fs from 'fs';
import path from 'path';
import { ThreatFeedSource, ThreatFeedItem } from '../types/security';

const DATA_DIR = path.join(process.cwd(), '.msec_data');
const FEEDS_FILE = path.join(DATA_DIR, 'threat_feeds.json');

export const DEFAULT_FEED_SOURCES: ThreatFeedSource[] = [
  {
    id: 'cert-se',
    name: 'CERT-SE Nyheter & Sårbarheter',
    url: 'https://www.cert.se/feed.rss',
    category: 'National CSIRT (Sweden)',
    enabled: true,
    isCustom: false,
    itemCount: 0
  },
  {
    id: 'cisa-alerts',
    name: 'CISA Cybersecurity Advisories',
    url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml',
    category: 'National CSIRT (US)',
    enabled: true,
    isCustom: false,
    itemCount: 0
  },
  {
    id: 'ncsc-uk',
    name: 'NCSC-UK Security Advisories',
    url: 'https://www.ncsc.gov.uk/api/1/services/v1/report-rss-feed.xml',
    category: 'National CSIRT (UK)',
    enabled: true,
    isCustom: false,
    itemCount: 0
  },
  {
    id: 'ms-security',
    name: 'Microsoft Security Blog',
    url: 'https://www.microsoft.com/en-us/security/blog/feed/',
    category: 'Vendor Intelligence',
    enabled: true,
    isCustom: false,
    itemCount: 0
  }
];

export class ThreatFeedService {
  private static sources: ThreatFeedSource[] = [];
  private static cachedItems: ThreatFeedItem[] = [];
  private static isRefreshing = false;
  private static refreshTimer: NodeJS.Timeout | null = null;

  public static async init(): Promise<void> {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(FEEDS_FILE)) {
        const raw = fs.readFileSync(FEEDS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.sources = parsed;
        } else {
          this.sources = [...DEFAULT_FEED_SOURCES];
          this.saveSources();
        }
      } else {
        this.sources = [...DEFAULT_FEED_SOURCES];
        this.saveSources();
      }

      // Initial non-blocking fetch in background
      this.refreshFeeds().catch(err => {
        console.warn('[ThreatFeed] Initial feed sync warning:', err.message);
      });

      // Background periodic poller every 60 minutes
      if (!this.refreshTimer) {
        this.refreshTimer = setInterval(() => {
          this.refreshFeeds().catch(err => console.error('[ThreatFeed] Periodic poll error:', err));
        }, 60 * 60 * 1000);
      }
    } catch (err) {
      console.error('[ThreatFeed] Init error:', err);
      this.sources = [...DEFAULT_FEED_SOURCES];
    }
  }

  private static saveSources(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(FEEDS_FILE, JSON.stringify(this.sources, null, 2), 'utf-8');
    } catch (err) {
      console.error('[ThreatFeed] Failed to save sources:', err);
    }
  }

  public static getSources(): ThreatFeedSource[] {
    return this.sources;
  }

  public static async addSource(data: { name: string; url: string; category?: string }): Promise<ThreatFeedSource> {
    const trimmedUrl = data.url?.trim();
    if (!trimmedUrl) throw new Error('Feed URL is required.');
    if (!/^https?:\/\//i.test(trimmedUrl)) throw new Error('Feed URL must begin with http:// or https://');

    // Test feed first
    const preview = await this.parseFeedFromUrl(trimmedUrl, 'custom-test');
    if (preview.items.length === 0 && !preview.title) {
      throw new Error('Unable to parse any RSS or Atom entries from provided URL.');
    }

    const id = `feed-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const newSource: ThreatFeedSource = {
      id,
      name: data.name?.trim() || preview.title || 'Custom Threat Feed',
      url: trimmedUrl,
      category: data.category?.trim() || 'Custom Feeds',
      enabled: true,
      isCustom: true,
      lastFetched: new Date().toISOString(),
      lastStatus: 'OK',
      itemCount: preview.items.length
    };

    this.sources.push(newSource);
    this.saveSources();

    // Cache the newly fetched items
    const taggedItems = preview.items.map(item => ({
      ...item,
      feedId: id,
      feedName: newSource.name
    }));
    this.cachedItems.unshift(...taggedItems);
    this.deduplicateAndSortCache();

    return newSource;
  }

  public static updateSource(id: string, patch: Partial<ThreatFeedSource>): ThreatFeedSource {
    const idx = this.sources.findIndex(s => s.id === id);
    if (idx === -1) throw new Error(`Feed source with id "${id}" not found.`);

    this.sources[idx] = {
      ...this.sources[idx],
      ...patch,
      id // preserve ID
    };

    this.saveSources();

    // If disabled, remove its items from cache
    if (patch.enabled === false) {
      this.cachedItems = this.cachedItems.filter(item => item.feedId !== id);
    }

    return this.sources[idx];
  }

  public static deleteSource(id: string): boolean {
    const initialLen = this.sources.length;
    this.sources = this.sources.filter(s => s.id !== id);
    if (this.sources.length < initialLen) {
      this.cachedItems = this.cachedItems.filter(item => item.feedId !== id);
      this.saveSources();
      return true;
    }
    return false;
  }

  public static async previewFeed(url: string): Promise<{ title: string; description: string; sampleItems: ThreatFeedItem[] }> {
    const trimmed = url?.trim();
    if (!trimmed) throw new Error('URL is required.');
    const parsed = await this.parseFeedFromUrl(trimmed, 'preview');
    return {
      title: parsed.title,
      description: parsed.description,
      sampleItems: parsed.items.slice(0, 5)
    };
  }

  public static async refreshFeeds(): Promise<{ successCount: number; errorCount: number; totalItems: number }> {
    if (this.isRefreshing) {
      return { successCount: 0, errorCount: 0, totalItems: this.cachedItems.length };
    }

    this.isRefreshing = true;
    let successCount = 0;
    let errorCount = 0;
    const newItems: ThreatFeedItem[] = [];

    try {
      const enabledSources = this.sources.filter(s => s.enabled);
      await Promise.allSettled(
        enabledSources.map(async (source) => {
          try {
            const parsed = await this.parseFeedFromUrl(source.url, source.id, source.name);
            source.lastFetched = new Date().toISOString();
            source.lastStatus = 'OK';
            source.lastError = undefined;
            source.itemCount = parsed.items.length;
            newItems.push(...parsed.items);
            successCount++;
          } catch (err: any) {
            source.lastFetched = new Date().toISOString();
            source.lastStatus = 'ERROR';
            source.lastError = err.message || 'Failed to fetch or parse feed';
            errorCount++;
          }
        })
      );

      this.cachedItems = newItems;
      this.deduplicateAndSortCache();
      this.saveSources();
    } finally {
      this.isRefreshing = false;
    }

    return {
      successCount,
      errorCount,
      totalItems: this.cachedItems.length
    };
  }

  public static getItems(options?: {
    feedId?: string;
    search?: string;
    category?: string;
    hasCves?: boolean;
    severity?: string;
    limit?: number;
    offset?: number;
  }): {
    items: ThreatFeedItem[];
    total: number;
    activeFeedsCount: number;
    cveCount: number;
  } {
    let list = [...this.cachedItems];

    if (options?.feedId && options.feedId !== 'ALL') {
      list = list.filter(item => item.feedId === options.feedId);
    }

    if (options?.category && options.category !== 'ALL') {
      const catLower = options.category.toLowerCase();
      const source = this.sources.find(s => s.category.toLowerCase() === catLower);
      if (source) {
        list = list.filter(item => item.feedId === source.id);
      }
    }

    if (options?.hasCves) {
      list = list.filter(item => item.cves && item.cves.length > 0);
    }

    if (options?.severity && options.severity !== 'ALL') {
      list = list.filter(item => item.severity === options.severity);
    }

    if (options?.search) {
      const q = options.search.toLowerCase().trim();
      list = list.filter(item => 
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.feedName.toLowerCase().includes(q) ||
        (item.cves && item.cves.some(c => c.toLowerCase().includes(q))) ||
        (item.categories && item.categories.some(c => c.toLowerCase().includes(q)))
      );
    }

    const total = list.length;
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    const paged = list.slice(offset, offset + limit);

    // Compute metrics
    const cveCount = new Set(this.cachedItems.flatMap(i => i.cves || [])).size;
    const activeFeedsCount = this.sources.filter(s => s.enabled).length;

    return {
      items: paged,
      total,
      activeFeedsCount,
      cveCount
    };
  }

  /**
   * Fetches and parses RSS 2.0 or Atom feeds from a given URL
   */
  public static async parseFeedFromUrl(url: string, feedId: string, feedName?: string): Promise<{
    title: string;
    description: string;
    items: ThreatFeedItem[];
  }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 mSec-Threat-Insight/1.0',
          'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
        }
      });

      if (!res.ok) {
        throw new Error(`Feed server returned HTTP ${res.status}: ${res.statusText}`);
      }

      const xml = await res.text();
      return this.parseXmlFeed(xml, feedId, feedName || 'Threat Feed');
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Parses XML string into structured threat feed items
   */
  public static parseXmlFeed(xml: string, feedId: string, feedName: string): {
    title: string;
    description: string;
    items: ThreatFeedItem[];
  } {
    if (!xml || typeof xml !== 'string') {
      return { title: feedName, description: '', items: [] };
    }

    // Determine feed title
    const channelMatch = xml.match(/<channel[\s\S]*?>([\s\S]*?)<\/channel>/i);
    const feedMatch = xml.match(/<feed[\s\S]*?>([\s\S]*?)<\/feed>/i);

    let parsedTitle = feedName;
    let parsedDescription = '';

    if (channelMatch) {
      const chHeader = channelMatch[1].split(/<item/i)[0];
      parsedTitle = this.decodeXmlEntities(chHeader.match(/<title[\s\S]*?>([\s\S]*?)<\/title>/i)?.[1]?.trim()) || feedName;
      parsedDescription = this.stripHtml(this.decodeXmlEntities(chHeader.match(/<description[\s\S]*?>([\s\S]*?)<\/description>/i)?.[1]?.trim())) || '';
    } else if (feedMatch) {
      const feedHeader = feedMatch[1].split(/<entry/i)[0];
      parsedTitle = this.decodeXmlEntities(feedHeader.match(/<title[\s\S]*?>([\s\S]*?)<\/title>/i)?.[1]?.trim()) || feedName;
      parsedDescription = this.stripHtml(this.decodeXmlEntities(feedHeader.match(/<subtitle[\s\S]*?>([\s\S]*?)<\/subtitle>/i)?.[1]?.trim())) || '';
    }

    const items: ThreatFeedItem[] = [];

    // Check for RSS 2.0 <item> entries
    const rssItems = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)];
    if (rssItems.length > 0) {
      for (const it of rssItems) {
        const raw = it[0];
        const title = this.decodeXmlEntities(raw.match(/<title[\s\S]*?>([\s\S]*?)<\/title>/i)?.[1]?.trim()) || 'Security Advisory';
        let link = raw.match(/<link[\s\S]*?>([\s\S]*?)<\/link>/i)?.[1]?.trim() || '';
        link = this.decodeXmlEntities(link);
        if (!link) {
          const guid = raw.match(/<guid[\s\S]*?>([\s\S]*?)<\/guid>/i)?.[1]?.trim();
          if (guid && guid.startsWith('http')) link = this.decodeXmlEntities(guid);
        }

        const rawDesc = raw.match(/<description[\s\S]*?>([\s\S]*?)<\/description>/i)?.[1] ||
                        raw.match(/<content:encoded[\s\S]*?>([\s\S]*?)<\/content:encoded>/i)?.[1] || '';
        const summary = this.cleanExcerpt(this.stripHtml(this.decodeXmlEntities(rawDesc)));

        const pubDateRaw = raw.match(/<pubDate[\s\S]*?>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() ||
                           raw.match(/<dc:date[\s\S]*?>([\s\S]*?)<\/dc:date>/i)?.[1]?.trim() ||
                           new Date().toISOString();
        const pubDate = this.normalizeDate(pubDateRaw);

        const author = this.decodeXmlEntities(
          raw.match(/<author[\s\S]*?>([\s\S]*?)<\/author>/i)?.[1]?.trim() ||
          raw.match(/<dc:creator[\s\S]*?>([\s\S]*?)<\/dc:creator>/i)?.[1]?.trim()
        );

        const categories = [...raw.matchAll(/<category[\s\S]*?>([\s\S]*?)<\/category>/gi)]
          .map(m => this.decodeXmlEntities(m[1].trim()))
          .filter(Boolean);

        const cves = this.extractCves(`${title} ${summary}`);
        const severity = this.inferSeverity(`${title} ${summary}`);

        const id = `item-${feedId}-${this.hashString(link || title + pubDate)}`;

        items.push({
          id,
          feedId,
          feedName: parsedTitle || feedName,
          title,
          link,
          pubDate,
          summary,
          author,
          categories: categories.length > 0 ? categories : undefined,
          cves: cves.length > 0 ? cves : undefined,
          severity
        });
      }
    } else {
      // Check for Atom <entry> entries
      const atomEntries = [...xml.matchAll(/<entry[\s\S]*?<\/entry>/gi)];
      for (const en of atomEntries) {
        const raw = en[0];
        const title = this.decodeXmlEntities(raw.match(/<title[\s\S]*?>([\s\S]*?)<\/title>/i)?.[1]?.trim()) || 'Security Notice';

        // Atom links are typically <link href="..." />
        let link = raw.match(/<link[^>]*?href=["']([^"']+)["'][^>]*?>/i)?.[1]?.trim() ||
                   raw.match(/<link[\s\S]*?>([\s\S]*?)<\/link>/i)?.[1]?.trim() || '';
        link = this.decodeXmlEntities(link);

        const rawSummary = raw.match(/<summary[\s\S]*?>([\s\S]*?)<\/summary>/i)?.[1] ||
                           raw.match(/<content[\s\S]*?>([\s\S]*?)<\/content>/i)?.[1] || '';
        const summary = this.cleanExcerpt(this.stripHtml(this.decodeXmlEntities(rawSummary)));

        const dateRaw = raw.match(/<updated[\s\S]*?>([\s\S]*?)<\/updated>/i)?.[1]?.trim() ||
                        raw.match(/<published[\s\S]*?>([\s\S]*?)<\/published>/i)?.[1]?.trim() ||
                        new Date().toISOString();
        const pubDate = this.normalizeDate(dateRaw);

        const author = this.decodeXmlEntities(raw.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/i)?.[1]?.trim());

        const categories = [...raw.matchAll(/<category[^>]*?term=["']([^"']+)["'][^>]*?>/gi)]
          .map(m => this.decodeXmlEntities(m[1].trim()))
          .filter(Boolean);

        const cves = this.extractCves(`${title} ${summary}`);
        const severity = this.inferSeverity(`${title} ${summary}`);

        const id = `item-${feedId}-${this.hashString(link || title + pubDate)}`;

        items.push({
          id,
          feedId,
          feedName: parsedTitle || feedName,
          title,
          link,
          pubDate,
          summary,
          author,
          categories: categories.length > 0 ? categories : undefined,
          cves: cves.length > 0 ? cves : undefined,
          severity
        });
      }
    }

    return {
      title: parsedTitle,
      description: parsedDescription,
      items
    };
  }

  public static decodeXmlEntities(str?: string): string {
    if (!str) return '';
    return str
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
  }

  public static stripHtml(str?: string): string {
    if (!str) return '';
    return str
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  public static cleanExcerpt(str?: string): string {
    if (!str) return '';
    const clean = str.trim();
    if (clean.length > 280) {
      return clean.substring(0, 277) + '...';
    }
    return clean;
  }

  public static normalizeDate(dateStr?: string): string {
    if (!dateStr) return new Date().toISOString();
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
    return new Date().toISOString();
  }

  public static extractCves(text: string): string[] {
    if (!text) return [];
    const matches = text.match(/\bCVE-\d{4}-\d{4,7}\b/gi) || [];
    const set = new Set<string>();
    for (const m of matches) {
      set.add(m.toUpperCase());
    }
    return Array.from(set);
  }

  public static inferSeverity(text: string): ThreatFeedItem['severity'] {
    if (!text) return 'INFO';
    const s = text.toLowerCase();
    if (
      s.includes('kritisk') ||
      s.includes('critical') ||
      s.includes('utnyttjas aktivt') ||
      s.includes('actively exploited') ||
      s.includes('zeroday') ||
      s.includes('zero-day') ||
      s.includes('0-day') ||
      s.includes('cvss 9.') ||
      s.includes('cvss 10')
    ) {
      return 'CRITICAL';
    }
    if (
      s.includes('hög') ||
      s.includes('high') ||
      s.includes('allvarlig') ||
      s.includes('remote code execution') ||
      s.includes('rce') ||
      s.includes('privilege escalation') ||
      s.includes('cvss 7.') ||
      s.includes('cvss 8.')
    ) {
      return 'HIGH';
    }
    if (s.includes('medium') || s.includes('medel') || s.includes('måttlig') || s.includes('cvss 5.') || s.includes('cvss 6.')) {
      return 'MEDIUM';
    }
    if (s.includes('låg') || s.includes('low') || s.includes('cvss 1.') || s.includes('cvss 2.') || s.includes('cvss 3.') || s.includes('cvss 4.')) {
      return 'LOW';
    }
    return 'INFO';
  }

  private static deduplicateAndSortCache(): void {
    const seenLinks = new Set<string>();
    const unique: ThreatFeedItem[] = [];

    for (const item of this.cachedItems) {
      const key = (item.link || item.title).toLowerCase();
      if (!seenLinks.has(key)) {
        seenLinks.add(key);
        unique.push(item);
      }
    }

    unique.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
    this.cachedItems = unique;
  }

  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}
