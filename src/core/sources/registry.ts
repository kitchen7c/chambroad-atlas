import type { Source, SourceType } from './types';

export class SourceRegistry {
  private sources = new Map<SourceType, Source>();

  register(source: Source): void {
    this.sources.set(source.type, source);
  }

  get(type: SourceType): Source | undefined {
    return this.sources.get(type);
  }

  getAll(): Source[] {
    return Array.from(this.sources.values());
  }

  has(type: SourceType): boolean {
    return this.sources.has(type);
  }
}

// 默认注册表实例
import { RSSSource } from './rss';

export const registry = new SourceRegistry();
registry.register(new RSSSource());
