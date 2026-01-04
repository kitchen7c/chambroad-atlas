import { FileStorage } from './file-storage';
import { VectorStore, OpenAIEmbeddings } from './vector';
import { getAdapter } from './adapters';
import type {
  KnowledgeConfig,
  MarkdownArticle,
  ArticleFrontmatter,
  NoteTool,
} from './types';
import type { VectorSearchResult } from './vector/types';
import * as path from 'path';

export interface KnowledgeBaseOptions {
  config: KnowledgeConfig;
  openaiApiKey?: string;
}

export class KnowledgeBase {
  private config: KnowledgeConfig;
  private storage: FileStorage;
  private vectorStore: VectorStore | null = null;
  // Adapter for tool-specific formatting (for future use)
  private _adapter;

  constructor(options: KnowledgeBaseOptions) {
    this.config = options.config;
    this.storage = new FileStorage(options.config.vaultPath, options.config);
    this._adapter = getAdapter(options.config.tool);

    // Initialize vector store if API key provided
    if (options.openaiApiKey) {
      const vectorPath = path.join(options.config.vaultPath, '.atlas', 'vectors');
      const embeddings = new OpenAIEmbeddings(options.openaiApiKey);
      this.vectorStore = new VectorStore(vectorPath, embeddings);
    }
  }

  /**
   * Initialize the knowledge base
   */
  async init(): Promise<void> {
    if (this.vectorStore) {
      await this.vectorStore.init();
    }
  }

  /**
   * Save a new article
   */
  async saveArticle(article: MarkdownArticle): Promise<string> {
    const filepath = await this.storage.saveArticle(article, 'inbox');

    // Index in vector store
    if (this.vectorStore) {
      await this.vectorStore.indexArticle({ ...article, filepath });
    }

    return filepath;
  }

  /**
   * Create article from raw data
   */
  async createArticle(data: {
    title: string;
    content: string;
    source?: string;
    url?: string;
    author?: string;
    tags?: string[];
    summary?: string;
  }): Promise<string> {
    const frontmatter: ArticleFrontmatter = {
      id: this.generateId(),
      title: data.title,
      source: data.source,
      url: data.url,
      author: data.author,
      tags: data.tags || [],
      isRead: false,
      isFavorite: false,
      summary: data.summary,
      publishedAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
    };

    const article: MarkdownArticle = {
      frontmatter,
      content: data.content,
      filepath: '',
    };

    return this.saveArticle(article);
  }

  /**
   * Get an article by filepath
   */
  async getArticle(filepath: string): Promise<MarkdownArticle> {
    return this.storage.readArticle(filepath);
  }

  /**
   * Update an article
   */
  async updateArticle(article: MarkdownArticle): Promise<void> {
    await this.storage.updateArticle(article);

    // Re-index in vector store
    if (this.vectorStore) {
      await this.vectorStore.indexArticle(article);
    }
  }

  /**
   * Delete an article
   */
  async deleteArticle(filepath: string): Promise<void> {
    const article = await this.storage.readArticle(filepath);
    await this.storage.deleteArticle(filepath);

    if (this.vectorStore) {
      await this.vectorStore.removeArticle(article.frontmatter.id);
    }
  }

  /**
   * Archive an article
   */
  async archiveArticle(filepath: string): Promise<string> {
    return this.storage.archiveArticle(filepath);
  }

  /**
   * List all articles
   */
  async listArticles(folder?: string): Promise<MarkdownArticle[]> {
    const filepaths = await this.storage.listArticles(folder);
    const articles: MarkdownArticle[] = [];

    for (const fp of filepaths) {
      try {
        const article = await this.storage.readArticle(fp);
        articles.push(article);
      } catch {
        // Skip invalid files
      }
    }

    return articles;
  }

  /**
   * Find articles by query
   */
  async findArticles(query: {
    tags?: string[];
    isRead?: boolean;
    isFavorite?: boolean;
    source?: string;
  }): Promise<MarkdownArticle[]> {
    return this.storage.findArticles(query);
  }

  /**
   * Semantic search
   */
  async search(query: string, options?: {
    topK?: number;
    filter?: { tags?: string[]; source?: string };
  }): Promise<VectorSearchResult[]> {
    if (!this.vectorStore) {
      throw new Error('Vector search not available. Please configure OpenAI API key.');
    }
    return this.vectorStore.search(query, options);
  }

  /**
   * Find similar articles
   */
  async findSimilar(articleId: string, topK?: number): Promise<VectorSearchResult[]> {
    if (!this.vectorStore) {
      throw new Error('Vector search not available. Please configure OpenAI API key.');
    }
    return this.vectorStore.findSimilar(articleId, topK);
  }

  /**
   * Re-index all articles
   */
  async reindexAll(): Promise<{ indexed: number; errors: number }> {
    if (!this.vectorStore) {
      throw new Error('Vector search not available.');
    }

    const articles = await this.listArticles();
    let indexed = 0;
    let errors = 0;

    for (const article of articles) {
      try {
        await this.vectorStore.indexArticle(article);
        indexed++;
      } catch (error) {
        console.error(`Failed to index ${article.filepath}:`, error);
        errors++;
      }
    }

    return { indexed, errors };
  }

  /**
   * Get configuration
   */
  getConfig(): KnowledgeConfig {
    return this.config;
  }

  /**
   * Get the current note tool adapter
   */
  getAdapter() {
    return this._adapter;
  }

  /**
   * Change note tool
   */
  setTool(tool: NoteTool): void {
    this.config.tool = tool;
    this._adapter = getAdapter(tool);
  }

  private generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
