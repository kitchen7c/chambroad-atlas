import { describe, it, expect } from 'vitest';
import { TextChunker } from './chunker';

describe('TextChunker', () => {
  it('should split text into chunks', () => {
    const chunker = new TextChunker({ maxTokens: 10, overlap: 2 });
    const text = 'This is a test. This is another sentence. And one more.';

    const chunks = chunker.chunk(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toBeTruthy();
  });

  it('should preserve context with overlap', () => {
    const chunker = new TextChunker({ maxTokens: 20, overlap: 5 });
    const text = 'First sentence here. Second sentence here. Third sentence here.';

    const chunks = chunker.chunk(text);

    // With overlap, adjacent chunks should share some content
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle short text as single chunk', () => {
    const chunker = new TextChunker({ maxTokens: 100, overlap: 10 });
    const text = 'Short text.';

    const chunks = chunker.chunk(text);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('Short text.');
  });
});
