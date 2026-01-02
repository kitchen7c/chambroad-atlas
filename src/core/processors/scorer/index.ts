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
