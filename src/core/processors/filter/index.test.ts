import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Filter } from './index';
import type { ProcessContext } from '../types';
import type { StoredArticle } from '../../storage/db';

vi.mock('../../llm/client', () => ({
  LLMClient: class MockLLMClient {
    chat = vi.fn().mockResolvedValue({ content: '保留' });
  },
}));

describe('Filter', () => {
  let filter: Filter;
  let mockArticle: StoredArticle;

  beforeEach(() => {
    filter = new Filter();
    mockArticle = {
      id: 'test-1',
      sourceId: 'source-1',
      title: 'Test Article',
      content: 'Article content...',
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

  it('should have type filter', () => {
    expect(filter.type).toBe('filter');
  });

  it('should skip processing when disabled', async () => {
    const ctx: ProcessContext = { article: mockArticle, results: {} };
    const result = await filter.process(ctx, { enabled: false, options: {} });

    expect(result.results.filtered).toBeUndefined();
  });

  it('should filter by score threshold', async () => {
    const ctx: ProcessContext = { article: mockArticle, results: { score: 3 } };
    const result = await filter.process(ctx, {
      enabled: true,
      options: { scoreThreshold: 5 },
    });

    expect(result.results.filtered).toBe(true);
    expect(result.results.filterReason).toContain('低于阈值');
  });

  it('should not filter when score above threshold', async () => {
    const ctx: ProcessContext = { article: mockArticle, results: { score: 8 } };
    const result = await filter.process(ctx, {
      enabled: true,
      options: { scoreThreshold: 5 },
    });

    expect(result.results.filtered).toBeFalsy();
  });

  it('should use LLM for rule-based filtering', async () => {
    const ctx: ProcessContext = { article: mockArticle, results: {} };
    const result = await filter.process(ctx, {
      enabled: true,
      options: {
        rules: '过滤广告内容',
        llmConfig: { provider: 'google', baseUrl: 'http://test', apiKey: 'key', model: 'test' },
      },
    });

    expect(result.results.filtered).toBeFalsy();
  });
});
