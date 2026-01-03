// src/core/browser-agent/providers.ts

import type { ProviderCapabilities, AgentMode } from './types';

// Provider capabilities matrix
export const providerCapabilities: Record<string, ProviderCapabilities> = {
  google: { functionCalling: true, vision: true },
  openai: { functionCalling: true, vision: true },
  anthropic: { functionCalling: true, vision: true },
  deepseek: { functionCalling: true, vision: false },
  qwen: { functionCalling: true, vision: true },
  glm: { functionCalling: true, vision: true },
  ollama: { functionCalling: false, vision: false },
  custom: { functionCalling: false, vision: false },
};

// Get capabilities for a provider
export function getProviderCapabilities(provider: string): ProviderCapabilities {
  return providerCapabilities[provider] ?? { functionCalling: false, vision: false };
}

// Determine agent mode based on provider
export function selectAgentMode(provider: string): AgentMode {
  const caps = getProviderCapabilities(provider);
  if (caps.vision) return 'hybrid';
  return 'dom';
}

// Check if provider supports function calling
export function supportsFunctionCalling(provider: string): boolean {
  return getProviderCapabilities(provider).functionCalling;
}

// Check if provider supports vision
export function supportsVision(provider: string): boolean {
  return getProviderCapabilities(provider).vision;
}
