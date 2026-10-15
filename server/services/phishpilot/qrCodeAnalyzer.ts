import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { ParsedEmail, QrCodeAnalysisResult } from '../../types/phishpilot.js';
import { UrlAnalyzerService } from './urlAnalyzer.js';

export class QrCodeAnalyzerService {
  private static PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  /**
   * Scans email attachments and inline HTML body images for embedded QR codes (Quishing)
   */
  public static async analyze(parsed: ParsedEmail): Promise<QrCodeAnalysisResult[]> {
    const results: QrCodeAnalysisResult[] = [];
    const scannedPayloads = new Set<string>();

    // 1. Scan image attachments (PNG format or with PNG signature)
    for (const att of parsed.attachments || []) {
      const isPngExt = /\.png$/i.test(att.filename);
      const isPngMime = att.mimeType === 'image/png';
      const hasPngHeader = att.content && att.content.length > 8 && att.content.subarray(0, 8).equals(this.PNG_MAGIC);

      if (isPngExt || isPngMime || hasPngHeader) {
        try {
          const qrText = this.decodeQrFromPngBuffer(att.content);
          if (qrText && !scannedPayloads.has(qrText)) {
            scannedPayloads.add(qrText);
            const qrResult = await this.evaluatePayload(qrText, 'ATTACHMENT', att.filename, parsed.htmlBody);
            results.push(qrResult);
          }
        } catch (err: any) {
          // Skip corrupt or unreadable image
        }
      }
    }

    // 2. Scan inline base64 images in HTML body
    const base64Regex = /data:image\/png;base64,([A-Za-z0-9+/=]+)/gi;
    let match: RegExpExecArray | null;
    let inlineCount = 0;

    while ((match = base64Regex.exec(parsed.htmlBody || '')) !== null) {
      inlineCount++;
      const b64Data = match[1];
      try {
        const buf = Buffer.from(b64Data, 'base64');
        const qrText = this.decodeQrFromPngBuffer(buf);
        if (qrText && !scannedPayloads.has(qrText)) {
          scannedPayloads.add(qrText);
          const qrResult = await this.evaluatePayload(qrText, 'BODY_IMAGE', `inline-qr-${inlineCount}.png`, parsed.htmlBody);
          results.push(qrResult);
        }
      } catch (err: any) {
        // Skip unreadable inline base64 image
      }
    }

    return results;
  }

  /**
   * Helper to decode a QR code from a PNG buffer
   */
  public static decodeQrFromPngBuffer(buffer: Buffer): string | null {
    try {
      const png = PNG.sync.read(buffer);
      const clamped = new Uint8ClampedArray(png.data);
      const code = jsQR(clamped, png.width, png.height);
      return code ? code.data.trim() : null;
    } catch {
      return null;
    }
  }

  /**
   * Evaluates decoded QR payload (URL or text), enriching with URL reputation and homoglyph checks
   */
  private static async evaluatePayload(
    payload: string, 
    source: 'ATTACHMENT' | 'BODY_IMAGE', 
    filename?: string,
    htmlBody: string = ''
  ): Promise<QrCodeAnalysisResult> {
    const isUrl = /^https?:\/\//i.test(payload);
    
    if (isUrl) {
      const urlAnalysis = await UrlAnalyzerService.analyzeSingleUrl(payload, htmlBody);
      const isMalicious = urlAnalysis ? urlAnalysis.isMalicious : false;
      const domain = urlAnalysis?.domain;
      const homoglyph = urlAnalysis?.homoglyph;
      const reputationSources = urlAnalysis?.reputationSources || [];

      // Quishing carries high risk points if suspicious/malicious or obfuscated
      const riskPoints = isMalicious ? 45 : 25;

      return {
        source,
        filename,
        decodedUrl: payload,
        domain,
        isMalicious,
        reputationSources,
        homoglyph,
        riskPoints
      };
    }

    // Non-URL QR payload (e.g. 2FA seed or authentication string)
    return {
      source,
      filename,
      decodedUrl: payload,
      isMalicious: false,
      reputationSources: [
        {
          source: 'QR Payload Inspector',
          result: 'clean',
          detail: 'Decoded QR contains non-URL text or token string'
        }
      ],
      riskPoints: 15
    };
  }
}

