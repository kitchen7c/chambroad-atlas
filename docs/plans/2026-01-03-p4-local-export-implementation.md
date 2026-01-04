# P4 Local Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a comprehensive local export system supporting Markdown, PDF, HTML, JSON, CSV formats with single/batch export and automated daily briefs.

**Architecture:** Export service with pluggable formatters for each output type. Integrates with P3 KnowledgeBase for article access. Daily brief generator uses P2 processors for summarization. All exports save to configurable local folders.

**Tech Stack:** TypeScript, jsPDF (PDF generation), Handlebars (templates), node-cron (scheduling), Zod validation

---

## Phase 1: Export Foundation

### Task 1: Add Export Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install required packages**

```bash
npm install jspdf handlebars
npm install -D @types/handlebars
```

**Step 2: Verify installation**

Run: `npm ls jspdf handlebars`
Expected: Packages listed without errors

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add jspdf and handlebars dependencies"
```

---

### Task 2: Define Export Types

**Files:**
- Create: `src/core/export/types.ts`

**Step 1: Create the types file**

```typescript
import { z } from 'zod';

// Supported export formats
export type ExportFormat = 'markdown' | 'pdf' | 'html' | 'json' | 'csv';

// Export configuration schema
export const ExportConfigSchema = z.object({
  outputDir: z.string().default('~/Atlas/exports'),
  formats: z.object({
    markdown: z.object({
      includeMetadata: z.boolean().default(true),
      includeSummary: z.boolean().default(true),
      template: z.string().optional(),
    }).default({}),
    pdf: z.object({
      pageSize: z.enum(['a4', 'letter']).default('a4'),
      includeHeader: z.boolean().default(true),
      includeFooter: z.boolean().default(true),
      fontSize: z.number().default(12),
    }).default({}),
    html: z.object({
      standalone: z.boolean().default(true),
      includeStyles: z.boolean().default(true),
      template: z.string().optional(),
    }).default({}),
    json: z.object({
      pretty: z.boolean().default(true),
      includeContent: z.boolean().default(true),
    }).default({}),
    csv: z.object({
      delimiter: z.string().default(','),
      includeHeaders: z.boolean().default(true),
      fields: z.array(z.string()).default(['title', 'source', 'url', 'tags', 'score', 'publishedAt']),
    }).default({}),
  }).default({}),
  dailyBrief: z.object({
    enabled: z.boolean().default(false),
    time: z.string().default('08:00'),
    format: z.enum(['markdown', 'pdf', 'html']).default('markdown'),
    folder: z.string().default('daily'),
    maxItems: z.number().default(10),
    minScore: z.number().default(5),
  }).default({}),
});

export type ExportConfig = z.infer<typeof ExportConfigSchema>;

// Export request
export interface ExportRequest {
  format: ExportFormat;
  articles: ArticleExportData[];
  outputPath?: string;
  options?: Partial<ExportConfig['formats'][ExportFormat]>;
}

// Article data for export
export interface ArticleExportData {
  id: string;
  title: string;
  content: string;
  source?: string;
  url?: string;
  author?: string;
  publishedAt?: string;
  fetchedAt?: string;
  tags: string[];
  score?: number;
  summary?: string;
  isRead: boolean;
  isFavorite: boolean;
}

// Export result
export interface ExportResult {
  success: boolean;
  filepath?: string;
  error?: string;
  format: ExportFormat;
  articleCount: number;
}

// Daily brief data
export interface DailyBriefData {
  date: string;
  articles: ArticleExportData[];
  summary: string;
  stats: {
    total: number;
    bySource: Record<string, number>;
    byTag: Record<string, number>;
    avgScore: number;
  };
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/export/types.ts
git commit -m "feat(export): add export types and schemas"
```

---

### Task 3: Create Base Exporter Interface

**Files:**
- Create: `src/core/export/formatters/base.ts`

**Step 1: Create the base formatter**

```typescript
import type { ArticleExportData, ExportResult } from '../types';

export interface ExportOptions {
  outputPath: string;
  [key: string]: unknown;
}

export interface Formatter {
  /** Format name */
  readonly format: string;

  /** File extension */
  readonly extension: string;

  /** Export a single article */
  exportOne(article: ArticleExportData, options: ExportOptions): Promise<ExportResult>;

  /** Export multiple articles */
  exportMany(articles: ArticleExportData[], options: ExportOptions): Promise<ExportResult>;

  /** Generate content without saving */
  render(article: ArticleExportData): string | Buffer;

  /** Generate content for multiple articles */
  renderMany(articles: ArticleExportData[]): string | Buffer;
}

export abstract class BaseFormatter implements Formatter {
  abstract readonly format: string;
  abstract readonly extension: string;

  abstract render(article: ArticleExportData): string | Buffer;
  abstract renderMany(articles: ArticleExportData[]): string | Buffer;

  async exportOne(article: ArticleExportData, options: ExportOptions): Promise<ExportResult> {
    try {
      const content = this.render(article);
      const filename = this.generateFilename(article);
      const filepath = `${options.outputPath}/${filename}`;

      await this.writeFile(filepath, content);

      return {
        success: true,
        filepath,
        format: this.format as any,
        articleCount: 1,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        format: this.format as any,
        articleCount: 0,
      };
    }
  }

  async exportMany(articles: ArticleExportData[], options: ExportOptions): Promise<ExportResult> {
    try {
      const content = this.renderMany(articles);
      const filename = this.generateBatchFilename();
      const filepath = `${options.outputPath}/${filename}`;

      await this.writeFile(filepath, content);

      return {
        success: true,
        filepath,
        format: this.format as any,
        articleCount: articles.length,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        format: this.format as any,
        articleCount: 0,
      };
    }
  }

  protected generateFilename(article: ArticleExportData): string {
    const date = new Date().toISOString().split('T')[0];
    const slug = this.slugify(article.title);
    return `${date}-${slug}.${this.extension}`;
  }

  protected generateBatchFilename(): string {
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toISOString().split('T')[1].slice(0, 5).replace(':', '');
    return `export-${date}-${time}.${this.extension}`;
  }

  protected slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50);
  }

  protected async writeFile(filepath: string, content: string | Buffer): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    // Ensure directory exists
    const dir = path.dirname(filepath);
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(filepath, content, typeof content === 'string' ? 'utf-8' : undefined);
  }
}
```

**Step 2: Commit**

```bash
git add src/core/export/formatters/base.ts
git commit -m "feat(export): add base formatter interface"
```

---

## Phase 2: Format Implementations

### Task 4: Create Markdown Formatter

**Files:**
- Create: `src/core/export/formatters/markdown.ts`
- Create: `src/core/export/formatters/markdown.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, it, expect } from 'vitest';
import { MarkdownFormatter } from './markdown';
import type { ArticleExportData } from '../types';

describe('MarkdownFormatter', () => {
  const formatter = new MarkdownFormatter();

  const sampleArticle: ArticleExportData = {
    id: 'test-1',
    title: 'Test Article',
    content: 'This is the content.\n\nWith multiple paragraphs.',
    source: 'TechCrunch',
    url: 'https://example.com/article',
    author: 'John Doe',
    publishedAt: '2026-01-03T10:00:00Z',
    tags: ['AI', 'Tech'],
    score: 8,
    summary: 'A brief summary.',
    isRead: false,
    isFavorite: true,
  };

  describe('render', () => {
    it('should render article with frontmatter', () => {
      const result = formatter.render(sampleArticle);

      expect(result).toContain('---');
      expect(result).toContain('title: Test Article');
      expect(result).toContain('source: TechCrunch');
      expect(result).toContain('tags:');
      expect(result).toContain('- AI');
      expect(result).toContain('## Summary');
      expect(result).toContain('A brief summary.');
      expect(result).toContain('This is the content.');
    });

    it('should handle missing optional fields', () => {
      const minimal: ArticleExportData = {
        id: 'min-1',
        title: 'Minimal',
        content: 'Content',
        tags: [],
        isRead: false,
        isFavorite: false,
      };

      const result = formatter.render(minimal);

      expect(result).toContain('title: Minimal');
      expect(result).toContain('Content');
    });
  });

  describe('renderMany', () => {
    it('should render multiple articles', () => {
      const articles = [sampleArticle, { ...sampleArticle, id: 'test-2', title: 'Second' }];
      const result = formatter.renderMany(articles);

      expect(result).toContain('Test Article');
      expect(result).toContain('Second');
      expect(result).toContain('---'); // Separator
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/core/export/formatters/markdown.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write the implementation**

```typescript
import { BaseFormatter } from './base';
import type { ArticleExportData } from '../types';

export interface MarkdownOptions {
  includeMetadata?: boolean;
  includeSummary?: boolean;
  template?: string;
}

export class MarkdownFormatter extends BaseFormatter {
  readonly format = 'markdown';
  readonly extension = 'md';

  private options: MarkdownOptions;

  constructor(options: MarkdownOptions = {}) {
    super();
    this.options = {
      includeMetadata: true,
      includeSummary: true,
      ...options,
    };
  }

  render(article: ArticleExportData): string {
    const lines: string[] = [];

    // Frontmatter
    if (this.options.includeMetadata) {
      lines.push('---');
      lines.push(`title: ${article.title}`);
      if (article.source) lines.push(`source: ${article.source}`);
      if (article.url) lines.push(`url: ${article.url}`);
      if (article.author) lines.push(`author: ${article.author}`);
      if (article.publishedAt) lines.push(`publishedAt: ${article.publishedAt}`);
      if (article.tags.length > 0) {
        lines.push('tags:');
        article.tags.forEach(tag => lines.push(`  - ${tag}`));
      }
      if (article.score !== undefined) lines.push(`score: ${article.score}`);
      lines.push(`isRead: ${article.isRead}`);
      lines.push(`isFavorite: ${article.isFavorite}`);
      lines.push('---');
      lines.push('');
    }

    // Title
    lines.push(`# ${article.title}`);
    lines.push('');

    // Metadata line
    const meta: string[] = [];
    if (article.source) meta.push(`Source: ${article.source}`);
    if (article.author) meta.push(`Author: ${article.author}`);
    if (article.publishedAt) {
      const date = new Date(article.publishedAt).toLocaleDateString();
      meta.push(`Date: ${date}`);
    }
    if (meta.length > 0) {
      lines.push(`*${meta.join(' | ')}*`);
      lines.push('');
    }

    // Summary
    if (this.options.includeSummary && article.summary) {
      lines.push('## Summary');
      lines.push('');
      lines.push(article.summary);
      lines.push('');
    }

    // Content
    lines.push('## Content');
    lines.push('');
    lines.push(article.content);
    lines.push('');

    // Tags
    if (article.tags.length > 0) {
      lines.push('---');
      lines.push('');
      lines.push(`Tags: ${article.tags.map(t => `#${t}`).join(' ')}`);
    }

    return lines.join('\n');
  }

  renderMany(articles: ArticleExportData[]): string {
    const sections: string[] = [];

    // Header
    sections.push(`# Export - ${new Date().toLocaleDateString()}`);
    sections.push('');
    sections.push(`Total articles: ${articles.length}`);
    sections.push('');
    sections.push('---');
    sections.push('');

    // Articles
    for (const article of articles) {
      sections.push(this.render(article));
      sections.push('');
      sections.push('---');
      sections.push('');
    }

    return sections.join('\n');
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/core/export/formatters/markdown.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/export/formatters/markdown.ts src/core/export/formatters/markdown.test.ts
git commit -m "feat(export): add Markdown formatter"
```

---

### Task 5: Create JSON Formatter

**Files:**
- Create: `src/core/export/formatters/json.ts`
- Create: `src/core/export/formatters/json.test.ts`

**Step 1: Write the test file**

```typescript
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
```

**Step 2: Write the implementation**

```typescript
import { BaseFormatter } from './base';
import type { ArticleExportData } from '../types';

export interface JsonOptions {
  pretty?: boolean;
  includeContent?: boolean;
}

export class JsonFormatter extends BaseFormatter {
  readonly format = 'json';
  readonly extension = 'json';

  private options: JsonOptions;

  constructor(options: JsonOptions = {}) {
    super();
    this.options = {
      pretty: true,
      includeContent: true,
      ...options,
    };
  }

  render(article: ArticleExportData): string {
    const data = this.options.includeContent
      ? article
      : { ...article, content: undefined };

    return this.options.pretty
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);
  }

  renderMany(articles: ArticleExportData[]): string {
    const data = {
      exportedAt: new Date().toISOString(),
      count: articles.length,
      articles: articles.map(a =>
        this.options.includeContent ? a : { ...a, content: undefined }
      ),
    };

    return this.options.pretty
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);
  }
}
```

**Step 3: Run tests**

Run: `npm test -- src/core/export/formatters/json.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/core/export/formatters/json.ts src/core/export/formatters/json.test.ts
git commit -m "feat(export): add JSON formatter"
```

---

### Task 6: Create CSV Formatter

**Files:**
- Create: `src/core/export/formatters/csv.ts`
- Create: `src/core/export/formatters/csv.test.ts`

**Step 1: Write the test file**

```typescript
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
```

**Step 2: Write the implementation**

```typescript
import { BaseFormatter } from './base';
import type { ArticleExportData } from '../types';

export interface CsvOptions {
  delimiter?: string;
  includeHeaders?: boolean;
  fields?: string[];
}

const DEFAULT_FIELDS = ['title', 'source', 'url', 'author', 'tags', 'score', 'publishedAt', 'isRead', 'isFavorite'];

export class CsvFormatter extends BaseFormatter {
  readonly format = 'csv';
  readonly extension = 'csv';

  private options: CsvOptions;

  constructor(options: CsvOptions = {}) {
    super();
    this.options = {
      delimiter: ',',
      includeHeaders: true,
      fields: DEFAULT_FIELDS,
      ...options,
    };
  }

  render(article: ArticleExportData): string {
    const lines: string[] = [];

    if (this.options.includeHeaders) {
      lines.push(this.options.fields!.join(this.options.delimiter));
    }

    lines.push(this.formatRow(article));

    return lines.join('\n');
  }

  renderMany(articles: ArticleExportData[]): string {
    const lines: string[] = [];

    if (this.options.includeHeaders) {
      lines.push(this.options.fields!.join(this.options.delimiter));
    }

    for (const article of articles) {
      lines.push(this.formatRow(article));
    }

    return lines.join('\n');
  }

  private formatRow(article: ArticleExportData): string {
    return this.options.fields!.map(field => {
      const value = this.getValue(article, field);
      return this.escapeValue(value);
    }).join(this.options.delimiter);
  }

  private getValue(article: ArticleExportData, field: string): string {
    const value = (article as any)[field];

    if (value === undefined || value === null) {
      return '';
    }

    if (Array.isArray(value)) {
      return value.join('; ');
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    return String(value);
  }

  private escapeValue(value: string): string {
    // Escape quotes and wrap in quotes if contains delimiter, quotes, or newlines
    if (value.includes(this.options.delimiter!) || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
```

**Step 3: Run tests**

Run: `npm test -- src/core/export/formatters/csv.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/core/export/formatters/csv.ts src/core/export/formatters/csv.test.ts
git commit -m "feat(export): add CSV formatter"
```

---

### Task 7: Create HTML Formatter

**Files:**
- Create: `src/core/export/formatters/html.ts`
- Create: `src/core/export/formatters/html.test.ts`

**Step 1: Write the test file**

```typescript
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
```

**Step 2: Write the implementation**

```typescript
import { BaseFormatter } from './base';
import type { ArticleExportData } from '../types';

export interface HtmlOptions {
  standalone?: boolean;
  includeStyles?: boolean;
  template?: string;
}

const DEFAULT_STYLES = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333; }
  h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; }
  h2 { color: #555; margin-top: 30px; }
  .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
  .tags { margin-top: 20px; }
  .tag { display: inline-block; background: #f0f0f0; padding: 4px 10px; border-radius: 4px; margin-right: 8px; font-size: 13px; }
  .summary { background: #f9f9f9; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0; }
  .toc { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
  .toc ul { margin: 10px 0 0 20px; }
  .article { border-bottom: 1px solid #eee; padding-bottom: 30px; margin-bottom: 30px; }
  a { color: #2563eb; }
`;

export class HtmlFormatter extends BaseFormatter {
  readonly format = 'html';
  readonly extension = 'html';

  private options: HtmlOptions;

  constructor(options: HtmlOptions = {}) {
    super();
    this.options = {
      standalone: true,
      includeStyles: true,
      ...options,
    };
  }

  render(article: ArticleExportData): string {
    const content = this.renderArticleContent(article);

    if (!this.options.standalone) {
      return content;
    }

    return this.wrapInDocument(article.title, content);
  }

  renderMany(articles: ArticleExportData[]): string {
    const toc = this.renderTableOfContents(articles);
    const content = articles.map((a, i) =>
      `<div class="article" id="article-${i}">${this.renderArticleContent(a)}</div>`
    ).join('\n');

    const title = `Export - ${new Date().toLocaleDateString()}`;
    return this.wrapInDocument(title, toc + content);
  }

  private renderArticleContent(article: ArticleExportData): string {
    const lines: string[] = [];

    lines.push(`<h1>${this.escapeHtml(article.title)}</h1>`);

    // Meta
    const meta: string[] = [];
    if (article.source) meta.push(`Source: ${this.escapeHtml(article.source)}`);
    if (article.author) meta.push(`Author: ${this.escapeHtml(article.author)}`);
    if (article.publishedAt) {
      meta.push(`Date: ${new Date(article.publishedAt).toLocaleDateString()}`);
    }
    if (article.url) {
      meta.push(`<a href="${article.url}" target="_blank">Original</a>`);
    }
    if (meta.length > 0) {
      lines.push(`<p class="meta">${meta.join(' | ')}</p>`);
    }

    // Summary
    if (article.summary) {
      lines.push(`<div class="summary"><strong>Summary:</strong> ${this.escapeHtml(article.summary)}</div>`);
    }

    // Content
    lines.push(`<div class="content">${this.formatContent(article.content)}</div>`);

    // Tags
    if (article.tags.length > 0) {
      lines.push('<div class="tags">');
      article.tags.forEach(tag => {
        lines.push(`<span class="tag">#${this.escapeHtml(tag)}</span>`);
      });
      lines.push('</div>');
    }

    return lines.join('\n');
  }

  private renderTableOfContents(articles: ArticleExportData[]): string {
    const items = articles.map((a, i) =>
      `<li><a href="#article-${i}">${this.escapeHtml(a.title)}</a></li>`
    ).join('\n');

    return `
      <div class="toc">
        <h2>Table of Contents</h2>
        <p>${articles.length} articles</p>
        <ul>${items}</ul>
      </div>
    `;
  }

  private wrapInDocument(title: string, content: string): string {
    const styles = this.options.includeStyles ? `<style>${DEFAULT_STYLES}</style>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  ${styles}
</head>
<body>
  ${content}
</body>
</html>`;
  }

  private formatContent(content: string): string {
    // Basic markdown-like formatting
    return content
      .split('\n\n')
      .map(p => `<p>${this.escapeHtml(p)}</p>`)
      .join('\n');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
```

**Step 3: Run tests**

Run: `npm test -- src/core/export/formatters/html.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/core/export/formatters/html.ts src/core/export/formatters/html.test.ts
git commit -m "feat(export): add HTML formatter"
```

---

### Task 8: Create PDF Formatter

**Files:**
- Create: `src/core/export/formatters/pdf.ts`
- Create: `src/core/export/formatters/pdf.test.ts`

**Step 1: Write the test file**

```typescript
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
```

**Step 2: Write the implementation**

```typescript
import { jsPDF } from 'jspdf';
import { BaseFormatter } from './base';
import type { ArticleExportData } from '../types';

export interface PdfOptions {
  pageSize?: 'a4' | 'letter';
  includeHeader?: boolean;
  includeFooter?: boolean;
  fontSize?: number;
}

export class PdfFormatter extends BaseFormatter {
  readonly format = 'pdf';
  readonly extension = 'pdf';

  private options: PdfOptions;

  constructor(options: PdfOptions = {}) {
    super();
    this.options = {
      pageSize: 'a4',
      includeHeader: true,
      includeFooter: true,
      fontSize: 12,
      ...options,
    };
  }

  render(article: ArticleExportData): Buffer {
    const doc = this.createDocument();

    this.renderArticle(doc, article);

    return Buffer.from(doc.output('arraybuffer'));
  }

  renderMany(articles: ArticleExportData[]): Buffer {
    const doc = this.createDocument();

    // Title page
    doc.setFontSize(24);
    doc.text('Article Export', 20, 40);
    doc.setFontSize(14);
    doc.text(`${articles.length} articles`, 20, 55);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 65);

    // Table of contents
    doc.addPage();
    doc.setFontSize(18);
    doc.text('Table of Contents', 20, 30);
    doc.setFontSize(12);

    let y = 50;
    articles.forEach((article, index) => {
      if (y > 270) {
        doc.addPage();
        y = 30;
      }
      doc.text(`${index + 1}. ${article.title.slice(0, 60)}`, 20, y);
      y += 10;
    });

    // Articles
    for (const article of articles) {
      doc.addPage();
      this.renderArticle(doc, article);
    }

    return Buffer.from(doc.output('arraybuffer'));
  }

  private createDocument(): jsPDF {
    return new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: this.options.pageSize,
    });
  }

  private renderArticle(doc: jsPDF, article: ArticleExportData): void {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;
    let y = 30;

    // Header
    if (this.options.includeHeader) {
      doc.setFontSize(10);
      doc.setTextColor(128);
      doc.text(`Atlas Export - ${new Date().toLocaleDateString()}`, margin, 15);
      doc.setTextColor(0);
    }

    // Title
    doc.setFontSize(18);
    const titleLines = doc.splitTextToSize(article.title, maxWidth);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 8 + 5;

    // Meta
    doc.setFontSize(10);
    doc.setTextColor(100);
    const meta: string[] = [];
    if (article.source) meta.push(`Source: ${article.source}`);
    if (article.author) meta.push(`Author: ${article.author}`);
    if (article.publishedAt) {
      meta.push(`Date: ${new Date(article.publishedAt).toLocaleDateString()}`);
    }
    if (meta.length > 0) {
      doc.text(meta.join(' | '), margin, y);
      y += 10;
    }
    doc.setTextColor(0);

    // Summary
    if (article.summary) {
      doc.setFontSize(11);
      doc.setFillColor(245, 245, 245);
      const summaryLines = doc.splitTextToSize(`Summary: ${article.summary}`, maxWidth - 10);
      const summaryHeight = summaryLines.length * 6 + 10;
      doc.rect(margin, y, maxWidth, summaryHeight, 'F');
      doc.text(summaryLines, margin + 5, y + 8);
      y += summaryHeight + 10;
    }

    // Content
    doc.setFontSize(this.options.fontSize!);
    const contentLines = doc.splitTextToSize(article.content, maxWidth);

    for (const line of contentLines) {
      if (y > 270) {
        doc.addPage();
        y = 30;
      }
      doc.text(line, margin, y);
      y += 6;
    }

    // Tags
    if (article.tags.length > 0) {
      y += 10;
      if (y > 270) {
        doc.addPage();
        y = 30;
      }
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`Tags: ${article.tags.map(t => `#${t}`).join(' ')}`, margin, y);
      doc.setTextColor(0);
    }

    // Footer
    if (this.options.includeFooter) {
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text(`${article.url || ''}`, margin, pageHeight - 10);
      doc.setTextColor(0);
    }
  }

  protected async writeFile(filepath: string, content: Buffer): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const dir = path.dirname(filepath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filepath, content);
  }
}
```

**Step 3: Run tests**

Run: `npm test -- src/core/export/formatters/pdf.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/core/export/formatters/pdf.ts src/core/export/formatters/pdf.test.ts
git commit -m "feat(export): add PDF formatter"
```

---

### Task 9: Create Formatters Index

**Files:**
- Create: `src/core/export/formatters/index.ts`

**Step 1: Create the index file**

```typescript
export { BaseFormatter, type Formatter, type ExportOptions } from './base';
export { MarkdownFormatter, type MarkdownOptions } from './markdown';
export { JsonFormatter, type JsonOptions } from './json';
export { CsvFormatter, type CsvOptions } from './csv';
export { HtmlFormatter, type HtmlOptions } from './html';
export { PdfFormatter, type PdfOptions } from './pdf';

import type { ExportFormat } from '../types';
import type { Formatter } from './base';
import { MarkdownFormatter } from './markdown';
import { JsonFormatter } from './json';
import { CsvFormatter } from './csv';
import { HtmlFormatter } from './html';
import { PdfFormatter } from './pdf';

const formatters: Record<ExportFormat, () => Formatter> = {
  markdown: () => new MarkdownFormatter(),
  json: () => new JsonFormatter(),
  csv: () => new CsvFormatter(),
  html: () => new HtmlFormatter(),
  pdf: () => new PdfFormatter(),
};

export function getFormatter(format: ExportFormat): Formatter {
  const factory = formatters[format];
  if (!factory) {
    throw new Error(`Unknown export format: ${format}`);
  }
  return factory();
}
```

**Step 2: Commit**

```bash
git add src/core/export/formatters/index.ts
git commit -m "feat(export): add formatters index"
```

---

## Phase 3: Export Service

### Task 10: Create Export Service

**Files:**
- Create: `src/core/export/export-service.ts`
- Create: `src/core/export/export-service.test.ts`

**Step 1: Write the test file**

```typescript
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
```

**Step 2: Write the implementation**

```typescript
import * as path from 'path';
import { getFormatter } from './formatters';
import type { ExportFormat, ExportConfig, ExportResult, ArticleExportData } from './types';

export class ExportService {
  private config: ExportConfig;

  constructor(config: Partial<ExportConfig> = {}) {
    this.config = {
      outputDir: config.outputDir || '~/Atlas/exports',
      formats: {
        markdown: { includeMetadata: true, includeSummary: true },
        pdf: { pageSize: 'a4', includeHeader: true, includeFooter: true, fontSize: 12 },
        html: { standalone: true, includeStyles: true },
        json: { pretty: true, includeContent: true },
        csv: { delimiter: ',', includeHeaders: true, fields: ['title', 'source', 'url', 'tags', 'score', 'publishedAt'] },
        ...config.formats,
      },
      dailyBrief: {
        enabled: false,
        time: '08:00',
        format: 'markdown',
        folder: 'daily',
        maxItems: 10,
        minScore: 5,
        ...config.dailyBrief,
      },
    };
  }

  /**
   * Export a single article
   */
  async exportArticle(
    article: ArticleExportData,
    format: ExportFormat,
    outputPath?: string
  ): Promise<ExportResult> {
    const formatter = getFormatter(format);
    const outPath = outputPath || this.resolveOutputDir();

    return formatter.exportOne(article, { outputPath: outPath });
  }

  /**
   * Export multiple articles to a single file
   */
  async exportArticles(
    articles: ArticleExportData[],
    format: ExportFormat,
    outputPath?: string
  ): Promise<ExportResult> {
    const formatter = getFormatter(format);
    const outPath = outputPath || this.resolveOutputDir();

    return formatter.exportMany(articles, { outputPath: outPath });
  }

  /**
   * Export each article as a separate file
   */
  async exportArticlesSeparate(
    articles: ArticleExportData[],
    format: ExportFormat,
    outputPath?: string
  ): Promise<ExportResult[]> {
    const results: ExportResult[] = [];

    for (const article of articles) {
      const result = await this.exportArticle(article, format, outputPath);
      results.push(result);
    }

    return results;
  }

  /**
   * Create a full backup in JSON format
   */
  async backup(articles: ArticleExportData[], outputPath?: string): Promise<ExportResult> {
    const formatter = getFormatter('json');
    const outPath = outputPath || path.join(this.resolveOutputDir(), 'backups');

    const result = await formatter.exportMany(articles, { outputPath: outPath });

    // Rename to backup format
    if (result.success && result.filepath) {
      const fs = await import('fs/promises');
      const date = new Date().toISOString().split('T')[0];
      const backupPath = path.join(path.dirname(result.filepath), `backup-${date}.json`);
      await fs.rename(result.filepath, backupPath);
      result.filepath = backupPath;
    }

    return result;
  }

  /**
   * Get content without saving (for preview)
   */
  preview(article: ArticleExportData, format: ExportFormat): string | Buffer {
    const formatter = getFormatter(format);
    return formatter.render(article);
  }

  /**
   * Get config
   */
  getConfig(): ExportConfig {
    return this.config;
  }

  /**
   * Update config
   */
  setConfig(config: Partial<ExportConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private resolveOutputDir(): string {
    let dir = this.config.outputDir;

    // Expand ~ to home directory
    if (dir.startsWith('~')) {
      const os = require('os');
      dir = path.join(os.homedir(), dir.slice(1));
    }

    return dir;
  }
}
```

**Step 3: Run tests**

Run: `npm test -- src/core/export/export-service.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/core/export/export-service.ts src/core/export/export-service.test.ts
git commit -m "feat(export): add ExportService for managing exports"
```

---

## Phase 4: Daily Brief Generator

### Task 11: Create Daily Brief Generator

**Files:**
- Create: `src/core/export/daily-brief.ts`
- Create: `src/core/export/daily-brief.test.ts`

**Step 1: Write the test file**

```typescript
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
```

**Step 2: Write the implementation**

```typescript
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
```

**Step 3: Run tests**

Run: `npm test -- src/core/export/daily-brief.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/core/export/daily-brief.ts src/core/export/daily-brief.test.ts
git commit -m "feat(export): add DailyBriefGenerator"
```

---

### Task 12: Create Export Module Index

**Files:**
- Create: `src/core/export/index.ts`
- Modify: `src/core/index.ts`

**Step 1: Create export index**

```typescript
// src/core/export/index.ts
export * from './types';
export { ExportService } from './export-service';
export { DailyBriefGenerator } from './daily-brief';
export * from './formatters';
```

**Step 2: Add to core index**

Add to `src/core/index.ts`:

```typescript
// P4: Export
export * from './export';
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/core/export/index.ts src/core/index.ts
git commit -m "feat(export): add export module to core"
```

---

## Phase 5: UI Integration

### Task 13: Add Export Button to Article Detail

**Files:**
- Modify: `src/components/ArticleDetail.tsx`

**Step 1: Add export dropdown to article detail**

Add to the ArticleDetail component's action buttons:

```tsx
// Add state for export menu
const [showExportMenu, setShowExportMenu] = useState(false);

// Add export handler
const handleExport = async (format: 'markdown' | 'pdf' | 'html' | 'json') => {
  if (!article) return;

  const exportData = {
    id: article.id,
    title: article.title,
    content: article.content,
    source: article.sourceName,
    url: article.url,
    author: article.author,
    publishedAt: article.publishedAt ? new Date(article.publishedAt).toISOString() : undefined,
    tags: article.tags || [],
    score: article.score,
    summary: article.summary,
    isRead: article.isRead,
    isFavorite: article.isFavorite,
  };

  // For Chrome extension, download via blob
  const { ExportService } = await import('../core/export');
  const service = new ExportService();
  const content = service.preview(exportData, format);

  const blob = new Blob(
    [content],
    { type: format === 'pdf' ? 'application/pdf' : 'text/plain' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${article.title.slice(0, 30)}.${format === 'markdown' ? 'md' : format}`;
  a.click();
  URL.revokeObjectURL(url);

  setShowExportMenu(false);
};

// Add to JSX (in article-detail-actions div)
<div className="export-dropdown">
  <button
    className="action-btn"
    onClick={() => setShowExportMenu(!showExportMenu)}
    title="Export"
  >
    ↓
  </button>
  {showExportMenu && (
    <div className="export-menu">
      <button onClick={() => handleExport('markdown')}>Markdown</button>
      <button onClick={() => handleExport('pdf')}>PDF</button>
      <button onClick={() => handleExport('html')}>HTML</button>
      <button onClick={() => handleExport('json')}>JSON</button>
    </div>
  )}
</div>
```

**Step 2: Add export dropdown styles to sidepanel.css**

```css
/* ===== Export Dropdown ===== */
.export-dropdown {
  position: relative;
}

.export-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  min-width: 120px;
  overflow: hidden;
}

.export-menu button {
  display: block;
  width: 100%;
  padding: 10px 16px;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
}

.export-menu button:hover {
  background: var(--bg-hover);
}
```

**Step 3: Commit**

```bash
git add src/components/ArticleDetail.tsx sidepanel.css
git commit -m "feat(ui): add export button to article detail"
```

---

### Task 14: Add Batch Export to Articles View

**Files:**
- Modify: `src/components/ArticlesView.tsx`

**Step 1: Add batch export functionality**

Add export all button and handler to ArticlesView:

```tsx
// Add to header actions
<button
  className="view-header-action"
  onClick={handleExportAll}
  title="Export All"
>
  Export
</button>

// Add handler
const handleExportAll = async () => {
  const format = window.prompt('Export format (markdown, json, csv):', 'markdown');
  if (!format || !['markdown', 'json', 'csv'].includes(format)) return;

  const { ExportService } = await import('../core/export');
  const service = new ExportService();

  const exportData = articles.map(a => ({
    id: a.id,
    title: a.title,
    content: a.content || '',
    source: a.sourceName,
    url: a.url,
    tags: a.tags || [],
    score: a.score,
    summary: a.summary,
    isRead: a.isRead,
    isFavorite: a.isFavorite,
  }));

  const content = service.preview(exportData[0], format as any); // For batch, use renderMany
  // ... similar download logic
};
```

**Step 2: Commit**

```bash
git add src/components/ArticlesView.tsx
git commit -m "feat(ui): add batch export to articles view"
```

---

## Summary

**Total Tasks:** 14

**Phase 1 (Tasks 1-3):** Export foundation
- Dependencies, types, base formatter

**Phase 2 (Tasks 4-9):** Format implementations
- Markdown, JSON, CSV, HTML, PDF formatters

**Phase 3 (Task 10):** Export service
- Main service for managing exports

**Phase 4 (Tasks 11-12):** Daily brief
- Generator and module index

**Phase 5 (Tasks 13-14):** UI integration
- Export buttons in article views

---

**After completing all tasks:**

1. Export articles to Markdown, PDF, HTML, JSON, CSV
2. Single and batch export support
3. Daily brief generation with statistics
4. Export buttons in article detail and list views
5. Full backup functionality
