import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Summarizer } from './index';
import type { ProcessContext } from '../types';
import type { StoredArticle } from '../../storage/db';

// Mock LLMClient
vi.mock('../../llm/client', () => ({
  LLMClient: class MockLLMClient {
    chat = vi.fn().mockResolvedValue({ content: 'Test summary' });
  },
}));

describe('Summarizer', () => {
  let summarizer: Summarizer;
  let mockArticle: StoredArticle;

  beforeEach(() => {
    summarizer = new Summarizer();
    mockArticle = {
      id: 'test-1',
      sourceId: 'source-1',
      title: 'Test Article',
      content: 'This is a long article content that needs to be summarized...',
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

  it('should have type summarizer', () => {
    expect(summarizer.type).toBe('summarizer');
  });

  it('should skip processing when disabled', async () => {
    const ctx: ProcessContext = { article: mockArticle, results: {} };
    const result = await summarizer.process(ctx, { enabled: false, options: {} });

    expect(result.results.summary).toBeUndefined();
  });

  it('should generate summary when enabled', async () => {
    const ctx: ProcessContext = { article: mockArticle, results: {} };
    const result = await summarizer.process(ctx, {
      enabled: true,
      options: { maxLength: 200, language: 'zh', llmConfig: { provider: 'google', baseUrl: 'http://test', apiKey: 'key', model: 'test' } },
    });

    expect(result.results.summary).toBe('Test summary');
  });

  it('should return valid config schema', () => {
    const schema = summarizer.getConfigSchema();
    expect(schema.type).toBe('object');
    expect(schema.properties).toHaveProperty('maxLength');
    expect(schema.properties).toHaveProperty('language');
  });
});
