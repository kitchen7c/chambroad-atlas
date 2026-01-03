import type { LLMConfig } from '../../../types';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

// Function calling types
export interface LLMTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LLMToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMResponseWithTools extends LLMResponse {
  toolCalls?: LLMToolCall[];
}

export interface ChatOptions {
  tools?: LLMTool[];
  signal?: AbortSignal;
}

export class LLMClient {
  constructor(private config: LLMConfig) {}

  async chat(messages: LLMMessage[], options?: ChatOptions): Promise<LLMResponseWithTools> {
    const { provider } = this.config;

    if (provider === 'google') {
      return this.callGoogle(messages, options);
    } else {
      return this.callOpenAICompatible(messages, options);
    }
  }

  private async callGoogle(messages: LLMMessage[], options?: ChatOptions): Promise<LLMResponseWithTools> {
    const { baseUrl, apiKey, model } = this.config;

    const body: Record<string, unknown> = {
      contents: messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    };

    // Add tools if provided
    if (options?.tools && options.tools.length > 0) {
      body.tools = [{
        functionDeclarations: options.tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        })),
      }];
    }

    const response = await fetch(
      `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: options?.signal,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    // Extract text content
    const textPart = parts.find((p: any) => p.text);
    const content = textPart?.text || '';

    // Extract function calls
    const functionCallParts = parts.filter((p: any) => p.functionCall);
    const toolCalls = functionCallParts.map((p: any) => ({
      name: p.functionCall.name,
      arguments: p.functionCall.args || {},
    }));

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  private async callOpenAICompatible(messages: LLMMessage[], options?: ChatOptions): Promise<LLMResponseWithTools> {
    const { baseUrl, apiKey, model } = this.config;

    const body: Record<string, unknown> = {
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    };

    // Add tools if provided (OpenAI format)
    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
      // Some providers need tool_choice to encourage function calling
      body.tool_choice = 'auto';
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: options?.signal,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;

    // Extract tool calls if present
    let toolCalls: LLMToolCall[] | undefined;
    if (message?.tool_calls && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      try {
        toolCalls = message.tool_calls.map((tc: any) => {
          let args: Record<string, unknown>;
          if (typeof tc.function?.arguments === 'string') {
            try {
              args = JSON.parse(tc.function.arguments);
            } catch {
              // If JSON parse fails, try to extract action from the string
              console.warn('Failed to parse tool arguments:', tc.function.arguments);
              args = {};
            }
          } else {
            args = tc.function?.arguments || {};
          }
          return {
            name: tc.function?.name || 'unknown',
            arguments: args,
          };
        });
      } catch (e) {
        console.warn('Failed to parse tool calls:', e);
        toolCalls = undefined;
      }
    }

    return {
      content: message?.content || '',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
      } : undefined,
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
    };
  }
}
