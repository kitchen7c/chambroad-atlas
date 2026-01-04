import { BaseFormatter } from './base';
import type { ArticleExportData } from '../types';

export interface CsvOptions {
  delimiter?: string;
  includeHeaders?: boolean;
  fields?: string[];
}

const DEFAULT_FIELDS = ['title', 'source', 'url', 'author', 'tags', 'score', 'publishedAt', 'isRead', 'isFavorite'];

export class CsvFormatter extends BaseFormatter {
  readonly format = 'csv';
  readonly extension = 'csv';

  private options: CsvOptions;

  constructor(options: CsvOptions = {}) {
    super();
    this.options = {
      delimiter: ',',
      includeHeaders: true,
      fields: DEFAULT_FIELDS,
      ...options,
    };
  }

  render(article: ArticleExportData): string {
    const lines: string[] = [];

    if (this.options.includeHeaders) {
      lines.push(this.options.fields!.join(this.options.delimiter));
    }

    lines.push(this.formatRow(article));

    return lines.join('\n');
  }

  renderMany(articles: ArticleExportData[]): string {
    const lines: string[] = [];

    if (this.options.includeHeaders) {
      lines.push(this.options.fields!.join(this.options.delimiter));
    }

    for (const article of articles) {
      lines.push(this.formatRow(article));
    }

    return lines.join('\n');
  }

  private formatRow(article: ArticleExportData): string {
    return this.options.fields!.map(field => {
      const value = this.getValue(article, field);
      return this.escapeValue(value);
    }).join(this.options.delimiter);
  }

  private getValue(article: ArticleExportData, field: string): string {
    const value = (article as unknown as Record<string, unknown>)[field];

    if (value === undefined || value === null) {
      return '';
    }

    if (Array.isArray(value)) {
      return value.join('; ');
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    return String(value);
  }

  private escapeValue(value: string): string {
    // Escape quotes and wrap in quotes if contains delimiter, quotes, or newlines
    if (value.includes(this.options.delimiter!) || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
