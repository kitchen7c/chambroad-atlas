// Shared types for the extension
import { z } from 'zod';

// ============================================
// LLM Configuration Types
// ============================================

export type LLMProvider = 'google' | 'openai' | 'anthropic' | 'deepseek' | 'qwen' | 'glm' | 'ollama' | 'custom';

/**
 * Optional LLM configuration parameters
 */
export interface LLMOptions {
  /** Controls randomness in responses. Range: 0 (deterministic) to 2 (creative). Default varies by provider. */
  temperature?: number;
  /** Maximum number of tokens in the response. */
  maxTokens?: number;
  /** Request timeout in seconds. */
  timeout?: number;
  /** Custom HTTP headers for API requests (e.g., for proxies or custom auth). */
  headers?: Record<string, string>;
}

export interface LLMConfig {
  provider: LLMProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  options?: LLMOptions;
}

/**
 * Pre-configured settings for supported LLM providers.
 * Note: 'custom' provider is excluded as it requires user-defined configuration.
 */
export const LLM_PROVIDER_PRESETS: Record<Exclude<LLMProvider, 'custom'>, { baseUrl: string; defaultModel: string; models: string[] }> = {
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.0-flash-exp',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash-exp'],
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4-turbo',
    models: ['gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-opus-20240229',
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
  },
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-max',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-long'],
  },
  glm: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-plus',
    models: ['glm-4-plus', 'glm-4-air', 'glm-4-flash', 'glm-4-long'],
  },
  ollama: {
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3',
    models: ['llama3', 'llama2', 'mistral', 'codellama'],
  },
};

export interface Settings {
  // New LLM configuration (supports multiple providers)
  llm: LLMConfig;
  // Legacy fields for backward compatibility with existing code
  // These map to llm.provider, llm.apiKey, llm.model respectively
  provider?: 'google';  // Only 'google' supported for legacy compatibility
  apiKey?: string;
  model?: string;
}

export interface ChatState {
  phase: 'loading' | 'ready' | 'streaming' | 'error';
  settings: Settings | null;
  messages: Message[];
  error: string | null;
  isLoading: boolean;
  browserToolsEnabled: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: GeminiFunctionCall[];
}

export interface PageContext {
  url: string;
  title: string;
  textContent: string;
  links: Array<{ text: string; href: string }>;
  images: Array<{ alt: string; src: string }>;
  forms: Array<{
    id: string;
    action: string;
    inputs: Array<{ name: string; type: string }>
  }>;
  metadata: {
    description?: string;
    keywords?: string;
    author?: string;
  };
  viewport?: {
    width: number;
    height: number;
    scrollX: number;
    scrollY: number;
    devicePixelRatio: number;
  };
}

export interface BrowserMemory {
  recentPages: Array<{
    url: string;
    title: string;
    timestamp: number;
    context?: any
  }>;
  userPreferences: Record<string, any>;
  sessionData: Record<string, any>;
}

export interface MessageRequest {
  type: string;
  [key: string]: any;
}

export interface MessageResponse {
  success?: boolean;
  error?: string;
  [key: string]: any;
}

export interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
}

/**
 * MCP Client type for managing Model Context Protocol connections
 * Matches the AI SDK experimental_createMCPClient return type
 */
export interface MCPClient {
  tools(): Promise<Record<string, any>>;
  close(): Promise<void>;
}

/**
 * Browser action function parameters
 */
export interface BrowserActionParams {
  x?: number;
  y?: number;
  text?: string;
  selector?: string;
  target?: string;
  value?: string;
  direction?: string;
  amount?: number;
  key?: string;
  keys?: string[];
  destination_x?: number;
  destination_y?: number;
  coordinate?: { x: number; y: number };
  address?: string;
  uri?: string;
  content?: string;
  seconds?: number;
  milliseconds?: number;
  press_enter?: boolean;
  clear_before_typing?: boolean;
  magnitude?: number;
}

/**
 * Gemini API function call
 */
export interface GeminiFunctionCall {
  name: string;
  args?: Record<string, unknown>;
}

/**
 * Extended viewport info
 */
export interface ViewportInfo {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
  devicePixelRatio: number;
}

// ============================================
// Zod Validation Schemas (for runtime validation)
// ============================================

/**
 * Validates Gemini API response structure
 * Ensures response has expected format before processing
 */
export const GeminiPartSchema = z.union([
  z.object({
    text: z.string(),
  }),
  z.object({
    functionCall: z.object({
      name: z.string(),
      args: z.record(z.any()).optional(),
    }),
  }),
  z.object({
    function_response: z.any(),
  }),
  z.object({
    inline_data: z.object({
      mime_type: z.string(),
      data: z.string(),
    }),
  }),
]);

export const GeminiCandidateSchema = z.object({
  content: z.object({
    parts: z.array(GeminiPartSchema),
  }).optional(),
  finishReason: z.string().optional(),
  safetyResponse: z.object({
    requireConfirmation: z.boolean(),
    message: z.string().optional(),
  }).optional(),
});

export const GeminiResponseSchema = z.object({
  candidates: z.array(GeminiCandidateSchema).optional(),
  promptFeedback: z.object({
    blockReason: z.string().optional(),
  }).optional(),
});

/**
 * Validates page context from content script
 */
export const PageContextSchema = z.object({
  url: z.string().url().or(z.string().startsWith('data:')),
  title: z.string(),
  textContent: z.string(),
  links: z.array(z.object({
    text: z.string(),
    href: z.string(),
  })).default([]),
  images: z.array(z.object({
    alt: z.string(),
    src: z.string(),
  })).default([]),
  forms: z.array(z.object({
    id: z.string(),
    action: z.string(),
    inputs: z.array(z.object({
      name: z.string(),
      type: z.string(),
    })),
  })).default([]),
  metadata: z.object({
    description: z.string().optional(),
    keywords: z.string().optional(),
    author: z.string().optional(),
  }).optional(),
  viewport: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    scrollX: z.number(),
    scrollY: z.number(),
    devicePixelRatio: z.number().positive(),
  }).optional(),
});

/**
 * Validates action response from content script
 */
export const ActionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
  data: z.any().optional(),
  element: z.string().optional(),
  elementBounds: z.object({
    left: z.number(),
    top: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional(),
  text: z.string().optional(),
  screenshot: z.string().optional(),
});

/**
 * Validates screenshot response
 */
export const ScreenshotResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  screenshot: z.string().optional(), // data URL
});

// ============================================
// LLM Configuration Validation Schemas
// ============================================

export const LLMOptionsSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  timeout: z.number().positive().optional(),
  headers: z.record(z.string()).optional(),
});

export const LLMConfigSchema = z.object({
  provider: z.enum(['google', 'openai', 'anthropic', 'deepseek', 'qwen', 'glm', 'ollama', 'custom']),
  baseUrl: z.string().url(),
  apiKey: z.string(),
  model: z.string().min(1),
  options: LLMOptionsSchema.optional(),
});

export const SettingsSchemaV2 = z.object({
  llm: LLMConfigSchema,
});
