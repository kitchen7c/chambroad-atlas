import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ExportService } from './export-service';
import type { ArticleExportData } from './types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('ExportService', () => {
  let testDir: string;
  let service: ExportService;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `atlas-export-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    service = new ExportService({ outputDir: testDir });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  const sampleArticle: ArticleExportData = {
    id: 'test-1',
    title: 'Test Article',
    content: 'Content here',
    tags: ['AI'],
    isRead: false,
    isFavorite: false,
  };

  describe('exportArticle', () => {
    it('should export single article to markdown', async () => {
      const result = await service.exportArticle(sampleArticle, 'markdown');

      expect(result.success).toBe(true);
      expect(result.filepath).toContain('.md');
      expect(result.articleCount).toBe(1);

      const content = await fs.readFile(result.filepath!, 'utf-8');
      expect(content).toContain('Test Article');
    });

    it('should export to JSON', async () => {
      const result = await service.exportArticle(sampleArticle, 'json');

      expect(result.success).toBe(true);
      expect(result.filepath).toContain('.json');
    });
  });

  describe('exportArticles', () => {
    it('should export multiple articles', async () => {
      const articles = [sampleArticle, { ...sampleArticle, id: 'test-2', title: 'Second' }];
      const result = await service.exportArticles(articles, 'markdown');

      expect(result.success).toBe(true);
      expect(result.articleCount).toBe(2);
    });
  });

  describe('backup', () => {
    it('should create full backup as JSON', async () => {
      const articles = [sampleArticle];
      const result = await service.backup(articles);

      expect(result.success).toBe(true);
      expect(result.filepath).toContain('backup');
      expect(result.filepath).toContain('.json');
    });
  });
});
