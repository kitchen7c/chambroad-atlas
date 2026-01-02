import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMClient } from './client';
import type { LLMConfig } from '../../types';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('LLMClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('Google provider', () => {
    it('should call Google API correctly', async () => {
      const config: LLMConfig = {
        provider: 'google',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'test-key',
        model: 'gemini-2.0-flash-exp',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'Hello response' }] } }],
        }),
      });

      const client = new LLMClient(config);
      const response = await client.chat([{ role: 'user', content: 'Hello' }]);

      expect(response.content).toBe('Hello response');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('OpenAI-compatible provider', () => {
    it('should call OpenAI-compatible API correctly', async () => {
      const config: LLMConfig = {
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        apiKey: 'test-key',
        model: 'deepseek-chat',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Deepseek response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20 },
        }),
      });

      const client = new LLMClient(config);
      const response = await client.chat([{ role: 'user', content: 'Hello' }]);

      expect(response.content).toBe('Deepseek response');
      expect(response.usage?.promptTokens).toBe(10);
    });
  });

  describe('error handling', () => {
    it('should throw on API error', async () => {
      const config: LLMConfig = {
        provider: 'google',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'test-key',
        model: 'gemini-2.0-flash-exp',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { message: 'Invalid API key' } }),
      });

      const client = new LLMClient(config);
      await expect(client.chat([{ role: 'user', content: 'Hello' }]))
        .rejects.toThrow();
    });
  });
});
