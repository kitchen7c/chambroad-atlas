import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Classifier } from './index';
import type { ProcessContext } from '../types';
import type { StoredArticle } from '../../storage/db';

vi.mock('../../llm/client', () => ({
  LLMClient: class MockLLMClient {
    chat = vi.fn().mockResolvedValue({ content: 'tech, ai' });
  },
}));

describe('Classifier', () => {
  let classifier: Classifier;
  let mockArticle: StoredArticle;

  beforeEach(() => {
    classifier = new Classifier();
    mockArticle = {
      id: 'test-1',
      sourceId: 'source-1',
      title: 'AI News',
      content: 'Article about artificial intelligence...',
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

  it('should have type classifier', () => {
    expect(classifier.type).toBe('classifier');
  });

  it('should skip processing when disabled', async () => {
    const ctx: ProcessContext = { article: mockArticle, results: {} };
    const result = await classifier.process(ctx, { enabled: false, options: {} });

    expect(result.results.tags).toBeUndefined();
  });

  it('should classify article with tags', async () => {
    const ctx: ProcessContext = { article: mockArticle, results: {} };
    const result = await classifier.process(ctx, {
      enabled: true,
      options: {
        categories: ['tech', 'ai', 'finance', 'health'],
        maxTags: 3,
        llmConfig: { provider: 'google', baseUrl: 'http://test', apiKey: 'key', model: 'test' },
      },
    });

    expect(result.results.tags).toContain('tech');
    expect(result.results.tags).toContain('ai');
  });

  it('should return valid config schema', () => {
    const schema = classifier.getConfigSchema();
    expect(schema.type).toBe('object');
    expect(schema.properties).toHaveProperty('categories');
    expect(schema.required).toContain('categories');
  });
});
