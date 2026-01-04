import { BaseAdapter } from './base';
import { ArticleFrontmatterSchema, type MarkdownArticle } from '../types';

export class LogseqAdapter extends BaseAdapter {
  formatArticle(article: MarkdownArticle): string {
    const { frontmatter, content } = article;

    // Logseq uses properties in outline format
    const lines: string[] = [];

    lines.push(`- id:: ${frontmatter.id}`);
    lines.push(`  title:: ${frontmatter.title}`);
    if (frontmatter.source) lines.push(`  source:: [[${frontmatter.source}]]`);
    if (frontmatter.url) lines.push(`  url:: ${frontmatter.url}`);
    if (frontmatter.tags.length > 0) {
      lines.push(`  tags:: ${frontmatter.tags.map(t => `#${t}`).join(' ')}`);
    }
    if (frontmatter.score !== undefined) lines.push(`  score:: ${frontmatter.score}`);

    // Add content as child blocks
    const contentLines = content.split('\n');
    for (const line of contentLines) {
      if (line.trim()) {
        lines.push(`- ${line}`);
      }
    }

    return lines.join('\n');
  }

  parseArticle(content: string, filepath: string): MarkdownArticle {
    const lines = content.split('\n');
    const properties: Record<string, string> = {};
    const contentLines: string[] = [];
    let inProperties = true;

    for (const line of lines) {
      const propMatch = line.match(/^\s*(\w+)::\s*(.+)$/);
      if (propMatch && inProperties) {
        properties[propMatch[1]] = propMatch[2];
      } else if (line.startsWith('- ') && !line.includes('::')) {
        inProperties = false;
        contentLines.push(line.slice(2));
      }
    }

    // Parse tags from inline format
    const tagsStr = properties.tags || '';
    const tags = tagsStr.match(/#\w+/g)?.map(t => t.slice(1)) || [];

    const frontmatter = ArticleFrontmatterSchema.parse({
      id: properties.id || this.generateId(),
      title: properties.title || 'Untitled',
      source: properties.source?.replace(/^\[\[|\]\]$/g, ''),
      url: properties.url,
      tags,
      score: properties.score ? parseInt(properties.score) : undefined,
      isRead: false,
      isFavorite: false,
    });

    return {
      frontmatter,
      content: contentLines.join('\n').trim(),
      filepath,
    };
  }

  formatLink(title: string, _path?: string): string {
    return `[[${title}]]`;
  }

  formatTags(tags: string[]): string {
    return tags.map(t => `#${t}`).join(' ');
  }

  private generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
