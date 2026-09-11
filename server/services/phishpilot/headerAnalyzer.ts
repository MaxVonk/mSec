import dns from 'node:dns/promises';
import { ParsedEmail, HeaderAnalysisResult, HeaderCheck, DnsAuthDetails } from '../../types/phishpilot.js';

export class HeaderAnalyzerService {
  public static async analyze(parsed: ParsedEmail): Promise<HeaderAnalysisResult> {
    const authResults = parsed.headersMap['authentication-results'] || '';
    
    // 1. Gateway header results
    let gatewaySpf = this.extractAuthResult(authResults, 'spf');
    let gatewayDkim = this.extractAuthResult(authResults, 'dkim');
    let gatewayDmarc = this.extractAuthResult(authResults, 'dmarc');

    // Mismatches
    const extractDomain = (emailStr: string) => {
      const match = emailStr.match(/@([\w.-]+)/);
      return match ? match[1].toLowerCase() : null;
    };

    const fromDomain = extractDomain(parsed.from);

    // If email was forwarded by an internal employee, do not credit internal reporter's SPF/DKIM to external sender
    if (parsed.isForwarded && parsed.forwardedBy) {
      const reporterDomain = extractDomain(parsed.forwardedBy);
      if (reporterDomain && fromDomain && reporterDomain !== fromDomain) {
        gatewaySpf = 'none';
        gatewayDkim = 'none';
        gatewayDmarc = 'none';
      }
    }
    let replyToMismatch = false;
    if (parsed.replyTo) {
      const replyToDomain = extractDomain(parsed.replyTo);
      if (fromDomain && replyToDomain && fromDomain !== replyToDomain) {
        replyToMismatch = true;
      }
    }

    let returnPathMismatch = false;
    if (parsed.returnPath) {
      const returnPathDomain = extractDomain(parsed.returnPath);
      if (fromDomain && returnPathDomain && fromDomain !== returnPathDomain) {
        returnPathMismatch = true;
      }
    }

    let receivedHops = 0;
    const originIps: string[] = [];

    for (const [key, value] of Object.entries(parsed.headersMap)) {
      if (key === 'received') {
        receivedHops++;
        const ipMatch = value.match(/\[(\d{1,3}(?:\.\d{1,3}){3})\]/);
        if (ipMatch) {
          originIps.push(ipMatch[1]);
        }
      }
    }

    // 2. Perform live DNS checks
    const targetDomain = fromDomain || (parsed.returnPath ? extractDomain(parsed.returnPath) : null);
    const dnsAuth: DnsAuthDetails = {};

    let finalSpf = gatewaySpf;
    let finalDkim = gatewayDkim;
    let finalDmarc = gatewayDmarc;

    let spfDetail = `Sender Policy Framework gateway status: ${gatewaySpf}`;
    let dkimDetail = `DomainKeys Identified Mail gateway status: ${gatewayDkim}`;
    let dmarcDetail = `DMARC gateway status: ${gatewayDmarc}`;

    if (targetDomain) {
      try {
        // A. Query live SPF record
        const liveSpf = await this.resolveLiveSpf(targetDomain);
        if (liveSpf) {
          dnsAuth.spfRecord = liveSpf;
          if (finalSpf === 'unknown' || finalSpf === 'none') {
            finalSpf = 'pass';
            spfDetail = `Live DNS SPF TXT record found on ${targetDomain}: "${liveSpf}"`;
          } else {
            spfDetail += ` (Live DNS SPF record: "${liveSpf.slice(0, 50)}...")`;
          }
        }
      } catch (e) {
        // DNS lookup failed
      }

      try {
        // B. Query live DMARC record
        const liveDmarc = await this.resolveLiveDmarc(targetDomain);
        if (liveDmarc) {
          dnsAuth.dmarcRecord = liveDmarc;
          const policyMatch = liveDmarc.match(/p=([a-zA-Z0-9_-]+)/);
          const policy = policyMatch ? policyMatch[1].toLowerCase() : 'none';
          dnsAuth.dmarcPolicy = policy;

          // Alignment check
          const isAligned = !replyToMismatch && !returnPathMismatch;
          dnsAuth.dmarcAlignment = isAligned ? 'aligned' : 'unaligned';

          if (finalDmarc === 'unknown' || finalDmarc === 'none') {
            finalDmarc = isAligned ? (finalSpf === 'pass' ? 'pass' : 'fail') : 'fail';
            dmarcDetail = `Live DMARC policy '${policy}' evaluated on ${targetDomain} (Alignment: ${dnsAuth.dmarcAlignment})`;
          } else {
            dmarcDetail += ` (Live DMARC policy: p=${policy}, alignment: ${dnsAuth.dmarcAlignment})`;
          }
        }
      } catch (e) {
        // DNS lookup failed
      }

      try {
        // C. Check DKIM selector if dkim-signature header present
        const dkimSig = parsed.headersMap['dkim-signature'];
        if (dkimSig) {
          const sMatch = dkimSig.match(/s=([a-zA-Z0-9._-]+)/i);
          const dMatch = dkimSig.match(/d=([a-zA-Z0-9._-]+)/i);
          if (sMatch && dMatch) {
            dnsAuth.dkimSelector = sMatch[1];
            dnsAuth.dkimDomain = dMatch[1];
            const hasKey = await this.resolveLiveDkim(dMatch[1], sMatch[1]);
            dnsAuth.dkimKeyFound = hasKey;
            if (hasKey) {
              if (finalDkim === 'unknown') finalDkim = 'pass';
              dkimDetail += ` (Live DKIM public key verified at ${sMatch[1]}._domainkey.${dMatch[1]})`;
            }
          }
        }
      } catch (e) {
        // DNS lookup failed
      }
    }

    const spf: HeaderCheck = {
      name: 'SPF',
      result: finalSpf,
      detail: spfDetail,
      dnsRecord: dnsAuth.spfRecord
    };

    const dkim: HeaderCheck = {
      name: 'DKIM',
      result: finalDkim,
      detail: dkimDetail,
      dnsRecord: dnsAuth.dkimSelector ? `${dnsAuth.dkimSelector}._domainkey.${dnsAuth.dkimDomain}` : undefined
    };

    const dmarc: HeaderCheck = {
      name: 'DMARC',
      result: finalDmarc,
      detail: dmarcDetail,
      dnsRecord: dnsAuth.dmarcRecord
    };

    const checks: HeaderCheck[] = [spf, dkim, dmarc];

    return {
      spf,
      dkim,
      dmarc,
      replyToMismatch,
      returnPathMismatch,
      receivedHops,
      originIps: Array.from(new Set(originIps)),
      checks,
      dnsAuth
    };
  }

  public static async resolveLiveSpf(domain: string): Promise<string | null> {
    try {
      const records = await dns.resolveTxt(domain);
      const joined = records.map(chunk => chunk.join(''));
      const spf = joined.find(r => r.startsWith('v=spf1'));
      return spf || null;
    } catch {
      return null;
    }
  }

  public static async resolveLiveDmarc(domain: string): Promise<string | null> {
    try {
      const records = await dns.resolveTxt(`_dmarc.${domain}`);
      const joined = records.map(chunk => chunk.join(''));
      const dmarc = joined.find(r => r.startsWith('v=DMARC1'));
      return dmarc || null;
    } catch {
      return null;
    }
  }

  public static async resolveLiveDkim(domain: string, selector: string): Promise<boolean> {
    try {
      const records = await dns.resolveTxt(`${selector}._domainkey.${domain}`);
      const joined = records.map(chunk => chunk.join(''));
      return joined.some(r => r.includes('p='));
    } catch {
      return false;
    }
  }

  private static extractAuthResult(header: string, mechanism: string): 'pass' | 'fail' | 'softfail' | 'none' | 'unknown' {
    const regex = new RegExp(`${mechanism}=([\\w]+)`, 'i');
    const match = header.match(regex);
    if (!match) return 'unknown';
    const val = match[1].toLowerCase();
    if (val === 'pass' || val === 'fail' || val === 'softfail' || val === 'none') {
      return val;
    }
    return 'unknown';
  }
}
