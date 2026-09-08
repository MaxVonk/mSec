import crypto from 'crypto';
import { ParsedEmail, AttachmentAnalysisResult, ReputationSource } from '../../types/phishpilot.js';

export class AttachmentAnalyzerService {
  private static DANGEROUS_EXTS = ['.exe', '.scr', '.js', '.vbs', '.ps1', '.bat', '.cmd', '.hta', '.wsf', '.iso', '.img', '.lnk', '.pif'];
  private static vtCache = new Map<string, ReputationSource>();

  public static async analyze(parsed: ParsedEmail): Promise<AttachmentAnalysisResult[]> {
    const results: AttachmentAnalysisResult[] = [];

    for (const att of parsed.attachments) {
      const md5 = crypto.createHash('md5').update(att.content).digest('hex');
      const sha256 = crypto.createHash('sha256').update(att.content).digest('hex');
      
      const ext = att.filename.slice((att.filename.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
      const isSuspiciousExtension = this.DANGEROUS_EXTS.includes(`.${ext}`);

      // Basic heuristic for password protected ZIP (checking header)
      let isPasswordProtected = false;
      if (att.mimeType === 'application/zip' || ext === 'zip') {
        if (att.content.length > 6) {
          const generalPurposeBitFlag = att.content.readUInt16LE(6);
          if ((generalPurposeBitFlag & 1) !== 0) {
            isPasswordProtected = true;
          }
        }
      }

      const reputationSources: ReputationSource[] = [
        {
          source: 'Extension Guard',
          result: isSuspiciousExtension ? 'suspicious' : 'clean',
          detail: isSuspiciousExtension ? `Executable/Script extension detected (.${ext})` : 'Standard document/media extension'
        }
      ];

      // Check VirusTotal File Hash API
      const vtResult = await this.checkVirusTotalHash(sha256);
      if (vtResult) {
        reputationSources.push(vtResult);
      }

      const vtMalicious = vtResult ? (vtResult.maliciousCount !== undefined && vtResult.maliciousCount > 0) : false;
      const isMalicious = isSuspiciousExtension || vtMalicious;

      results.push({
        filename: att.filename,
        mimeType: att.mimeType,
        size: att.size,
        md5,
        sha256,
        isSuspiciousExtension,
        isPasswordProtected,
        isMalicious,
        reputationSources
      });
    }

    return results;
  }

  public static async checkVirusTotalHash(sha256: string): Promise<ReputationSource | null> {
    const apiKey = process.env.VIRUSTOTAL_API_KEY;
    if (!apiKey) {
      return null;
    }

    if (this.vtCache.has(sha256)) {
      return this.vtCache.get(sha256)!;
    }

    try {
      const res = await fetch(`https://www.virustotal.com/api/v3/files/${sha256}`, {
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
          detail: `${malicious}/${total || 70} security vendors flagged this file hash`,
          maliciousCount: malicious,
          totalEngines: total
        };

        this.vtCache.set(sha256, rep);
        return rep;
      }
    } catch (e) {
      // Ignore VT failure
    }
    return null;
  }
}
