import type { ArticleExportData, DailyBriefData } from './types';

export interface DailyBriefOptions {
  maxItems?: number;
  minScore?: number;
  includeStats?: boolean;
}

export class DailyBriefGenerator {
  private options: DailyBriefOptions;

  constructor(options: DailyBriefOptions = {}) {
    this.options = {
      maxItems: 10,
      minScore: 0,
      includeStats: true,
      ...options,
    };
  }

  /**
   * Generate daily brief data
   */
  generate(articles: ArticleExportData[]): DailyBriefData {
    const filtered = this.filterByScore(articles, this.options.minScore!);
    const sorted = this.sortByScore(filtered);
    const top = sorted.slice(0, this.options.maxItems);

    return {
      date: new Date().toISOString().split('T')[0],
      articles: top,
      summary: this.generateSummary(top),
      stats: this.calculateStats(articles),
    };
  }

  /**
   * Filter articles by minimum score
   */
  filterByScore(articles: ArticleExportData[], minScore: number): ArticleExportData[] {
    return articles.filter(a => (a.score ?? 0) >= minScore);
  }

  /**
   * Sort articles by score descending
   */
  sortByScore(articles: ArticleExportData[]): ArticleExportData[] {
    return [...articles].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }

  /**
   * Calculate statistics
   */
  calculateStats(articles: ArticleExportData[]): DailyBriefData['stats'] {
    const bySource: Record<string, number> = {};
    const byTag: Record<string, number> = {};
    let totalScore = 0;
    let scoredCount = 0;

    for (const article of articles) {
      // Count by source
      if (article.source) {
        bySource[article.source] = (bySource[article.source] || 0) + 1;
      }

      // Count by tag
      for (const tag of article.tags) {
        byTag[tag] = (byTag[tag] || 0) + 1;
      }

      // Sum scores
      if (article.score !== undefined) {
        totalScore += article.score;
        scoredCount++;
      }
    }

    return {
      total: articles.length,
      bySource,
      byTag,
      avgScore: scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0,
    };
  }

  /**
   * Generate summary text
   */
  generateSummary(articles: ArticleExportData[]): string {
    if (articles.length === 0) {
      return 'No articles today.';
    }

    const sources = [...new Set(articles.map(a => a.source).filter(Boolean))];
    const topTags = this.getTopTags(articles, 3);

    return `Today's brief includes ${articles.length} articles from ${sources.length} sources. ` +
      `Top topics: ${topTags.join(', ')}.`;
  }

  /**
   * Get top N tags
   */
  getTopTags(articles: ArticleExportData[], n: number): string[] {
    const tagCounts: Record<string, number> = {};

    for (const article of articles) {
      for (const tag of article.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([tag]) => tag);
  }

  /**
   * Render brief as Markdown
   */
  renderMarkdown(brief: DailyBriefData): string {
    const lines: string[] = [];

    lines.push(`# Daily Brief - ${brief.date}`);
    lines.push('');
    lines.push(brief.summary);
    lines.push('');

    // Statistics
    if (this.options.includeStats) {
      lines.push('## Statistics');
      lines.push('');
      lines.push(`- Total articles: ${brief.stats.total}`);
      lines.push(`- Average score: ${brief.stats.avgScore}`);
      lines.push('');

      // Top sources
      const topSources = Object.entries(brief.stats.bySource)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      if (topSources.length > 0) {
        lines.push('### Top Sources');
        lines.push('');
        topSources.forEach(([source, count]) => {
          lines.push(`- ${source}: ${count}`);
        });
        lines.push('');
      }
    }

    // Articles
    lines.push('## Articles');
    lines.push('');

    for (const article of brief.articles) {
      lines.push(`### ${article.title}`);
      lines.push('');

      const meta: string[] = [];
      if (article.source) meta.push(article.source);
      if (article.score !== undefined) meta.push(`Score: ${article.score}`);
      if (meta.length > 0) {
        lines.push(`*${meta.join(' | ')}*`);
        lines.push('');
      }

      if (article.summary) {
        lines.push(article.summary);
        lines.push('');
      }

      if (article.url) {
        lines.push(`[Read more](${article.url})`);
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }
}
