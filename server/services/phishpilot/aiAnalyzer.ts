import { ParsedEmail, HeaderAnalysisResult, UrlAnalysisResult, AttachmentAnalysisResult, AiClassification } from '../../types/phishpilot.js';

export class AiAnalyzerService {
  public static async analyze(
    parsed: ParsedEmail, 
    headers: HeaderAnalysisResult, 
    urls: UrlAnalysisResult[], 
    attachments: AttachmentAnalysisResult[]
  ): Promise<AiClassification | null> {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    if (!endpoint || !apiKey) return null;

    const modelMini = process.env.AZURE_OPENAI_DEPLOYMENT_MINI || 'gpt-4o-mini';
    const modelFull = process.env.AZURE_OPENAI_DEPLOYMENT_FULL || 'gpt-4o';

    try {
      const systemPrompt = `You are a senior cybersecurity email analysis expert. Analyze the provided email security indicators and classify the email as strictly one of: LEGITIMATE, SUSPICIOUS, or PHISHING.
Respond ONLY with a valid JSON object matching this schema:
{
  "classification": "LEGITIMATE" | "SUSPICIOUS" | "PHISHING",
  "confidence": number between 0.0 and 1.0,
  "keyFindings": string[],
  "indicators": string[],
  "recommendedActions": string[]
}`;

      const userContent = JSON.stringify({
        sender: parsed.from,
        to: parsed.to,
        subject: parsed.subject,
        replyTo: parsed.replyTo,
        returnPath: parsed.returnPath,
        authentication: {
          spf: headers.spf.result,
          dkim: headers.dkim.result,
          dmarc: headers.dmarc.result,
          replyToMismatch: headers.replyToMismatch
        },
        urls: urls.map(u => ({ url: u.url, domain: u.domain, domainAgeDays: u.domainAgeDays, isMalicious: u.isMalicious, isDeceptive: u.isDeceptive })),
        attachments: attachments.map(a => ({ filename: a.filename, mimeType: a.mimeType, isSuspiciousExtension: a.isSuspiciousExtension })),
        bodyPreview: parsed.plainTextBody.slice(0, 1000)
      });

      const url = `${endpoint.replace(/\/+$/, '')}/openai/deployments/${modelMini}/chat/completions?api-version=2024-02-15-preview`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (res.ok) {
        const data = await res.json() as any;
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsedRes = JSON.parse(content);
          return {
            classification: parsedRes.classification || 'SUSPICIOUS',
            confidence: typeof parsedRes.confidence === 'number' ? parsedRes.confidence : 0.85,
            keyFindings: Array.isArray(parsedRes.keyFindings) ? parsedRes.keyFindings : [],
            indicators: Array.isArray(parsedRes.indicators) ? parsedRes.indicators : [],
            recommendedActions: Array.isArray(parsedRes.recommendedActions) ? parsedRes.recommendedActions : ['Review email carefully'],
            modelUsed: modelMini
          };
        }
      }
    } catch (e) {
      console.error('AI analysis request failed:', e);
    }
    return null;
  }
}
