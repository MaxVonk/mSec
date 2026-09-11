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

    // 1. Check if this email has a nested attached email (e.g. Outlook Report Phishing button or Forward as Attachment)
    const attachedEmail = (parsed.attachments || []).find(att => {
      const ct = (att.contentType || '').toLowerCase();
      const fn = (att.filename || '').toLowerCase();
      return ct.includes('message/rfc822') || fn.endsWith('.eml') || (
        att.content && (
          att.content.slice(0, 100).toString().includes('From:') ||
          att.content.slice(0, 100).toString().includes('Received:')
        )
      );
    });

    if (attachedEmail?.content) {
      try {
        const innerParsed = await EmailParserService.parse(attachedEmail.content);
        innerParsed.isForwarded = true;
        innerParsed.forwardedBy = parsed.from?.text || getHeaderString(parsed.headers.get('from')) || 'Internal Reporter';
        return innerParsed;
      } catch (err) {
        console.warn('[EmailParser] Failed to unwrap nested email attachment, evaluating outer message:', err);
      }
    }

    const plainTextBody = parsed.text || '';
    const htmlBody = parsed.html || '';
    
    // 2. Check if this email was forwarded inline (e.g. user clicked "Forward" in Outlook/Gmail)
    let finalFrom = parsed.from?.text || '';
    let finalSubject = parsed.subject || '';
    let isForwarded = false;
    let forwardedBy: string | undefined;

    const forwardHeaderRegex = /(?:-----Original Message-----|---------- Forwarded message ---------|Begin forwarded message:)\s*[\r\n]+([\s\S]+?)(?:[\r\n]{2,}|$)/i;
    const forwardMatch = plainTextBody.match(forwardHeaderRegex);

    if (forwardMatch) {
      const headerBlock = forwardMatch[1];
      const fromMatch = headerBlock.match(/From:\s*([^\r\n]+)/i);
      const subjectMatch = headerBlock.match(/Subject:\s*([^\r\n]+)/i);

      if (fromMatch) {
        isForwarded = true;
        forwardedBy = parsed.from?.text || 'Internal Reporter';
        finalFrom = fromMatch[1].trim();
        if (subjectMatch) {
          finalSubject = subjectMatch[1].trim();
        }
      }
    }
    
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
      from: finalFrom,
      to: parsed.to ? (Array.isArray(parsed.to) ? parsed.to.map(t => t.text).join(', ') : parsed.to.text) : '',
      subject: finalSubject,
      date: parsed.date || null,
      messageId: parsed.messageId || '',
      replyTo: parsed.replyTo?.text || null,
      returnPath,
      headersMap,
      plainTextBody,
      htmlBody,
      urls,
      attachments,
      isForwarded,
      forwardedBy
    };
  }
}
