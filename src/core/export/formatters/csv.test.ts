import { describe, it, expect } from 'vitest';
import { CsvFormatter } from './csv';
import type { ArticleExportData } from '../types';

describe('CsvFormatter', () => {
  const formatter = new CsvFormatter();

  const sampleArticle: ArticleExportData = {
    id: 'test-1',
    title: 'Test Article',
    content: 'Content',
    source: 'TechCrunch',
    url: 'https://example.com',
    tags: ['AI', 'Tech'],
    score: 8,
    isRead: false,
    isFavorite: false,
  };

  describe('render', () => {
    it('should render CSV with headers', () => {
      const result = formatter.render(sampleArticle);
      const lines = result.split('\n');

      expect(lines[0]).toContain('title');
      expect(lines[0]).toContain('source');
      expect(lines[1]).toContain('Test Article');
      expect(lines[1]).toContain('TechCrunch');
    });

    it('should handle commas in values', () => {
      const article = { ...sampleArticle, title: 'Hello, World' };
      const result = formatter.render(article);

      expect(result).toContain('"Hello, World"');
    });
  });

  describe('renderMany', () => {
    it('should render multiple rows', () => {
      const articles = [sampleArticle, { ...sampleArticle, id: 'test-2', title: 'Second' }];
      const result = formatter.renderMany(articles);
      const lines = result.split('\n').filter(l => l.trim());

      expect(lines).toHaveLength(3); // header + 2 rows
    });
  });
});
