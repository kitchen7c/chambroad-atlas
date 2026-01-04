import { z } from 'zod';

// Supported export formats
export type ExportFormat = 'markdown' | 'pdf' | 'html' | 'json' | 'csv';

// Export configuration schema
export const ExportConfigSchema = z.object({
  outputDir: z.string().default('~/Atlas/exports'),
  formats: z.object({
    markdown: z.object({
      includeMetadata: z.boolean().default(true),
      includeSummary: z.boolean().default(true),
      template: z.string().optional(),
    }).default({}),
    pdf: z.object({
      pageSize: z.enum(['a4', 'letter']).default('a4'),
      includeHeader: z.boolean().default(true),
      includeFooter: z.boolean().default(true),
      fontSize: z.number().default(12),
    }).default({}),
    html: z.object({
      standalone: z.boolean().default(true),
      includeStyles: z.boolean().default(true),
      template: z.string().optional(),
    }).default({}),
    json: z.object({
      pretty: z.boolean().default(true),
      includeContent: z.boolean().default(true),
    }).default({}),
    csv: z.object({
      delimiter: z.string().default(','),
      includeHeaders: z.boolean().default(true),
      fields: z.array(z.string()).default(['title', 'source', 'url', 'tags', 'score', 'publishedAt']),
    }).default({}),
  }).default({}),
  dailyBrief: z.object({
    enabled: z.boolean().default(false),
    time: z.string().default('08:00'),
    format: z.enum(['markdown', 'pdf', 'html']).default('markdown'),
    folder: z.string().default('daily'),
    maxItems: z.number().default(10),
    minScore: z.number().default(5),
  }).default({}),
});

export type ExportConfig = z.infer<typeof ExportConfigSchema>;

// Export request
export interface ExportRequest {
  format: ExportFormat;
  articles: ArticleExportData[];
  outputPath?: string;
  options?: Partial<ExportConfig['formats'][ExportFormat]>;
}

// Article data for export
export interface ArticleExportData {
  id: string;
  title: string;
  content: string;
  source?: string;
  url?: string;
  author?: string;
  publishedAt?: string;
  fetchedAt?: string;
  tags: string[];
  score?: number;
  summary?: string;
  isRead: boolean;
  isFavorite: boolean;
}

// Export result
export interface ExportResult {
  success: boolean;
  filepath?: string;
  error?: string;
  format: ExportFormat;
  articleCount: number;
}

// Daily brief data
export interface DailyBriefData {
  date: string;
  articles: ArticleExportData[];
  summary: string;
  stats: {
    total: number;
    bySource: Record<string, number>;
    byTag: Record<string, number>;
    avgScore: number;
  };
}
