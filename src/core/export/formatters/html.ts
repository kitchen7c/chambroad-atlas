import { BaseFormatter } from './base';
import type { ArticleExportData } from '../types';

export interface HtmlOptions {
  standalone?: boolean;
  includeStyles?: boolean;
  template?: string;
}

const DEFAULT_STYLES = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333; }
  h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; }
  h2 { color: #555; margin-top: 30px; }
  .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
  .tags { margin-top: 20px; }
  .tag { display: inline-block; background: #f0f0f0; padding: 4px 10px; border-radius: 4px; margin-right: 8px; font-size: 13px; }
  .summary { background: #f9f9f9; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0; }
  .toc { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
  .toc ul { margin: 10px 0 0 20px; }
  .article { border-bottom: 1px solid #eee; padding-bottom: 30px; margin-bottom: 30px; }
  a { color: #2563eb; }
`;

export class HtmlFormatter extends BaseFormatter {
  readonly format = 'html';
  readonly extension = 'html';

  private options: HtmlOptions;

  constructor(options: HtmlOptions = {}) {
    super();
    this.options = {
      standalone: true,
      includeStyles: true,
      ...options,
    };
  }

  render(article: ArticleExportData): string {
    const content = this.renderArticleContent(article);

    if (!this.options.standalone) {
      return content;
    }

    return this.wrapInDocument(article.title, content);
  }

  renderMany(articles: ArticleExportData[]): string {
    const toc = this.renderTableOfContents(articles);
    const content = articles.map((a, i) =>
      `<div class="article" id="article-${i}">${this.renderArticleContent(a)}</div>`
    ).join('\n');

    const title = `Export - ${new Date().toLocaleDateString()}`;
    return this.wrapInDocument(title, toc + content);
  }

  private renderArticleContent(article: ArticleExportData): string {
    const lines: string[] = [];

    lines.push(`<h1>${this.escapeHtml(article.title)}</h1>`);

    // Meta
    const meta: string[] = [];
    if (article.source) meta.push(`Source: ${this.escapeHtml(article.source)}`);
    if (article.author) meta.push(`Author: ${this.escapeHtml(article.author)}`);
    if (article.publishedAt) {
      meta.push(`Date: ${new Date(article.publishedAt).toLocaleDateString()}`);
    }
    if (article.url) {
      meta.push(`<a href="${article.url}" target="_blank">Original</a>`);
    }
    if (meta.length > 0) {
      lines.push(`<p class="meta">${meta.join(' | ')}</p>`);
    }

    // Summary
    if (article.summary) {
      lines.push(`<div class="summary"><strong>Summary:</strong> ${this.escapeHtml(article.summary)}</div>`);
    }

    // Content
    lines.push(`<div class="content">${this.formatContent(article.content)}</div>`);

    // Tags
    if (article.tags.length > 0) {
      lines.push('<div class="tags">');
      article.tags.forEach(tag => {
        lines.push(`<span class="tag">#${this.escapeHtml(tag)}</span>`);
      });
      lines.push('</div>');
    }

    return lines.join('\n');
  }

  private renderTableOfContents(articles: ArticleExportData[]): string {
    const items = articles.map((a, i) =>
      `<li><a href="#article-${i}">${this.escapeHtml(a.title)}</a></li>`
    ).join('\n');

    return `
      <div class="toc">
        <h2>Table of Contents</h2>
        <p>${articles.length} articles</p>
        <ul>${items}</ul>
      </div>
    `;
  }

  private wrapInDocument(title: string, content: string): string {
    const styles = this.options.includeStyles ? `<style>${DEFAULT_STYLES}</style>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  ${styles}
</head>
<body>
  ${content}
</body>
</html>`;
  }

  private formatContent(content: string): string {
    // Basic markdown-like formatting
    return content
      .split('\n\n')
      .map(p => `<p>${this.escapeHtml(p)}</p>`)
      .join('\n');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
