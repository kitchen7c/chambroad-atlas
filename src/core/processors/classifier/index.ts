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
