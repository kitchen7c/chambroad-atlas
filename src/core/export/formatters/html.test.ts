import { describe, it, expect } from 'vitest';
import { HtmlFormatter } from './html';
import type { ArticleExportData } from '../types';

describe('HtmlFormatter', () => {
  const formatter = new HtmlFormatter();

  const sampleArticle: ArticleExportData = {
    id: 'test-1',
    title: 'Test Article',
    content: 'This is **bold** content.',
    source: 'TechCrunch',
    tags: ['AI'],
    isRead: false,
    isFavorite: false,
  };

  describe('render', () => {
    it('should render valid HTML document', () => {
      const result = formatter.render(sampleArticle);

      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<html');
      expect(result).toContain('Test Article');
      expect(result).toContain('</html>');
    });

    it('should include styles when standalone', () => {
      const result = formatter.render(sampleArticle);

      expect(result).toContain('<style>');
    });
  });

  describe('renderMany', () => {
    it('should render table of contents', () => {
      const articles = [sampleArticle, { ...sampleArticle, id: 'test-2', title: 'Second' }];
      const result = formatter.renderMany(articles);

      expect(result).toContain('Table of Contents');
      expect(result).toContain('Test Article');
      expect(result).toContain('Second');
    });
  });
});
