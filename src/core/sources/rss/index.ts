import type { Source, SourceConfig, FetchResult, Article } from '../types';
import { parseRSS } from './parser';

export interface RSSSourceConfig {
  url: string;
  maxItems?: number;
}

export class RSSSource implements Source {
  readonly type = 'rss' as const;

  async validate(config: SourceConfig): Promise<{ valid: boolean; error?: string }> {
    const { url } = config.config as RSSSourceConfig;

    if (!url || !url.startsWith('http')) {
      return { valid: false, error: '请输入有效的 RSS URL' };
    }

    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (!response.ok) {
        return { valid: false, error: `无法访问: HTTP ${response.status}` };
      }
      return { valid: true };
    } catch (e) {
      return { valid: false, error: '网络请求失败' };
    }
  }

  async fetch(config: SourceConfig): Promise<FetchResult> {
    const { url, maxItems = 50 } = config.config as RSSSourceConfig;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return { success: false, articles: [], error: `HTTP ${response.status}` };
      }

      const xml = await response.text();
      const items = parseRSS(xml, maxItems);

      const articles: Article[] = items.map(item => ({
        id: this.generateId(item.link || item.guid || item.title),
        sourceId: config.id,
        title: item.title,
        content: item.content || item.description || '',
        url: item.link,
        author: item.author,
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        fetchedAt: new Date(),
        metadata: { guid: item.guid },
      }));

      return { success: true, articles };
    } catch (e) {
      return { success: false, articles: [], error: String(e) };
    }
  }

  getConfigSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          title: 'RSS URL',
          format: 'uri',
          description: 'RSS 或 Atom feed 的 URL',
        },
        maxItems: {
          type: 'number',
          title: '最大条目数',
          default: 50,
          minimum: 1,
          maximum: 100,
        },
      },
      required: ['url'],
    };
  }

  private generateId(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return `rss-${Math.abs(hash).toString(36)}`;
  }
}
