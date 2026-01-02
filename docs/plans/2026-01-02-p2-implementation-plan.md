# P2 AI 处理层实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现 AI 处理层，包含摘要、分类、评分、过滤四个处理器，以及执行管道和批量处理任务。

**Architecture:** 创建 `src/core/processors/` 处理器模块，`src/core/llm/` LLM 客户端，`src/core/jobs/` 后台任务。扩展存储层支持处理结果。

**Tech Stack:** TypeScript, Dexie.js, Vitest (测试)

**前置条件:** P1 信息采集已完成（存储层、Source 插件架构）

---

## Task 1: 扩展存储层 Schema

**Files:**
- Modify: `src/core/storage/db.ts`
- Modify: `src/core/storage/db.test.ts`

**Step 1: 更新测试**

在 `src/core/storage/db.test.ts` 添加测试：

```typescript
describe('articles with processing fields', () => {
  it('should store and query processed articles', async () => {
    const article: StoredArticle = {
      id: 'processed-1',
      sourceId: 'source-1',
      title: 'Processed Article',
      content: 'Content',
      url: 'https://example.com/1',
      publishedAt: Date.now(),
      fetchedAt: Date.now(),
      metadata: '{}',
      isRead: false,
      isFavorite: false,
      processedAt: Date.now(),
      summary: 'AI generated summary',
      tags: '["tech","ai"]',
      score: 8,
      filtered: 0,
    };

    await db.articles.add(article);
    const retrieved = await db.articles.get('processed-1');

    expect(retrieved?.summary).toBe('AI generated summary');
    expect(retrieved?.score).toBe(8);
  });

  it('should query unprocessed articles', async () => {
    await db.articles.bulkAdd([
      { id: '1', sourceId: 's1', title: 'Processed', content: '', url: '', publishedAt: 1, fetchedAt: 1, metadata: '{}', isRead: false, isFavorite: false, processedAt: Date.now(), filtered: 0 },
      { id: '2', sourceId: 's1', title: 'Unprocessed', content: '', url: '', publishedAt: 2, fetchedAt: 2, metadata: '{}', isRead: false, isFavorite: false, processedAt: 0, filtered: 0 },
    ]);

    const unprocessed = await db.articles.where('processedAt').equals(0).toArray();
    expect(unprocessed).toHaveLength(1);
    expect(unprocessed[0].title).toBe('Unprocessed');
  });
});
```

**Step 2: 运行测试验证失败**

Run: `npm test`
Expected: FAIL（新字段不存在）

**Step 3: 更新 StoredArticle 接口**

修改 `src/core/storage/db.ts`：

```typescript
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
  // P2 新增字段
  processedAt: number;      // 处理时间戳，0 表示未处理
  summary?: string;         // AI 生成摘要
  tags?: string;            // JSON 字符串存储标签数组
  score?: number;           // 重要性评分
  filtered: number;         // 0=未过滤, 1=已过滤
  filterReason?: string;    // 过滤原因
}
```

**Step 4: 更新数据库版本**

修改 `AtlasDB` 构造函数：

```typescript
constructor() {
  super('AtlasDB');

  this.version(1).stores({
    articles: 'id, sourceId, publishedAt, fetchedAt, isRead, isFavorite',
    sources: 'id, type, enabled',
  });

  this.version(2).stores({
    articles: 'id, sourceId, publishedAt, fetchedAt, isRead, isFavorite, processedAt, score, filtered',
    sources: 'id, type, enabled',
  });
}
```

**Step 5: 运行测试验证通过**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/core/storage/
git commit -m "feat(core): extend StoredArticle with processing fields"
```

---

## Task 2: 创建处理器类型定义

**Files:**
- Create: `src/core/processors/types.ts`

**Step 1: 创建目录**

Run: `mkdir -p src/core/processors`

**Step 2: 创建类型定义文件**

创建 `src/core/processors/types.ts`：

```typescript
import type { StoredArticle } from '../storage/db';

/**
 * 处理器类型
 */
export type ProcessorType = 'summarizer' | 'classifier' | 'scorer' | 'filter';

/**
 * 处理策略
 */
export type ProcessStrategy = 'immediate' | 'on_view' | 'batch';

/**
 * 处理上下文 - 在处理器间传递
 */
export interface ProcessContext {
  article: StoredArticle;
  results: {
    summary?: string;
    tags?: string[];
    score?: number;
    filtered?: boolean;
    filterReason?: string;
  };
}

/**
 * 处理器配置
 */
export interface ProcessorConfig {
  enabled: boolean;
  options: Record<string, unknown>;
}

/**
 * 处理器接口 - 所有处理器必须实现
 */
export interface Processor {
  readonly type: ProcessorType;

  /**
   * 处理文章
   */
  process(ctx: ProcessContext, config: ProcessorConfig): Promise<ProcessContext>;

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
git add src/core/processors/types.ts
git commit -m "feat(core): add Processor interface types"
```

---

## Task 3: 创建 LLM 客户端

**Files:**
- Create: `src/core/llm/client.ts`
- Create: `src/core/llm/client.test.ts`

**Step 1: 创建目录**

Run: `mkdir -p src/core/llm`

**Step 2: 写测试**

创建 `src/core/llm/client.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMClient } from './client';
import type { LLMConfig } from '../../types';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('LLMClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('Google provider', () => {
    it('should call Google API correctly', async () => {
      const config: LLMConfig = {
        provider: 'google',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'test-key',
        model: 'gemini-2.0-flash-exp',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'Hello response' }] } }],
        }),
      });

      const client = new LLMClient(config);
      const response = await client.chat([{ role: 'user', content: 'Hello' }]);

      expect(response.content).toBe('Hello response');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('OpenAI-compatible provider', () => {
    it('should call OpenAI-compatible API correctly', async () => {
      const config: LLMConfig = {
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        apiKey: 'test-key',
        model: 'deepseek-chat',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Deepseek response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20 },
        }),
      });

      const client = new LLMClient(config);
      const response = await client.chat([{ role: 'user', content: 'Hello' }]);

      expect(response.content).toBe('Deepseek response');
      expect(response.usage?.promptTokens).toBe(10);
    });
  });

  describe('error handling', () => {
    it('should throw on API error', async () => {
      const config: LLMConfig = {
        provider: 'google',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'test-key',
        model: 'gemini-2.0-flash-exp',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { message: 'Invalid API key' } }),
      });

      const client = new LLMClient(config);
      await expect(client.chat([{ role: 'user', content: 'Hello' }]))
        .rejects.toThrow();
    });
  });
});
```

**Step 3: 运行测试验证失败**

Run: `npm test`
Expected: FAIL（LLMClient 不存在）

**Step 4: 实现 LLM 客户端**

创建 `src/core/llm/client.ts`：

```typescript
import type { LLMConfig } from '../../types';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export class LLMClient {
  constructor(private config: LLMConfig) {}

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    const { provider } = this.config;

    if (provider === 'google') {
      return this.callGoogle(messages);
    } else {
      return this.callOpenAICompatible(messages);
    }
  }

  private async callGoogle(messages: LLMMessage[]): Promise<LLMResponse> {
    const { baseUrl, apiKey, model } = this.config;

    const response = await fetch(
      `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    };
  }

  private async callOpenAICompatible(messages: LLMMessage[]): Promise<LLMResponse> {
    const { baseUrl, apiKey, model } = this.config;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
      } : undefined,
    };
  }
}
```

**Step 5: 运行测试验证通过**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/core/llm/
git commit -m "feat(core): add LLMClient with multi-provider support"
```

---

## Task 4: 实现 Summarizer 处理器

**Files:**
- Create: `src/core/processors/summarizer/index.ts`
- Create: `src/core/processors/summarizer/index.test.ts`

**Step 1: 创建目录**

Run: `mkdir -p src/core/processors/summarizer`

**Step 2: 写测试**

创建 `src/core/processors/summarizer/index.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Summarizer } from './index';
import type { ProcessContext } from '../types';
import type { StoredArticle } from '../../storage/db';

// Mock LLMClient
vi.mock('../../llm/client', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    chat: vi.fn().mockResolvedValue({ content: 'Test summary' }),
  })),
}));

describe('Summarizer', () => {
  let summarizer: Summarizer;
  let mockArticle: StoredArticle;

  beforeEach(() => {
    summarizer = new Summarizer();
    mockArticle = {
      id: 'test-1',
      sourceId: 'source-1',
      title: 'Test Article',
      content: 'This is a long article content that needs to be summarized...',
      url: 'https://example.com/1',
      publishedAt: Date.now(),
      fetchedAt: Date.now(),
      metadata: '{}',
      isRead: false,
      isFavorite: false,
      processedAt: 0,
      filtered: 0,
    };
  });

  it('should have type summarizer', () => {
    expect(summarizer.type).toBe('summarizer');
  });

  it('should skip processing when disabled', async () => {
    const ctx: ProcessContext = { article: mockArticle, results: {} };
    const result = await summarizer.process(ctx, { enabled: false, options: {} });

    expect(result.results.summary).toBeUndefined();
  });

  it('should generate summary when enabled', async () => {
    const ctx: ProcessContext = { article: mockArticle, results: {} };
    const result = await summarizer.process(ctx, {
      enabled: true,
      options: { maxLength: 200, language: 'zh' },
    });

    expect(result.results.summary).toBe('Test summary');
  });

  it('should return valid config schema', () => {
    const schema = summarizer.getConfigSchema();
    expect(schema.type).toBe('object');
    expect(schema.properties).toHaveProperty('maxLength');
    expect(schema.properties).toHaveProperty('language');
  });
});
```

**Step 3: 运行测试验证失败**

Run: `npm test`
Expected: FAIL

**Step 4: 实现 Summarizer**

创建 `src/core/processors/summarizer/index.ts`：

```typescript
import type { Processor, ProcessContext, ProcessorConfig } from '../types';
import { LLMClient } from '../../llm/client';
import type { LLMConfig } from '../../../types';

export interface SummarizerConfig extends ProcessorConfig {
  options: {
    maxLength?: number;
    language?: 'zh' | 'en';
    llmConfig?: LLMConfig;
  };
}

export class Summarizer implements Processor {
  readonly type = 'summarizer' as const;

  async process(ctx: ProcessContext, config: SummarizerConfig): Promise<ProcessContext> {
    if (!config.enabled) return ctx;

    const { maxLength = 200, language = 'zh', llmConfig } = config.options;

    if (!llmConfig) {
      console.warn('Summarizer: No LLM config provided');
      return ctx;
    }

    const client = new LLMClient(llmConfig);

    const prompt = language === 'zh'
      ? `请用不超过${maxLength}字概括以下文章的核心内容：\n\n${ctx.article.content}`
      : `Summarize the following article in ${maxLength} words or less:\n\n${ctx.article.content}`;

    const response = await client.chat([{ role: 'user', content: prompt }]);

    return {
      ...ctx,
      results: {
        ...ctx.results,
        summary: response.content.trim(),
      },
    };
  }

  getConfigSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        maxLength: { type: 'number', title: '最大字数', default: 200 },
        language: { type: 'string', enum: ['zh', 'en'], title: '输出语言', default: 'zh' },
      },
    };
  }
}
```

**Step 5: 运行测试验证通过**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/core/processors/summarizer/
git commit -m "feat(core): add Summarizer processor"
```

---

## Task 5: 实现 Classifier 处理器

**Files:**
- Create: `src/core/processors/classifier/index.ts`
- Create: `src/core/processors/classifier/index.test.ts`

**Step 1: 创建目录**

Run: `mkdir -p src/core/processors/classifier`

**Step 2: 写测试**

创建 `src/core/processors/classifier/index.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Classifier } from './index';
import type { ProcessContext } from '../types';
import type { StoredArticle } from '../../storage/db';

vi.mock('../../llm/client', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    chat: vi.fn().mockResolvedValue({ content: 'tech, ai' }),
  })),
}));

describe('Classifier', () => {
  let classifier: Classifier;
  let mockArticle: StoredArticle;

  beforeEach(() => {
    classifier = new Classifier();
    mockArticle = {
      id: 'test-1',
      sourceId: 'source-1',
      title: 'AI News',
      content: 'Article about artificial intelligence...',
      url: 'https://example.com/1',
      publishedAt: Date.now(),
      fetchedAt: Date.now(),
      metadata: '{}',
      isRead: false,
      isFavorite: false,
      processedAt: 0,
      filtered: 0,
    };
  });

  it('should have type classifier', () => {
    expect(classifier.type).toBe('classifier');
  });

  it('should skip processing when disabled', async () => {
    const ctx: ProcessContext = { article: mockArticle, results: {} };
    const result = await classifier.process(ctx, { enabled: false, options: {} });

    expect(result.results.tags).toBeUndefined();
  });

  it('should classify article with tags', async () => {
    const ctx: ProcessContext = { article: mockArticle, results: {} };
    const result = await classifier.process(ctx, {
      enabled: true,
      options: {
        categories: ['tech', 'ai', 'finance', 'health'],
        maxTags: 3,
      },
    });

    expect(result.results.tags).toContain('tech');
    expect(result.results.tags).toContain('ai');
  });

  it('should return valid config schema', () => {
    const schema = classifier.getConfigSchema();
    expect(schema.type).toBe('object');
    expect(schema.properties).toHaveProperty('categories');
    expect(schema.required).toContain('categories');
  });
});
```

**Step 3: 运行测试验证失败**

Run: `npm test`
Expected: FAIL

**Step 4: 实现 Classifier**

创建 `src/core/processors/classifier/index.ts`：

```typescript
import type { Processor, ProcessContext, ProcessorConfig } from '../types';
import { LLMClient } from '../../llm/client';
import type { LLMConfig } from '../../../types';

export interface ClassifierConfig extends ProcessorConfig {
  options: {
    categories?: string[];
    maxTags?: number;
    llmConfig?: LLMConfig;
  };
}

export class Classifier implements Processor {
  readonly type = 'classifier' as const;

  async process(ctx: ProcessContext, config: ClassifierConfig): Promise<ProcessContext> {
    if (!config.enabled) return ctx;

    const { categories = [], maxTags = 3, llmConfig } = config.options;

    if (!llmConfig || categories.length === 0) {
      console.warn('Classifier: Missing LLM config or categories');
      return ctx;
    }

    const client = new LLMClient(llmConfig);

    const prompt = `请从以下分类中选择最多${maxTags}个最相关的标签：
分类列表：${categories.join(', ')}

文章标题：${ctx.article.title}
文章内容：${ctx.article.content.slice(0, 500)}

请只返回标签，用逗号分隔。`;

    const response = await client.chat([{ role: 'user', content: prompt }]);

    const tags = response.content
      .split(/[,，]/)
      .map(t => t.trim())
      .filter(t => categories.includes(t))
      .slice(0, maxTags);

    return {
      ...ctx,
      results: {
        ...ctx.results,
        tags,
      },
    };
  }

  getConfigSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        categories: { type: 'array', items: { type: 'string' }, title: '分类列表' },
        maxTags: { type: 'number', title: '最多标签数', default: 3 },
      },
      required: ['categories'],
    };
  }
}
```

**Step 5: 运行测试验证通过**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/core/processors/classifier/
git commit -m "feat(core): add Classifier processor"
```

---

## Task 6: 实现 Scorer 处理器

**Files:**
- Create: `src/core/processors/scorer/index.ts`
- Create: `src/core/processors/scorer/index.test.ts`

**Step 1: 创建目录**

Run: `mkdir -p src/core/processors/scorer`

**Step 2: 写测试**

创建 `src/core/processors/scorer/index.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Scorer } from './index';
import type { ProcessContext } from '../types';
import type { StoredArticle } from '../../storage/db';

vi.mock('../../llm/client', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    chat: vi.fn().mockResolvedValue({ content: '8' }),
  })),
}));

describe('Scorer', () => {
  let scorer: Scorer;
  let mockArticle: StoredArticle;

  beforeEach(() => {
    scorer = new Scorer();
    mockArticle = {
      id: 'test-1',
      sourceId: 'source-1',
      title: 'Important News',
      content: 'Very important content...',
      url: 'https://example.com/1',
      publishedAt: Date.now(),
      fetchedAt: Date.now(),
      metadata: '{}',
      isRead: false,
      isFavorite: false,
      processedAt: 0,
      filtered: 0,
    };
  });

  it('should have type scorer', () => {
    expect(scorer.type).toBe('scorer');
  });

  it('should skip processing when disabled', async () => {
    const ctx: ProcessContext = { article: mockArticle, results: {} };
    const result = await scorer.process(ctx, { enabled: false, options: {} });

    expect(result.results.score).toBeUndefined();
  });

  it('should score article', async () => {
    const ctx: ProcessContext = { article: mockArticle, results: {} };
    const result = await scorer.process(ctx, {
      enabled: true,
      options: {
        criteria: '内容质量、相关性',
        minScore: 1,
        maxScore: 10,
      },
    });

    expect(result.results.score).toBe(8);
  });

  it('should clamp score within range', async () => {
    vi.mocked(await import('../../llm/client')).LLMClient.mockImplementation(() => ({
      chat: vi.fn().mockResolvedValue({ content: '15' }),
    }) as any);

    const ctx: ProcessContext = { article: mockArticle, results: {} };
    const newScorer = new Scorer();
    const result = await newScorer.process(ctx, {
      enabled: true,
      options: { criteria: 'test', minScore: 1, maxScore: 10 },
    });

    expect(result.results.score).toBeLessThanOrEqual(10);
  });
});
```

**Step 3: 运行测试验证失败**

Run: `npm test`
Expected: FAIL

**Step 4: 实现 Scorer**

创建 `src/core/processors/scorer/index.ts`：

```typescript
import type { Processor, ProcessContext, ProcessorConfig } from '../types';
import { LLMClient } from '../../llm/client';
import type { LLMConfig } from '../../../types';

export interface ScorerConfig extends ProcessorConfig {
  options: {
    criteria?: string;
    minScore?: number;
    maxScore?: number;
    llmConfig?: LLMConfig;
  };
}

export class Scorer implements Processor {
  readonly type = 'scorer' as const;

  async process(ctx: ProcessContext, config: ScorerConfig): Promise<ProcessContext> {
    if (!config.enabled) return ctx;

    const { criteria = '内容质量、相关性、时效性', minScore = 1, maxScore = 10, llmConfig } = config.options;

    if (!llmConfig) {
      console.warn('Scorer: No LLM config provided');
      return ctx;
    }

    const client = new LLMClient(llmConfig);

    const prompt = `请根据以下标准，为这篇文章评分（${minScore}-${maxScore}分）：
评分标准：${criteria}

文章标题：${ctx.article.title}
文章内容：${ctx.article.content.slice(0, 500)}

请只返回一个数字分数。`;

    const response = await client.chat([{ role: 'user', content: prompt }]);

    const rawScore = parseInt(response.content.trim(), 10);
    const score = isNaN(rawScore) ? Math.floor((minScore + maxScore) / 2) : Math.max(minScore, Math.min(maxScore, rawScore));

    return {
      ...ctx,
      results: {
        ...ctx.results,
        score,
      },
    };
  }

  getConfigSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        criteria: { type: 'string', title: '评分标准', default: '内容质量、相关性、时效性' },
        minScore: { type: 'number', title: '最低分', default: 1 },
        maxScore: { type: 'number', title: '最高分', default: 10 },
      },
    };
  }
}
```

**Step 5: 运行测试验证通过**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/core/processors/scorer/
git commit -m "feat(core): add Scorer processor"
```

---

## Task 7: 实现 Filter 处理器

**Files:**
- Create: `src/core/processors/filter/index.ts`
- Create: `src/core/processors/filter/index.test.ts`

**Step 1: 创建目录**

Run: `mkdir -p src/core/processors/filter`

**Step 2: 写测试**

创建 `src/core/processors/filter/index.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Filter } from './index';
import type { ProcessContext } from '../types';
import type { StoredArticle } from '../../storage/db';

vi.mock('../../llm/client', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    chat: vi.fn().mockResolvedValue({ content: '保留' }),
  })),
}));

describe('Filter', () => {
  let filter: Filter;
  let mockArticle: StoredArticle;

  beforeEach(() => {
    filter = new Filter();
    mockArticle = {
      id: 'test-1',
      sourceId: 'source-1',
      title: 'Test Article',
      content: 'Article content...',
      url: 'https://example.com/1',
      publishedAt: Date.now(),
      fetchedAt: Date.now(),
      metadata: '{}',
      isRead: false,
      isFavorite: false,
      processedAt: 0,
      filtered: 0,
    };
  });

  it('should have type filter', () => {
    expect(filter.type).toBe('filter');
  });

  it('should skip processing when disabled', async () => {
    const ctx: ProcessContext = { article: mockArticle, results: {} };
    const result = await filter.process(ctx, { enabled: false, options: {} });

    expect(result.results.filtered).toBeUndefined();
  });

  it('should filter by score threshold', async () => {
    const ctx: ProcessContext = { article: mockArticle, results: { score: 3 } };
    const result = await filter.process(ctx, {
      enabled: true,
      options: { scoreThreshold: 5 },
    });

    expect(result.results.filtered).toBe(true);
    expect(result.results.filterReason).toContain('低于阈值');
  });

  it('should not filter when score above threshold', async () => {
    const ctx: ProcessContext = { article: mockArticle, results: { score: 8 } };
    const result = await filter.process(ctx, {
      enabled: true,
      options: { scoreThreshold: 5 },
    });

    expect(result.results.filtered).toBeFalsy();
  });

  it('should use LLM for rule-based filtering', async () => {
    const ctx: ProcessContext = { article: mockArticle, results: {} };
    const result = await filter.process(ctx, {
      enabled: true,
      options: { rules: '过滤广告内容' },
    });

    expect(result.results.filtered).toBeFalsy();
  });
});
```

**Step 3: 运行测试验证失败**

Run: `npm test`
Expected: FAIL

**Step 4: 实现 Filter**

创建 `src/core/processors/filter/index.ts`：

```typescript
import type { Processor, ProcessContext, ProcessorConfig } from '../types';
import { LLMClient } from '../../llm/client';
import type { LLMConfig } from '../../../types';

export interface FilterConfig extends ProcessorConfig {
  options: {
    rules?: string;
    scoreThreshold?: number;
    llmConfig?: LLMConfig;
  };
}

export class Filter implements Processor {
  readonly type = 'filter' as const;

  async process(ctx: ProcessContext, config: FilterConfig): Promise<ProcessContext> {
    if (!config.enabled) return ctx;

    const { rules, scoreThreshold, llmConfig } = config.options;

    // 基于评分的快速过滤
    if (scoreThreshold !== undefined && ctx.results.score !== undefined) {
      if (ctx.results.score < scoreThreshold) {
        return {
          ...ctx,
          results: {
            ...ctx.results,
            filtered: true,
            filterReason: `评分 ${ctx.results.score} 低于阈值 ${scoreThreshold}`,
          },
        };
      }
    }

    // 基于规则的 LLM 过滤
    if (rules && llmConfig) {
      const client = new LLMClient(llmConfig);

      const prompt = `请判断这篇文章是否应该被过滤掉。
过滤规则：${rules}

文章标题：${ctx.article.title}
文章摘要：${ctx.results.summary || ctx.article.content.slice(0, 300)}

如果应该过滤，请回答 "过滤: [原因]"
如果不应该过滤，请回答 "保留"`;

      const response = await client.chat([{ role: 'user', content: prompt }]);

      const result = response.content.trim();
      if (result.startsWith('过滤')) {
        return {
          ...ctx,
          results: {
            ...ctx.results,
            filtered: true,
            filterReason: result.replace('过滤:', '').replace('过滤：', '').trim(),
          },
        };
      }
    }

    return ctx;
  }

  getConfigSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        rules: { type: 'string', title: '过滤规则', description: '描述什么样的内容应该被过滤' },
        scoreThreshold: { type: 'number', title: '评分阈值', description: '低于此分数自动过滤' },
      },
    };
  }
}
```

**Step 5: 运行测试验证通过**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/core/processors/filter/
git commit -m "feat(core): add Filter processor"
```

---

## Task 8: 创建处理器注册表

**Files:**
- Create: `src/core/processors/registry.ts`
- Create: `src/core/processors/registry.test.ts`

**Step 1: 写测试**

创建 `src/core/processors/registry.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ProcessorRegistry } from './registry';
import { Summarizer } from './summarizer';
import { Classifier } from './classifier';

describe('ProcessorRegistry', () => {
  let registry: ProcessorRegistry;

  beforeEach(() => {
    registry = new ProcessorRegistry();
  });

  it('should register and retrieve a processor', () => {
    const summarizer = new Summarizer();
    registry.register(summarizer);

    const retrieved = registry.get('summarizer');
    expect(retrieved).toBe(summarizer);
  });

  it('should return undefined for unregistered type', () => {
    const retrieved = registry.get('unknown' as any);
    expect(retrieved).toBeUndefined();
  });

  it('should list all registered processors', () => {
    registry.register(new Summarizer());
    registry.register(new Classifier());

    const all = registry.getAll();
    expect(all).toHaveLength(2);
  });
});
```

**Step 2: 运行测试验证失败**

Run: `npm test`
Expected: FAIL

**Step 3: 实现注册表**

创建 `src/core/processors/registry.ts`：

```typescript
import type { Processor, ProcessorType } from './types';

export class ProcessorRegistry {
  private processors = new Map<ProcessorType, Processor>();

  register(processor: Processor): void {
    this.processors.set(processor.type, processor);
  }

  get(type: ProcessorType): Processor | undefined {
    return this.processors.get(type);
  }

  getAll(): Processor[] {
    return Array.from(this.processors.values());
  }

  has(type: ProcessorType): boolean {
    return this.processors.has(type);
  }
}

// 默认注册表实例
import { Summarizer } from './summarizer';
import { Classifier } from './classifier';
import { Scorer } from './scorer';
import { Filter } from './filter';

export const processorRegistry = new ProcessorRegistry();
processorRegistry.register(new Summarizer());
processorRegistry.register(new Classifier());
processorRegistry.register(new Scorer());
processorRegistry.register(new Filter());
```

**Step 4: 运行测试验证通过**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/processors/registry.ts src/core/processors/registry.test.ts
git commit -m "feat(core): add ProcessorRegistry"
```

---

## Task 9: 实现执行管道

**Files:**
- Create: `src/core/processors/pipeline.ts`
- Create: `src/core/processors/pipeline.test.ts`

**Step 1: 写测试**

创建 `src/core/processors/pipeline.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pipeline } from './pipeline';
import type { StoredArticle } from '../storage/db';

// Mock all processors
vi.mock('./summarizer', () => ({
  Summarizer: vi.fn().mockImplementation(() => ({
    type: 'summarizer',
    process: vi.fn().mockImplementation(ctx => ({
      ...ctx,
      results: { ...ctx.results, summary: 'Test summary' },
    })),
  })),
}));

vi.mock('./classifier', () => ({
  Classifier: vi.fn().mockImplementation(() => ({
    type: 'classifier',
    process: vi.fn().mockImplementation(ctx => ({
      ...ctx,
      results: { ...ctx.results, tags: ['tech'] },
    })),
  })),
}));

vi.mock('./registry', () => ({
  processorRegistry: {
    get: vi.fn().mockImplementation(type => {
      if (type === 'summarizer') {
        return {
          process: vi.fn().mockImplementation(ctx => ({
            ...ctx,
            results: { ...ctx.results, summary: 'Test summary' },
          })),
        };
      }
      if (type === 'filter') {
        return {
          process: vi.fn().mockImplementation(ctx => ({
            ...ctx,
            results: { ...ctx.results, filtered: true, filterReason: 'Test filter' },
          })),
        };
      }
      return undefined;
    }),
  },
}));

describe('Pipeline', () => {
  let mockArticle: StoredArticle;

  beforeEach(() => {
    mockArticle = {
      id: 'test-1',
      sourceId: 'source-1',
      title: 'Test Article',
      content: 'Content...',
      url: 'https://example.com/1',
      publishedAt: Date.now(),
      fetchedAt: Date.now(),
      metadata: '{}',
      isRead: false,
      isFavorite: false,
      processedAt: 0,
      filtered: 0,
    };
  });

  it('should execute processors in order', async () => {
    const pipeline = new Pipeline({
      processors: [
        { type: 'summarizer', config: { enabled: true, options: {} } },
      ],
    });

    const result = await pipeline.execute(mockArticle);
    expect(result.results.summary).toBe('Test summary');
  });

  it('should stop early when filtered', async () => {
    const pipeline = new Pipeline({
      processors: [
        { type: 'filter', config: { enabled: true, options: {} } },
        { type: 'summarizer', config: { enabled: true, options: {} } },
      ],
    });

    const result = await pipeline.execute(mockArticle);
    expect(result.results.filtered).toBe(true);
    // Summarizer should not have run after filter
  });

  it('should skip unknown processor types', async () => {
    const pipeline = new Pipeline({
      processors: [
        { type: 'unknown' as any, config: { enabled: true, options: {} } },
      ],
    });

    const result = await pipeline.execute(mockArticle);
    expect(result.article).toBe(mockArticle);
  });
});
```

**Step 2: 运行测试验证失败**

Run: `npm test`
Expected: FAIL

**Step 3: 实现 Pipeline**

创建 `src/core/processors/pipeline.ts`：

```typescript
import type { ProcessContext, ProcessorConfig, ProcessorType } from './types';
import { processorRegistry } from './registry';
import type { StoredArticle } from '../storage/db';

export interface PipelineConfig {
  processors: Array<{
    type: ProcessorType;
    config: ProcessorConfig;
  }>;
}

export class Pipeline {
  constructor(private config: PipelineConfig) {}

  async execute(article: StoredArticle): Promise<ProcessContext> {
    let ctx: ProcessContext = {
      article,
      results: {},
    };

    for (const step of this.config.processors) {
      const processor = processorRegistry.get(step.type);
      if (!processor) {
        console.warn(`Processor not found: ${step.type}`);
        continue;
      }

      try {
        ctx = await processor.process(ctx, step.config);

        // 如果被过滤，提前退出
        if (ctx.results.filtered) {
          break;
        }
      } catch (error) {
        console.error(`Processor ${step.type} failed:`, error);
      }
    }

    return ctx;
  }
}
```

**Step 4: 运行测试验证通过**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/processors/pipeline.ts src/core/processors/pipeline.test.ts
git commit -m "feat(core): add Pipeline executor"
```

---

## Task 10: 实现批量处理任务

**Files:**
- Create: `src/core/jobs/processor-job.ts`
- Create: `src/core/jobs/processor-job.test.ts`

**Step 1: 创建目录**

Run: `mkdir -p src/core/jobs`

**Step 2: 写测试**

创建 `src/core/jobs/processor-job.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProcessorJob } from './processor-job';
import { db } from '../storage/db';

vi.mock('../processors/pipeline', () => ({
  Pipeline: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      article: {},
      results: { summary: 'Test', tags: ['tech'], score: 8, filtered: false },
    }),
  })),
}));

describe('ProcessorJob', () => {
  let job: ProcessorJob;

  beforeEach(async () => {
    await db.articles.clear();
    await db.sources.clear();

    job = new ProcessorJob({
      batchSize: 10,
      intervalMs: 60000,
      defaultPipeline: {
        processors: [
          { type: 'summarizer', config: { enabled: true, options: {} } },
        ],
      },
    });

    vi.useFakeTimers();
  });

  afterEach(() => {
    job.stop();
    vi.useRealTimers();
  });

  it('should process unprocessed articles', async () => {
    await db.articles.add({
      id: 'test-1',
      sourceId: 'source-1',
      title: 'Test',
      content: 'Content',
      url: 'https://example.com/1',
      publishedAt: Date.now(),
      fetchedAt: Date.now(),
      metadata: '{}',
      isRead: false,
      isFavorite: false,
      processedAt: 0,
      filtered: 0,
    });

    const result = await job.processNextBatch();
    expect(result.processed).toBe(1);

    const article = await db.articles.get('test-1');
    expect(article?.processedAt).toBeGreaterThan(0);
  });

  it('should skip already processed articles', async () => {
    await db.articles.add({
      id: 'test-1',
      sourceId: 'source-1',
      title: 'Test',
      content: 'Content',
      url: 'https://example.com/1',
      publishedAt: Date.now(),
      fetchedAt: Date.now(),
      metadata: '{}',
      isRead: false,
      isFavorite: false,
      processedAt: Date.now(), // Already processed
      filtered: 0,
    });

    const result = await job.processNextBatch();
    expect(result.processed).toBe(0);
  });

  it('should process single article on demand', async () => {
    await db.articles.add({
      id: 'test-1',
      sourceId: 'source-1',
      title: 'Test',
      content: 'Content',
      url: 'https://example.com/1',
      publishedAt: Date.now(),
      fetchedAt: Date.now(),
      metadata: '{}',
      isRead: false,
      isFavorite: false,
      processedAt: 0,
      filtered: 0,
    });

    const result = await job.processOne('test-1');
    expect(result?.results.summary).toBe('Test');
  });
});
```

**Step 3: 运行测试验证失败**

Run: `npm test`
Expected: FAIL

**Step 4: 实现 ProcessorJob**

创建 `src/core/jobs/processor-job.ts`：

```typescript
import { db } from '../storage/db';
import { Pipeline, PipelineConfig } from '../processors/pipeline';
import type { ProcessContext } from '../processors/types';

export interface ProcessorJobConfig {
  batchSize: number;
  intervalMs: number;
  defaultPipeline: PipelineConfig;
  sourcePipelines?: Record<string, PipelineConfig>;
}

export class ProcessorJob {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private config: ProcessorJobConfig) {}

  async start(): Promise<void> {
    await this.processNextBatch();

    this.timer = setInterval(() => {
      this.processNextBatch().catch(console.error);
    }, this.config.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async processNextBatch(): Promise<{ processed: number }> {
    const articles = await db.articles
      .where('processedAt')
      .equals(0)
      .limit(this.config.batchSize)
      .toArray();

    let processed = 0;

    for (const article of articles) {
      const pipelineConfig =
        this.config.sourcePipelines?.[article.sourceId]
        ?? this.config.defaultPipeline;

      const pipeline = new Pipeline(pipelineConfig);
      const result = await pipeline.execute(article);

      await db.articles.update(article.id, {
        summary: result.results.summary,
        tags: JSON.stringify(result.results.tags || []),
        score: result.results.score,
        filtered: result.results.filtered ? 1 : 0,
        filterReason: result.results.filterReason,
        processedAt: Date.now(),
      });

      processed++;
    }

    return { processed };
  }

  async processOne(articleId: string): Promise<ProcessContext | null> {
    const article = await db.articles.get(articleId);
    if (!article) return null;

    const pipelineConfig =
      this.config.sourcePipelines?.[article.sourceId]
      ?? this.config.defaultPipeline;

    const pipeline = new Pipeline(pipelineConfig);
    const result = await pipeline.execute(article);

    await db.articles.update(articleId, {
      summary: result.results.summary,
      tags: JSON.stringify(result.results.tags || []),
      score: result.results.score,
      filtered: result.results.filtered ? 1 : 0,
      filterReason: result.results.filterReason,
      processedAt: Date.now(),
    });

    return result;
  }
}
```

**Step 5: 运行测试验证通过**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/core/jobs/
git commit -m "feat(core): add ProcessorJob for batch processing"
```

---

## Task 11: 创建模块入口并更新核心导出

**Files:**
- Create: `src/core/processors/index.ts`
- Create: `src/core/llm/index.ts`
- Create: `src/core/jobs/index.ts`
- Modify: `src/core/index.ts`

**Step 1: 创建处理器模块入口**

创建 `src/core/processors/index.ts`：

```typescript
export * from './types';
export { processorRegistry, ProcessorRegistry } from './registry';
export { Pipeline } from './pipeline';
export type { PipelineConfig } from './pipeline';
export { Summarizer } from './summarizer';
export { Classifier } from './classifier';
export { Scorer } from './scorer';
export { Filter } from './filter';
```

**Step 2: 创建 LLM 模块入口**

创建 `src/core/llm/index.ts`：

```typescript
export { LLMClient } from './client';
export type { LLMMessage, LLMResponse } from './client';
```

**Step 3: 创建 Jobs 模块入口**

创建 `src/core/jobs/index.ts`：

```typescript
export { ProcessorJob } from './processor-job';
export type { ProcessorJobConfig } from './processor-job';
```

**Step 4: 更新核心模块入口**

修改 `src/core/index.ts`，添加：

```typescript
// P1 exports (existing)
export * from './sources/types';
export { db, AtlasDB } from './storage/db';
export type { StoredArticle, StoredSource } from './storage/db';
export { registry, SourceRegistry } from './sources/registry';
export { RSSSource } from './sources/rss';
export { scheduler, Scheduler, parseSchedule } from './scheduler/scheduler';

// P2 exports (new)
export * from './processors';
export * from './llm';
export * from './jobs';
```

**Step 5: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

**Step 6: Commit**

```bash
git add src/core/
git commit -m "feat(core): add P2 module exports"
```

---

## Task 12: 运行全部测试并验证

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

- [ ] 存储层扩展（新字段 + 数据库版本升级）
- [ ] 处理器类型定义
- [ ] LLM 客户端（多 provider 支持）
- [ ] Summarizer 处理器
- [ ] Classifier 处理器
- [ ] Scorer 处理器
- [ ] Filter 处理器
- [ ] ProcessorRegistry 注册表
- [ ] Pipeline 执行管道
- [ ] ProcessorJob 批量任务
- [ ] 模块入口和导出
- [ ] 所有测试通过
- [ ] 构建成功

---

*计划创建时间: 2026-01-02*
