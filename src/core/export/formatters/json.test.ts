import { describe, it, expect } from 'vitest';
import { JsonFormatter } from './json';
import type { ArticleExportData } from '../types';

describe('JsonFormatter', () => {
  const formatter = new JsonFormatter();

  const sampleArticle: ArticleExportData = {
    id: 'test-1',
    title: 'Test Article',
    content: 'Content here',
    tags: ['AI'],
    isRead: false,
    isFavorite: false,
  };

  describe('render', () => {
    it('should render valid JSON', () => {
      const result = formatter.render(sampleArticle);
      const parsed = JSON.parse(result);

      expect(parsed.id).toBe('test-1');
      expect(parsed.title).toBe('Test Article');
    });

    it('should pretty print by default', () => {
      const result = formatter.render(sampleArticle);

      expect(result).toContain('\n');
      expect(result).toContain('  ');
    });
  });

  describe('renderMany', () => {
    it('should render array with metadata', () => {
      const articles = [sampleArticle];
      const result = formatter.renderMany(articles);
      const parsed = JSON.parse(result);

      expect(parsed.exportedAt).toBeTruthy();
      expect(parsed.count).toBe(1);
      expect(parsed.articles).toHaveLength(1);
    });
  });
});
