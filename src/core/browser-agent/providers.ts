// src/core/browser-agent/providers.ts

import type { LLMProvider } from '../../../types';
import type { ProviderCapabilities, AgentMode } from './types';

// Default capabilities for unknown providers
const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  functionCalling: false,
  vision: false
};

// Provider capabilities matrix
export const providerCapabilities: Record<LLMProvider, ProviderCapabilities> = {
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
export function getProviderCapabilities(provider: LLMProvider): ProviderCapabilities {
  return providerCapabilities[provider] ?? DEFAULT_CAPABILITIES;
}

// Determine agent mode based on provider
export function selectAgentMode(provider: LLMProvider): AgentMode {
  const caps = getProviderCapabilities(provider);
  if (caps.vision) return 'hybrid';
  return 'dom';
}

// Check if provider supports function calling
export function supportsFunctionCalling(provider: LLMProvider): boolean {
  return getProviderCapabilities(provider).functionCalling;
}

// Check if provider supports vision
export function supportsVision(provider: LLMProvider): boolean {
  return getProviderCapabilities(provider).vision;
}
