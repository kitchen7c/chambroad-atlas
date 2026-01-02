import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Scheduler, parseSchedule } from './scheduler';
import { db } from '../storage/db';

describe('parseSchedule', () => {
  it('should parse minutes', () => {
    expect(parseSchedule('30m')).toBe(30 * 60 * 1000);
  });

  it('should parse hours', () => {
    expect(parseSchedule('2h')).toBe(2 * 60 * 60 * 1000);
  });

  it('should parse days', () => {
    expect(parseSchedule('1d')).toBe(24 * 60 * 60 * 1000);
  });

  it('should default to 1h for invalid format', () => {
    expect(parseSchedule('invalid')).toBe(60 * 60 * 1000);
  });
});

describe('Scheduler', () => {
  let scheduler: Scheduler;

  beforeEach(async () => {
    scheduler = new Scheduler();
    await db.articles.clear();
    await db.sources.clear();
  });

  afterEach(() => {
    scheduler.stop();
  });

  it('should fetch source manually', async () => {
    // 添加测试源
    await db.sources.add({
      id: 'test-source',
      name: 'Test',
      type: 'rss',
      enabled: true,
      schedule: '1h',
      config: JSON.stringify({ url: 'https://example.com/feed.xml' }),
    });

    // Mock fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(`
        <rss version="2.0">
          <channel>
            <item>
              <title>Test</title>
              <link>https://example.com/1</link>
              <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>
      `),
    });
    global.fetch = mockFetch;

    const result = await scheduler.fetchNow('test-source');

    expect(result.count).toBe(1);
    expect(result.error).toBeUndefined();

    // 验证文章已存储
    const articles = await db.articles.toArray();
    expect(articles).toHaveLength(1);
  });

  it('should not duplicate articles', async () => {
    await db.sources.add({
      id: 'test-source',
      name: 'Test',
      type: 'rss',
      enabled: true,
      schedule: '1h',
      config: JSON.stringify({ url: 'https://example.com/feed.xml' }),
    });

    const rssXml = `
      <rss version="2.0">
        <channel>
          <item>
            <title>Same Article</title>
            <link>https://example.com/same</link>
            <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>
    `;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(rssXml),
    });

    // 抓取两次
    await scheduler.fetchNow('test-source');
    await scheduler.fetchNow('test-source');

    // 应该只有一条
    const articles = await db.articles.toArray();
    expect(articles).toHaveLength(1);
  });
});
