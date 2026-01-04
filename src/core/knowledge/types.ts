import { z } from 'zod';

// Supported note tools
export type NoteTool = 'obsidian' | 'logseq' | 'typora' | 'custom';

// Link format preference
export type LinkFormat = 'wikilink' | 'markdown';

// Tag format preference
export type TagFormat = 'frontmatter' | 'inline' | 'both';

// Knowledge base configuration schema
export const KnowledgeConfigSchema = z.object({
  tool: z.enum(['obsidian', 'logseq', 'typora', 'custom']).default('obsidian'),
  vaultPath: z.string().min(1),
  inboxFolder: z.string().default('Atlas/Inbox'),
  dailyFolder: z.string().default('Atlas/Daily'),
  archiveFolder: z.string().default('Atlas/Archive'),
  readFolders: z.array(z.string()).default([]),
  filenameTemplate: z.string().default('{{date}}-{{slug}}'),

  // Tool-specific settings
  linkFormat: z.enum(['wikilink', 'markdown']).default('wikilink'),
  tagFormat: z.enum(['frontmatter', 'inline', 'both']).default('frontmatter'),
  useYamlFrontmatter: z.boolean().default(true),
});

export type KnowledgeConfig = z.infer<typeof KnowledgeConfigSchema>;

// Article frontmatter schema
export const ArticleFrontmatterSchema = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string().optional(),
  url: z.string().url().optional(),
  author: z.string().optional(),
  publishedAt: z.string().optional(),
  fetchedAt: z.string().optional(),
  tags: z.array(z.string()).default([]),
  score: z.number().min(0).max(10).optional(),
  isRead: z.boolean().default(false),
  isFavorite: z.boolean().default(false),
  summary: z.string().optional(),
});

export type ArticleFrontmatter = z.infer<typeof ArticleFrontmatterSchema>;

// Full article with content
export interface MarkdownArticle {
  frontmatter: ArticleFrontmatter;
  content: string;
  filepath: string;
}

// Default configurations for each tool
export const TOOL_DEFAULTS: Record<NoteTool, Partial<KnowledgeConfig>> = {
  obsidian: {
    linkFormat: 'wikilink',
    tagFormat: 'frontmatter',
    useYamlFrontmatter: true,
  },
  logseq: {
    linkFormat: 'wikilink',
    tagFormat: 'inline',
    useYamlFrontmatter: false,
  },
  typora: {
    linkFormat: 'markdown',
    tagFormat: 'frontmatter',
    useYamlFrontmatter: true,
  },
  custom: {
    linkFormat: 'markdown',
    tagFormat: 'frontmatter',
    useYamlFrontmatter: true,
  },
};
