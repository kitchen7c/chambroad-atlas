import { z } from 'zod';

export type LLMProvider = 'google' | 'openai' | 'anthropic' | 'ollama' | 'custom';

/**
 * Optional LLM configuration parameters
 */
export interface LLMOptions {
  /** Controls randomness in responses. Range: 0 (deterministic) to 2 (creative). */
  temperature?: number;
  /** Maximum number of tokens in the response. */
  maxTokens?: number;
  /** Request timeout in seconds. */
  timeout?: number;
  /** Custom HTTP headers for API requests. */
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
  ollama: {
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3',
    models: ['llama3', 'llama2', 'mistral', 'codellama'],
  },
};

export interface ToolCall {
  id: string;
  toolName: string;
  args?: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'completed' | 'failed';
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode: 'chat' | 'web';
  timestamp?: number;
  toolCalls?: ToolCall[];
}

export interface Settings {
  // New LLM configuration (supports multiple providers)
  llm?: LLMConfig;
  // Legacy fields for backward compatibility
  googleApiKey: string;
  composioApiKey?: string;
  model: string;
}

export interface BrowserAction {
  type: 'navigate' | 'click' | 'type' | 'scroll' | 'screenshot';
  url?: string;
  x?: number;
  y?: number;
  text?: string;
  direction?: 'up' | 'down';
  amount?: number;
}

// SECURITY: Zod schemas for validating data from localStorage
// This prevents corrupted or malicious data from being used

export const LLMConfigSchema = z.object({
  provider: z.enum(['google', 'openai', 'anthropic', 'ollama', 'custom']),
  baseUrl: z.string().url(),
  apiKey: z.string(),
  model: z.string().min(1),
  options: z.object({
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().positive().optional(),
    timeout: z.number().positive().optional(),
    headers: z.record(z.string()).optional(),
  }).optional(),
});

export const ToolCallSchema = z.object({
  id: z.string(),
  toolName: z.string(),
  args: z.record(z.unknown()).optional(),
  result: z.unknown().optional(),
  status: z.enum(['pending', 'completed', 'failed']),
});

export const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  mode: z.enum(['chat', 'web']),
  timestamp: z.number().optional(),
  toolCalls: z.array(ToolCallSchema).optional(),
});

export const ChatHistorySchema = z.array(MessageSchema);

export const SettingsSchema = z.object({
  llm: LLMConfigSchema.optional(),
  googleApiKey: z.string(),
  composioApiKey: z.string().optional(),
  model: z.string(),
});
