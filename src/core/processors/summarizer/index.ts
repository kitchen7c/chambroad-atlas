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
