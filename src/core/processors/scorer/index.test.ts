import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Scorer } from './index';
import type { ProcessContext } from '../types';
import type { StoredArticle } from '../../storage/db';

vi.mock('../../llm/client', () => ({
  LLMClient: class MockLLMClient {
    chat = vi.fn().mockResolvedValue({ content: '8' });
  },
}));

describe('Scorer', () => {
  let scorer: Scorer;
  let mockArticle: StoredArticle;

  beforeEach(() => {
    scorer = new Scorer();
    mockArticle = {
      id: 'test-1',
      sourceId: 'source-1',
      title: 'Important News',
      content: 'Very important content...',
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

  it('should have type scorer', () => {
    expect(scorer.type).toBe('scorer');
  });

  it('should skip processing when disabled', async () => {
    const ctx: ProcessContext = { article: mockArticle, results: {} };
    const result = await scorer.process(ctx, { enabled: false, options: {} });

    expect(result.results.score).toBeUndefined();
  });

  it('should score article', async () => {
    const ctx: ProcessContext = { article: mockArticle, results: {} };
    const result = await scorer.process(ctx, {
      enabled: true,
      options: {
        criteria: '内容质量、相关性',
        minScore: 1,
        maxScore: 10,
        llmConfig: { provider: 'google', baseUrl: 'http://test', apiKey: 'key', model: 'test' },
      },
    });

    expect(result.results.score).toBe(8);
  });

  it('should return valid config schema', () => {
    const schema = scorer.getConfigSchema();
    expect(schema.type).toBe('object');
    expect(schema.properties).toHaveProperty('criteria');
  });
});
