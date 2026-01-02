import { db } from '../storage/db';
import { registry } from '../sources/registry';
import type { SourceConfig, SourceType } from '../sources/types';
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
    const sources = await db.sources.filter(s => s.enabled).toArray();

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
