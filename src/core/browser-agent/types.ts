// src/core/browser-agent/types.ts

// Action types supported by the browser agent
export type ActionType =
  | 'click' | 'type' | 'scroll' | 'navigate' | 'screenshot' | 'wait'
  | 'hover' | 'select' | 'pressKey' | 'goBack' | 'goForward' | 'refresh'
  | 'dragDrop' | 'uploadFile' | 'switchTab' | 'executeJS'
  | 'getElements' | 'getElementDetails';

// Browser action with parameters
export interface BrowserAction {
  action: ActionType;
  params?: Record<string, unknown>;
}

// Page summary - first layer, always sent to LLM
export interface PageSummary {
  url: string;
  title: string;
  viewport: { width: number; height: number };
  scrollPosition: { x: number; y: number };
  elements: {
    buttons: number;
    inputs: number;
    links: number;
    selects: number;
    images: number;
    forms: number;
  };
  visibleText: string;
  focusedElement?: { tag: string; index: number };
}

// Element info - second layer, returned by getElements
export interface ElementInfo {
  index: number;
  tag: string;
  text: string;
  role?: string;
  type?: string;
  placeholder?: string;
  href?: string;
  value?: string;
  isVisible: boolean;
  isEnabled: boolean;
  rect: { x: number; y: number; width: number; height: number };
}

// Element details - third layer, returned by getElementDetails
export interface ElementDetails extends ElementInfo {
  attributes: Record<string, string>;
  selector: string;
  xpath: string;
  parentText?: string;
  childCount: number;
}

// Action execution result
export interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

// Confirmation level for sensitive actions
export type ConfirmLevel = 'auto' | 'notify' | 'confirm' | 'block';

// LLM provider capabilities
export interface ProviderCapabilities {
  functionCalling: boolean;
  vision: boolean;
}

// Agent execution mode
export type AgentMode = 'dom' | 'vision' | 'hybrid';
