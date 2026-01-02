import { describe, it, expect } from 'vitest';
import { parseRSS, RSSItem } from './parser';

const RSS_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Article 1</title>
      <link>https://example.com/1</link>
      <description>Description 1</description>
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
      <guid>guid-1</guid>
    </item>
    <item>
      <title>Article 2</title>
      <link>https://example.com/2</link>
      <description>Description 2</description>
      <pubDate>Tue, 02 Jan 2024 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <title>Atom Article</title>
    <link href="https://example.com/atom/1"/>
    <summary>Atom summary</summary>
    <published>2024-01-01T00:00:00Z</published>
    <id>atom-id-1</id>
  </entry>
</feed>`;

describe('parseRSS', () => {
  it('should parse RSS 2.0 feed', () => {
    const items = parseRSS(RSS_SAMPLE);

    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('Article 1');
    expect(items[0].link).toBe('https://example.com/1');
    expect(items[0].description).toBe('Description 1');
    expect(items[0].guid).toBe('guid-1');
  });

  it('should parse Atom feed', () => {
    const items = parseRSS(ATOM_SAMPLE);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Atom Article');
    expect(items[0].link).toBe('https://example.com/atom/1');
    expect(items[0].description).toBe('Atom summary');
  });

  it('should respect maxItems limit', () => {
    const items = parseRSS(RSS_SAMPLE, 1);
    expect(items).toHaveLength(1);
  });

  it('should handle empty feed', () => {
    const items = parseRSS('<rss><channel></channel></rss>');
    expect(items).toHaveLength(0);
  });
});
