import matter from 'gray-matter';
import { BaseAdapter } from './base';
import { ArticleFrontmatterSchema, type MarkdownArticle } from '../types';

export class ObsidianAdapter extends BaseAdapter {
  formatArticle(article: MarkdownArticle): string {
    const { frontmatter, content } = article;

    const fm: Record<string, unknown> = {
      id: frontmatter.id,
      title: frontmatter.title,
      tags: frontmatter.tags,
      isRead: frontmatter.isRead,
      isFavorite: frontmatter.isFavorite,
    };

    // Add optional fields
    if (frontmatter.source) fm.source = `"[[${frontmatter.source}]]"`;
    if (frontmatter.url) fm.url = frontmatter.url;
    if (frontmatter.author) fm.author = frontmatter.author;
    if (frontmatter.publishedAt) fm.publishedAt = frontmatter.publishedAt;
    if (frontmatter.score !== undefined) fm.score = frontmatter.score;
    if (frontmatter.summary) fm.summary = frontmatter.summary;

    return matter.stringify(content, fm);
  }

  parseArticle(content: string, filepath: string): MarkdownArticle {
    const { data, content: body } = matter(content);

    // Clean source field (remove wikilink format)
    let source = data.source;
    if (typeof source === 'string') {
      source = source.replace(/^\[\[|\]\]$/g, '').replace(/^"|"$/g, '');
    }

    const frontmatter = ArticleFrontmatterSchema.parse({
      id: data.id || this.generateId(),
      title: data.title || 'Untitled',
      source,
      url: data.url,
      author: data.author,
      publishedAt: data.publishedAt,
      fetchedAt: data.fetchedAt,
      tags: Array.isArray(data.tags) ? data.tags : [],
      score: data.score,
      isRead: data.isRead ?? false,
      isFavorite: data.isFavorite ?? false,
      summary: data.summary,
    });

    return { frontmatter, content: body.trim(), filepath };
  }

  formatLink(title: string, _path?: string): string {
    return `[[${title}]]`;
  }

  formatTags(_tags: string[]): string {
    // Obsidian uses frontmatter tags
    return '';
  }

  private generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
