import test, { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { ThreatFeedService } from '../server/services/threatFeedService';

describe('Threat Insight RSS & Cyber Intelligence Feed Ingestion Suite', () => {

  const SAMPLE_CERT_SE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>CERT-SE Nyheter</title>
    <description>CERT-SE är Sveriges nationella CSIRT med uppgift att stödja samhället.</description>
    <link>https://www.cert.se</link>
    <item>
      <title>Kritisk sårbarhet i Cisco Secure Email Gateway utnyttjas aktivt</title>
      <description>&lt;p&gt;Cisco har publicerat information om en kritisk SQL injection-sårbarhet i Cisco Secure Email Gateway som utnyttjas aktivt. Sårbarheten (CVE-2026-76461) har fått CVSS-klassificering 9.8 (CVSS v.3.1). [1] CISA har lagt till sårbarheten i KEV-katalogen.&lt;/p&gt;</description>
      <pubDate>Tue, 15 Sep 2026 15:00:00 +0200</pubDate>
      <link>https://www.cert.se/2026/09/kritisk-sarbarhet-i-cisco-secure-email-gateway-utnyttjas-aktivt.html</link>
      <guid isPermaLink="true">https://www.cert.se/2026/09/kritisk-sarbarhet-i-cisco-secure-email-gateway-utnyttjas-aktivt.html</guid>
      <category>Sårbarhet</category>
      <category>Cisco</category>
    </item>
    <item>
      <title><![CDATA[CERT-SE:s veckobrev v.37]]></title>
      <description><![CDATA[I veckans brev kan du läsa om EU:s Cyber Resilience Act (CRA), och CVE-2026-1122.]]></description>
      <pubDate>Fri, 11 Sep 2026 14:30:00 +0200</pubDate>
      <link>https://www.cert.se/2026/09/cert-se-veckobrev-v37.html</link>
      <guid>https://www.cert.se/2026/09/cert-se-veckobrev-v37.html</guid>
      <category>Veckobrev</category>
    </item>
  </channel>
</rss>`;

  const SAMPLE_ATOM_XML = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>CISA Current Activity</title>
  <subtitle>Cybersecurity Advisories and Alerts</subtitle>
  <link href="https://www.cisa.gov/news-events/cybersecurity-advisories" rel="alternate"/>
  <entry>
    <title>High Severity Vulnerability in Apache HTTP Server (CVE-2026-3456)</title>
    <link href="https://www.cisa.gov/news-events/alerts/2026/09/16/apache-httpd" />
    <id>urn:cisa:alert:2026-09-16-1</id>
    <updated>2026-09-16T10:00:00Z</updated>
    <summary>A remote code execution flaw has been patched in Apache HTTP Server.</summary>
    <category term="Advisory" />
    <author><name>CISA Alert Team</name></author>
  </entry>
</feed>`;

  it('should parse CERT-SE RSS 2.0 XML with entities, categories, and CDATA', () => {
    const result = ThreatFeedService.parseXmlFeed(SAMPLE_CERT_SE_RSS, 'cert-se', 'CERT-SE');
    assert.equal(result.title, 'CERT-SE Nyheter');
    assert.equal(result.items.length, 2);

    const item1 = result.items[0];
    assert.equal(item1.title, 'Kritisk sårbarhet i Cisco Secure Email Gateway utnyttjas aktivt');
    assert.equal(item1.link, 'https://www.cert.se/2026/09/kritisk-sarbarhet-i-cisco-secure-email-gateway-utnyttjas-aktivt.html');
    assert.ok(item1.summary.includes('Cisco har publicerat information om en kritisk SQL injection'));
    assert.ok(!item1.summary.includes('<p>'), 'HTML tags should be stripped from summary');
    assert.ok(item1.cves?.includes('CVE-2026-76461'), 'Should extract CVE-2026-76461');
    assert.equal(item1.severity, 'CRITICAL', 'Should infer CRITICAL from "kritisk" and "utnyttjas aktivt"');
    assert.deepEqual(item1.categories, ['Sårbarhet', 'Cisco']);

    const item2 = result.items[1];
    assert.equal(item2.title, 'CERT-SE:s veckobrev v.37');
    assert.ok(item2.cves?.includes('CVE-2026-1122'));
    assert.deepEqual(item2.categories, ['Veckobrev']);
  });

  it('should parse Atom 1.0 XML entries', () => {
    const result = ThreatFeedService.parseXmlFeed(SAMPLE_ATOM_XML, 'cisa-alerts', 'CISA');
    assert.equal(result.title, 'CISA Current Activity');
    assert.equal(result.items.length, 1);

    const entry = result.items[0];
    assert.equal(entry.title, 'High Severity Vulnerability in Apache HTTP Server (CVE-2026-3456)');
    assert.equal(entry.link, 'https://www.cisa.gov/news-events/alerts/2026/09/16/apache-httpd');
    assert.equal(entry.author, 'CISA Alert Team');
    assert.ok(entry.cves?.includes('CVE-2026-3456'));
    assert.equal(entry.severity, 'HIGH', 'Should infer HIGH severity from "High" and "remote code execution"');
  });

  it('should extract multiple CVE identifiers without duplicates', () => {
    const text = 'Multiple flaws observed: CVE-2026-1111, cve-2026-2222, and again CVE-2026-1111 in vendor patch.';
    const cves = ThreatFeedService.extractCves(text);
    assert.deepEqual(cves, ['CVE-2026-1111', 'CVE-2026-2222']);
  });

  it('should decode XML entities and clean HTML tags correctly', () => {
    const encoded = '&lt;b&gt;Security &amp; Privacy Alert&lt;/b&gt; for &quot;Admin&#39;s Portal&quot; &amp; partners';
    const stripped = ThreatFeedService.stripHtml(ThreatFeedService.decodeXmlEntities(encoded));
    assert.equal(stripped, 'Security & Privacy Alert for "Admin\'s Portal" & partners');
  });

  it('should manage default sources and support source updates and filtering', async () => {
    await ThreatFeedService.init();
    const sources = ThreatFeedService.getSources();
    assert.ok(sources.length >= 4, 'Should initialize with default reputable feed sources');
    assert.ok(sources.some(s => s.id === 'cert-se' && s.url.includes('cert.se')));

    // Update source
    const updated = ThreatFeedService.updateSource('cert-se', { enabled: true, category: 'National CSIRT' });
    assert.equal(updated.category, 'National CSIRT');

    // Query items
    const query = ThreatFeedService.getItems({ limit: 10 });
    assert.ok(Array.isArray(query.items));
    assert.equal(typeof query.total, 'number');
    assert.equal(typeof query.activeFeedsCount, 'number');
  });
});
