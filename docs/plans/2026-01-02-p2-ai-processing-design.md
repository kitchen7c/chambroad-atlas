# P2 AI 处理层架构设计

> 日期: 2026-01-02
> 状态: 已确认

## 概述

为 Atlas 智能信息中枢实现 AI 处理能力，包含摘要生成、分类标签、重要性评分、过滤筛选四个核心处理器。

### 设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 核心能力 | 全部基础版 | 四个处理器都需要，先实现基础版 |
| 处理时机 | 可配置，默认批量 | 灵活性高，批量处理节省 API 调用 |
| 管道设计 | 按信息源配置 | 不同源需要不同处理策略 |
| LLM 调用 | 多次调用，各司其职 | 解耦清晰，便于调试和优化 |

---

## 整体结构

```
src/core/
├── processors/              # 处理器模块
│   ├── types.ts            # 处理器接口定义
│   ├── registry.ts         # 处理器注册表
│   ├── pipeline.ts         # 执行管道
│   ├── summarizer/         # 摘要处理器
│   │   └── index.ts
│   ├── classifier/         # 分类处理器
│   │   └── index.ts
│   ├── scorer/             # 评分处理器
│   │   └── index.ts
│   └── filter/             # 过滤处理器
│       └── index.ts
├── llm/                    # LLM 客户端
│   ├── client.ts           # 统一客户端
│   └── prompts.ts          # Prompt 模板
└── jobs/                   # 后台任务
    └── processor-job.ts    # 批量处理任务
```

**核心设计原则：**

1. 处理器遵循统一接口，易于扩展
2. Pipeline 链式执行，上下文在处理器间传递
3. LLM Client 封装多 provider 支持
4. 批量处理减少 API 调用，支持按需处理

---

## 处理器接口

```typescript
// src/core/processors/types.ts

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
   * @param ctx 处理上下文
   * @param config 处理器配置
   * @returns 更新后的上下文
   */
  process(ctx: ProcessContext, config: ProcessorConfig): Promise<ProcessContext>;

  /**
   * 获取配置 Schema（用于 UI 动态生成表单）
   */
  getConfigSchema(): Record<string, unknown>;
}
```

---

## LLM 客户端

```typescript
// src/core/llm/client.ts

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
    const { provider, baseUrl, apiKey, model } = this.config;

    if (provider === 'google') {
      return this.callGoogle(messages);
    } else {
      // OpenAI 兼容 API (Deepseek, Qwen, GLM, OpenAI, Ollama, Custom)
      return this.callOpenAICompatible(messages);
    }
  }

  private async callGoogle(messages: LLMMessage[]): Promise<LLMResponse> {
    const response = await fetch(
      `${this.config.baseUrl}/models/${this.config.model}:generateContent?key=${this.config.apiKey}`,
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

    const data = await response.json();
    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    };
  }

  private async callOpenAICompatible(messages: LLMMessage[]): Promise<LLMResponse> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

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

// 单例，使用用户配置初始化
let clientInstance: LLMClient | null = null;

export function getLLMClient(config: LLMConfig): LLMClient {
  if (!clientInstance) {
    clientInstance = new LLMClient(config);
  }
  return clientInstance;
}
```

---

## 处理器实现

### 摘要处理器 (Summarizer)

```typescript
// src/core/processors/summarizer/index.ts

import type { Processor, ProcessContext, ProcessorConfig } from '../types';
import { getLLMClient } from '../../llm/client';

export interface SummarizerConfig extends ProcessorConfig {
  options: {
    maxLength: number;      // 摘要最大字数，默认 200
    language: 'zh' | 'en';  // 输出语言
  };
}

export class Summarizer implements Processor {
  readonly type = 'summarizer' as const;

  async process(ctx: ProcessContext, config: SummarizerConfig): Promise<ProcessContext> {
    if (!config.enabled) return ctx;

    const { maxLength = 200, language = 'zh' } = config.options;
    const client = getLLMClient(/* from settings */);

    const prompt = language === 'zh'
      ? `请用不超过${maxLength}字概括以下文章的核心内容：\n\n${ctx.article.content}`
      : `Summarize the following article in ${maxLength} words or less:\n\n${ctx.article.content}`;

    const response = await client.chat([
      { role: 'user', content: prompt }
    ]);

    return {
      ...ctx,
      results: {
        ...ctx.results,
        summary: response.content.trim(),
      },
    };
  }

  getConfigSchema() {
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

### 分类处理器 (Classifier)

```typescript
// src/core/processors/classifier/index.ts

import type { Processor, ProcessContext, ProcessorConfig } from '../types';
import { getLLMClient } from '../../llm/client';

export interface ClassifierConfig extends ProcessorConfig {
  options: {
    categories: string[];   // 预定义分类
    maxTags: number;        // 最多标签数，默认 3
  };
}

export class Classifier implements Processor {
  readonly type = 'classifier' as const;

  async process(ctx: ProcessContext, config: ClassifierConfig): Promise<ProcessContext> {
    if (!config.enabled) return ctx;

    const { categories, maxTags = 3 } = config.options;
    const client = getLLMClient(/* from settings */);

    const prompt = `请从以下分类中选择最多${maxTags}个最相关的标签：
分类列表：${categories.join(', ')}

文章标题：${ctx.article.title}
文章内容：${ctx.article.content.slice(0, 500)}

请只返回标签，用逗号分隔。`;

    const response = await client.chat([
      { role: 'user', content: prompt }
    ]);

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

  getConfigSchema() {
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

### 评分处理器 (Scorer)

```typescript
// src/core/processors/scorer/index.ts

import type { Processor, ProcessContext, ProcessorConfig } from '../types';
import { getLLMClient } from '../../llm/client';

export interface ScorerConfig extends ProcessorConfig {
  options: {
    criteria: string;       // 评分标准描述
    minScore: number;       // 最低分，默认 1
    maxScore: number;       // 最高分，默认 10
  };
}

export class Scorer implements Processor {
  readonly type = 'scorer' as const;

  async process(ctx: ProcessContext, config: ScorerConfig): Promise<ProcessContext> {
    if (!config.enabled) return ctx;

    const { criteria, minScore = 1, maxScore = 10 } = config.options;
    const client = getLLMClient(/* from settings */);

    const prompt = `请根据以下标准，为这篇文章评分（${minScore}-${maxScore}分）：
评分标准：${criteria}

文章标题：${ctx.article.title}
文章内容：${ctx.article.content.slice(0, 500)}

请只返回一个数字分数。`;

    const response = await client.chat([
      { role: 'user', content: prompt }
    ]);

    const score = parseInt(response.content.trim(), 10);
    const validScore = isNaN(score) ? 5 : Math.max(minScore, Math.min(maxScore, score));

    return {
      ...ctx,
      results: {
        ...ctx.results,
        score: validScore,
      },
    };
  }

  getConfigSchema() {
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

### 过滤处理器 (Filter)

```typescript
// src/core/processors/filter/index.ts

import type { Processor, ProcessContext, ProcessorConfig } from '../types';
import { getLLMClient } from '../../llm/client';

export interface FilterConfig extends ProcessorConfig {
  options: {
    rules: string;          // 过滤规则描述
    scoreThreshold?: number; // 基于评分过滤，低于此分数过滤
  };
}

export class Filter implements Processor {
  readonly type = 'filter' as const;

  async process(ctx: ProcessContext, config: FilterConfig): Promise<ProcessContext> {
    if (!config.enabled) return ctx;

    const { rules, scoreThreshold } = config.options;

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
    if (rules) {
      const client = getLLMClient(/* from settings */);

      const prompt = `请判断这篇文章是否应该被过滤掉。
过滤规则：${rules}

文章标题：${ctx.article.title}
文章摘要：${ctx.results.summary || ctx.article.content.slice(0, 300)}

如果应该过滤，请回答 "过滤: [原因]"
如果不应该过滤，请回答 "保留"`;

      const response = await client.chat([
        { role: 'user', content: prompt }
      ]);

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

  getConfigSchema() {
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

---

## 执行管道

```typescript
// src/core/processors/pipeline.ts

import type { Processor, ProcessContext, ProcessorConfig, ProcessorType } from './types';
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

  /**
   * 执行处理管道
   * 按顺序运行每个处理器，传递上下文
   */
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
        // 继续下一个处理器，不中断整个管道
      }
    }

    return ctx;
  }
}
```

---

## 批量处理任务

```typescript
// src/core/jobs/processor-job.ts

import { db } from '../storage/db';
import { Pipeline, PipelineConfig } from '../processors/pipeline';
import type { ProcessContext } from '../processors/types';

export interface ProcessorJobConfig {
  batchSize: number;        // 每批处理数量，默认 10
  intervalMs: number;       // 处理间隔，默认 5 分钟
  defaultPipeline: PipelineConfig;
  sourcePipelines?: Record<string, PipelineConfig>;  // 按源自定义
}

export class ProcessorJob {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private config: ProcessorJobConfig) {}

  async start(): Promise<void> {
    // 启动时立即执行一次
    await this.processNextBatch();

    // 定时执行
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
    // 获取未处理的文章
    const articles = await db.articles
      .where('processedAt')
      .equals(0)
      .limit(this.config.batchSize)
      .toArray();

    let processed = 0;

    for (const article of articles) {
      // 获取该源的 pipeline 配置
      const pipelineConfig =
        this.config.sourcePipelines?.[article.sourceId]
        ?? this.config.defaultPipeline;

      const pipeline = new Pipeline(pipelineConfig);
      const result = await pipeline.execute(article);

      // 更新文章
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

  /**
   * 手动处理单篇文章（用于 on_view 策略）
   */
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

---

## 存储层扩展

需要在 `StoredArticle` 增加以下字段：

```typescript
export interface StoredArticle {
  // ... 现有字段 ...

  // P2 新增字段
  processedAt: number;      // 处理时间戳，0 表示未处理
  summary?: string;         // AI 生成摘要
  tags?: string;            // JSON 字符串存储标签数组
  score?: number;           // 重要性评分
  filtered: number;         // 0=未过滤, 1=已过滤
  filterReason?: string;    // 过滤原因
}
```

数据库 schema 更新：

```typescript
this.version(2).stores({
  articles: 'id, sourceId, publishedAt, fetchedAt, isRead, isFavorite, processedAt, score, filtered',
  sources: 'id, type, enabled',
});
```

---

## 后续扩展

P2 完成后，可以逐步添加更多处理器：

| 处理器 | 复杂度 | 说明 |
|--------|--------|------|
| 翻译器 | 低 | 调用 LLM 翻译 |
| 关键词提取 | 低 | 提取文章关键词 |
| 实体识别 | 中 | 识别人名、公司、产品等 |
| 情感分析 | 中 | 分析文章情感倾向 |
| 相似度检测 | 高 | 检测重复/相似文章 |

---

*设计确认时间: 2026-01-02*
