import * as fs from 'fs/promises';
import * as path from 'path';
import { parseMarkdown, stringifyMarkdown, generateFilename } from './markdown-parser';
import type { MarkdownArticle, KnowledgeConfig } from './types';

export class FileStorage {
  private basePath: string;
  private config: Partial<KnowledgeConfig>;

  constructor(basePath: string, config: Partial<KnowledgeConfig> = {}) {
    this.basePath = basePath;
    this.config = {
      inboxFolder: 'Atlas/Inbox',
      dailyFolder: 'Atlas/Daily',
      archiveFolder: 'Atlas/Archive',
      filenameTemplate: '{{date}}-{{slug}}',
      ...config,
    };
  }

  /**
   * Get full path for a folder type
   */
  private getFolderPath(folder: 'inbox' | 'daily' | 'archive'): string {
    const folderMap = {
      inbox: this.config.inboxFolder!,
      daily: this.config.dailyFolder!,
      archive: this.config.archiveFolder!,
    };
    return path.join(this.basePath, folderMap[folder]);
  }

  /**
   * Ensure folder exists
   */
  private async ensureFolder(folderPath: string): Promise<void> {
    await fs.mkdir(folderPath, { recursive: true });
  }

  /**
   * Save an article to a markdown file
   */
  async saveArticle(
    article: MarkdownArticle,
    folder: 'inbox' | 'daily' | 'archive' = 'inbox'
  ): Promise<string> {
    const folderPath = this.getFolderPath(folder);
    await this.ensureFolder(folderPath);

    const filename = generateFilename(
      this.config.filenameTemplate!,
      article.frontmatter
    );
    const filepath = path.join(folderPath, filename);

    const content = stringifyMarkdown(article);
    await fs.writeFile(filepath, content, 'utf-8');

    return filepath;
  }

  /**
   * Read an article from a markdown file
   */
  async readArticle(filepath: string): Promise<MarkdownArticle> {
    const content = await fs.readFile(filepath, 'utf-8');
    return parseMarkdown(content, filepath);
  }

  /**
   * Update an existing article
   */
  async updateArticle(article: MarkdownArticle): Promise<void> {
    if (!article.filepath) {
      throw new Error('Article has no filepath');
    }
    const content = stringifyMarkdown(article);
    await fs.writeFile(article.filepath, content, 'utf-8');
  }

  /**
   * Delete an article
   */
  async deleteArticle(filepath: string): Promise<void> {
    await fs.unlink(filepath);
  }

  /**
   * Move article to archive
   */
  async archiveArticle(filepath: string): Promise<string> {
    const article = await this.readArticle(filepath);
    const newPath = await this.saveArticle(article, 'archive');
    await this.deleteArticle(filepath);
    return newPath;
  }

  /**
   * List all markdown files in base path (recursive)
   */
  async listArticles(subFolder?: string): Promise<string[]> {
    const searchPath = subFolder
      ? path.join(this.basePath, subFolder)
      : this.basePath;

    const files: string[] = [];

    try {
      await this.collectMarkdownFiles(searchPath, files);
    } catch {
      // Folder doesn't exist yet
      return [];
    }

    return files;
  }

  private async collectMarkdownFiles(dir: string, files: string[]): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        await this.collectMarkdownFiles(fullPath, files);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  /**
   * Search articles by frontmatter fields
   */
  async findArticles(query: {
    tags?: string[];
    isRead?: boolean;
    isFavorite?: boolean;
    source?: string;
  }): Promise<MarkdownArticle[]> {
    const files = await this.listArticles();
    const articles: MarkdownArticle[] = [];

    for (const filepath of files) {
      try {
        const article = await this.readArticle(filepath);

        if (this.matchesQuery(article, query)) {
          articles.push(article);
        }
      } catch {
        // Skip invalid files
      }
    }

    return articles;
  }

  private matchesQuery(
    article: MarkdownArticle,
    query: { tags?: string[]; isRead?: boolean; isFavorite?: boolean; source?: string }
  ): boolean {
    const { frontmatter } = article;

    if (query.tags && query.tags.length > 0) {
      const hasTag = query.tags.some(t => frontmatter.tags.includes(t));
      if (!hasTag) return false;
    }

    if (query.isRead !== undefined && frontmatter.isRead !== query.isRead) {
      return false;
    }

    if (query.isFavorite !== undefined && frontmatter.isFavorite !== query.isFavorite) {
      return false;
    }

    if (query.source && frontmatter.source !== query.source) {
      return false;
    }

    return true;
  }
}
