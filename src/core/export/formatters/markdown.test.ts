import { describe, it, expect } from 'vitest';
import { MarkdownFormatter } from './markdown';
import type { ArticleExportData } from '../types';

describe('MarkdownFormatter', () => {
  const formatter = new MarkdownFormatter();

  const sampleArticle: ArticleExportData = {
    id: 'test-1',
    title: 'Test Article',
    content: 'This is the content.\n\nWith multiple paragraphs.',
    source: 'TechCrunch',
    url: 'https://example.com/article',
    author: 'John Doe',
    publishedAt: '2026-01-03T10:00:00Z',
    tags: ['AI', 'Tech'],
    score: 8,
    summary: 'A brief summary.',
    isRead: false,
    isFavorite: true,
  };

  describe('render', () => {
    it('should render article with frontmatter', () => {
      const result = formatter.render(sampleArticle);

      expect(result).toContain('---');
      expect(result).toContain('title: Test Article');
      expect(result).toContain('source: TechCrunch');
      expect(result).toContain('tags:');
      expect(result).toContain('- AI');
      expect(result).toContain('## Summary');
      expect(result).toContain('A brief summary.');
      expect(result).toContain('This is the content.');
    });

    it('should handle missing optional fields', () => {
      const minimal: ArticleExportData = {
        id: 'min-1',
        title: 'Minimal',
        content: 'Content',
        tags: [],
        isRead: false,
        isFavorite: false,
      };

      const result = formatter.render(minimal);

      expect(result).toContain('title: Minimal');
      expect(result).toContain('Content');
    });
  });

  describe('renderMany', () => {
    it('should render multiple articles', () => {
      const articles = [sampleArticle, { ...sampleArticle, id: 'test-2', title: 'Second' }];
      const result = formatter.renderMany(articles);

      expect(result).toContain('Test Article');
      expect(result).toContain('Second');
      expect(result).toContain('---'); // Separator
    });
  });
});
