# P1 信息采集架构设计

> 日期: 2026-01-02
> 状态: 已确认

## 概述

为 Atlas 智能信息中枢实现信息采集能力，采用插件化架构，支持 Chrome Extension 和 Electron 两端复用。

### 设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 实现优先级 | 先搭建插件架构 | 良好抽象让后续扩展更简单 |
| 运行环境 | Chrome + Electron 都支持 | 共享核心逻辑，最大化复用 |
| 存储方案 | IndexedDB + Dexie.js | 两端原生支持，API 简洁 |

---

## 整体结构

```
src/
└── core/                          # 共享核心模块（Chrome + Electron 复用）
    ├── sources/                   # 信息源插件
    │   ├── types.ts               # Source 接口定义
    │   ├── registry.ts            # 插件注册表
    │   ├── rss/                   # RSS 源实现
    │   │   ├── index.ts
    │   │   └── parser.ts
    │   └── base-source.ts         # 抽象基类
    │
    ├── storage/                   # 存储层
    │   ├── db.ts                  # Dexie 数据库定义
    │   ├── models.ts              # 数据模型（Article, Source 等）
    │   └── migrations.ts          # 数据库迁移
    │
    └── scheduler/                 # 调度器
        ├── types.ts               # 调度任务定义
        └── scheduler.ts           # 定时拉取逻辑
```

**核心设计原则：**

1. `src/core/` 是纯 TypeScript，不依赖 Chrome API 或 Electron API
2. Chrome Extension 和 Electron 分别在各自的入口引入 core 模块
3. 平台特定逻辑通过依赖注入处理

---

## Source 插件接口

```typescript
// src/core/sources/types.ts

/** 信息源类型 */
export type SourceType = 'rss' | 'web' | 'api' | 'github' | 'arxiv';

/** 信息源配置（用户定义） */
export interface SourceConfig {
  id: string;
  name: string;
  type: SourceType;
  enabled: boolean;
  schedule: string;          // 如 "1h", "30m", "1d"
  config: Record<string, unknown>;  // 类型特定配置
}

/** 抓取到的文章/条目 */
export interface Article {
  id: string;                // 唯一标识（URL hash 或 GUID）
  sourceId: string;          // 来源 ID
  title: string;
  content: string;           // 正文或摘要
  url: string;
  author?: string;
  publishedAt: Date;
  fetchedAt: Date;
  metadata: Record<string, unknown>;
}

/** 抓取结果 */
export interface FetchResult {
  success: boolean;
  articles: Article[];
  error?: string;
  nextCursor?: string;       // 分页游标
}

/** 信息源插件接口 - 所有源必须实现 */
export interface Source {
  type: SourceType;

  /** 验证配置是否有效 */
  validate(config: SourceConfig): Promise<{ valid: boolean; error?: string }>;

  /** 抓取内容 */
  fetch(config: SourceConfig, cursor?: string): Promise<FetchResult>;

  /** 获取配置 Schema（用于 UI 动态生成表单） */
  getConfigSchema(): Record<string, unknown>;
}
```

---

## 存储层设计

```typescript
// src/core/storage/db.ts

import Dexie, { Table } from 'dexie';

export interface StoredArticle {
  id: string;
  sourceId: string;
  title: string;
  content: string;
  url: string;
  author?: string;
  publishedAt: number;      // timestamp
  fetchedAt: number;
  metadata: string;         // JSON string
  isRead: boolean;
  isFavorite: boolean;
}

export interface StoredSource {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  schedule: string;
  config: string;           // JSON string
  lastFetchAt?: number;
  lastError?: string;
}

export class AtlasDB extends Dexie {
  articles!: Table<StoredArticle>;
  sources!: Table<StoredSource>;

  constructor() {
    super('AtlasDB');

    this.version(1).stores({
      articles: 'id, sourceId, publishedAt, fetchedAt, isRead, isFavorite',
      sources: 'id, type, enabled'
    });
  }
}

export const db = new AtlasDB();
```

---

## RSS 源实现

```typescript
// src/core/sources/rss/index.ts

import { Source, SourceConfig, FetchResult, Article } from '../types';
import { parseRSS } from './parser';

export interface RSSSourceConfig {
  url: string;
  maxItems?: number;        // 默认 50
}

export class RSSSource implements Source {
  type = 'rss' as const;

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
      const xml = await response.text();
      const items = parseRSS(xml, maxItems);

      const articles: Article[] = items.map(item => ({
        id: this.generateId(item.link || item.guid),
        sourceId: config.id,
        title: item.title,
        content: item.description || item.content || '',
        url: item.link,
        author: item.author,
        publishedAt: new Date(item.pubDate),
        fetchedAt: new Date(),
        metadata: { guid: item.guid },
      }));

      return { success: true, articles };
    } catch (e) {
      return { success: false, articles: [], error: String(e) };
    }
  }

  getConfigSchema() {
    return {
      type: 'object',
      properties: {
        url: { type: 'string', title: 'RSS URL', format: 'uri' },
        maxItems: { type: 'number', title: '最大条目数', default: 50 },
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

---

## 插件注册表

```typescript
// src/core/sources/registry.ts

import { Source, SourceType } from './types';
import { RSSSource } from './rss';

class SourceRegistry {
  private sources = new Map<SourceType, Source>();

  register(source: Source) {
    this.sources.set(source.type, source);
  }

  get(type: SourceType): Source | undefined {
    return this.sources.get(type);
  }

  getAll(): Source[] {
    return Array.from(this.sources.values());
  }
}

export const registry = new SourceRegistry();

// 注册内置源
registry.register(new RSSSource());
```

---

## 调度器

```typescript
// src/core/scheduler/scheduler.ts

import { db } from '../storage/db';
import { registry } from '../sources/registry';
import type { SourceConfig } from '../sources/types';

export class Scheduler {
  private timers = new Map<string, number>();

  async start() {
    const sources = await db.sources.where('enabled').equals(1).toArray();
    sources.forEach(s => this.scheduleSource(JSON.parse(s.config)));
  }

  stop() {
    this.timers.forEach(timer => clearInterval(timer));
    this.timers.clear();
  }

  async fetchNow(sourceId: string): Promise<{ count: number; error?: string }> {
    const stored = await db.sources.get(sourceId);
    if (!stored) return { count: 0, error: '源不存在' };

    const config: SourceConfig = { ...stored, config: JSON.parse(stored.config) };
    const source = registry.get(config.type as any);
    if (!source) return { count: 0, error: '不支持的源类型' };

    const result = await source.fetch(config);

    if (result.success) {
      for (const article of result.articles) {
        const exists = await db.articles.get(article.id);
        if (!exists) {
          await db.articles.add({ ...article, isRead: false, isFavorite: false });
        }
      }
      await db.sources.update(sourceId, { lastFetchAt: Date.now(), lastError: undefined });
      return { count: result.articles.length };
    }

    await db.sources.update(sourceId, { lastError: result.error });
    return { count: 0, error: result.error };
  }

  private scheduleSource(config: SourceConfig) {
    const intervalMs = this.parseSchedule(config.schedule);
    const timer = setInterval(() => this.fetchNow(config.id), intervalMs);
    this.timers.set(config.id, timer as unknown as number);
  }

  private parseSchedule(schedule: string): number {
    const match = schedule.match(/^(\d+)(m|h|d)$/);
    if (!match) return 3600000;
    const [, num, unit] = match;
    const multipliers = { m: 60000, h: 3600000, d: 86400000 };
    return parseInt(num) * multipliers[unit as keyof typeof multipliers];
  }
}

export const scheduler = new Scheduler();
```

---

## 平台集成

### Chrome Extension

```typescript
// background.ts - 新增部分

import { scheduler } from './src/core/scheduler/scheduler';
import { db } from './src/core/storage/db';

chrome.runtime.onInstalled.addListener(async () => {
  await scheduler.start();
});

chrome.runtime.onStartup.addListener(async () => {
  await scheduler.start();
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'FETCH_SOURCE') {
    scheduler.fetchNow(request.sourceId).then(sendResponse);
    return true;
  }

  if (request.type === 'GET_ARTICLES') {
    db.articles
      .orderBy('publishedAt')
      .reverse()
      .limit(request.limit || 50)
      .toArray()
      .then(articles => sendResponse({ articles }));
    return true;
  }
});
```

### Electron

```typescript
// electron-browser/src/main/source-manager.ts

import { scheduler } from '../../../src/core/scheduler/scheduler';

export class SourceManager {
  async initialize() {
    await scheduler.start();
  }

  async shutdown() {
    scheduler.stop();
  }
}
```

---

## 后续扩展

P1 完成后，可以逐步添加更多信息源：

| 源类型 | 复杂度 | 说明 |
|--------|--------|------|
| Web Scraper | 中 | 需要 Readability 提取正文 |
| GitHub | 低 | REST API，结构清晰 |
| arXiv | 低 | 提供 API 和 RSS |
| 财经 API | 中 | 需要处理认证和限流 |

---

*设计确认时间: 2026-01-02*
