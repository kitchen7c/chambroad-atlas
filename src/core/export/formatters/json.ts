import { BaseFormatter } from './base';
import type { ArticleExportData } from '../types';

export interface JsonOptions {
  pretty?: boolean;
  includeContent?: boolean;
}

export class JsonFormatter extends BaseFormatter {
  readonly format = 'json';
  readonly extension = 'json';

  private options: JsonOptions;

  constructor(options: JsonOptions = {}) {
    super();
    this.options = {
      pretty: true,
      includeContent: true,
      ...options,
    };
  }

  render(article: ArticleExportData): string {
    const data = this.options.includeContent
      ? article
      : { ...article, content: undefined };

    return this.options.pretty
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);
  }

  renderMany(articles: ArticleExportData[]): string {
    const data = {
      exportedAt: new Date().toISOString(),
      count: articles.length,
      articles: articles.map(a =>
        this.options.includeContent ? a : { ...a, content: undefined }
      ),
    };

    return this.options.pretty
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);
  }
}
