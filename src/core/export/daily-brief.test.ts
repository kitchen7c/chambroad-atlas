import { describe, it, expect } from 'vitest';
import { DailyBriefGenerator } from './daily-brief';
import type { ArticleExportData } from './types';

describe('DailyBriefGenerator', () => {
  const generator = new DailyBriefGenerator();

  const sampleArticles: ArticleExportData[] = [
    {
      id: '1',
      title: 'AI News',
      content: 'Content 1',
      source: 'TechCrunch',
      tags: ['AI'],
      score: 8,
      summary: 'Summary 1',
      isRead: false,
      isFavorite: false,
      publishedAt: new Date().toISOString(),
    },
    {
      id: '2',
      title: 'Tech Update',
      content: 'Content 2',
      source: 'Wired',
      tags: ['Tech', 'AI'],
      score: 6,
      summary: 'Summary 2',
      isRead: false,
      isFavorite: false,
      publishedAt: new Date().toISOString(),
    },
  ];

  describe('generate', () => {
    it('should generate brief data', () => {
      const brief = generator.generate(sampleArticles);

      expect(brief.date).toBeTruthy();
      expect(brief.articles).toHaveLength(2);
      expect(brief.stats.total).toBe(2);
      expect(brief.stats.avgScore).toBe(7);
    });

    it('should count by source', () => {
      const brief = generator.generate(sampleArticles);

      expect(brief.stats.bySource['TechCrunch']).toBe(1);
      expect(brief.stats.bySource['Wired']).toBe(1);
    });

    it('should count by tag', () => {
      const brief = generator.generate(sampleArticles);

      expect(brief.stats.byTag['AI']).toBe(2);
      expect(brief.stats.byTag['Tech']).toBe(1);
    });
  });

  describe('filterByScore', () => {
    it('should filter articles by minimum score', () => {
      const filtered = generator.filterByScore(sampleArticles, 7);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('AI News');
    });
  });

  describe('renderMarkdown', () => {
    it('should render brief as markdown', () => {
      const brief = generator.generate(sampleArticles);
      const md = generator.renderMarkdown(brief);

      expect(md).toContain('Daily Brief');
      expect(md).toContain('AI News');
      expect(md).toContain('Statistics');
    });
  });
});
