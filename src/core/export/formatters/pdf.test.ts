import { describe, it, expect } from 'vitest';
import { PdfFormatter } from './pdf';
import type { ArticleExportData } from '../types';

describe('PdfFormatter', () => {
  const formatter = new PdfFormatter();

  const sampleArticle: ArticleExportData = {
    id: 'test-1',
    title: 'Test Article',
    content: 'This is the content of the article.',
    source: 'TechCrunch',
    tags: ['AI'],
    isRead: false,
    isFavorite: false,
  };

  describe('render', () => {
    it('should return a Buffer', () => {
      const result = formatter.render(sampleArticle);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should start with PDF magic bytes', () => {
      const result = formatter.render(sampleArticle);
      const header = result.slice(0, 5).toString();

      expect(header).toBe('%PDF-');
    });
  });
});
