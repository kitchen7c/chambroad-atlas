import * as path from 'path';
import * as os from 'os';
import { getFormatter } from './formatters';
import type { ExportFormat, ExportConfig, ExportResult, ArticleExportData } from './types';

export class ExportService {
  private config: ExportConfig;

  constructor(config: Partial<ExportConfig> = {}) {
    this.config = {
      outputDir: config.outputDir || '~/Atlas/exports',
      formats: {
        markdown: { includeMetadata: true, includeSummary: true },
        pdf: { pageSize: 'a4', includeHeader: true, includeFooter: true, fontSize: 12 },
        html: { standalone: true, includeStyles: true },
        json: { pretty: true, includeContent: true },
        csv: { delimiter: ',', includeHeaders: true, fields: ['title', 'source', 'url', 'tags', 'score', 'publishedAt'] },
        ...config.formats,
      },
      dailyBrief: {
        enabled: false,
        time: '08:00',
        format: 'markdown',
        folder: 'daily',
        maxItems: 10,
        minScore: 5,
        ...config.dailyBrief,
      },
    };
  }

  /**
   * Export a single article
   */
  async exportArticle(
    article: ArticleExportData,
    format: ExportFormat,
    outputPath?: string
  ): Promise<ExportResult> {
    const formatter = getFormatter(format);
    const outPath = outputPath || this.resolveOutputDir();

    return formatter.exportOne(article, { outputPath: outPath });
  }

  /**
   * Export multiple articles to a single file
   */
  async exportArticles(
    articles: ArticleExportData[],
    format: ExportFormat,
    outputPath?: string
  ): Promise<ExportResult> {
    const formatter = getFormatter(format);
    const outPath = outputPath || this.resolveOutputDir();

    return formatter.exportMany(articles, { outputPath: outPath });
  }

  /**
   * Export each article as a separate file
   */
  async exportArticlesSeparate(
    articles: ArticleExportData[],
    format: ExportFormat,
    outputPath?: string
  ): Promise<ExportResult[]> {
    const results: ExportResult[] = [];

    for (const article of articles) {
      const result = await this.exportArticle(article, format, outputPath);
      results.push(result);
    }

    return results;
  }

  /**
   * Create a full backup in JSON format
   */
  async backup(articles: ArticleExportData[], outputPath?: string): Promise<ExportResult> {
    const formatter = getFormatter('json');
    const outPath = outputPath || path.join(this.resolveOutputDir(), 'backups');

    const result = await formatter.exportMany(articles, { outputPath: outPath });

    // Rename to backup format
    if (result.success && result.filepath) {
      const fs = await import('fs/promises');
      const date = new Date().toISOString().split('T')[0];
      const backupPath = path.join(path.dirname(result.filepath), `backup-${date}.json`);
      await fs.rename(result.filepath, backupPath);
      result.filepath = backupPath;
    }

    return result;
  }

  /**
   * Get content without saving (for preview)
   */
  preview(article: ArticleExportData, format: ExportFormat): string | Buffer {
    const formatter = getFormatter(format);
    return formatter.render(article);
  }

  /**
   * Get config
   */
  getConfig(): ExportConfig {
    return this.config;
  }

  /**
   * Update config
   */
  setConfig(config: Partial<ExportConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private resolveOutputDir(): string {
    let dir = this.config.outputDir;

    // Expand ~ to home directory
    if (dir.startsWith('~')) {
      dir = path.join(os.homedir(), dir.slice(1));
    }

    return dir;
  }
}
