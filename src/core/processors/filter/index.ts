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
