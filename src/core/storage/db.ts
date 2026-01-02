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
  }
}

export const db = new AtlasDB();
