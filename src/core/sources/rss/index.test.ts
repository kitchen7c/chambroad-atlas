import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RSSSource } from './index';
import type { SourceConfig } from '../types';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('RSSSource', () => {
  let source: RSSSource;

  beforeEach(() => {
    source = new RSSSource();
    mockFetch.mockReset();
  });

  describe('type', () => {
    it('should be rss', () => {
      expect(source.type).toBe('rss');
    });
  });

  describe('validate', () => {
    it('should reject invalid URL', async () => {
      const config: SourceConfig = {
        id: '1', name: 'Test', type: 'rss', enabled: true, schedule: '1h',
        config: { url: 'not-a-url' },
      };

      const result = await source.validate(config);
      expect(result.valid).toBe(false);
    });

    it('should accept valid URL', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const config: SourceConfig = {
        id: '1', name: 'Test', type: 'rss', enabled: true, schedule: '1h',
        config: { url: 'https://example.com/feed.xml' },
      };

      const result = await source.validate(config);
      expect(result.valid).toBe(true);
    });
  });

  describe('fetch', () => {
    it('should fetch and parse RSS feed', async () => {
      const rssXml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>Test Article</title>
              <link>https://example.com/1</link>
              <description>Content</description>
              <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(rssXml),
      });

      const config: SourceConfig = {
        id: 'source-1', name: 'Test', type: 'rss', enabled: true, schedule: '1h',
        config: { url: 'https://example.com/feed.xml' },
      };

      const result = await source.fetch(config);

      expect(result.success).toBe(true);
      expect(result.articles).toHaveLength(1);
      expect(result.articles[0].title).toBe('Test Article');
      expect(result.articles[0].sourceId).toBe('source-1');
    });

    it('should handle fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const config: SourceConfig = {
        id: '1', name: 'Test', type: 'rss', enabled: true, schedule: '1h',
        config: { url: 'https://example.com/feed.xml' },
      };

      const result = await source.fetch(config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('getConfigSchema', () => {
    it('should return valid JSON schema', () => {
      const schema = source.getConfigSchema();

      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('url');
      expect(schema.required).toContain('url');
    });
  });
});
