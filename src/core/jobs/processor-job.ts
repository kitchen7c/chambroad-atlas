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
