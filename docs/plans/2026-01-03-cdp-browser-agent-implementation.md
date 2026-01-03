# CDP Browser Agent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement browser automation using CDP that works with any LLM, replacing Gemini Computer Use dependency.

**Architecture:** BrowserAgent orchestrates LLM decision-making and action execution. PageContext extracts DOM elements in layers. ActionExecutor runs commands via content script. Safety module gates sensitive operations.

**Tech Stack:** TypeScript, Chrome Extensions API, existing LLMClient (extended for function calling)

---

## Task 1: Define Core Types

**Files:**
- Create: `src/core/browser-agent/types.ts`

**Step 1: Create types file with all interfaces**

```typescript
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
```

**Step 2: Create index file**

```typescript
// src/core/browser-agent/index.ts
export * from './types';
```

**Step 3: Commit**

```bash
git add src/core/browser-agent/
git commit -m "feat(browser-agent): add core type definitions"
```

---

## Task 2: Define Function Calling Schema

**Files:**
- Create: `src/core/browser-agent/actions.ts`

**Step 1: Create actions schema**

```typescript
// src/core/browser-agent/actions.ts

import type { ActionType } from './types';

// Function calling tool definition for LLMs
export const browserActionTool = {
  name: 'browser_action',
  description: 'Execute browser actions like clicking, typing, scrolling, and navigating.',
  parameters: {
    type: 'object' as const,
    required: ['action'],
    properties: {
      action: {
        type: 'string',
        enum: [
          'click', 'type', 'scroll', 'navigate', 'screenshot', 'wait',
          'hover', 'select', 'pressKey', 'goBack', 'goForward', 'refresh',
          'dragDrop', 'uploadFile', 'switchTab', 'executeJS',
          'getElements', 'getElementDetails'
        ] as ActionType[],
        description: 'The action to perform'
      },
      params: {
        type: 'object',
        description: 'Action parameters (varies by action type)',
        properties: {
          // Click/hover params
          index: { type: 'number', description: 'Element index from getElements' },
          selector: { type: 'string', description: 'CSS selector' },
          x: { type: 'number', description: 'X coordinate' },
          y: { type: 'number', description: 'Y coordinate' },
          // Type params
          text: { type: 'string', description: 'Text to type' },
          clear: { type: 'boolean', description: 'Clear field before typing' },
          // Scroll params
          direction: { type: 'string', enum: ['up', 'down', 'left', 'right'] },
          amount: { type: 'number', description: 'Scroll amount in pixels' },
          // Navigate params
          url: { type: 'string', description: 'URL to navigate to' },
          // Wait params
          ms: { type: 'number', description: 'Milliseconds to wait' },
          // Select params
          value: { type: 'string', description: 'Option value to select' },
          // Key params
          key: { type: 'string', description: 'Key to press' },
          modifiers: { type: 'array', items: { type: 'string' } },
          // getElements params
          type: { type: 'string', enum: ['button', 'input', 'link', 'select', 'image', 'all'] },
          visible: { type: 'boolean', description: 'Only visible elements' },
          // getElementDetails params
          indices: { type: 'array', items: { type: 'number' } },
          // executeJS params
          code: { type: 'string', description: 'JavaScript code to execute' },
          // DragDrop params
          from: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } } },
          to: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } } },
        }
      }
    }
  }
};

// Convert tool to OpenAI format
export function toOpenAITool() {
  return {
    type: 'function' as const,
    function: browserActionTool
  };
}

// Convert tool to Anthropic format
export function toAnthropicTool() {
  return {
    name: browserActionTool.name,
    description: browserActionTool.description,
    input_schema: browserActionTool.parameters
  };
}

// Convert tool to Google format
export function toGoogleTool() {
  return {
    functionDeclarations: [{
      name: browserActionTool.name,
      description: browserActionTool.description,
      parameters: browserActionTool.parameters
    }]
  };
}
```

**Step 2: Update index**

```typescript
// src/core/browser-agent/index.ts
export * from './types';
export * from './actions';
```

**Step 3: Commit**

```bash
git add src/core/browser-agent/
git commit -m "feat(browser-agent): add function calling schema definitions"
```

---

## Task 3: Implement Page Context Extractor

**Files:**
- Create: `src/core/browser-agent/page-context.ts`
- Modify: `content.ts` (add new message handlers)

**Step 1: Create page context module**

```typescript
// src/core/browser-agent/page-context.ts

import type { PageSummary, ElementInfo, ElementDetails } from './types';

// Build unique CSS selector for an element
export function buildSelector(element: Element): string {
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).filter(c => c).slice(0, 2);
      if (classes.length) {
        selector += '.' + classes.map(c => CSS.escape(c)).join('.');
      }
    }

    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(c => c.tagName === current!.tagName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    current = parent;
  }

  return path.join(' > ');
}

// Build XPath for an element
export function buildXPath(element: Element): string {
  const paths: string[] = [];
  let current: Element | null = element;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let index = 1;
    let sibling = current.previousElementSibling;

    while (sibling) {
      if (sibling.tagName === current.tagName) index++;
      sibling = sibling.previousElementSibling;
    }

    const tagName = current.tagName.toLowerCase();
    paths.unshift(`${tagName}[${index}]`);
    current = current.parentElement;
  }

  return '/' + paths.join('/');
}

// Check if element is in viewport
export function isInViewport(rect: DOMRect): boolean {
  return (
    rect.top < window.innerHeight &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.right > 0
  );
}

// Check if element is interactable
export function isInteractable(element: Element): boolean {
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return false;
  }

  return true;
}
```

**Step 2: Add content script message handlers**

Add to end of `content.ts` (before the final `sendPageLoadMessage` section):

```typescript
// Enhanced element extraction for browser agent
interface InteractiveElement {
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

// Element store for index-based operations
let elementStore: Element[] = [];

function extractInteractiveElements(
  filterType?: 'button' | 'input' | 'link' | 'select' | 'image' | 'all',
  visibleOnly?: boolean
): InteractiveElement[] {
  const selectors: Record<string, string> = {
    button: 'button, [role="button"], input[type="button"], input[type="submit"]',
    input: 'input:not([type="hidden"]):not([type="button"]):not([type="submit"]), textarea, [contenteditable="true"]',
    link: 'a[href]',
    select: 'select',
    image: 'img[src]',
    all: 'button, [role="button"], input, textarea, select, a[href], [contenteditable="true"], [onclick], [role="link"], [role="tab"], [role="menuitem"]'
  };

  const selector = selectors[filterType || 'all'];
  const elements = Array.from(document.querySelectorAll(selector));

  elementStore = []; // Reset store
  const result: InteractiveElement[] = [];

  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);

    const isVisible =
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0';

    const isInViewport =
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0;

    if (visibleOnly && (!isVisible || !isInViewport)) {
      continue;
    }

    const index = elementStore.length;
    elementStore.push(el);

    const htmlEl = el as HTMLElement;
    const inputEl = el as HTMLInputElement;

    result.push({
      index,
      tag: el.tagName.toLowerCase(),
      text: (htmlEl.innerText || htmlEl.textContent || '').trim().slice(0, 50),
      role: el.getAttribute('role') || undefined,
      type: inputEl.type || undefined,
      placeholder: inputEl.placeholder || undefined,
      href: (el as HTMLAnchorElement).href || undefined,
      value: inputEl.value || undefined,
      isVisible: isVisible && isInViewport,
      isEnabled: !inputEl.disabled,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    });
  }

  return result;
}

function extractPageSummary(): {
  url: string;
  title: string;
  viewport: { width: number; height: number };
  scrollPosition: { x: number; y: number };
  elements: { buttons: number; inputs: number; links: number; selects: number; images: number; forms: number };
  visibleText: string;
  focusedElement?: { tag: string; index: number };
} {
  const buttons = document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]').length;
  const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="button"]):not([type="submit"]), textarea').length;
  const links = document.querySelectorAll('a[href]').length;
  const selects = document.querySelectorAll('select').length;
  const images = document.querySelectorAll('img').length;
  const forms = document.querySelectorAll('form').length;

  let focusedElement: { tag: string; index: number } | undefined;
  const activeEl = document.activeElement;
  if (activeEl && activeEl !== document.body) {
    const idx = elementStore.indexOf(activeEl);
    focusedElement = {
      tag: activeEl.tagName.toLowerCase(),
      index: idx >= 0 ? idx : -1
    };
  }

  return {
    url: window.location.href,
    title: document.title,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    scrollPosition: { x: window.scrollX, y: window.scrollY },
    elements: { buttons, inputs, links, selects, images, forms },
    visibleText: document.body.innerText.slice(0, 500),
    focusedElement
  };
}

function getElementByIndex(index: number): Element | null {
  return elementStore[index] || null;
}

// Add message handlers (inside the existing chrome.runtime.onMessage.addListener)
// These need to be added to the switch/if blocks
```

**Step 3: Update content.ts message listener**

Add these handlers inside the existing `chrome.runtime.onMessage.addListener` in content.ts:

```typescript
  if (request.type === 'GET_PAGE_SUMMARY') {
    // First extract elements to populate the store
    extractInteractiveElements('all', false);
    const summary = extractPageSummary();
    sendResponse(summary);
    return true;
  }

  if (request.type === 'GET_ELEMENTS') {
    const elements = extractInteractiveElements(request.filterType, request.visibleOnly);
    sendResponse({ elements });
    return true;
  }

  if (request.type === 'GET_ELEMENT_DETAILS') {
    const indices: number[] = request.indices || [];
    const details = indices.map(idx => {
      const el = getElementByIndex(idx);
      if (!el) return null;

      const rect = el.getBoundingClientRect();
      const htmlEl = el as HTMLElement;
      const inputEl = el as HTMLInputElement;

      // Build selector and xpath
      let selector = '';
      let xpath = '';
      try {
        // Simple selector building
        if (el.id) {
          selector = `#${el.id}`;
        } else if (el.className && typeof el.className === 'string') {
          selector = `${el.tagName.toLowerCase()}.${el.className.split(' ')[0]}`;
        } else {
          selector = el.tagName.toLowerCase();
        }

        // Simple xpath
        xpath = `//${el.tagName.toLowerCase()}`;
      } catch (e) {
        // Ignore errors in selector building
      }

      const attrs: Record<string, string> = {};
      for (const attr of Array.from(el.attributes)) {
        attrs[attr.name] = attr.value;
      }

      return {
        index: idx,
        tag: el.tagName.toLowerCase(),
        text: (htmlEl.innerText || htmlEl.textContent || '').trim().slice(0, 100),
        role: el.getAttribute('role') || undefined,
        type: inputEl.type || undefined,
        placeholder: inputEl.placeholder || undefined,
        href: (el as HTMLAnchorElement).href || undefined,
        value: inputEl.value || undefined,
        isVisible: rect.width > 0 && rect.height > 0,
        isEnabled: !inputEl.disabled,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        attributes: attrs,
        selector,
        xpath,
        parentText: el.parentElement?.textContent?.trim().slice(0, 50),
        childCount: el.children.length
      };
    }).filter(Boolean);

    sendResponse({ details });
    return true;
  }

  if (request.type === 'CLICK_BY_INDEX') {
    const el = getElementByIndex(request.index);
    if (el) {
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      ['mousedown', 'mouseup', 'click'].forEach(eventType => {
        el.dispatchEvent(new MouseEvent(eventType, {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y
        }));
      });

      highlightElement(el, { x, y });
      sendResponse({ success: true, message: `Clicked element ${request.index}` });
    } else {
      sendResponse({ success: false, message: `Element ${request.index} not found` });
    }
    return true;
  }
```

**Step 4: Commit**

```bash
git add src/core/browser-agent/ content.ts
git commit -m "feat(browser-agent): add page context extraction with layered DOM"
```

---

## Task 4: Implement Provider Capabilities

**Files:**
- Create: `src/core/browser-agent/providers.ts`

**Step 1: Create providers configuration**

```typescript
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
```

**Step 2: Update index**

```typescript
// src/core/browser-agent/index.ts
export * from './types';
export * from './actions';
export * from './providers';
```

**Step 3: Commit**

```bash
git add src/core/browser-agent/
git commit -m "feat(browser-agent): add provider capabilities matrix"
```

---

## Task 5: Implement Safety Module

**Files:**
- Create: `src/core/browser-agent/safety.ts`

**Step 1: Create safety module**

```typescript
// src/core/browser-agent/safety.ts

import type { BrowserAction, PageSummary, ConfirmLevel } from './types';

// Sensitive URL patterns
const sensitiveUrlPatterns = [
  /checkout/i, /payment/i, /pay\//i, /billing/i,
  /login/i, /signin/i, /signup/i, /auth/i, /oauth/i,
  /delete/i, /remove/i, /cancel/i, /unsubscribe/i,
  /admin/i, /settings/i, /account/i, /profile/i,
  /bank/i, /transfer/i, /wire/i
];

// Sensitive content keywords
const sensitiveKeywords = [
  '确认支付', '立即支付', '删除账户', '注销', '取消订阅',
  '确认删除', '永久删除', '不可恢复',
  'confirm payment', 'delete account', 'unsubscribe',
  'permanently delete', 'cannot be undone', 'purchase', 'buy now'
];

// Actions that always require confirmation
const alwaysConfirmActions = ['executeJS', 'uploadFile'];

// Button text patterns that indicate sensitive actions
const sensitiveButtonPatterns = [
  /(submit|确认|提交|pay|支付|purchase|购买|order|下单)/i,
  /(delete|删除|remove|移除|cancel|取消|unsubscribe)/i
];

// Check if URL matches sensitive patterns
function isUrlSensitive(url: string): boolean {
  return sensitiveUrlPatterns.some(p => p.test(url));
}

// Check if content contains sensitive keywords
function contentContainsSensitive(text: string): boolean {
  const lowerText = text.toLowerCase();
  return sensitiveKeywords.some(k => lowerText.includes(k.toLowerCase()));
}

// Check if button text is sensitive
function isButtonSensitive(text: string): boolean {
  return sensitiveButtonPatterns.some(p => p.test(text));
}

// Determine confirmation level for an action
export function getConfirmLevel(
  action: BrowserAction,
  pageSummary: PageSummary
): ConfirmLevel {
  // Always confirm these actions
  if (alwaysConfirmActions.includes(action.action)) {
    return 'confirm';
  }

  const urlSensitive = isUrlSensitive(pageSummary.url);
  const contentSensitive = contentContainsSensitive(pageSummary.visibleText);

  // Click action on sensitive button
  if (action.action === 'click' && action.params) {
    const targetText = String(action.params.text || '');
    if (isButtonSensitive(targetText) && (urlSensitive || contentSensitive)) {
      return 'confirm';
    }
  }

  // Enter key on sensitive page (form submission)
  if (action.action === 'pressKey' && action.params?.key === 'Enter') {
    if (urlSensitive || contentSensitive) {
      return 'confirm';
    }
  }

  // Type action with sensitive content patterns (like credit card numbers)
  if (action.action === 'type' && action.params?.text) {
    const text = String(action.params.text);
    // Credit card pattern
    if (/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/.test(text)) {
      return 'confirm';
    }
  }

  return 'auto';
}

// Format confirmation message
export function formatConfirmMessage(
  action: BrowserAction,
  pageSummary: PageSummary
): string {
  const actionDesc = describeAction(action);
  return `确认执行操作？\n\n操作: ${actionDesc}\n页面: ${pageSummary.url}`;
}

// Describe action in human-readable format
function describeAction(action: BrowserAction): string {
  const params = action.params || {};

  switch (action.action) {
    case 'click':
      if (params.index !== undefined) return `点击元素 #${params.index}`;
      if (params.selector) return `点击 ${params.selector}`;
      if (params.x !== undefined) return `点击坐标 (${params.x}, ${params.y})`;
      return '点击';
    case 'type':
      return `输入 "${String(params.text || '').slice(0, 20)}..."`;
    case 'navigate':
      return `跳转到 ${params.url}`;
    case 'pressKey':
      return `按键 ${params.key}`;
    case 'executeJS':
      return `执行 JavaScript`;
    case 'uploadFile':
      return `上传文件`;
    default:
      return action.action;
  }
}
```

**Step 2: Update index**

```typescript
// src/core/browser-agent/index.ts
export * from './types';
export * from './actions';
export * from './providers';
export * from './safety';
```

**Step 3: Commit**

```bash
git add src/core/browser-agent/
git commit -m "feat(browser-agent): add safety module for sensitive action detection"
```

---

## Task 6: Implement System Prompts

**Files:**
- Create: `src/core/browser-agent/prompts.ts`

**Step 1: Create prompts module**

```typescript
// src/core/browser-agent/prompts.ts

import type { PageSummary, AgentMode } from './types';

// Build system prompt for browser agent
export function buildSystemPrompt(mode: AgentMode): string {
  const base = `你是一个浏览器自动化助手。根据用户任务和页面信息执行操作。

## 可用操作
使用 browser_action 工具执行以下操作：

### 信息获取
- getElements: 获取页面元素列表（可指定 type: button/input/link/select/image/all）
- getElementDetails: 获取特定元素的详细信息（传入 indices 数组）
- screenshot: 截取当前页面

### 基础操作
- click: 点击元素（使用 index 或 selector 或坐标 x,y）
- type: 输入文本（指定 text，可选 clear: true 先清空）
- scroll: 滚动页面（direction: up/down/left/right, amount: 像素数）
- navigate: 跳转 URL
- wait: 等待（ms: 毫秒数）

### 导航操作
- goBack: 后退
- goForward: 前进
- refresh: 刷新页面

### 高级操作
- hover: 悬停在元素上
- select: 选择下拉选项
- pressKey: 按键（key: Enter/Tab/Escape 等）
- switchTab: 切换标签页

## 执行流程
1. 先用 getElements 了解页面有哪些可交互元素
2. 根据元素的 index 执行 click、type 等操作
3. 每次操作后会收到结果，据此决定下一步
4. 任务完成后说明结果

## 注意事项
- 优先使用 index 操作元素（更可靠）
- 如果元素不在视口内，先 scroll 到可见位置
- 输入前可能需要先 click 聚焦输入框
- 表单提交可以用 click 提交按钮或 pressKey Enter`;

  if (mode === 'vision' || mode === 'hybrid') {
    return base + `

## 视觉模式
当前模式支持视觉分析，你会收到页面截图。
- 可以通过坐标 (x, y) 直接操作
- 截图中的位置对应实际点击位置
- 结合 DOM 信息和视觉信息做决策`;
  }

  return base;
}

// Build user message with page context
export function buildUserMessage(
  task: string,
  pageSummary: PageSummary
): string {
  const elementsInfo = Object.entries(pageSummary.elements)
    .filter(([_, count]) => count > 0)
    .map(([type, count]) => `${count} 个${typeLabel(type)}`)
    .join(', ');

  return `## 当前页面
URL: ${pageSummary.url}
标题: ${pageSummary.title}
视口: ${pageSummary.viewport.width}x${pageSummary.viewport.height}
可交互元素: ${elementsInfo}

页面内容摘要:
${pageSummary.visibleText}

## 用户任务
${task}`;
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    buttons: '按钮',
    inputs: '输入框',
    links: '链接',
    selects: '下拉框',
    images: '图片',
    forms: '表单'
  };
  return labels[type] || type;
}

// Fallback prompt for non-function-calling LLMs
export function buildFallbackPrompt(mode: AgentMode): string {
  return buildSystemPrompt(mode) + `

## 响应格式
由于你不支持 function calling，请将操作以 JSON 格式放在 markdown 代码块中返回：

\`\`\`json
{"action": "getElements", "params": {"type": "button"}}
\`\`\`

或多个操作：

\`\`\`json
[
  {"action": "click", "params": {"index": 0}},
  {"action": "type", "params": {"text": "hello"}}
]
\`\`\``;
}
```

**Step 2: Update index**

```typescript
// src/core/browser-agent/index.ts
export * from './types';
export * from './actions';
export * from './providers';
export * from './safety';
export * from './prompts';
```

**Step 3: Commit**

```bash
git add src/core/browser-agent/
git commit -m "feat(browser-agent): add system prompt templates"
```

---

## Task 7: Extend LLM Client for Function Calling

**Files:**
- Modify: `src/core/llm/client.ts`

**Step 1: Add function calling types**

Add at top of file after existing interfaces:

```typescript
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
```

**Step 2: Update chat method signature**

Replace the existing `chat` method:

```typescript
  async chat(messages: LLMMessage[], options?: ChatOptions): Promise<LLMResponseWithTools> {
    const { provider } = this.config;

    if (provider === 'google') {
      return this.callGoogle(messages, options);
    } else {
      return this.callOpenAICompatible(messages, options);
    }
  }
```

**Step 3: Update Google method for function calling**

Replace `callGoogle` method:

```typescript
  private async callGoogle(messages: LLMMessage[], options?: ChatOptions): Promise<LLMResponseWithTools> {
    const { baseUrl, apiKey, model } = this.config;

    const body: Record<string, unknown> = {
      contents: messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
    };

    // Add system instruction
    const systemMsg = messages.find(m => m.role === 'system');
    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }

    // Add tools if provided
    if (options?.tools?.length) {
      body.tools = [{
        functionDeclarations: options.tools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        }))
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
    const parts = data.candidates?.[0]?.content?.parts || [];

    const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);
    const functionCalls = parts.filter((p: any) => p.functionCall);

    const result: LLMResponseWithTools = {
      content: textParts.join(''),
    };

    if (functionCalls.length > 0) {
      result.toolCalls = functionCalls.map((fc: any) => ({
        name: fc.functionCall.name,
        arguments: fc.functionCall.args || {},
      }));
    }

    return result;
  }
```

**Step 4: Update OpenAI-compatible method for function calling**

Replace `callOpenAICompatible` method:

```typescript
  private async callOpenAICompatible(messages: LLMMessage[], options?: ChatOptions): Promise<LLMResponseWithTools> {
    const { baseUrl, apiKey, model } = this.config;

    const body: Record<string, unknown> = {
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    };

    // Add tools if provided
    if (options?.tools?.length) {
      body.tools = options.tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        }
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

    const result: LLMResponseWithTools = {
      content: message?.content || '',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
      } : undefined,
    };

    if (message?.tool_calls?.length) {
      result.toolCalls = message.tool_calls.map((tc: any) => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments || '{}'),
      }));
    }

    return result;
  }
```

**Step 5: Commit**

```bash
git add src/core/llm/client.ts
git commit -m "feat(llm): add function calling support to LLMClient"
```

---

## Task 8: Implement Action Executor

**Files:**
- Create: `src/core/browser-agent/action-executor.ts`

**Step 1: Create action executor**

```typescript
// src/core/browser-agent/action-executor.ts

import type { BrowserAction, ActionResult, ElementInfo, ElementDetails, PageSummary } from './types';

// Send message to content script via background
async function sendToContentScript(message: Record<string, unknown>): Promise<any> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, message: chrome.runtime.lastError.message });
      } else {
        resolve(response);
      }
    });
  });
}

// Execute a browser action
export async function executeAction(action: BrowserAction): Promise<ActionResult> {
  const { action: actionType, params = {} } = action;

  switch (actionType) {
    case 'getElements':
      return executeGetElements(params);

    case 'getElementDetails':
      return executeGetElementDetails(params);

    case 'click':
      return executeClick(params);

    case 'type':
      return executeType(params);

    case 'scroll':
      return executeScroll(params);

    case 'navigate':
      return executeNavigate(params);

    case 'wait':
      return executeWait(params);

    case 'hover':
      return executeHover(params);

    case 'select':
      return executeSelect(params);

    case 'pressKey':
      return executePressKey(params);

    case 'goBack':
      return executeGoBack();

    case 'goForward':
      return executeGoForward();

    case 'refresh':
      return executeRefresh();

    case 'screenshot':
      return executeScreenshot();

    case 'switchTab':
      return executeSwitchTab(params);

    case 'executeJS':
      return executeJS(params);

    case 'dragDrop':
      return executeDragDrop(params);

    case 'uploadFile':
      return { success: false, message: 'uploadFile not yet implemented' };

    default:
      return { success: false, message: `Unknown action: ${actionType}` };
  }
}

async function executeGetElements(params: Record<string, unknown>): Promise<ActionResult> {
  const response = await sendToContentScript({
    type: 'GET_ELEMENTS',
    filterType: params.type as string,
    visibleOnly: params.visible as boolean
  });

  if (response.elements) {
    return {
      success: true,
      message: `Found ${response.elements.length} elements`,
      data: response.elements as ElementInfo[]
    };
  }

  return { success: false, message: 'Failed to get elements' };
}

async function executeGetElementDetails(params: Record<string, unknown>): Promise<ActionResult> {
  const indices = params.indices as number[];
  if (!Array.isArray(indices)) {
    return { success: false, message: 'indices must be an array' };
  }

  const response = await sendToContentScript({
    type: 'GET_ELEMENT_DETAILS',
    indices
  });

  if (response.details) {
    return {
      success: true,
      message: `Got details for ${response.details.length} elements`,
      data: response.details as ElementDetails[]
    };
  }

  return { success: false, message: 'Failed to get element details' };
}

async function executeClick(params: Record<string, unknown>): Promise<ActionResult> {
  // Click by index
  if (params.index !== undefined) {
    const response = await sendToContentScript({
      type: 'CLICK_BY_INDEX',
      index: params.index as number
    });
    return response as ActionResult;
  }

  // Click by selector or coordinates
  const response = await sendToContentScript({
    type: 'EXECUTE_ACTION',
    action: 'click',
    selector: params.selector as string,
    coordinates: params.x !== undefined ? { x: params.x, y: params.y } : undefined
  });

  return response as ActionResult;
}

async function executeType(params: Record<string, unknown>): Promise<ActionResult> {
  // Clear first if requested
  if (params.clear) {
    await sendToContentScript({
      type: 'EXECUTE_ACTION',
      action: 'clear_input'
    });
    await new Promise(r => setTimeout(r, 100));
  }

  const response = await sendToContentScript({
    type: 'EXECUTE_ACTION',
    action: 'keyboard_type',
    value: params.text as string
  });

  return response as ActionResult;
}

async function executeScroll(params: Record<string, unknown>): Promise<ActionResult> {
  const response = await sendToContentScript({
    type: 'EXECUTE_ACTION',
    action: 'scroll',
    direction: params.direction as string,
    amount: params.amount as number,
    selector: params.selector as string
  });

  return response as ActionResult;
}

async function executeNavigate(params: Record<string, unknown>): Promise<ActionResult> {
  const url = params.url as string;
  if (!url) {
    return { success: false, message: 'URL is required' };
  }

  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'NAVIGATE', url }, (response) => {
      resolve(response as ActionResult);
    });
  });
}

async function executeWait(params: Record<string, unknown>): Promise<ActionResult> {
  const ms = (params.ms as number) || 1000;
  await new Promise(r => setTimeout(r, ms));
  return { success: true, message: `Waited ${ms}ms` };
}

async function executeHover(params: Record<string, unknown>): Promise<ActionResult> {
  const response = await sendToContentScript({
    type: 'EXECUTE_ACTION',
    action: 'hover',
    coordinates: { x: params.x, y: params.y }
  });

  return response as ActionResult;
}

async function executeSelect(params: Record<string, unknown>): Promise<ActionResult> {
  // First click to focus
  if (params.index !== undefined) {
    await sendToContentScript({
      type: 'CLICK_BY_INDEX',
      index: params.index as number
    });
  } else if (params.selector) {
    await sendToContentScript({
      type: 'EXECUTE_ACTION',
      action: 'click',
      selector: params.selector as string
    });
  }

  // Then select value
  const response = await sendToContentScript({
    type: 'EXECUTE_ACTION',
    action: 'fill',
    value: params.value as string
  });

  return response as ActionResult;
}

async function executePressKey(params: Record<string, unknown>): Promise<ActionResult> {
  const keys = params.modifiers
    ? [...(params.modifiers as string[]), params.key as string]
    : [params.key as string];

  const response = await sendToContentScript({
    type: 'EXECUTE_ACTION',
    action: 'key_combination',
    keys
  });

  return response as ActionResult;
}

async function executeGoBack(): Promise<ActionResult> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.goBack(tabs[0].id);
        setTimeout(() => resolve({ success: true, message: 'Navigated back' }), 500);
      } else {
        resolve({ success: false, message: 'No active tab' });
      }
    });
  });
}

async function executeGoForward(): Promise<ActionResult> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.goForward(tabs[0].id);
        setTimeout(() => resolve({ success: true, message: 'Navigated forward' }), 500);
      } else {
        resolve({ success: false, message: 'No active tab' });
      }
    });
  });
}

async function executeRefresh(): Promise<ActionResult> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.reload(tabs[0].id);
        setTimeout(() => resolve({ success: true, message: 'Page refreshed' }), 500);
      } else {
        resolve({ success: false, message: 'No active tab' });
      }
    });
  });
}

async function executeScreenshot(): Promise<ActionResult> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'TAKE_SCREENSHOT' }, (response) => {
      if (response?.screenshot) {
        resolve({
          success: true,
          message: 'Screenshot captured',
          data: response.screenshot
        });
      } else {
        resolve({ success: false, message: response?.error || 'Failed to capture screenshot' });
      }
    });
  });
}

async function executeSwitchTab(params: Record<string, unknown>): Promise<ActionResult> {
  return new Promise((resolve) => {
    if (params.index !== undefined) {
      chrome.tabs.query({}, (tabs) => {
        const tab = tabs[params.index as number];
        if (tab?.id) {
          chrome.tabs.update(tab.id, { active: true });
          resolve({ success: true, message: `Switched to tab ${params.index}` });
        } else {
          resolve({ success: false, message: `Tab ${params.index} not found` });
        }
      });
    } else if (params.url) {
      chrome.tabs.query({ url: params.url as string }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.update(tabs[0].id, { active: true });
          resolve({ success: true, message: `Switched to tab with URL ${params.url}` });
        } else {
          resolve({ success: false, message: `Tab with URL ${params.url} not found` });
        }
      });
    } else {
      resolve({ success: false, message: 'index or url required' });
    }
  });
}

async function executeJS(params: Record<string, unknown>): Promise<ActionResult> {
  const code = params.code as string;
  if (!code) {
    return { success: false, message: 'code is required' };
  }

  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs[0]?.id) {
        resolve({ success: false, message: 'No active tab' });
        return;
      }

      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: (code: string) => {
            try {
              return { success: true, result: eval(code) };
            } catch (e) {
              return { success: false, error: String(e) };
            }
          },
          args: [code]
        });

        const result = results[0]?.result;
        if (result?.success) {
          resolve({ success: true, message: 'JS executed', data: result.result });
        } else {
          resolve({ success: false, message: result?.error || 'JS execution failed' });
        }
      } catch (e) {
        resolve({ success: false, message: String(e) });
      }
    });
  });
}

async function executeDragDrop(params: Record<string, unknown>): Promise<ActionResult> {
  const from = params.from as { x: number; y: number };
  const to = params.to as { x: number; y: number };

  if (!from || !to) {
    return { success: false, message: 'from and to coordinates required' };
  }

  const response = await sendToContentScript({
    type: 'EXECUTE_ACTION',
    action: 'drag_drop',
    coordinates: from,
    destination: to
  });

  return response as ActionResult;
}

// Get page summary
export async function getPageSummary(): Promise<PageSummary> {
  const response = await sendToContentScript({ type: 'GET_PAGE_SUMMARY' });
  return response as PageSummary;
}
```

**Step 2: Update index**

```typescript
// src/core/browser-agent/index.ts
export * from './types';
export * from './actions';
export * from './providers';
export * from './safety';
export * from './prompts';
export * from './action-executor';
```

**Step 3: Commit**

```bash
git add src/core/browser-agent/
git commit -m "feat(browser-agent): implement action executor"
```

---

## Task 9: Implement Browser Agent Core

**Files:**
- Create: `src/core/browser-agent/agent.ts`

**Step 1: Create browser agent class**

```typescript
// src/core/browser-agent/agent.ts

import { LLMClient, LLMMessage, LLMTool } from '../llm/client';
import type { LLMConfig } from '../../../types';
import type { BrowserAction, ActionResult, PageSummary, AgentMode, ConfirmLevel } from './types';
import { browserActionTool } from './actions';
import { getProviderCapabilities, selectAgentMode, supportsFunctionCalling } from './providers';
import { getConfirmLevel, formatConfirmMessage } from './safety';
import { buildSystemPrompt, buildUserMessage, buildFallbackPrompt } from './prompts';
import { executeAction, getPageSummary } from './action-executor';

export interface AgentCallbacks {
  onActionStart?: (action: BrowserAction) => void;
  onActionComplete?: (action: BrowserAction, result: ActionResult) => void;
  onThinking?: (message: string) => void;
  onConfirmRequired?: (message: string, action: BrowserAction) => Promise<boolean>;
  onError?: (error: Error) => void;
}

export interface AgentOptions {
  maxTurns?: number;
  callbacks?: AgentCallbacks;
}

export class BrowserAgent {
  private llmClient: LLMClient;
  private mode: AgentMode;
  private usesFunctionCalling: boolean;
  private messages: LLMMessage[] = [];
  private abortController: AbortController | null = null;

  constructor(
    private config: LLMConfig,
    private options: AgentOptions = {}
  ) {
    this.llmClient = new LLMClient(config);
    this.mode = selectAgentMode(config.provider);
    this.usesFunctionCalling = supportsFunctionCalling(config.provider);
  }

  // Run the agent with a task
  async run(task: string): Promise<string> {
    this.abortController = new AbortController();
    const maxTurns = this.options.maxTurns || 20;

    // Get initial page context
    const pageSummary = await getPageSummary();

    // Build initial messages
    const systemPrompt = this.usesFunctionCalling
      ? buildSystemPrompt(this.mode)
      : buildFallbackPrompt(this.mode);

    this.messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildUserMessage(task, pageSummary) }
    ];

    let lastResponse = '';

    for (let turn = 0; turn < maxTurns; turn++) {
      if (this.abortController.signal.aborted) {
        return lastResponse + '\n\n[Stopped by user]';
      }

      this.options.callbacks?.onThinking?.(`Turn ${turn + 1}/${maxTurns}`);

      try {
        // Call LLM
        const tools: LLMTool[] = this.usesFunctionCalling ? [browserActionTool] : [];
        const response = await this.llmClient.chat(this.messages, {
          tools,
          signal: this.abortController.signal
        });

        lastResponse = response.content;

        // Check for tool calls
        let actions: BrowserAction[] = [];

        if (response.toolCalls?.length) {
          // Function calling response
          actions = response.toolCalls.map(tc => ({
            action: tc.arguments.action as any,
            params: tc.arguments.params as Record<string, unknown>
          }));
        } else if (!this.usesFunctionCalling && response.content) {
          // Try to parse JSON from markdown
          actions = this.parseActionsFromMarkdown(response.content);
        }

        // If no actions, task is complete
        if (actions.length === 0) {
          return response.content;
        }

        // Execute actions
        const results: ActionResult[] = [];
        for (const action of actions) {
          // Check if confirmation needed
          const confirmLevel = getConfirmLevel(action, pageSummary);

          if (confirmLevel === 'confirm') {
            const message = formatConfirmMessage(action, pageSummary);
            const confirmed = await this.options.callbacks?.onConfirmRequired?.(message, action);

            if (!confirmed) {
              results.push({ success: false, message: 'Action cancelled by user' });
              continue;
            }
          }

          if (confirmLevel === 'block') {
            results.push({ success: false, message: 'Action blocked for safety' });
            continue;
          }

          this.options.callbacks?.onActionStart?.(action);
          const result = await executeAction(action);
          this.options.callbacks?.onActionComplete?.(action, result);
          results.push(result);

          // Small delay between actions
          await new Promise(r => setTimeout(r, 300));
        }

        // Add results to conversation
        const resultSummary = results.map((r, i) =>
          `Action ${i + 1}: ${r.success ? '✓' : '✗'} ${r.message}`
        ).join('\n');

        // Get updated page state
        const newSummary = await getPageSummary();

        this.messages.push({
          role: 'assistant',
          content: response.content || `Executed ${actions.length} action(s)`
        });

        this.messages.push({
          role: 'user',
          content: `## 操作结果\n${resultSummary}\n\n## 当前页面状态\nURL: ${newSummary.url}\n标题: ${newSummary.title}\n\n请继续完成任务，或者如果任务已完成，总结结果。`
        });

      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return lastResponse + '\n\n[Stopped by user]';
        }
        this.options.callbacks?.onError?.(error as Error);
        throw error;
      }
    }

    return lastResponse + '\n\n[Reached maximum turns]';
  }

  // Stop the agent
  stop(): void {
    this.abortController?.abort();
  }

  // Parse actions from markdown JSON blocks
  private parseActionsFromMarkdown(content: string): BrowserAction[] {
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) return [];

    try {
      const parsed = JSON.parse(jsonMatch[1]);
      const actions = Array.isArray(parsed) ? parsed : [parsed];

      return actions.map(a => ({
        action: a.action,
        params: a.params || {}
      }));
    } catch {
      return [];
    }
  }
}
```

**Step 2: Update index**

```typescript
// src/core/browser-agent/index.ts
export * from './types';
export * from './actions';
export * from './providers';
export * from './safety';
export * from './prompts';
export * from './action-executor';
export * from './agent';
```

**Step 3: Commit**

```bash
git add src/core/browser-agent/
git commit -m "feat(browser-agent): implement BrowserAgent core class"
```

---

## Task 10: Update Background Script

**Files:**
- Modify: `background.ts`

**Step 1: Add message forwarding for new message types**

Add inside the existing message listener in background.ts:

```typescript
  // Forward page summary request to content script
  if (request.type === 'GET_PAGE_SUMMARY') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, request, (response) => {
          sendResponse(response);
        });
      } else {
        sendResponse({ error: 'No active tab' });
      }
    });
    return true;
  }

  // Forward element requests to content script
  if (request.type === 'GET_ELEMENTS' || request.type === 'GET_ELEMENT_DETAILS' || request.type === 'CLICK_BY_INDEX') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, request, (response) => {
          sendResponse(response);
        });
      } else {
        sendResponse({ error: 'No active tab' });
      }
    });
    return true;
  }
```

**Step 2: Commit**

```bash
git add background.ts
git commit -m "feat(background): add message forwarding for browser agent"
```

---

## Task 11: Integrate Browser Agent into Sidepanel

**Files:**
- Modify: `sidepanel.tsx`

**Step 1: Import browser agent**

Add imports at top of file:

```typescript
import { BrowserAgent, AgentCallbacks } from './src/core/browser-agent';
```

**Step 2: Add agent state and handler**

Inside the ChatSidebar component, add after other state declarations:

```typescript
  const browserAgentRef = useRef<BrowserAgent | null>(null);
```

**Step 3: Create agent runner function**

Add new function inside ChatSidebar:

```typescript
  const runBrowserAgent = async (task: string) => {
    if (!settings?.llm) {
      throw new Error('LLM not configured');
    }

    const callbacks: AgentCallbacks = {
      onThinking: (message) => {
        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg?.role === 'assistant') {
            lastMsg.content = message;
          }
          return updated;
        });
      },
      onActionStart: (action) => {
        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg?.role === 'assistant') {
            lastMsg.content += `\n[${action.action}...]`;
          }
          return updated;
        });
      },
      onActionComplete: (action, result) => {
        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg?.role === 'assistant') {
            lastMsg.content += ` ${result.success ? '✓' : '✗'}`;
          }
          return updated;
        });
      },
      onConfirmRequired: async (message, action) => {
        return window.confirm(message);
      },
      onError: (error) => {
        console.error('Browser agent error:', error);
      }
    };

    browserAgentRef.current = new BrowserAgent(settings.llm, {
      maxTurns: 20,
      callbacks
    });

    // Add initial assistant message
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: 'Analyzing page...',
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const result = await browserAgentRef.current.run(task);

      setMessages(prev => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg?.role === 'assistant') {
          lastMsg.content = result;
        }
        return updated;
      });
    } catch (error) {
      throw error;
    }
  };
```

**Step 4: Update handleSubmit to use browser agent**

Find the section in handleSubmit where browserToolsEnabled is checked and replace:

```typescript
      // BROWSER TOOLS MODE - Use Browser Agent (any LLM)
      if (browserToolsEnabled && !pageSummaryRequest) {
        await runBrowserAgent(userContent);
      } else {
        await streamGoogle(newMessages, abortControllerRef.current.signal);
      }
```

**Step 5: Update stop function**

Update the stop function to also stop the browser agent:

```typescript
  const stop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (browserAgentRef.current) {
      browserAgentRef.current.stop();
    }
    setIsLoading(false);
  };
```

**Step 6: Update toggleBrowserTools to remove Google check**

Remove the Google API key check from toggleBrowserTools since any LLM now works:

```typescript
  const toggleBrowserTools = async () => {
    const newValue = !browserToolsEnabled;

    if (newValue && !settings) {
      alert('⚠️ Please configure your settings first.');
      openSettings();
      return;
    }

    setBrowserToolsEnabled(newValue);
  };
```

**Step 7: Update browser tools hint**

Update the Toggle hint to not mention Gemini:

```typescript
            hint={browserToolsEnabled ? t('browserTools.hint') : undefined}
```

And update translation files to change the hint:

In `src/locales/en/translation.json`:
```json
    "hint": "AI controls your browser"
```

In `src/locales/zh/translation.json`:
```json
    "hint": "AI 控制浏览器"
```

**Step 8: Commit**

```bash
git add sidepanel.tsx src/locales/
git commit -m "feat(sidepanel): integrate BrowserAgent for any LLM browser automation"
```

---

## Task 12: Add Core Export

**Files:**
- Modify: `src/core/index.ts`

**Step 1: Export browser agent module**

Add to exports:

```typescript
export * from './browser-agent';
```

**Step 2: Commit**

```bash
git add src/core/index.ts
git commit -m "feat(core): export browser-agent module"
```

---

## Task 13: Build and Test

**Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds

**Step 3: Run tests**

```bash
npm test
```

Expected: All tests pass

**Step 4: Manual testing**

1. Load extension in Chrome
2. Open any website
3. Enable Browser Tools toggle
4. Send a task like "Click the first link on this page"
5. Verify agent analyzes page and executes action

**Step 5: Final commit**

```bash
git add -A
git commit -m "test: verify browser agent build and integration"
```

---

## Summary

Total tasks: 13
New files: 8
Modified files: 4
Estimated new code: ~900 lines

Key changes:
1. New `src/core/browser-agent/` module with types, actions, providers, safety, prompts, executor, and agent
2. Extended `LLMClient` with function calling support
3. Enhanced `content.ts` with element extraction and index-based operations
4. Updated `background.ts` for message forwarding
5. Integrated `BrowserAgent` into `sidepanel.tsx`
