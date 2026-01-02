import type { StoredArticle } from '../storage/db';

/**
 * 处理器类型
 */
export type ProcessorType = 'summarizer' | 'classifier' | 'scorer' | 'filter';

/**
 * 处理策略
 */
export type ProcessStrategy = 'immediate' | 'on_view' | 'batch';

/**
 * 处理上下文 - 在处理器间传递
 */
export interface ProcessContext {
  article: StoredArticle;
  results: {
    summary?: string;
    tags?: string[];
    score?: number;
    filtered?: boolean;
    filterReason?: string;
  };
}

/**
 * 处理器配置
 */
export interface ProcessorConfig {
  enabled: boolean;
  options: Record<string, unknown>;
}

/**
 * 处理器接口 - 所有处理器必须实现
 */
export interface Processor {
  readonly type: ProcessorType;

  /**
   * 处理文章
   */
  process(ctx: ProcessContext, config: ProcessorConfig): Promise<ProcessContext>;

  /**
   * 获取配置 Schema（用于 UI 动态生成表单）
   */
  getConfigSchema(): Record<string, unknown>;
}
