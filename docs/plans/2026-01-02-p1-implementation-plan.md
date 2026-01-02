# P1 信息采集实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现插件化信息采集架构，包含 RSS 源作为第一个实现验证架构设计。

**Architecture:** 创建 `src/core/` 共享模块，包含 Source 插件接口、Dexie 存储层、调度器。Chrome Extension 和 Electron 各自集成核心模块。

**Tech Stack:** TypeScript, Dexie.js (IndexedDB), Vitest (测试)

---

## Task 1: 安装依赖

**Files:**
- Modify: `package.json`

**Step 1: 安装 Dexie.js**

Run: `npm install dexie`

**Step 2: 安装测试框架 Vitest**

Run: `npm install -D vitest @vitest/ui happy-dom`

**Step 3: 添加测试脚本到 package.json**

在 `package.json` 的 scripts 中添加：

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

**Step 4: 创建 vitest 配置**

创建文件 `vitest.config.ts`：

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
```

**Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add dexie and vitest dependencies"
```

---

## Task 2: 创建 Source 类型定义

**Files:**
- Create: `src/core/sources/types.ts`

**Step 1: 创建目录结构**

Run: `mkdir -p src/core/sources`

**Step 2: 创建类型定义文件**

创建文件 `src/core/sources/types.ts`：

```typescript
/**
 * 信息源类型
 */
export type SourceType = 'rss' | 'web' | 'api' | 'github' | 'arxiv';

/**
 * 信息源配置（用户定义）
 */
export interface SourceConfig {
  id: string;
  name: string;
  type: SourceType;
  enabled: boolean;
  schedule: string;  // 如 "1h", "30m", "1d"
  config: Record<string, unknown>;
}

/**
 * 抓取到的文章/条目
 */
export interface Article {
  id: string;
  sourceId: string;
  title: string;
  content: string;
  url: string;
  author?: string;
  publishedAt: Date;
  fetchedAt: Date;
  metadata: Record<string, unknown>;
}

/**
 * 抓取结果
 */
export interface FetchResult {
  success: boolean;
  articles: Article[];
  error?: string;
  nextCursor?: string;
}

/**
 * 信息源插件接口 - 所有源必须实现
 */
export interface Source {
  readonly type: SourceType;

  /**
   * 验证配置是否有效
   */
  validate(config: SourceConfig): Promise<{ valid: boolean; error?: string }>;

  /**
   * 抓取内容
   */
  fetch(config: SourceConfig, cursor?: string): Promise<FetchResult>;

  /**
   * 获取配置 Schema（用于 UI 动态生成表单）
   */
  getConfigSchema(): Record<string, unknown>;
}
```

**Step 3: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

**Step 4: Commit**

```bash
git add src/core/sources/types.ts
git commit -m "feat(core): add Source plugin interface types"
```

---

## Task 3: 创建存储层

**Files:**
- Create: `src/core/storage/db.ts`
- Create: `src/core/storage/db.test.ts`

**Step 1: 创建目录**

Run: `mkdir -p src/core/storage`

**Step 2: 写测试（TDD）**

创建文件 `src/core/storage/db.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { db, StoredArticle, StoredSource } from './db';

describe('AtlasDB', () => {
  beforeEach(async () => {
    // 清空数据库
    await db.articles.clear();
    await db.sources.clear();
  });

  describe('articles', () => {
    it('should add and retrieve an article', async () => {
      const article: StoredArticle = {
        id: 'test-1',
        sourceId: 'source-1',
        title: 'Test Article',
        content: 'Test content',
        url: 'https://example.com/article',
        publishedAt: Date.now(),
        fetchedAt: Date.now(),
        metadata: '{}',
        isRead: false,
        isFavorite: false,
      };

      await db.articles.add(article);
      const retrieved = await db.articles.get('test-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe('Test Article');
    });

    it('should query unread articles', async () => {
      await db.articles.bulkAdd([
        { id: '1', sourceId: 's1', title: 'Read', content: '', url: '', publishedAt: 1, fetchedAt: 1, metadata: '{}', isRead: true, isFavorite: false },
        { id: '2', sourceId: 's1', title: 'Unread', content: '', url: '', publishedAt: 2, fetchedAt: 2, metadata: '{}', isRead: false, isFavorite: false },
      ]);

      const unread = await db.articles.where('isRead').equals(0).toArray();
      expect(unread).toHaveLength(1);
      expect(unread[0].title).toBe('Unread');
    });
  });

  describe('sources', () => {
    it('should add and retrieve a source', async () => {
      const source: StoredSource = {
        id: 'source-1',
        name: 'Test Source',
        type: 'rss',
        enabled: true,
        schedule: '1h',
        config: '{"url":"https://example.com/feed"}',
      };

      await db.sources.add(source);
      const retrieved = await db.sources.get('source-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Source');
    });
  });
});
```

**Step 3: 运行测试验证失败**

Run: `npm test`
Expected: FAIL（db 模块不存在）

**Step 4: 实现存储层**

创建文件 `src/core/storage/db.ts`：

```typescript
import Dexie, { Table } from 'dexie';

export interface StoredArticle {
  id: string;
  sourceId: string;
  title: string;
  content: string;
  url: string;
  author?: string;
  publishedAt: number;
  fetchedAt: number;
  metadata: string;
  isRead: boolean;
  isFavorite: boolean;
}

export interface StoredSource {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  schedule: string;
  config: string;
  lastFetchAt?: number;
  lastError?: string;
}

export class AtlasDB extends Dexie {
  articles!: Table<StoredArticle>;
  sources!: Table<StoredSource>;

  constructor() {
    super('AtlasDB');

    this.version(1).stores({
      // isRead/isFavorite 用 0/1 存储以支持索引
      articles: 'id, sourceId, publishedAt, fetchedAt, isRead, isFavorite',
      sources: 'id, type, enabled',
    });
  }
}

export const db = new AtlasDB();
```

**Step 5: 运行测试验证通过**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/core/storage/
git commit -m "feat(core): add Dexie storage layer with tests"
```

---

## Task 4: 创建 RSS 解析器

**Files:**
- Create: `src/core/sources/rss/parser.ts`
- Create: `src/core/sources/rss/parser.test.ts`

**Step 1: 创建目录**

Run: `mkdir -p src/core/sources/rss`

**Step 2: 写测试**

创建文件 `src/core/sources/rss/parser.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { parseRSS, RSSItem } from './parser';

const RSS_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Article 1</title>
      <link>https://example.com/1</link>
      <description>Description 1</description>
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
      <guid>guid-1</guid>
    </item>
    <item>
      <title>Article 2</title>
      <link>https://example.com/2</link>
      <description>Description 2</description>
      <pubDate>Tue, 02 Jan 2024 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <title>Atom Article</title>
    <link href="https://example.com/atom/1"/>
    <summary>Atom summary</summary>
    <published>2024-01-01T00:00:00Z</published>
    <id>atom-id-1</id>
  </entry>
</feed>`;

describe('parseRSS', () => {
  it('should parse RSS 2.0 feed', () => {
    const items = parseRSS(RSS_SAMPLE);

    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('Article 1');
    expect(items[0].link).toBe('https://example.com/1');
    expect(items[0].description).toBe('Description 1');
    expect(items[0].guid).toBe('guid-1');
  });

  it('should parse Atom feed', () => {
    const items = parseRSS(ATOM_SAMPLE);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Atom Article');
    expect(items[0].link).toBe('https://example.com/atom/1');
    expect(items[0].description).toBe('Atom summary');
  });

  it('should respect maxItems limit', () => {
    const items = parseRSS(RSS_SAMPLE, 1);
    expect(items).toHaveLength(1);
  });

  it('should handle empty feed', () => {
    const items = parseRSS('<rss><channel></channel></rss>');
    expect(items).toHaveLength(0);
  });
});
```

**Step 3: 运行测试验证失败**

Run: `npm test`
Expected: FAIL

**Step 4: 实现解析器**

创建文件 `src/core/sources/rss/parser.ts`：

```typescript
export interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid?: string;
  author?: string;
  content?: string;
}

/**
 * 解析 RSS 2.0 或 Atom feed
 */
export function parseRSS(xml: string, maxItems = 50): RSSItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  // 检查是否是 Atom
  const isAtom = doc.querySelector('feed') !== null;

  if (isAtom) {
    return parseAtom(doc, maxItems);
  }

  return parseRSS2(doc, maxItems);
}

function parseRSS2(doc: Document, maxItems: number): RSSItem[] {
  const items: RSSItem[] = [];
  const itemElements = doc.querySelectorAll('item');

  for (let i = 0; i < Math.min(itemElements.length, maxItems); i++) {
    const item = itemElements[i];
    items.push({
      title: getTextContent(item, 'title'),
      link: getTextContent(item, 'link'),
      description: getTextContent(item, 'description'),
      pubDate: getTextContent(item, 'pubDate'),
      guid: getTextContent(item, 'guid') || undefined,
      author: getTextContent(item, 'author') || getTextContent(item, 'dc\\:creator') || undefined,
      content: getTextContent(item, 'content\\:encoded') || undefined,
    });
  }

  return items;
}

function parseAtom(doc: Document, maxItems: number): RSSItem[] {
  const items: RSSItem[] = [];
  const entries = doc.querySelectorAll('entry');

  for (let i = 0; i < Math.min(entries.length, maxItems); i++) {
    const entry = entries[i];
    const linkEl = entry.querySelector('link');

    items.push({
      title: getTextContent(entry, 'title'),
      link: linkEl?.getAttribute('href') || '',
      description: getTextContent(entry, 'summary') || getTextContent(entry, 'content'),
      pubDate: getTextContent(entry, 'published') || getTextContent(entry, 'updated'),
      guid: getTextContent(entry, 'id') || undefined,
      author: getTextContent(entry, 'author name') || undefined,
      content: getTextContent(entry, 'content') || undefined,
    });
  }

  return items;
}

function getTextContent(parent: Element, selector: string): string {
  return parent.querySelector(selector)?.textContent?.trim() || '';
}
```

**Step 5: 运行测试验证通过**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/core/sources/rss/
git commit -m "feat(core): add RSS/Atom parser with tests"
```

---

## Task 5: 实现 RSSSource 插件

**Files:**
- Create: `src/core/sources/rss/index.ts`
- Create: `src/core/sources/rss/index.test.ts`

**Step 1: 写测试**

创建文件 `src/core/sources/rss/index.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RSSSource } from './index';
import type { SourceConfig } from '../types';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('RSSSource', () => {
  let source: RSSSource;

  beforeEach(() => {
    source = new RSSSource();
    mockFetch.mockReset();
  });

  describe('type', () => {
    it('should be rss', () => {
      expect(source.type).toBe('rss');
    });
  });

  describe('validate', () => {
    it('should reject invalid URL', async () => {
      const config: SourceConfig = {
        id: '1', name: 'Test', type: 'rss', enabled: true, schedule: '1h',
        config: { url: 'not-a-url' },
      };

      const result = await source.validate(config);
      expect(result.valid).toBe(false);
    });

    it('should accept valid URL', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const config: SourceConfig = {
        id: '1', name: 'Test', type: 'rss', enabled: true, schedule: '1h',
        config: { url: 'https://example.com/feed.xml' },
      };

      const result = await source.validate(config);
      expect(result.valid).toBe(true);
    });
  });

  describe('fetch', () => {
    it('should fetch and parse RSS feed', async () => {
      const rssXml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>Test Article</title>
              <link>https://example.com/1</link>
              <description>Content</description>
              <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(rssXml),
      });

      const config: SourceConfig = {
        id: 'source-1', name: 'Test', type: 'rss', enabled: true, schedule: '1h',
        config: { url: 'https://example.com/feed.xml' },
      };

      const result = await source.fetch(config);

      expect(result.success).toBe(true);
      expect(result.articles).toHaveLength(1);
      expect(result.articles[0].title).toBe('Test Article');
      expect(result.articles[0].sourceId).toBe('source-1');
    });

    it('should handle fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const config: SourceConfig = {
        id: '1', name: 'Test', type: 'rss', enabled: true, schedule: '1h',
        config: { url: 'https://example.com/feed.xml' },
      };

      const result = await source.fetch(config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('getConfigSchema', () => {
    it('should return valid JSON schema', () => {
      const schema = source.getConfigSchema();

      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('url');
      expect(schema.required).toContain('url');
    });
  });
});
```

**Step 2: 运行测试验证失败**

Run: `npm test`
Expected: FAIL

**Step 3: 实现 RSSSource**

创建文件 `src/core/sources/rss/index.ts`：

```typescript
import type { Source, SourceConfig, FetchResult, Article } from '../types';
import { parseRSS } from './parser';

export interface RSSSourceConfig {
  url: string;
  maxItems?: number;
}

export class RSSSource implements Source {
  readonly type = 'rss' as const;

  async validate(config: SourceConfig): Promise<{ valid: boolean; error?: string }> {
    const { url } = config.config as RSSSourceConfig;

    if (!url || !url.startsWith('http')) {
      return { valid: false, error: '请输入有效的 RSS URL' };
    }

    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (!response.ok) {
        return { valid: false, error: `无法访问: HTTP ${response.status}` };
      }
      return { valid: true };
    } catch (e) {
      return { valid: false, error: '网络请求失败' };
    }
  }

  async fetch(config: SourceConfig): Promise<FetchResult> {
    const { url, maxItems = 50 } = config.config as RSSSourceConfig;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return { success: false, articles: [], error: `HTTP ${response.status}` };
      }

      const xml = await response.text();
      const items = parseRSS(xml, maxItems);

      const articles: Article[] = items.map(item => ({
        id: this.generateId(item.link || item.guid || item.title),
        sourceId: config.id,
        title: item.title,
        content: item.content || item.description || '',
        url: item.link,
        author: item.author,
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        fetchedAt: new Date(),
        metadata: { guid: item.guid },
      }));

      return { success: true, articles };
    } catch (e) {
      return { success: false, articles: [], error: String(e) };
    }
  }

  getConfigSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          title: 'RSS URL',
          format: 'uri',
          description: 'RSS 或 Atom feed 的 URL',
        },
        maxItems: {
          type: 'number',
          title: '最大条目数',
          default: 50,
          minimum: 1,
          maximum: 100,
        },
      },
      required: ['url'],
    };
  }

  private generateId(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return `rss-${Math.abs(hash).toString(36)}`;
  }
}
```

**Step 4: 运行测试验证通过**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/sources/rss/
git commit -m "feat(core): implement RSSSource plugin with tests"
```

---

## Task 6: 创建插件注册表

**Files:**
- Create: `src/core/sources/registry.ts`
- Create: `src/core/sources/registry.test.ts`

**Step 1: 写测试**

创建文件 `src/core/sources/registry.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SourceRegistry } from './registry';
import { RSSSource } from './rss';

describe('SourceRegistry', () => {
  let registry: SourceRegistry;

  beforeEach(() => {
    registry = new SourceRegistry();
  });

  it('should register and retrieve a source', () => {
    const rssSource = new RSSSource();
    registry.register(rssSource);

    const retrieved = registry.get('rss');
    expect(retrieved).toBe(rssSource);
  });

  it('should return undefined for unregistered type', () => {
    const retrieved = registry.get('unknown' as any);
    expect(retrieved).toBeUndefined();
  });

  it('should list all registered sources', () => {
    registry.register(new RSSSource());

    const all = registry.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].type).toBe('rss');
  });
});
```

**Step 2: 运行测试验证失败**

Run: `npm test`
Expected: FAIL

**Step 3: 实现注册表**

创建文件 `src/core/sources/registry.ts`：

```typescript
import type { Source, SourceType } from './types';

export class SourceRegistry {
  private sources = new Map<SourceType, Source>();

  register(source: Source): void {
    this.sources.set(source.type, source);
  }

  get(type: SourceType): Source | undefined {
    return this.sources.get(type);
  }

  getAll(): Source[] {
    return Array.from(this.sources.values());
  }

  has(type: SourceType): boolean {
    return this.sources.has(type);
  }
}

// 默认注册表实例
import { RSSSource } from './rss';

export const registry = new SourceRegistry();
registry.register(new RSSSource());
```

**Step 4: 运行测试验证通过**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/sources/registry.ts src/core/sources/registry.test.ts
git commit -m "feat(core): add SourceRegistry for plugin management"
```

---

## Task 7: 创建调度器

**Files:**
- Create: `src/core/scheduler/scheduler.ts`
- Create: `src/core/scheduler/scheduler.test.ts`

**Step 1: 创建目录**

Run: `mkdir -p src/core/scheduler`

**Step 2: 写测试**

创建文件 `src/core/scheduler/scheduler.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Scheduler, parseSchedule } from './scheduler';
import { db } from '../storage/db';
import { registry } from '../sources/registry';

describe('parseSchedule', () => {
  it('should parse minutes', () => {
    expect(parseSchedule('30m')).toBe(30 * 60 * 1000);
  });

  it('should parse hours', () => {
    expect(parseSchedule('2h')).toBe(2 * 60 * 60 * 1000);
  });

  it('should parse days', () => {
    expect(parseSchedule('1d')).toBe(24 * 60 * 60 * 1000);
  });

  it('should default to 1h for invalid format', () => {
    expect(parseSchedule('invalid')).toBe(60 * 60 * 1000);
  });
});

describe('Scheduler', () => {
  let scheduler: Scheduler;

  beforeEach(async () => {
    scheduler = new Scheduler();
    await db.articles.clear();
    await db.sources.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  it('should fetch source manually', async () => {
    // 添加测试源
    await db.sources.add({
      id: 'test-source',
      name: 'Test',
      type: 'rss',
      enabled: true,
      schedule: '1h',
      config: JSON.stringify({ url: 'https://example.com/feed.xml' }),
    });

    // Mock fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(`
        <rss version="2.0">
          <channel>
            <item>
              <title>Test</title>
              <link>https://example.com/1</link>
              <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>
      `),
    });
    global.fetch = mockFetch;

    const result = await scheduler.fetchNow('test-source');

    expect(result.count).toBe(1);
    expect(result.error).toBeUndefined();

    // 验证文章已存储
    const articles = await db.articles.toArray();
    expect(articles).toHaveLength(1);
  });

  it('should not duplicate articles', async () => {
    await db.sources.add({
      id: 'test-source',
      name: 'Test',
      type: 'rss',
      enabled: true,
      schedule: '1h',
      config: JSON.stringify({ url: 'https://example.com/feed.xml' }),
    });

    const rssXml = `
      <rss version="2.0">
        <channel>
          <item>
            <title>Same Article</title>
            <link>https://example.com/same</link>
            <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>
    `;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(rssXml),
    });

    // 抓取两次
    await scheduler.fetchNow('test-source');
    await scheduler.fetchNow('test-source');

    // 应该只有一条
    const articles = await db.articles.toArray();
    expect(articles).toHaveLength(1);
  });
});
```

**Step 3: 运行测试验证失败**

Run: `npm test`
Expected: FAIL

**Step 4: 实现调度器**

创建文件 `src/core/scheduler/scheduler.ts`：

```typescript
import { db } from '../storage/db';
import { registry } from '../sources/registry';
import type { SourceConfig, SourceType, Article } from '../sources/types';
import type { StoredArticle } from '../storage/db';

/**
 * 解析调度时间表达式
 * 支持: "30m" (30分钟), "2h" (2小时), "1d" (1天)
 */
export function parseSchedule(schedule: string): number {
  const match = schedule.match(/^(\d+)(m|h|d)$/);
  if (!match) return 60 * 60 * 1000; // 默认 1 小时

  const [, num, unit] = match;
  const multipliers: Record<string, number> = {
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return parseInt(num) * multipliers[unit];
}

export class Scheduler {
  private timers = new Map<string, ReturnType<typeof setInterval>>();

  /**
   * 启动所有启用的源的定时任务
   */
  async start(): Promise<void> {
    const sources = await db.sources.where('enabled').equals(1).toArray();

    for (const stored of sources) {
      const config: SourceConfig = {
        id: stored.id,
        name: stored.name,
        type: stored.type as SourceType,
        enabled: stored.enabled,
        schedule: stored.schedule,
        config: JSON.parse(stored.config),
      };
      this.scheduleSource(config);
    }
  }

  /**
   * 停止所有定时任务
   */
  stop(): void {
    this.timers.forEach(timer => clearInterval(timer));
    this.timers.clear();
  }

  /**
   * 手动触发抓取
   */
  async fetchNow(sourceId: string): Promise<{ count: number; error?: string }> {
    const stored = await db.sources.get(sourceId);
    if (!stored) {
      return { count: 0, error: '源不存在' };
    }

    const config: SourceConfig = {
      id: stored.id,
      name: stored.name,
      type: stored.type as SourceType,
      enabled: stored.enabled,
      schedule: stored.schedule,
      config: JSON.parse(stored.config),
    };

    const source = registry.get(config.type);
    if (!source) {
      return { count: 0, error: `不支持的源类型: ${config.type}` };
    }

    const result = await source.fetch(config);

    if (result.success) {
      let newCount = 0;

      for (const article of result.articles) {
        const exists = await db.articles.get(article.id);
        if (!exists) {
          const storedArticle: StoredArticle = {
            id: article.id,
            sourceId: article.sourceId,
            title: article.title,
            content: article.content,
            url: article.url,
            author: article.author,
            publishedAt: article.publishedAt.getTime(),
            fetchedAt: article.fetchedAt.getTime(),
            metadata: JSON.stringify(article.metadata),
            isRead: false,
            isFavorite: false,
          };
          await db.articles.add(storedArticle);
          newCount++;
        }
      }

      await db.sources.update(sourceId, {
        lastFetchAt: Date.now(),
        lastError: undefined,
      });

      return { count: newCount };
    }

    await db.sources.update(sourceId, { lastError: result.error });
    return { count: 0, error: result.error };
  }

  /**
   * 添加源的定时任务
   */
  scheduleSource(config: SourceConfig): void {
    if (this.timers.has(config.id)) {
      clearInterval(this.timers.get(config.id));
    }

    const intervalMs = parseSchedule(config.schedule);
    const timer = setInterval(() => {
      this.fetchNow(config.id).catch(console.error);
    }, intervalMs);

    this.timers.set(config.id, timer);
  }

  /**
   * 移除源的定时任务
   */
  unscheduleSource(sourceId: string): void {
    const timer = this.timers.get(sourceId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(sourceId);
    }
  }
}

export const scheduler = new Scheduler();
```

**Step 5: 运行测试验证通过**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/core/scheduler/
git commit -m "feat(core): add Scheduler for periodic source fetching"
```

---

## Task 8: 创建核心模块入口

**Files:**
- Create: `src/core/index.ts`

**Step 1: 创建入口文件**

创建文件 `src/core/index.ts`：

```typescript
// Types
export * from './sources/types';

// Storage
export { db, AtlasDB } from './storage/db';
export type { StoredArticle, StoredSource } from './storage/db';

// Sources
export { registry, SourceRegistry } from './sources/registry';
export { RSSSource } from './sources/rss';

// Scheduler
export { scheduler, Scheduler, parseSchedule } from './scheduler/scheduler';
```

**Step 2: 验证导入**

Run: `npx tsc --noEmit`
Expected: 无错误

**Step 3: Commit**

```bash
git add src/core/index.ts
git commit -m "feat(core): add core module entry point"
```

---

## Task 9: 运行全部测试并验证

**Step 1: 运行所有测试**

Run: `npm test`
Expected: 全部 PASS

**Step 2: 运行构建**

Run: `npm run build`
Expected: 构建成功

**Step 3: Commit（如有修复）**

```bash
git add .
git commit -m "fix: resolve any remaining issues"
```

---

## 完成检查清单

- [ ] Dexie.js 和 Vitest 已安装
- [ ] Source 接口类型已定义
- [ ] 存储层已实现并测试
- [ ] RSS 解析器已实现并测试
- [ ] RSSSource 插件已实现并测试
- [ ] SourceRegistry 已实现并测试
- [ ] Scheduler 已实现并测试
- [ ] 核心模块入口已创建
- [ ] 所有测试通过
- [ ] 构建成功

---

*计划创建时间: 2026-01-02*
