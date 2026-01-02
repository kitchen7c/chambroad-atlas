/**
 * 信息源类型
 */
export type SourceType = 'rss' | 'web' | 'api' | 'github' | 'arxiv';

/**
 * 信息源配置（用户定义）
 */
export interface SourceConfig {
  id: string;
  name: string;
  type: SourceType;
  enabled: boolean;
  schedule: string;  // 如 "1h", "30m", "1d"
  config: Record<string, unknown>;
}

/**
 * 抓取到的文章/条目
 */
export interface Article {
  id: string;
  sourceId: string;
  title: string;
  content: string;
  url: string;
  author?: string;
  publishedAt: Date;
  fetchedAt: Date;
  metadata: Record<string, unknown>;
}

/**
 * 抓取结果
 */
export interface FetchResult {
  success: boolean;
  articles: Article[];
  error?: string;
  nextCursor?: string;
}

/**
 * 信息源插件接口 - 所有源必须实现
 */
export interface Source {
  readonly type: SourceType;

  /**
   * 验证配置是否有效
   */
  validate(config: SourceConfig): Promise<{ valid: boolean; error?: string }>;

  /**
   * 抓取内容
   */
  fetch(config: SourceConfig, cursor?: string): Promise<FetchResult>;

  /**
   * 获取配置 Schema（用于 UI 动态生成表单）
   */
  getConfigSchema(): Record<string, unknown>;
}
