# P3 Knowledge Base Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Markdown-based local knowledge base with note tool integration (Obsidian/Logseq/Typora) and vector semantic search.

**Architecture:** Articles stored as Markdown files with YAML frontmatter. Configurable vault path integrates with existing note tools. LanceDB provides local vector storage for semantic search. Adapter pattern supports different note tool formats.

**Tech Stack:** TypeScript, gray-matter (frontmatter), LanceDB (vectors), OpenAI/local embeddings, Node.js fs, Zod validation

---

## Phase 1: Markdown Storage Foundation

### Task 1: Add Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install required packages**

```bash
npm install gray-matter lancedb @lancedb/lancedb
npm install -D @types/node
```

**Step 2: Verify installation**

Run: `npm ls gray-matter lancedb`
Expected: Packages listed without errors

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add gray-matter and lancedb dependencies"
```

---

### Task 2: Define Knowledge Base Types

**Files:**
- Create: `src/core/knowledge/types.ts`

**Step 1: Create the types file**

```typescript
import { z } from 'zod';

// Supported note tools
export type NoteTool = 'obsidian' | 'logseq' | 'typora' | 'custom';

// Link format preference
export type LinkFormat = 'wikilink' | 'markdown';

// Tag format preference
export type TagFormat = 'frontmatter' | 'inline' | 'both';

// Knowledge base configuration schema
export const KnowledgeConfigSchema = z.object({
  tool: z.enum(['obsidian', 'logseq', 'typora', 'custom']).default('obsidian'),
  vaultPath: z.string().min(1),
  inboxFolder: z.string().default('Atlas/Inbox'),
  dailyFolder: z.string().default('Atlas/Daily'),
  archiveFolder: z.string().default('Atlas/Archive'),
  readFolders: z.array(z.string()).default([]),
  filenameTemplate: z.string().default('{{date}}-{{slug}}'),

  // Tool-specific settings
  linkFormat: z.enum(['wikilink', 'markdown']).default('wikilink'),
  tagFormat: z.enum(['frontmatter', 'inline', 'both']).default('frontmatter'),
  useYamlFrontmatter: z.boolean().default(true),
});

export type KnowledgeConfig = z.infer<typeof KnowledgeConfigSchema>;

// Article frontmatter schema
export const ArticleFrontmatterSchema = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string().optional(),
  url: z.string().url().optional(),
  author: z.string().optional(),
  publishedAt: z.string().optional(),
  fetchedAt: z.string().optional(),
  tags: z.array(z.string()).default([]),
  score: z.number().min(0).max(10).optional(),
  isRead: z.boolean().default(false),
  isFavorite: z.boolean().default(false),
  summary: z.string().optional(),
});

export type ArticleFrontmatter = z.infer<typeof ArticleFrontmatterSchema>;

// Full article with content
export interface MarkdownArticle {
  frontmatter: ArticleFrontmatter;
  content: string;
  filepath: string;
}

// Default configurations for each tool
export const TOOL_DEFAULTS: Record<NoteTool, Partial<KnowledgeConfig>> = {
  obsidian: {
    linkFormat: 'wikilink',
    tagFormat: 'frontmatter',
    useYamlFrontmatter: true,
  },
  logseq: {
    linkFormat: 'wikilink',
    tagFormat: 'inline',
    useYamlFrontmatter: false,
  },
  typora: {
    linkFormat: 'markdown',
    tagFormat: 'frontmatter',
    useYamlFrontmatter: true,
  },
  custom: {
    linkFormat: 'markdown',
    tagFormat: 'frontmatter',
    useYamlFrontmatter: true,
  },
};
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/knowledge/types.ts
git commit -m "feat(knowledge): add knowledge base types and schemas"
```

---

### Task 3: Create Markdown Parser

**Files:**
- Create: `src/core/knowledge/markdown-parser.ts`
- Create: `src/core/knowledge/markdown-parser.test.ts`

**Step 1: Write the test file**

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/core/knowledge/markdown-parser.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write the implementation**

```typescript
import matter from 'gray-matter';
import { ArticleFrontmatterSchema, type ArticleFrontmatter, type MarkdownArticle } from './types';

/**
 * Parse a markdown string with YAML frontmatter
 */
export function parseMarkdown(content: string, filepath: string = ''): MarkdownArticle {
  const { data, content: body } = matter(content);

  // Validate and set defaults
  const frontmatter = ArticleFrontmatterSchema.parse({
    id: data.id || generateId(),
    title: data.title || 'Untitled',
    source: data.source,
    url: data.url,
    author: data.author,
    publishedAt: data.publishedAt,
    fetchedAt: data.fetchedAt,
    tags: Array.isArray(data.tags) ? data.tags : [],
    score: data.score,
    isRead: data.isRead ?? false,
    isFavorite: data.isFavorite ?? false,
    summary: data.summary,
  });

  return {
    frontmatter,
    content: body.trim(),
    filepath,
  };
}

/**
 * Convert a MarkdownArticle back to a markdown string
 */
export function stringifyMarkdown(article: MarkdownArticle): string {
  const { frontmatter, content } = article;

  // Clean up frontmatter - remove undefined values
  const cleanFrontmatter: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value !== undefined) {
      cleanFrontmatter[key] = value;
    }
  }

  return matter.stringify(content, cleanFrontmatter);
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate a URL-safe slug from title
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

/**
 * Generate filename from template
 */
export function generateFilename(
  template: string,
  frontmatter: ArticleFrontmatter
): string {
  const date = new Date().toISOString().split('T')[0];
  const slug = slugify(frontmatter.title);

  return template
    .replace('{{date}}', date)
    .replace('{{slug}}', slug)
    .replace('{{title}}', slug)
    .replace('{{id}}', frontmatter.id)
    + '.md';
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/core/knowledge/markdown-parser.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/knowledge/markdown-parser.ts src/core/knowledge/markdown-parser.test.ts
git commit -m "feat(knowledge): add markdown parser with frontmatter support"
```

---

### Task 4: Create File Storage Service

**Files:**
- Create: `src/core/knowledge/file-storage.ts`
- Create: `src/core/knowledge/file-storage.test.ts`

**Step 1: Write the test file**

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/core/knowledge/file-storage.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write the implementation**

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { parseMarkdown, stringifyMarkdown, generateFilename } from './markdown-parser';
import type { MarkdownArticle, KnowledgeConfig } from './types';

export class FileStorage {
  private basePath: string;
  private config: Partial<KnowledgeConfig>;

  constructor(basePath: string, config: Partial<KnowledgeConfig> = {}) {
    this.basePath = basePath;
    this.config = {
      inboxFolder: 'Atlas/Inbox',
      dailyFolder: 'Atlas/Daily',
      archiveFolder: 'Atlas/Archive',
      filenameTemplate: '{{date}}-{{slug}}',
      ...config,
    };
  }

  /**
   * Get full path for a folder type
   */
  private getFolderPath(folder: 'inbox' | 'daily' | 'archive'): string {
    const folderMap = {
      inbox: this.config.inboxFolder!,
      daily: this.config.dailyFolder!,
      archive: this.config.archiveFolder!,
    };
    return path.join(this.basePath, folderMap[folder]);
  }

  /**
   * Ensure folder exists
   */
  private async ensureFolder(folderPath: string): Promise<void> {
    await fs.mkdir(folderPath, { recursive: true });
  }

  /**
   * Save an article to a markdown file
   */
  async saveArticle(
    article: MarkdownArticle,
    folder: 'inbox' | 'daily' | 'archive' = 'inbox'
  ): Promise<string> {
    const folderPath = this.getFolderPath(folder);
    await this.ensureFolder(folderPath);

    const filename = generateFilename(
      this.config.filenameTemplate!,
      article.frontmatter
    );
    const filepath = path.join(folderPath, filename);

    const content = stringifyMarkdown(article);
    await fs.writeFile(filepath, content, 'utf-8');

    return filepath;
  }

  /**
   * Read an article from a markdown file
   */
  async readArticle(filepath: string): Promise<MarkdownArticle> {
    const content = await fs.readFile(filepath, 'utf-8');
    return parseMarkdown(content, filepath);
  }

  /**
   * Update an existing article
   */
  async updateArticle(article: MarkdownArticle): Promise<void> {
    if (!article.filepath) {
      throw new Error('Article has no filepath');
    }
    const content = stringifyMarkdown(article);
    await fs.writeFile(article.filepath, content, 'utf-8');
  }

  /**
   * Delete an article
   */
  async deleteArticle(filepath: string): Promise<void> {
    await fs.unlink(filepath);
  }

  /**
   * Move article to archive
   */
  async archiveArticle(filepath: string): Promise<string> {
    const article = await this.readArticle(filepath);
    const newPath = await this.saveArticle(article, 'archive');
    await this.deleteArticle(filepath);
    return newPath;
  }

  /**
   * List all markdown files in base path (recursive)
   */
  async listArticles(subFolder?: string): Promise<string[]> {
    const searchPath = subFolder
      ? path.join(this.basePath, subFolder)
      : this.basePath;

    const files: string[] = [];

    try {
      await this.collectMarkdownFiles(searchPath, files);
    } catch (error) {
      // Folder doesn't exist yet
      return [];
    }

    return files;
  }

  private async collectMarkdownFiles(dir: string, files: string[]): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        await this.collectMarkdownFiles(fullPath, files);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  /**
   * Search articles by frontmatter fields
   */
  async findArticles(query: {
    tags?: string[];
    isRead?: boolean;
    isFavorite?: boolean;
    source?: string;
  }): Promise<MarkdownArticle[]> {
    const files = await this.listArticles();
    const articles: MarkdownArticle[] = [];

    for (const filepath of files) {
      try {
        const article = await this.readArticle(filepath);

        if (this.matchesQuery(article, query)) {
          articles.push(article);
        }
      } catch {
        // Skip invalid files
      }
    }

    return articles;
  }

  private matchesQuery(
    article: MarkdownArticle,
    query: { tags?: string[]; isRead?: boolean; isFavorite?: boolean; source?: string }
  ): boolean {
    const { frontmatter } = article;

    if (query.tags && query.tags.length > 0) {
      const hasTag = query.tags.some(t => frontmatter.tags.includes(t));
      if (!hasTag) return false;
    }

    if (query.isRead !== undefined && frontmatter.isRead !== query.isRead) {
      return false;
    }

    if (query.isFavorite !== undefined && frontmatter.isFavorite !== query.isFavorite) {
      return false;
    }

    if (query.source && frontmatter.source !== query.source) {
      return false;
    }

    return true;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/core/knowledge/file-storage.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/knowledge/file-storage.ts src/core/knowledge/file-storage.test.ts
git commit -m "feat(knowledge): add file storage service for markdown articles"
```

---

### Task 5: Create Note Tool Adapters

**Files:**
- Create: `src/core/knowledge/adapters/index.ts`
- Create: `src/core/knowledge/adapters/obsidian.ts`
- Create: `src/core/knowledge/adapters/logseq.ts`
- Create: `src/core/knowledge/adapters/base.ts`

**Step 1: Create base adapter interface**

```typescript
// src/core/knowledge/adapters/base.ts
import type { MarkdownArticle, ArticleFrontmatter } from '../types';

export interface NoteToolAdapter {
  /** Format an article for this tool */
  formatArticle(article: MarkdownArticle): string;

  /** Parse an article from this tool's format */
  parseArticle(content: string, filepath: string): MarkdownArticle;

  /** Format a wiki link */
  formatLink(title: string, path?: string): string;

  /** Format tags */
  formatTags(tags: string[]): string;

  /** Get file extension */
  getExtension(): string;
}

export abstract class BaseAdapter implements NoteToolAdapter {
  abstract formatArticle(article: MarkdownArticle): string;
  abstract parseArticle(content: string, filepath: string): MarkdownArticle;
  abstract formatLink(title: string, path?: string): string;
  abstract formatTags(tags: string[]): string;

  getExtension(): string {
    return '.md';
  }
}
```

**Step 2: Create Obsidian adapter**

```typescript
// src/core/knowledge/adapters/obsidian.ts
import matter from 'gray-matter';
import { BaseAdapter } from './base';
import { ArticleFrontmatterSchema, type MarkdownArticle } from '../types';

export class ObsidianAdapter extends BaseAdapter {
  formatArticle(article: MarkdownArticle): string {
    const { frontmatter, content } = article;

    const fm: Record<string, unknown> = {
      id: frontmatter.id,
      title: frontmatter.title,
      tags: frontmatter.tags,
      isRead: frontmatter.isRead,
      isFavorite: frontmatter.isFavorite,
    };

    // Add optional fields
    if (frontmatter.source) fm.source = `"[[${frontmatter.source}]]"`;
    if (frontmatter.url) fm.url = frontmatter.url;
    if (frontmatter.author) fm.author = frontmatter.author;
    if (frontmatter.publishedAt) fm.publishedAt = frontmatter.publishedAt;
    if (frontmatter.score !== undefined) fm.score = frontmatter.score;
    if (frontmatter.summary) fm.summary = frontmatter.summary;

    return matter.stringify(content, fm);
  }

  parseArticle(content: string, filepath: string): MarkdownArticle {
    const { data, content: body } = matter(content);

    // Clean source field (remove wikilink format)
    let source = data.source;
    if (typeof source === 'string') {
      source = source.replace(/^\[\[|\]\]$/g, '').replace(/^"|"$/g, '');
    }

    const frontmatter = ArticleFrontmatterSchema.parse({
      id: data.id || this.generateId(),
      title: data.title || 'Untitled',
      source,
      url: data.url,
      author: data.author,
      publishedAt: data.publishedAt,
      fetchedAt: data.fetchedAt,
      tags: Array.isArray(data.tags) ? data.tags : [],
      score: data.score,
      isRead: data.isRead ?? false,
      isFavorite: data.isFavorite ?? false,
      summary: data.summary,
    });

    return { frontmatter, content: body.trim(), filepath };
  }

  formatLink(title: string, _path?: string): string {
    return `[[${title}]]`;
  }

  formatTags(tags: string[]): string {
    // Obsidian uses frontmatter tags
    return '';
  }

  private generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
```

**Step 3: Create Logseq adapter**

```typescript
// src/core/knowledge/adapters/logseq.ts
import { BaseAdapter } from './base';
import { ArticleFrontmatterSchema, type MarkdownArticle } from '../types';

export class LogseqAdapter extends BaseAdapter {
  formatArticle(article: MarkdownArticle): string {
    const { frontmatter, content } = article;

    // Logseq uses properties in outline format
    const lines: string[] = [];

    lines.push(`- id:: ${frontmatter.id}`);
    lines.push(`  title:: ${frontmatter.title}`);
    if (frontmatter.source) lines.push(`  source:: [[${frontmatter.source}]]`);
    if (frontmatter.url) lines.push(`  url:: ${frontmatter.url}`);
    if (frontmatter.tags.length > 0) {
      lines.push(`  tags:: ${frontmatter.tags.map(t => `#${t}`).join(' ')}`);
    }
    if (frontmatter.score !== undefined) lines.push(`  score:: ${frontmatter.score}`);

    // Add content as child blocks
    const contentLines = content.split('\n');
    for (const line of contentLines) {
      if (line.trim()) {
        lines.push(`- ${line}`);
      }
    }

    return lines.join('\n');
  }

  parseArticle(content: string, filepath: string): MarkdownArticle {
    const lines = content.split('\n');
    const properties: Record<string, string> = {};
    const contentLines: string[] = [];
    let inProperties = true;

    for (const line of lines) {
      const propMatch = line.match(/^\s*(\w+)::\s*(.+)$/);
      if (propMatch && inProperties) {
        properties[propMatch[1]] = propMatch[2];
      } else if (line.startsWith('- ') && !line.includes('::')) {
        inProperties = false;
        contentLines.push(line.slice(2));
      }
    }

    // Parse tags from inline format
    const tagsStr = properties.tags || '';
    const tags = tagsStr.match(/#\w+/g)?.map(t => t.slice(1)) || [];

    const frontmatter = ArticleFrontmatterSchema.parse({
      id: properties.id || this.generateId(),
      title: properties.title || 'Untitled',
      source: properties.source?.replace(/^\[\[|\]\]$/g, ''),
      url: properties.url,
      tags,
      score: properties.score ? parseInt(properties.score) : undefined,
      isRead: false,
      isFavorite: false,
    });

    return {
      frontmatter,
      content: contentLines.join('\n').trim(),
      filepath,
    };
  }

  formatLink(title: string, _path?: string): string {
    return `[[${title}]]`;
  }

  formatTags(tags: string[]): string {
    return tags.map(t => `#${t}`).join(' ');
  }

  private generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
```

**Step 4: Create adapter index**

```typescript
// src/core/knowledge/adapters/index.ts
import type { NoteTool } from '../types';
import type { NoteToolAdapter } from './base';
import { ObsidianAdapter } from './obsidian';
import { LogseqAdapter } from './logseq';

export { NoteToolAdapter, BaseAdapter } from './base';
export { ObsidianAdapter } from './obsidian';
export { LogseqAdapter } from './logseq';

const adapters: Record<NoteTool, () => NoteToolAdapter> = {
  obsidian: () => new ObsidianAdapter(),
  logseq: () => new LogseqAdapter(),
  typora: () => new ObsidianAdapter(), // Typora uses standard markdown
  custom: () => new ObsidianAdapter(),
};

export function getAdapter(tool: NoteTool): NoteToolAdapter {
  return adapters[tool]();
}
```

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add src/core/knowledge/adapters/
git commit -m "feat(knowledge): add note tool adapters for Obsidian and Logseq"
```

---

## Phase 2: Vector Search

### Task 6: Define Vector Types

**Files:**
- Create: `src/core/knowledge/vector/types.ts`

**Step 1: Create vector types**

```typescript
import { z } from 'zod';

// Vector search configuration
export const VectorConfigSchema = z.object({
  enabled: z.boolean().default(true),
  provider: z.enum(['openai', 'local']).default('openai'),
  model: z.string().default('text-embedding-3-small'),
  storagePath: z.string().default('.atlas/vectors'),

  chunking: z.object({
    maxTokens: z.number().default(512),
    overlap: z.number().default(50),
  }).default({}),

  search: z.object({
    topK: z.number().default(10),
    minScore: z.number().default(0.7),
  }).default({}),
});

export type VectorConfig = z.infer<typeof VectorConfigSchema>;

// Vector record stored in database
export interface VectorRecord {
  id: string;
  articleId: string;
  filepath: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
  metadata: {
    title: string;
    source?: string;
    tags: string[];
    createdAt: number;
  };
}

// Search result
export interface VectorSearchResult {
  id: string;
  articleId: string;
  filepath: string;
  title: string;
  score: number;
  snippet: string;
}

// Embedding provider interface
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  dimensions: number;
}
```

**Step 2: Commit**

```bash
git add src/core/knowledge/vector/types.ts
git commit -m "feat(knowledge): add vector search types"
```

---

### Task 7: Create OpenAI Embedding Provider

**Files:**
- Create: `src/core/knowledge/vector/openai-embeddings.ts`
- Create: `src/core/knowledge/vector/openai-embeddings.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { OpenAIEmbeddings } from './openai-embeddings';

// Mock fetch
global.fetch = vi.fn();

describe('OpenAIEmbeddings', () => {
  it('should have correct dimensions for text-embedding-3-small', () => {
    const embeddings = new OpenAIEmbeddings('test-key', 'text-embedding-3-small');
    expect(embeddings.dimensions).toBe(1536);
  });

  it('should call OpenAI API with correct parameters', async () => {
    const mockResponse = {
      data: [{ embedding: new Array(1536).fill(0.1) }],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const embeddings = new OpenAIEmbeddings('test-key');
    const result = await embeddings.embed('test text');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/embeddings',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-key',
        }),
      })
    );
    expect(result).toHaveLength(1536);
  });
});
```

**Step 2: Write the implementation**

```typescript
import type { EmbeddingProvider } from './types';

const MODEL_DIMENSIONS: Record<string, number> = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
};

export class OpenAIEmbeddings implements EmbeddingProvider {
  private apiKey: string;
  private model: string;
  public dimensions: number;

  constructor(apiKey: string, model: string = 'text-embedding-3-small') {
    this.apiKey = apiKey;
    this.model = model;
    this.dimensions = MODEL_DIMENSIONS[model] || 1536;
  }

  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    return results[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.data.map((item: { embedding: number[] }) => item.embedding);
  }
}
```

**Step 3: Run tests**

Run: `npm test -- src/core/knowledge/vector/openai-embeddings.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/core/knowledge/vector/openai-embeddings.ts src/core/knowledge/vector/openai-embeddings.test.ts
git commit -m "feat(knowledge): add OpenAI embeddings provider"
```

---

### Task 8: Create Text Chunker

**Files:**
- Create: `src/core/knowledge/vector/chunker.ts`
- Create: `src/core/knowledge/vector/chunker.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, it, expect } from 'vitest';
import { TextChunker } from './chunker';

describe('TextChunker', () => {
  it('should split text into chunks', () => {
    const chunker = new TextChunker({ maxTokens: 10, overlap: 2 });
    const text = 'This is a test. This is another sentence. And one more.';

    const chunks = chunker.chunk(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toBeTruthy();
  });

  it('should preserve context with overlap', () => {
    const chunker = new TextChunker({ maxTokens: 20, overlap: 5 });
    const text = 'First sentence here. Second sentence here. Third sentence here.';

    const chunks = chunker.chunk(text);

    // With overlap, adjacent chunks should share some content
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle short text as single chunk', () => {
    const chunker = new TextChunker({ maxTokens: 100, overlap: 10 });
    const text = 'Short text.';

    const chunks = chunker.chunk(text);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('Short text.');
  });
});
```

**Step 2: Write the implementation**

```typescript
export interface ChunkerOptions {
  maxTokens: number;
  overlap: number;
}

export class TextChunker {
  private maxTokens: number;
  private overlap: number;

  constructor(options: ChunkerOptions = { maxTokens: 512, overlap: 50 }) {
    this.maxTokens = options.maxTokens;
    this.overlap = options.overlap;
  }

  /**
   * Simple token estimation (4 chars ≈ 1 token)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Split text into overlapping chunks
   */
  chunk(text: string): string[] {
    const sentences = this.splitSentences(text);
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentTokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokens(sentence);

      if (currentTokens + sentenceTokens > this.maxTokens && currentChunk.length > 0) {
        // Save current chunk
        chunks.push(currentChunk.join(' '));

        // Keep overlap sentences
        const overlapSentences: string[] = [];
        let overlapTokens = 0;

        for (let i = currentChunk.length - 1; i >= 0; i--) {
          const tokens = this.estimateTokens(currentChunk[i]);
          if (overlapTokens + tokens <= this.overlap) {
            overlapSentences.unshift(currentChunk[i]);
            overlapTokens += tokens;
          } else {
            break;
          }
        }

        currentChunk = overlapSentences;
        currentTokens = overlapTokens;
      }

      currentChunk.push(sentence);
      currentTokens += sentenceTokens;
    }

    // Add remaining chunk
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }

    return chunks;
  }

  /**
   * Split text into sentences
   */
  private splitSentences(text: string): string[] {
    // Simple sentence splitting on . ! ?
    return text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
}
```

**Step 3: Run tests**

Run: `npm test -- src/core/knowledge/vector/chunker.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/core/knowledge/vector/chunker.ts src/core/knowledge/vector/chunker.test.ts
git commit -m "feat(knowledge): add text chunker for vector indexing"
```

---

### Task 9: Create Vector Store with LanceDB

**Files:**
- Create: `src/core/knowledge/vector/vector-store.ts`
- Create: `src/core/knowledge/vector/index.ts`

**Step 1: Create the vector store**

```typescript
// src/core/knowledge/vector/vector-store.ts
import { connect, Table } from '@lancedb/lancedb';
import type { VectorRecord, VectorSearchResult, EmbeddingProvider, VectorConfig } from './types';
import { TextChunker } from './chunker';
import type { MarkdownArticle } from '../types';

export class VectorStore {
  private dbPath: string;
  private embeddings: EmbeddingProvider;
  private chunker: TextChunker;
  private config: VectorConfig;
  private table: Table | null = null;
  private tableName = 'articles';

  constructor(
    dbPath: string,
    embeddings: EmbeddingProvider,
    config: Partial<VectorConfig> = {}
  ) {
    this.dbPath = dbPath;
    this.embeddings = embeddings;
    this.config = {
      enabled: true,
      provider: 'openai',
      model: 'text-embedding-3-small',
      storagePath: '.atlas/vectors',
      chunking: { maxTokens: 512, overlap: 50 },
      search: { topK: 10, minScore: 0.7 },
      ...config,
    };
    this.chunker = new TextChunker(this.config.chunking);
  }

  /**
   * Initialize the database connection
   */
  async init(): Promise<void> {
    const db = await connect(this.dbPath);

    try {
      this.table = await db.openTable(this.tableName);
    } catch {
      // Table doesn't exist, will be created on first insert
      this.table = null;
    }
  }

  /**
   * Index an article
   */
  async indexArticle(article: MarkdownArticle): Promise<void> {
    const { frontmatter, content, filepath } = article;

    // Combine title, summary, and content for embedding
    const fullText = [
      frontmatter.title,
      frontmatter.summary || '',
      content,
    ].filter(Boolean).join('\n\n');

    // Chunk the text
    const chunks = this.chunker.chunk(fullText);

    // Generate embeddings
    const embeddings = await this.embeddings.embedBatch(chunks);

    // Create records
    const records: VectorRecord[] = chunks.map((chunk, index) => ({
      id: `${frontmatter.id}-${index}`,
      articleId: frontmatter.id,
      filepath,
      chunkIndex: index,
      content: chunk,
      embedding: embeddings[index],
      metadata: {
        title: frontmatter.title,
        source: frontmatter.source,
        tags: frontmatter.tags,
        createdAt: Date.now(),
      },
    }));

    // Insert into database
    const db = await connect(this.dbPath);

    if (!this.table) {
      this.table = await db.createTable(this.tableName, records);
    } else {
      // Remove existing records for this article
      await this.removeArticle(frontmatter.id);
      await this.table.add(records);
    }
  }

  /**
   * Remove an article from the index
   */
  async removeArticle(articleId: string): Promise<void> {
    if (!this.table) return;

    await this.table.delete(`articleId = "${articleId}"`);
  }

  /**
   * Search for similar content
   */
  async search(query: string, options?: {
    topK?: number;
    filter?: { tags?: string[]; source?: string };
  }): Promise<VectorSearchResult[]> {
    if (!this.table) {
      return [];
    }

    const topK = options?.topK || this.config.search.topK;

    // Generate query embedding
    const queryEmbedding = await this.embeddings.embed(query);

    // Search
    let searchQuery = this.table.search(queryEmbedding).limit(topK);

    // Apply filters if provided
    if (options?.filter?.source) {
      searchQuery = searchQuery.where(`metadata.source = "${options.filter.source}"`);
    }

    const results = await searchQuery.toArray();

    // Convert to search results
    return results
      .filter(r => r._distance <= (1 - this.config.search.minScore))
      .map(r => ({
        id: r.id,
        articleId: r.articleId,
        filepath: r.filepath,
        title: r.metadata.title,
        score: 1 - r._distance, // Convert distance to similarity
        snippet: r.content.slice(0, 200) + '...',
      }));
  }

  /**
   * Find similar articles
   */
  async findSimilar(articleId: string, topK: number = 5): Promise<VectorSearchResult[]> {
    if (!this.table) {
      return [];
    }

    // Get the article's first chunk embedding
    const results = await this.table
      .search(undefined)
      .where(`articleId = "${articleId}" AND chunkIndex = 0`)
      .limit(1)
      .toArray();

    if (results.length === 0) {
      return [];
    }

    // Search using that embedding, excluding the same article
    const embedding = results[0].embedding;
    const similar = await this.table
      .search(embedding)
      .where(`articleId != "${articleId}"`)
      .limit(topK)
      .toArray();

    // Deduplicate by articleId
    const seen = new Set<string>();
    return similar
      .filter(r => {
        if (seen.has(r.articleId)) return false;
        seen.add(r.articleId);
        return true;
      })
      .map(r => ({
        id: r.id,
        articleId: r.articleId,
        filepath: r.filepath,
        title: r.metadata.title,
        score: 1 - r._distance,
        snippet: r.content.slice(0, 200) + '...',
      }));
  }
}
```

**Step 2: Create index file**

```typescript
// src/core/knowledge/vector/index.ts
export * from './types';
export { VectorStore } from './vector-store';
export { OpenAIEmbeddings } from './openai-embeddings';
export { TextChunker } from './chunker';
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/core/knowledge/vector/
git commit -m "feat(knowledge): add LanceDB vector store for semantic search"
```

---

## Phase 3: Knowledge Base Service

### Task 10: Create Knowledge Base Service

**Files:**
- Create: `src/core/knowledge/knowledge-base.ts`
- Create: `src/core/knowledge/index.ts`

**Step 1: Create the main service**

```typescript
// src/core/knowledge/knowledge-base.ts
import { FileStorage } from './file-storage';
import { VectorStore, OpenAIEmbeddings } from './vector';
import { getAdapter } from './adapters';
import type {
  KnowledgeConfig,
  MarkdownArticle,
  ArticleFrontmatter,
  NoteTool,
} from './types';
import type { VectorSearchResult } from './vector/types';
import * as path from 'path';

export interface KnowledgeBaseOptions {
  config: KnowledgeConfig;
  openaiApiKey?: string;
}

export class KnowledgeBase {
  private config: KnowledgeConfig;
  private storage: FileStorage;
  private vectorStore: VectorStore | null = null;
  private adapter;

  constructor(options: KnowledgeBaseOptions) {
    this.config = options.config;
    this.storage = new FileStorage(options.config.vaultPath, options.config);
    this.adapter = getAdapter(options.config.tool);

    // Initialize vector store if API key provided
    if (options.openaiApiKey) {
      const vectorPath = path.join(options.config.vaultPath, '.atlas', 'vectors');
      const embeddings = new OpenAIEmbeddings(options.openaiApiKey);
      this.vectorStore = new VectorStore(vectorPath, embeddings);
    }
  }

  /**
   * Initialize the knowledge base
   */
  async init(): Promise<void> {
    if (this.vectorStore) {
      await this.vectorStore.init();
    }
  }

  /**
   * Save a new article
   */
  async saveArticle(article: MarkdownArticle): Promise<string> {
    const filepath = await this.storage.saveArticle(article, 'inbox');

    // Index in vector store
    if (this.vectorStore) {
      await this.vectorStore.indexArticle({ ...article, filepath });
    }

    return filepath;
  }

  /**
   * Create article from raw data
   */
  async createArticle(data: {
    title: string;
    content: string;
    source?: string;
    url?: string;
    author?: string;
    tags?: string[];
    summary?: string;
  }): Promise<string> {
    const frontmatter: ArticleFrontmatter = {
      id: this.generateId(),
      title: data.title,
      source: data.source,
      url: data.url,
      author: data.author,
      tags: data.tags || [],
      isRead: false,
      isFavorite: false,
      summary: data.summary,
      publishedAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
    };

    const article: MarkdownArticle = {
      frontmatter,
      content: data.content,
      filepath: '',
    };

    return this.saveArticle(article);
  }

  /**
   * Get an article by filepath
   */
  async getArticle(filepath: string): Promise<MarkdownArticle> {
    return this.storage.readArticle(filepath);
  }

  /**
   * Update an article
   */
  async updateArticle(article: MarkdownArticle): Promise<void> {
    await this.storage.updateArticle(article);

    // Re-index in vector store
    if (this.vectorStore) {
      await this.vectorStore.indexArticle(article);
    }
  }

  /**
   * Delete an article
   */
  async deleteArticle(filepath: string): Promise<void> {
    const article = await this.storage.readArticle(filepath);
    await this.storage.deleteArticle(filepath);

    if (this.vectorStore) {
      await this.vectorStore.removeArticle(article.frontmatter.id);
    }
  }

  /**
   * Archive an article
   */
  async archiveArticle(filepath: string): Promise<string> {
    return this.storage.archiveArticle(filepath);
  }

  /**
   * List all articles
   */
  async listArticles(folder?: string): Promise<MarkdownArticle[]> {
    const filepaths = await this.storage.listArticles(folder);
    const articles: MarkdownArticle[] = [];

    for (const fp of filepaths) {
      try {
        const article = await this.storage.readArticle(fp);
        articles.push(article);
      } catch {
        // Skip invalid files
      }
    }

    return articles;
  }

  /**
   * Find articles by query
   */
  async findArticles(query: {
    tags?: string[];
    isRead?: boolean;
    isFavorite?: boolean;
    source?: string;
  }): Promise<MarkdownArticle[]> {
    return this.storage.findArticles(query);
  }

  /**
   * Semantic search
   */
  async search(query: string, options?: {
    topK?: number;
    filter?: { tags?: string[]; source?: string };
  }): Promise<VectorSearchResult[]> {
    if (!this.vectorStore) {
      throw new Error('Vector search not available. Please configure OpenAI API key.');
    }
    return this.vectorStore.search(query, options);
  }

  /**
   * Find similar articles
   */
  async findSimilar(articleId: string, topK?: number): Promise<VectorSearchResult[]> {
    if (!this.vectorStore) {
      throw new Error('Vector search not available. Please configure OpenAI API key.');
    }
    return this.vectorStore.findSimilar(articleId, topK);
  }

  /**
   * Re-index all articles
   */
  async reindexAll(): Promise<{ indexed: number; errors: number }> {
    if (!this.vectorStore) {
      throw new Error('Vector search not available.');
    }

    const articles = await this.listArticles();
    let indexed = 0;
    let errors = 0;

    for (const article of articles) {
      try {
        await this.vectorStore.indexArticle(article);
        indexed++;
      } catch (error) {
        console.error(`Failed to index ${article.filepath}:`, error);
        errors++;
      }
    }

    return { indexed, errors };
  }

  /**
   * Get configuration
   */
  getConfig(): KnowledgeConfig {
    return this.config;
  }

  /**
   * Change note tool
   */
  setTool(tool: NoteTool): void {
    this.config.tool = tool;
    this.adapter = getAdapter(tool);
  }

  private generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
```

**Step 2: Create index file**

```typescript
// src/core/knowledge/index.ts
export * from './types';
export { KnowledgeBase } from './knowledge-base';
export { FileStorage } from './file-storage';
export { parseMarkdown, stringifyMarkdown, slugify, generateFilename } from './markdown-parser';
export * from './adapters';
export * from './vector';
```

**Step 3: Export from core index**

Add to `src/core/index.ts`:

```typescript
// P3: Knowledge Base
export * from './knowledge';
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/core/knowledge/ src/core/index.ts
git commit -m "feat(knowledge): add KnowledgeBase service with full API"
```

---

## Phase 4: Settings UI Integration

### Task 11: Add Knowledge Base Settings Types

**Files:**
- Modify: `types.ts`

**Step 1: Add knowledge base settings to Settings type**

Add to the Settings interface in `types.ts`:

```typescript
// Add to existing Settings interface
export interface Settings {
  // ... existing fields ...

  // Knowledge base settings
  knowledge?: {
    enabled: boolean;
    tool: 'obsidian' | 'logseq' | 'typora' | 'custom';
    vaultPath: string;
    inboxFolder: string;
    dailyFolder: string;
    archiveFolder: string;
    linkFormat: 'wikilink' | 'markdown';
    tagFormat: 'frontmatter' | 'inline' | 'both';
    vectorSearch: {
      enabled: boolean;
      provider: 'openai' | 'local';
    };
  };
}
```

**Step 2: Commit**

```bash
git add types.ts
git commit -m "feat(types): add knowledge base settings schema"
```

---

### Task 12: Create Knowledge Base Settings Component

**Files:**
- Create: `src/components/KnowledgeSettings.tsx`

**Step 1: Create the component**

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface KnowledgeSettingsProps {
  settings: {
    enabled: boolean;
    tool: string;
    vaultPath: string;
    inboxFolder: string;
    linkFormat: string;
    tagFormat: string;
    vectorSearch: {
      enabled: boolean;
      provider: string;
    };
  };
  onSave: (settings: any) => void;
}

export function KnowledgeSettings({ settings, onSave }: KnowledgeSettingsProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(settings);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="knowledge-settings">
      <h3>{t('settings.knowledgeBase', 'Knowledge Base')}</h3>

      <div className="form-field">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={formData.enabled}
            onChange={(e) => handleChange('enabled', e.target.checked)}
          />
          {t('settings.enableKnowledgeBase', 'Enable Knowledge Base')}
        </label>
      </div>

      {formData.enabled && (
        <>
          <div className="form-field">
            <label>{t('settings.noteTool', 'Note Tool')}</label>
            <select
              value={formData.tool}
              onChange={(e) => handleChange('tool', e.target.value)}
            >
              <option value="obsidian">Obsidian</option>
              <option value="logseq">Logseq</option>
              <option value="typora">Typora</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div className="form-field">
            <label>{t('settings.vaultPath', 'Vault Path')}</label>
            <input
              type="text"
              value={formData.vaultPath}
              onChange={(e) => handleChange('vaultPath', e.target.value)}
              placeholder="~/Documents/Obsidian/MyVault"
            />
          </div>

          <div className="form-field">
            <label>{t('settings.inboxFolder', 'Inbox Folder')}</label>
            <input
              type="text"
              value={formData.inboxFolder}
              onChange={(e) => handleChange('inboxFolder', e.target.value)}
              placeholder="Atlas/Inbox"
            />
          </div>

          <div className="form-field">
            <label>{t('settings.linkFormat', 'Link Format')}</label>
            <select
              value={formData.linkFormat}
              onChange={(e) => handleChange('linkFormat', e.target.value)}
            >
              <option value="wikilink">[[Wikilink]]</option>
              <option value="markdown">[Markdown](link)</option>
            </select>
          </div>

          <div className="form-field">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={formData.vectorSearch.enabled}
                onChange={(e) => handleChange('vectorSearch', {
                  ...formData.vectorSearch,
                  enabled: e.target.checked,
                })}
              />
              {t('settings.enableVectorSearch', 'Enable Semantic Search')}
            </label>
          </div>
        </>
      )}

      <button type="submit" className="primary">
        {t('settings.save', 'Save')}
      </button>
    </form>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/KnowledgeSettings.tsx
git commit -m "feat(ui): add knowledge base settings component"
```

---

## Summary

**Total Tasks:** 12

**Phase 1 (Tasks 1-5):** Markdown storage foundation
- Dependencies, types, parser, file storage, adapters

**Phase 2 (Tasks 6-9):** Vector search
- Types, embeddings, chunker, LanceDB store

**Phase 3 (Task 10):** Knowledge base service
- Main service integrating storage and vectors

**Phase 4 (Tasks 11-12):** Settings UI
- Types and settings component

---

**After completing all tasks:**

1. Articles saved as Markdown in configured vault
2. Works with Obsidian, Logseq, Typora
3. Semantic search via LanceDB + OpenAI embeddings
4. Configurable via Settings UI
