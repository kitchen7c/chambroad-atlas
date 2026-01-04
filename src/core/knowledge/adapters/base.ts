import type { MarkdownArticle } from '../types';

export interface NoteToolAdapter {
  /** Format an article for this tool */
  formatArticle(article: MarkdownArticle): string;

  /** Parse an article from this tool's format */
  parseArticle(content: string, filepath: string): MarkdownArticle;

  /** Format a wiki link */
  formatLink(title: string, path?: string): string;

  /** Format tags */
  formatTags(tags: string[]): string;

  /** Get file extension */
  getExtension(): string;
}

export abstract class BaseAdapter implements NoteToolAdapter {
  abstract formatArticle(article: MarkdownArticle): string;
  abstract parseArticle(content: string, filepath: string): MarkdownArticle;
  abstract formatLink(title: string, path?: string): string;
  abstract formatTags(tags: string[]): string;

  getExtension(): string {
    return '.md';
  }
}
