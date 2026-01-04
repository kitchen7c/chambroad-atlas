import matter from 'gray-matter';
import { ArticleFrontmatterSchema, type ArticleFrontmatter, type MarkdownArticle } from './types';

/**
 * Parse a markdown string with YAML frontmatter
 */
export function parseMarkdown(content: string, filepath: string = ''): MarkdownArticle {
  const { data, content: body } = matter(content);

  // Validate and set defaults
  const frontmatter = ArticleFrontmatterSchema.parse({
    id: data.id || generateId(),
    title: data.title || 'Untitled',
    source: data.source,
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

  return {
    frontmatter,
    content: body.trim(),
    filepath,
  };
}

/**
 * Convert a MarkdownArticle back to a markdown string
 */
export function stringifyMarkdown(article: MarkdownArticle): string {
  const { frontmatter, content } = article;

  // Clean up frontmatter - remove undefined values
  const cleanFrontmatter: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value !== undefined) {
      cleanFrontmatter[key] = value;
    }
  }

  return matter.stringify(content, cleanFrontmatter);
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate a URL-safe slug from title
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

/**
 * Generate filename from template
 */
export function generateFilename(
  template: string,
  frontmatter: ArticleFrontmatter
): string {
  const date = new Date().toISOString().split('T')[0];
  const slug = slugify(frontmatter.title);

  return template
    .replace('{{date}}', date)
    .replace('{{slug}}', slug)
    .replace('{{title}}', slug)
    .replace('{{id}}', frontmatter.id)
    + '.md';
}
