import { simpleParser, ParsedMail } from 'mailparser';
import { ParsedEmail } from '../../types/phishpilot.js';

export class EmailParserService {
  public static async parse(emlContent: string | Buffer): Promise<ParsedEmail> {
    const parsed: ParsedMail = await simpleParser(emlContent);
    
    const getHeaderString = (val: any): string => {
      if (!val) return '';
      if (typeof val === 'string') return val;
      if (typeof val.text === 'string') return val.text;
      if (typeof val.value === 'string') return val.value;
      if (Array.isArray(val.value)) {
        return val.value.map((v: any) => v.address || v.text || v.name || String(v)).join(', ');
      }
      return String(val);
    };

    const headersMap: Record<string, string> = {};
    parsed.headers.forEach((value, key) => {
      headersMap[key.toLowerCase()] = getHeaderString(value);
    });

    const plainTextBody = parsed.text || '';
    const htmlBody = parsed.html || '';
    
    // Extract URLs (simple regex)
    const urlRegex = /(https?:\/\/[^\s<>'"]+)/gi;
    const plainUrls = Array.from(plainTextBody.matchAll(urlRegex), m => m[1]);
    const htmlUrls = Array.from(htmlBody.matchAll(urlRegex), m => m[1]);
    
    const urls = Array.from(new Set([...plainUrls, ...htmlUrls]));

    const attachments = (parsed.attachments || []).map(att => ({
      filename: att.filename || 'unknown',
      mimeType: att.contentType || 'application/octet-stream',
      size: att.size || 0,
      content: att.content
    }));

    const returnPathRaw = parsed.headers.get('return-path');
    const returnPath = returnPathRaw ? getHeaderString(returnPathRaw) : (headersMap['return-path'] || null);

    return {
      from: parsed.from?.text || '',
      to: parsed.to ? (Array.isArray(parsed.to) ? parsed.to.map(t => t.text).join(', ') : parsed.to.text) : '',
      subject: parsed.subject || '',
      date: parsed.date || null,
      messageId: parsed.messageId || '',
      replyTo: parsed.replyTo?.text || null,
      returnPath,
      headersMap,
      plainTextBody,
      htmlBody,
      urls,
      attachments
    };
  }
}
