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
