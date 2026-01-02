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
      };

      await db.articles.add(article);
      const retrieved = await db.articles.get('test-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe('Test Article');
    });

    it('should query unread articles', async () => {
      await db.articles.bulkAdd([
        { id: '1', sourceId: 's1', title: 'Read', content: '', url: '', publishedAt: 1, fetchedAt: 1, metadata: '{}', isRead: true, isFavorite: false },
        { id: '2', sourceId: 's1', title: 'Unread', content: '', url: '', publishedAt: 2, fetchedAt: 2, metadata: '{}', isRead: false, isFavorite: false },
      ]);

      const unread = await db.articles.filter(a => !a.isRead).toArray();
      expect(unread).toHaveLength(1);
      expect(unread[0].title).toBe('Unread');
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
