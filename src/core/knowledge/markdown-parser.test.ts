import { describe, it, expect } from 'vitest';
import { parseMarkdown, stringifyMarkdown } from './markdown-parser';

describe('MarkdownParser', () => {
  describe('parseMarkdown', () => {
    it('should parse frontmatter and content', () => {
      const md = `---
id: abc123
title: Test Article
tags: [AI, Tech]
---

# Content

This is the body.`;

      const result = parseMarkdown(md);

      expect(result.frontmatter.id).toBe('abc123');
      expect(result.frontmatter.title).toBe('Test Article');
      expect(result.frontmatter.tags).toEqual(['AI', 'Tech']);
      expect(result.content).toContain('# Content');
      expect(result.content).toContain('This is the body.');
    });

    it('should handle missing optional fields', () => {
      const md = `---
id: test
title: Minimal
---

Body`;

      const result = parseMarkdown(md);

      expect(result.frontmatter.id).toBe('test');
      expect(result.frontmatter.tags).toEqual([]);
      expect(result.frontmatter.isRead).toBe(false);
    });
  });

  describe('stringifyMarkdown', () => {
    it('should create valid markdown with frontmatter', () => {
      const article = {
        frontmatter: {
          id: 'xyz',
          title: 'My Article',
          tags: ['test'],
          isRead: false,
          isFavorite: false,
        },
        content: '# Hello\n\nWorld',
        filepath: '/test/path.md',
      };

      const result = stringifyMarkdown(article);

      expect(result).toContain('---');
      expect(result).toContain('id: xyz');
      expect(result).toContain('title: My Article');
      expect(result).toContain('# Hello');
      expect(result).toContain('World');
    });
  });
});
