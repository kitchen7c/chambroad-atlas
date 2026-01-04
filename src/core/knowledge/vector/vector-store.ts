import { connect, type Table } from '@lancedb/lancedb';
import type { VectorRecord, VectorSearchResult, EmbeddingProvider, VectorConfig } from './types';
import { TextChunker } from './chunker';
import type { MarkdownArticle } from '../types';

export class VectorStore {
  private dbPath: string;
  private embeddings: EmbeddingProvider;
  private chunker: TextChunker;
  private config: VectorConfig;
  private table: Table | null = null;
  private tableName = 'articles';

  constructor(
    dbPath: string,
    embeddings: EmbeddingProvider,
    config: Partial<VectorConfig> = {}
  ) {
    this.dbPath = dbPath;
    this.embeddings = embeddings;
    this.config = {
      enabled: true,
      provider: 'openai',
      model: 'text-embedding-3-small',
      storagePath: '.atlas/vectors',
      chunking: { maxTokens: 512, overlap: 50 },
      search: { topK: 10, minScore: 0.7 },
      ...config,
    };
    this.chunker = new TextChunker(this.config.chunking);
  }

  /**
   * Initialize the database connection
   */
  async init(): Promise<void> {
    const db = await connect(this.dbPath);

    try {
      this.table = await db.openTable(this.tableName);
    } catch {
      // Table doesn't exist, will be created on first insert
      this.table = null;
    }
  }

  /**
   * Index an article
   */
  async indexArticle(article: MarkdownArticle): Promise<void> {
    const { frontmatter, content, filepath } = article;

    // Combine title, summary, and content for embedding
    const fullText = [
      frontmatter.title,
      frontmatter.summary || '',
      content,
    ].filter(Boolean).join('\n\n');

    // Chunk the text
    const chunks = this.chunker.chunk(fullText);

    // Generate embeddings
    const embeddings = await this.embeddings.embedBatch(chunks);

    // Create records
    const records: VectorRecord[] = chunks.map((chunk, index) => ({
      id: `${frontmatter.id}-${index}`,
      articleId: frontmatter.id,
      filepath,
      chunkIndex: index,
      content: chunk,
      embedding: embeddings[index],
      metadata: {
        title: frontmatter.title,
        source: frontmatter.source,
        tags: frontmatter.tags,
        createdAt: Date.now(),
      },
    }));

    // Insert into database
    const db = await connect(this.dbPath);

    // Convert to plain objects for LanceDB
    const plainRecords = records.map(r => ({ ...r })) as Record<string, unknown>[];

    if (!this.table) {
      this.table = await db.createTable(this.tableName, plainRecords);
    } else {
      // Remove existing records for this article
      await this.removeArticle(frontmatter.id);
      await this.table.add(plainRecords);
    }
  }

  /**
   * Remove an article from the index
   */
  async removeArticle(articleId: string): Promise<void> {
    if (!this.table) return;

    await this.table.delete(`articleId = "${articleId}"`);
  }

  /**
   * Search for similar content
   */
  async search(query: string, options?: {
    topK?: number;
    filter?: { tags?: string[]; source?: string };
  }): Promise<VectorSearchResult[]> {
    if (!this.table) {
      return [];
    }

    const topK = options?.topK || this.config.search.topK;

    // Generate query embedding
    const queryEmbedding = await this.embeddings.embed(query);

    // Search
    let searchQuery = this.table.search(queryEmbedding).limit(topK);

    // Apply filters if provided
    if (options?.filter?.source) {
      searchQuery = searchQuery.where(`metadata.source = "${options.filter.source}"`);
    }

    const results = await searchQuery.toArray();

    // Convert to search results
    return results
      .filter((r: { _distance?: number }) => (r._distance ?? 0) <= (1 - this.config.search.minScore))
      .map((r: VectorRecord & { _distance?: number }) => ({
        id: r.id,
        articleId: r.articleId,
        filepath: r.filepath,
        title: r.metadata.title,
        score: 1 - (r._distance ?? 0), // Convert distance to similarity
        snippet: r.content.slice(0, 200) + '...',
      }));
  }

  /**
   * Find similar articles
   */
  async findSimilar(articleId: string, topK: number = 5): Promise<VectorSearchResult[]> {
    if (!this.table) {
      return [];
    }

    // Get the article's first chunk embedding
    const results = await this.table
      .query()
      .where(`articleId = "${articleId}" AND chunkIndex = 0`)
      .limit(1)
      .toArray();

    if (results.length === 0) {
      return [];
    }

    // Search using that embedding, excluding the same article
    const embedding = (results[0] as VectorRecord).embedding;
    const similar = await this.table
      .search(embedding)
      .where(`articleId != "${articleId}"`)
      .limit(topK)
      .toArray();

    // Deduplicate by articleId
    const seen = new Set<string>();
    return similar
      .filter((r: { articleId: string }) => {
        if (seen.has(r.articleId)) return false;
        seen.add(r.articleId);
        return true;
      })
      .map((r: VectorRecord & { _distance?: number }) => ({
        id: r.id,
        articleId: r.articleId,
        filepath: r.filepath,
        title: r.metadata.title,
        score: 1 - (r._distance ?? 0),
        snippet: r.content.slice(0, 200) + '...',
      }));
  }
}
