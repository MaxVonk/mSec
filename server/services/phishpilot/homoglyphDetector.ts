import { HomoglyphResult } from '../../types/phishpilot.js';

export class HomoglyphDetector {
  // Common Cyrillic / Greek homoglyphs mapped to ASCII equivalents
  private static CONFUSABLES: Record<string, string> = {
    'а': 'a', 'с': 'c', 'е': 'e', 'о': 'o', 'р': 'p', 'х': 'x', 'у': 'y',
    'і': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'ԛ': 'q', 'ԝ': 'w',
    'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Ι': 'I', 'Κ': 'K',
    'Μ': 'M', 'Ν': 'N', 'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Υ': 'Y', 'Χ': 'X'
  };

  private static MONITORED_BRANDS = [
    'microsoft', 'office365', 'outlook', 'azure', 'docusign',
    'paypal', 'google', 'apple', 'adobe', 'netflix', 'chase', 'wellsfargo'
  ];

  /**
   * Evaluates if a domain contains homoglyph/punycode characters or is a close typosquat of a major brand
   */
  public static detect(domain: string, internalDomain?: string): HomoglyphResult {
    return this.evaluateDomain(domain, internalDomain);
  }

  public static evaluateDomain(domain: string, internalDomain?: string): HomoglyphResult {
    const cleanDomain = domain.toLowerCase().trim();
    const isPunycode = cleanDomain.includes('xn--');

    // 1. Check for homoglyph characters
    let normalized = '';
    let hasHomoglyphChar = false;
    for (const char of cleanDomain) {
      if (this.CONFUSABLES[char]) {
        normalized += this.CONFUSABLES[char];
        hasHomoglyphChar = true;
      } else {
        normalized += char;
      }
    }

    if (hasHomoglyphChar || isPunycode) {
      return {
        isSuspicious: true,
        punycode: isPunycode ? cleanDomain : undefined,
        explanation: `Confusable Homoglyph/Punycode characters detected in domain "${cleanDomain}" (Normalizes to: "${normalized}").`
      };
    }

    // 2. Check Levenshtein distance and brand token presence against internal and popular brands
    const domainBody = cleanDomain.split('.')[0];
    const targets = internalDomain ? [...this.MONITORED_BRANDS, internalDomain.split('.')[0]] : this.MONITORED_BRANDS;
    const segments = domainBody.includes('-') ? [domainBody, ...domainBody.split('-')] : [domainBody];

    for (const brand of targets) {
      for (const seg of segments) {
        if (seg === brand && segments.length > 1) {
          return {
            isSuspicious: true,
            impersonatedBrand: brand,
            matchedTarget: brand,
            similarityScore: 0.95,
            explanation: `Brand impersonation domain: "${cleanDomain}" directly uses trusted brand name "${brand}".`
          };
        }

        if (seg === brand) continue;

        const dist = this.levenshtein(seg, brand);
        // If edit distance is 1 or 2 on words longer than 5 chars, it's a high-probability typosquat
        if (dist > 0 && dist <= 2 && brand.length >= 5) {
          return {
            isSuspicious: true,
            impersonatedBrand: brand,
            matchedTarget: brand,
            similarityScore: Number((1 - dist / Math.max(seg.length, brand.length)).toFixed(2)),
            explanation: `Typosquat / Lookalike domain detected: "${cleanDomain}" is only ${dist} edit(s) away from trusted brand "${brand}".`
          };
        }
      }
    }

    return { isSuspicious: false };
  }

  private static levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }
}
