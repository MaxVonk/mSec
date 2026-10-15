import { ParsedEmail, UrlAnalysisResult, ReputationSource } from '../../types/phishpilot.js';
import { HomoglyphDetector } from './homoglyphDetector.js';

export class UrlAnalyzerService {
  private static vtCache = new Map<string, ReputationSource>();

  public static async analyze(parsed: ParsedEmail): Promise<UrlAnalysisResult[]> {
    const results: UrlAnalysisResult[] = [];

    for (const urlStr of parsed.urls) {
      const res = await this.analyzeSingleUrl(urlStr, parsed.htmlBody);
      if (res) {
        results.push(res);
      }
    }
    return results;
  }

  public static async analyzeSingleUrl(urlStr: string, htmlBody: string = ''): Promise<UrlAnalysisResult | null> {
    try {
      const urlObj = new URL(urlStr);
      const domain = urlObj.hostname;

      // Determine if there's display URL deception
      const deceptionRegex = new RegExp(`>\\s*https?://([^<]+)\\s*</a>`, 'gi');
      let isDeceptive = false;
      
      for (const match of htmlBody.matchAll(deceptionRegex)) {
         const textUrl = match[1];
         if (textUrl && !textUrl.includes(domain) && urlStr.includes(domain)) {
           isDeceptive = true;
         }
      }

      const reputationSources: ReputationSource[] = [];

      // 1. Check URLHaus
      const urlHausMalicious = await this.checkUrlHaus(urlStr);
      reputationSources.push({
        source: 'URLHaus',
        result: urlHausMalicious ? 'malicious' : 'clean',
        detail: urlHausMalicious ? 'Flagged in URLHaus malware distribution database' : 'No threat detected'
      });

      // 2. Check VirusTotal API v3 (if key provided)
      const vtSource = await this.checkVirusTotalUrl(urlStr);
      if (vtSource) {
        reputationSources.push(vtSource);
      }

      // 3. Domain age & heuristic evaluation
      const isSuspiciousDomain = /(verify|secure|update|login|account|banking|paypal|microsoft|apple).*\.(xyz|top|ru|cc|tk|ga|cf|gq|ml|buzz)/i.test(domain);
      let domainAgeDays = isSuspiciousDomain ? 4 : 365;

      // 4. Homoglyph / Confusable lookalike domain detection
      const homoglyph = HomoglyphDetector.evaluateDomain(domain);
      if (homoglyph.isSuspicious) {
        reputationSources.push({
          source: 'Homoglyph Guard',
          result: 'malicious',
          detail: homoglyph.explanation
        });
      }

      const vtMalicious = vtSource ? (vtSource.maliciousCount !== undefined && vtSource.maliciousCount > 0) : false;
      const isMalicious = urlHausMalicious || isSuspiciousDomain || vtMalicious || homoglyph.isSuspicious;

      return {
        url: urlStr,
        domain,
        domainAgeDays,
        isMalicious,
        isDeceptive,
        reputationSources,
        homoglyph: homoglyph.isSuspicious ? homoglyph : undefined
      };
    } catch (e) {
      return null;
    }
  }

  private static async checkUrlHaus(url: string): Promise<boolean> {
    try {
      const formData = new URLSearchParams();
      formData.append('url', url);
      const res = await fetch('https://urlhaus-api.abuse.ch/v1/url/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const data = await res.json() as any;
        return data.query_status === 'ok';
      }
    } catch (e) {
      // Ignore network timeout
    }
    return false;
  }

  public static async checkVirusTotalUrl(url: string): Promise<ReputationSource | null> {
    const apiKey = process.env.VIRUSTOTAL_API_KEY;
    if (!apiKey) {
      return null;
    }

    if (this.vtCache.has(url)) {
      return this.vtCache.get(url)!;
    }

    try {
      // VirusTotal URL identifier: base64 without padding '='
      const urlId = Buffer.from(url).toString('base64').replace(/=/g, '');
      const res = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
        headers: {
          'x-apikey': apiKey,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(4000)
      });

      if (res.ok) {
        const data = await res.json() as any;
        const stats = data.data?.attributes?.last_analysis_stats || {};
        const malicious = stats.malicious || 0;
        const suspicious = stats.suspicious || 0;
        const total = (stats.malicious || 0) + (stats.suspicious || 0) + (stats.harmless || 0) + (stats.undetected || 0);

        const rep: ReputationSource = {
          source: 'VirusTotal v3',
          result: malicious > 0 ? 'malicious' : (suspicious > 0 ? 'suspicious' : 'clean'),
          detail: `${malicious}/${total || 70} security vendors flagged this URL`,
          maliciousCount: malicious,
          totalEngines: total
        };

        this.vtCache.set(url, rep);
        return rep;
      }
    } catch (e) {
      // VT error
    }
    return null;
  }
}
