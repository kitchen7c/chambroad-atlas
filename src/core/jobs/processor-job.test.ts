import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProcessorJob } from './processor-job';
import { db } from '../storage/db';

vi.mock('../processors/pipeline', () => ({
  Pipeline: class MockPipeline {
    execute = vi.fn().mockResolvedValue({
      article: {},
      results: { summary: 'Test', tags: ['tech'], score: 8, filtered: false },
    });
  },
}));

describe('ProcessorJob', () => {
  let job: ProcessorJob;

  beforeEach(async () => {
    await db.articles.clear();
    await db.sources.clear();

    job = new ProcessorJob({
      batchSize: 10,
      intervalMs: 60000,
      defaultPipeline: {
        processors: [
          { type: 'summarizer', config: { enabled: true, options: {} } },
        ],
      },
    });
  });

  afterEach(() => {
    job.stop();
  });

  it('should process unprocessed articles', async () => {
    await db.articles.add({
      id: 'test-1',
      sourceId: 'source-1',
      title: 'Test',
      content: 'Content',
      url: 'https://example.com/1',
      publishedAt: Date.now(),
      fetchedAt: Date.now(),
      metadata: '{}',
      isRead: false,
      isFavorite: false,
      processedAt: 0,
      filtered: 0,
    });

    const result = await job.processNextBatch();
    expect(result.processed).toBe(1);

    const article = await db.articles.get('test-1');
    expect(article?.processedAt).toBeGreaterThan(0);
  });

  it('should skip already processed articles', async () => {
    await db.articles.add({
      id: 'test-1',
      sourceId: 'source-1',
      title: 'Test',
      content: 'Content',
      url: 'https://example.com/1',
      publishedAt: Date.now(),
      fetchedAt: Date.now(),
      metadata: '{}',
      isRead: false,
      isFavorite: false,
      processedAt: Date.now(), // Already processed
      filtered: 0,
    });

    const result = await job.processNextBatch();
    expect(result.processed).toBe(0);
  });

  it('should process single article on demand', async () => {
    await db.articles.add({
      id: 'test-1',
      sourceId: 'source-1',
      title: 'Test',
      content: 'Content',
      url: 'https://example.com/1',
      publishedAt: Date.now(),
      fetchedAt: Date.now(),
      metadata: '{}',
      isRead: false,
      isFavorite: false,
      processedAt: 0,
      filtered: 0,
    });

    const result = await job.processOne('test-1');
    expect(result?.results.summary).toBe('Test');
  });
});
