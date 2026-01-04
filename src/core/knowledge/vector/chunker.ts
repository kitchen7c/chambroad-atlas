export interface ChunkerOptions {
  maxTokens: number;
  overlap: number;
}

export class TextChunker {
  private maxTokens: number;
  private overlap: number;

  constructor(options: ChunkerOptions = { maxTokens: 512, overlap: 50 }) {
    this.maxTokens = options.maxTokens;
    this.overlap = options.overlap;
  }

  /**
   * Simple token estimation (4 chars ≈ 1 token)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Split text into overlapping chunks
   */
  chunk(text: string): string[] {
    const sentences = this.splitSentences(text);
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentTokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokens(sentence);

      if (currentTokens + sentenceTokens > this.maxTokens && currentChunk.length > 0) {
        // Save current chunk
        chunks.push(currentChunk.join(' '));

        // Keep overlap sentences
        const overlapSentences: string[] = [];
        let overlapTokens = 0;

        for (let i = currentChunk.length - 1; i >= 0; i--) {
          const tokens = this.estimateTokens(currentChunk[i]);
          if (overlapTokens + tokens <= this.overlap) {
            overlapSentences.unshift(currentChunk[i]);
            overlapTokens += tokens;
          } else {
            break;
          }
        }

        currentChunk = overlapSentences;
        currentTokens = overlapTokens;
      }

      currentChunk.push(sentence);
      currentTokens += sentenceTokens;
    }

    // Add remaining chunk
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }

    return chunks;
  }

  /**
   * Split text into sentences
   */
  private splitSentences(text: string): string[] {
    // Simple sentence splitting on . ! ?
    return text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
}
