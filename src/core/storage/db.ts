import Dexie, { Table } from 'dexie';

export interface StoredArticle {
  id: string;
  sourceId: string;
  title: string;
  content: string;
  url: string;
  author?: string;
  publishedAt: number;
  fetchedAt: number;
  metadata: string;
  isRead: boolean;
  isFavorite: boolean;
  // P2 新增字段
  processedAt: number;      // 处理时间戳，0 表示未处理
  summary?: string;         // AI 生成摘要
  tags?: string;            // JSON 字符串存储标签数组
  score?: number;           // 重要性评分
  filtered: number;         // 0=未过滤, 1=已过滤
  filterReason?: string;    // 过滤原因
}

export interface StoredSource {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  schedule: string;
  config: string;
  lastFetchAt?: number;
  lastError?: string;
}

export class AtlasDB extends Dexie {
  articles!: Table<StoredArticle>;
  sources!: Table<StoredSource>;

  constructor() {
    super('AtlasDB');

    this.version(1).stores({
      articles: 'id, sourceId, publishedAt, fetchedAt',
      sources: 'id, type',
    });

    this.version(2).stores({
      articles: 'id, sourceId, publishedAt, fetchedAt, processedAt, score, filtered',
      sources: 'id, type, enabled',
    });
  }
}

export const db = new AtlasDB();
