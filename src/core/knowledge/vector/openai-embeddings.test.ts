import { describe, it, expect, vi } from 'vitest';
import { OpenAIEmbeddings } from './openai-embeddings';

// Mock fetch
global.fetch = vi.fn();

describe('OpenAIEmbeddings', () => {
  it('should have correct dimensions for text-embedding-3-small', () => {
    const embeddings = new OpenAIEmbeddings('test-key', 'text-embedding-3-small');
    expect(embeddings.dimensions).toBe(1536);
  });

  it('should call OpenAI API with correct parameters', async () => {
    const mockResponse = {
      data: [{ embedding: new Array(1536).fill(0.1) }],
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const embeddings = new OpenAIEmbeddings('test-key');
    const result = await embeddings.embed('test text');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/embeddings',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-key',
        }),
      })
    );
    expect(result).toHaveLength(1536);
  });
});
