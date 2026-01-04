import type { ArticleExportData, ExportResult } from '../types';

export interface ExportOptions {
  outputPath: string;
  [key: string]: unknown;
}

export interface Formatter {
  /** Format name */
  readonly format: string;

  /** File extension */
  readonly extension: string;

  /** Export a single article */
  exportOne(article: ArticleExportData, options: ExportOptions): Promise<ExportResult>;

  /** Export multiple articles */
  exportMany(articles: ArticleExportData[], options: ExportOptions): Promise<ExportResult>;

  /** Generate content without saving */
  render(article: ArticleExportData): string | Buffer;

  /** Generate content for multiple articles */
  renderMany(articles: ArticleExportData[]): string | Buffer;
}

export abstract class BaseFormatter implements Formatter {
  abstract readonly format: string;
  abstract readonly extension: string;

  abstract render(article: ArticleExportData): string | Buffer;
  abstract renderMany(articles: ArticleExportData[]): string | Buffer;

  async exportOne(article: ArticleExportData, options: ExportOptions): Promise<ExportResult> {
    try {
      const content = this.render(article);
      const filename = this.generateFilename(article);
      const filepath = `${options.outputPath}/${filename}`;

      await this.writeFile(filepath, content);

      return {
        success: true,
        filepath,
        format: this.format as ExportResult['format'],
        articleCount: 1,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        format: this.format as ExportResult['format'],
        articleCount: 0,
      };
    }
  }

  async exportMany(articles: ArticleExportData[], options: ExportOptions): Promise<ExportResult> {
    try {
      const content = this.renderMany(articles);
      const filename = this.generateBatchFilename();
      const filepath = `${options.outputPath}/${filename}`;

      await this.writeFile(filepath, content);

      return {
        success: true,
        filepath,
        format: this.format as ExportResult['format'],
        articleCount: articles.length,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        format: this.format as ExportResult['format'],
        articleCount: 0,
      };
    }
  }

  protected generateFilename(article: ArticleExportData): string {
    const date = new Date().toISOString().split('T')[0];
    const slug = this.slugify(article.title);
    return `${date}-${slug}.${this.extension}`;
  }

  protected generateBatchFilename(): string {
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toISOString().split('T')[1].slice(0, 5).replace(':', '');
    return `export-${date}-${time}.${this.extension}`;
  }

  protected slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50);
  }

  protected async writeFile(filepath: string, content: string | Buffer): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    // Ensure directory exists
    const dir = path.dirname(filepath);
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(filepath, content, typeof content === 'string' ? 'utf-8' : undefined);
  }
}
