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
    const toolCalls = message?.tool_calls?.map((tc: any) => ({
      name: tc.function.name,
      arguments: typeof tc.function.arguments === 'string'
        ? JSON.parse(tc.function.arguments)
        : tc.function.arguments,
    }));

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
