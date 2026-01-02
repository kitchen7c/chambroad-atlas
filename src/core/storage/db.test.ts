import { describe, it, expect, beforeEach } from 'vitest';
import { db, StoredArticle, StoredSource } from './db';

describe('AtlasDB', () => {
  beforeEach(async () => {
    // 清空数据库
    await db.articles.clear();
    await db.sources.clear();
  });

  describe('articles', () => {
    it('should add and retrieve an article', async () => {
      const article: StoredArticle = {
        id: 'test-1',
        sourceId: 'source-1',
        title: 'Test Article',
        content: 'Test content',
        url: 'https://example.com/article',
        publishedAt: Date.now(),
        fetchedAt: Date.now(),
        metadata: '{}',
        isRead: false,
        isFavorite: false,
        processedAt: 0,
        filtered: 0,
      };

      await db.articles.add(article);
      const retrieved = await db.articles.get('test-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe('Test Article');
    });

    it('should query unread articles', async () => {
      await db.articles.bulkAdd([
        { id: '1', sourceId: 's1', title: 'Read', content: '', url: '', publishedAt: 1, fetchedAt: 1, metadata: '{}', isRead: true, isFavorite: false, processedAt: 0, filtered: 0 },
        { id: '2', sourceId: 's1', title: 'Unread', content: '', url: '', publishedAt: 2, fetchedAt: 2, metadata: '{}', isRead: false, isFavorite: false, processedAt: 0, filtered: 0 },
      ]);

      const unread = await db.articles.filter(a => !a.isRead).toArray();
      expect(unread).toHaveLength(1);
      expect(unread[0].title).toBe('Unread');
    });
  });

  describe('articles with processing fields', () => {
    it('should store and query processed articles', async () => {
      const article: StoredArticle = {
        id: 'processed-1',
        sourceId: 'source-1',
        title: 'Processed Article',
        content: 'Content',
        url: 'https://example.com/1',
        publishedAt: Date.now(),
        fetchedAt: Date.now(),
        metadata: '{}',
        isRead: false,
        isFavorite: false,
        processedAt: Date.now(),
        summary: 'AI generated summary',
        tags: '["tech","ai"]',
        score: 8,
        filtered: 0,
      };

      await db.articles.add(article);
      const retrieved = await db.articles.get('processed-1');

      expect(retrieved?.summary).toBe('AI generated summary');
      expect(retrieved?.score).toBe(8);
    });

    it('should query unprocessed articles', async () => {
      await db.articles.bulkAdd([
        { id: '1', sourceId: 's1', title: 'Processed', content: '', url: '', publishedAt: 1, fetchedAt: 1, metadata: '{}', isRead: false, isFavorite: false, processedAt: Date.now(), filtered: 0 },
        { id: '2', sourceId: 's1', title: 'Unprocessed', content: '', url: '', publishedAt: 2, fetchedAt: 2, metadata: '{}', isRead: false, isFavorite: false, processedAt: 0, filtered: 0 },
      ]);

      const unprocessed = await db.articles.where('processedAt').equals(0).toArray();
      expect(unprocessed).toHaveLength(1);
      expect(unprocessed[0].title).toBe('Unprocessed');
    });
  });

  describe('sources', () => {
    it('should add and retrieve a source', async () => {
      const source: StoredSource = {
        id: 'source-1',
        name: 'Test Source',
        type: 'rss',
        enabled: true,
        schedule: '1h',
        config: '{"url":"https://example.com/feed"}',
      };

      await db.sources.add(source);
      const retrieved = await db.sources.get('source-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Source');
    });
  });
});
