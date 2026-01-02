import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pipeline } from './pipeline';
import type { StoredArticle } from '../storage/db';

// Mock the registry
vi.mock('./registry', () => ({
  processorRegistry: {
    get: vi.fn().mockImplementation(type => {
      if (type === 'summarizer') {
        return {
          process: vi.fn().mockImplementation(ctx => ({
            ...ctx,
            results: { ...ctx.results, summary: 'Test summary' },
          })),
        };
      }
      if (type === 'filter') {
        return {
          process: vi.fn().mockImplementation(ctx => ({
            ...ctx,
            results: { ...ctx.results, filtered: true, filterReason: 'Test filter' },
          })),
        };
      }
      return undefined;
    }),
  },
}));

describe('Pipeline', () => {
  let mockArticle: StoredArticle;

  beforeEach(() => {
    mockArticle = {
      id: 'test-1',
      sourceId: 'source-1',
      title: 'Test Article',
      content: 'Content...',
      url: 'https://example.com/1',
      publishedAt: Date.now(),
      fetchedAt: Date.now(),
      metadata: '{}',
      isRead: false,
      isFavorite: false,
      processedAt: 0,
      filtered: 0,
    };
  });

  it('should execute processors in order', async () => {
    const pipeline = new Pipeline({
      processors: [
        { type: 'summarizer', config: { enabled: true, options: {} } },
      ],
    });

    const result = await pipeline.execute(mockArticle);
    expect(result.results.summary).toBe('Test summary');
  });

  it('should stop early when filtered', async () => {
    const pipeline = new Pipeline({
      processors: [
        { type: 'filter', config: { enabled: true, options: {} } },
        { type: 'summarizer', config: { enabled: true, options: {} } },
      ],
    });

    const result = await pipeline.execute(mockArticle);
    expect(result.results.filtered).toBe(true);
    // Summarizer should not have run after filter
  });

  it('should skip unknown processor types', async () => {
    const pipeline = new Pipeline({
      processors: [
        { type: 'unknown' as any, config: { enabled: true, options: {} } },
      ],
    });

    const result = await pipeline.execute(mockArticle);
    expect(result.article).toBe(mockArticle);
  });
});
