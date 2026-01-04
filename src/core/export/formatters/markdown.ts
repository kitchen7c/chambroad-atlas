import { BaseFormatter } from './base';
import type { ArticleExportData } from '../types';

export interface MarkdownOptions {
  includeMetadata?: boolean;
  includeSummary?: boolean;
  template?: string;
}

export class MarkdownFormatter extends BaseFormatter {
  readonly format = 'markdown';
  readonly extension = 'md';

  private options: MarkdownOptions;

  constructor(options: MarkdownOptions = {}) {
    super();
    this.options = {
      includeMetadata: true,
      includeSummary: true,
      ...options,
    };
  }

  render(article: ArticleExportData): string {
    const lines: string[] = [];

    // Frontmatter
    if (this.options.includeMetadata) {
      lines.push('---');
      lines.push(`title: ${article.title}`);
      if (article.source) lines.push(`source: ${article.source}`);
      if (article.url) lines.push(`url: ${article.url}`);
      if (article.author) lines.push(`author: ${article.author}`);
      if (article.publishedAt) lines.push(`publishedAt: ${article.publishedAt}`);
      if (article.tags.length > 0) {
        lines.push('tags:');
        article.tags.forEach(tag => lines.push(`  - ${tag}`));
      }
      if (article.score !== undefined) lines.push(`score: ${article.score}`);
      lines.push(`isRead: ${article.isRead}`);
      lines.push(`isFavorite: ${article.isFavorite}`);
      lines.push('---');
      lines.push('');
    }

    // Title
    lines.push(`# ${article.title}`);
    lines.push('');

    // Metadata line
    const meta: string[] = [];
    if (article.source) meta.push(`Source: ${article.source}`);
    if (article.author) meta.push(`Author: ${article.author}`);
    if (article.publishedAt) {
      const date = new Date(article.publishedAt).toLocaleDateString();
      meta.push(`Date: ${date}`);
    }
    if (meta.length > 0) {
      lines.push(`*${meta.join(' | ')}*`);
      lines.push('');
    }

    // Summary
    if (this.options.includeSummary && article.summary) {
      lines.push('## Summary');
      lines.push('');
      lines.push(article.summary);
      lines.push('');
    }

    // Content
    lines.push('## Content');
    lines.push('');
    lines.push(article.content);
    lines.push('');

    // Tags
    if (article.tags.length > 0) {
      lines.push('---');
      lines.push('');
      lines.push(`Tags: ${article.tags.map(t => `#${t}`).join(' ')}`);
    }

    return lines.join('\n');
  }

  renderMany(articles: ArticleExportData[]): string {
    const sections: string[] = [];

    // Header
    sections.push(`# Export - ${new Date().toLocaleDateString()}`);
    sections.push('');
    sections.push(`Total articles: ${articles.length}`);
    sections.push('');
    sections.push('---');
    sections.push('');

    // Articles
    for (const article of articles) {
      sections.push(this.render(article));
      sections.push('');
      sections.push('---');
      sections.push('');
    }

    return sections.join('\n');
  }
}
