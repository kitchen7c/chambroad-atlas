import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileStorage } from './file-storage';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('FileStorage', () => {
  let testDir: string;
  let storage: FileStorage;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `atlas-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    storage = new FileStorage(testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('saveArticle', () => {
    it('should save article as markdown file', async () => {
      const article = {
        frontmatter: {
          id: 'test-1',
          title: 'Test Article',
          tags: ['test'],
          isRead: false,
          isFavorite: false,
        },
        content: '# Test\n\nHello world',
        filepath: '',
      };

      const filepath = await storage.saveArticle(article, 'inbox');

      expect(filepath).toContain('test-article.md');

      const content = await fs.readFile(filepath, 'utf-8');
      expect(content).toContain('id: test-1');
      expect(content).toContain('# Test');
    });
  });

  describe('readArticle', () => {
    it('should read and parse markdown file', async () => {
      const md = `---
id: read-test
title: Read Test
tags: []
isRead: false
isFavorite: false
---

Content here`;

      const filepath = path.join(testDir, 'test.md');
      await fs.writeFile(filepath, md);

      const article = await storage.readArticle(filepath);

      expect(article.frontmatter.id).toBe('read-test');
      expect(article.frontmatter.title).toBe('Read Test');
      expect(article.content).toBe('Content here');
    });
  });

  describe('listArticles', () => {
    it('should list all markdown files in folder', async () => {
      await fs.writeFile(path.join(testDir, 'a.md'), '---\nid: a\ntitle: A\n---\n');
      await fs.writeFile(path.join(testDir, 'b.md'), '---\nid: b\ntitle: B\n---\n');
      await fs.writeFile(path.join(testDir, 'c.txt'), 'not markdown');

      const files = await storage.listArticles();

      expect(files).toHaveLength(2);
      expect(files.some(f => f.endsWith('a.md'))).toBe(true);
      expect(files.some(f => f.endsWith('b.md'))).toBe(true);
    });
  });
});
