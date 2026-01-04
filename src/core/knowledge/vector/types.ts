import { z } from 'zod';

// Vector search configuration
export const VectorConfigSchema = z.object({
  enabled: z.boolean().default(true),
  provider: z.enum(['openai', 'local']).default('openai'),
  model: z.string().default('text-embedding-3-small'),
  storagePath: z.string().default('.atlas/vectors'),

  chunking: z.object({
    maxTokens: z.number().default(512),
    overlap: z.number().default(50),
  }).default({}),

  search: z.object({
    topK: z.number().default(10),
    minScore: z.number().default(0.7),
  }).default({}),
});

export type VectorConfig = z.infer<typeof VectorConfigSchema>;

// Vector record stored in database
export interface VectorRecord {
  id: string;
  articleId: string;
  filepath: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
  metadata: {
    title: string;
    source?: string;
    tags: string[];
    createdAt: number;
  };
}

// Search result
export interface VectorSearchResult {
  id: string;
  articleId: string;
  filepath: string;
  title: string;
  score: number;
  snippet: string;
}

// Embedding provider interface
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  dimensions: number;
}
