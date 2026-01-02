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
