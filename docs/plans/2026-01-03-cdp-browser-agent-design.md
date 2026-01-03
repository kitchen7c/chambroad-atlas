# CDP Browser Agent 设计文档

## 概述

使用 Chrome DevTools Protocol (CDP) 实现浏览器自动化，让任意 LLM 都能控制浏览器完成任务，无需特定的 Google API Key。

## 设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 操作模式 | 混合模式 | 根据 LLM 能力自动选择 DOM 或 Vision |
| 返回格式 | Function Calling + Fallback | 主用 FC，JSON in Markdown 兜底 |
| 操作集 | 完整操作 | 支持 17 种操作，覆盖所有场景 |
| DOM 提取 | 智能分层 | 摘要→列表→详情，省 token |
| 执行模式 | 智能确认 | 敏感操作需确认，普通自动执行 |

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                        Sidepanel UI                          │
│  [用户输入任务] → [显示执行过程] → [确认敏感操作]              │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   BrowserAgent (新增)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ TaskPlanner │→ │ActionExecutor│→ │ ResultParser│          │
│  │ (LLM 决策)  │  │ (CDP 执行)  │  │ (解析结果)  │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   PageContext (增强)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ DOM Extractor│  │ Screenshot  │  │Element Index│          │
│  │ (元素提取)  │  │ (截图)      │  │ (元素索引)  │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              Content Script (现有，增强)                      │
│         实际执行 DOM 操作、事件触发、截图                      │
└─────────────────────────────────────────────────────────────┘
```

## 操作定义

### 完整操作集

```typescript
const browserActions = {
  // 基础操作
  click: { selector?: string, index?: number, x?: number, y?: number },
  type: { selector?: string, index?: number, text: string, clear?: boolean },
  scroll: { direction: 'up'|'down'|'left'|'right', amount?: number, selector?: string },
  navigate: { url: string },
  screenshot: {},
  wait: { ms: number },

  // 标准操作
  hover: { selector?: string, index?: number, x?: number, y?: number },
  select: { selector?: string, index?: number, value: string },
  pressKey: { key: string, modifiers?: ('ctrl'|'alt'|'shift'|'meta')[] },
  goBack: {},
  goForward: {},
  refresh: {},

  // 高级操作
  dragDrop: { from: {x: number, y: number}, to: {x: number, y: number} },
  uploadFile: { selector?: string, index?: number, filePath: string },
  switchTab: { index?: number, url?: string },
  executeJS: { code: string },

  // 智能分层专用
  getElements: { type?: 'button'|'input'|'link'|'select'|'image'|'all', visible?: boolean },
  getElementDetails: { indices: number[] }
}
```

### Function Calling Schema

```typescript
const browserActionTool = {
  name: 'browser_action',
  description: '执行浏览器操作。可以点击、输入、滚动、导航等。',
  parameters: {
    type: 'object',
    required: ['action'],
    properties: {
      action: {
        type: 'string',
        enum: ['click', 'type', 'scroll', 'navigate', 'screenshot', 'wait',
               'hover', 'select', 'pressKey', 'goBack', 'goForward', 'refresh',
               'dragDrop', 'uploadFile', 'switchTab', 'executeJS',
               'getElements', 'getElementDetails'],
        description: '要执行的操作类型'
      },
      params: {
        type: 'object',
        description: '操作参数，根据 action 类型不同而不同'
      }
    }
  }
};
```

## 智能分层 DOM 提取

### 第一层：页面摘要

始终发送给 LLM，提供页面概览：

```typescript
interface PageSummary {
  url: string;
  title: string;
  viewport: { width: number, height: number };
  scrollPosition: { x: number, y: number };
  elements: {
    buttons: number;
    inputs: number;
    links: number;
    selects: number;
    images: number;
    forms: number;
  };
  visibleText: string;  // 前 500 字符
  focusedElement?: { tag: string, index: number };
}
```

### 第二层：元素列表

LLM 调用 `getElements` 时返回：

```typescript
interface ElementInfo {
  index: number;          // 唯一索引
  tag: string;            // button, a, input, select...
  text: string;           // 可见文本（截断到 50 字符）
  role?: string;          // ARIA role
  type?: string;          // input type
  placeholder?: string;   // 输入框占位符
  href?: string;          // 链接地址（截断到 100 字符）
  value?: string;         // 当前值
  isVisible: boolean;     // 是否在视口内
  isEnabled: boolean;     // 是否可交互
  rect: { x: number, y: number, width: number, height: number };
}
```

### 第三层：元素详情

LLM 调用 `getElementDetails` 时返回：

```typescript
interface ElementDetails extends ElementInfo {
  attributes: Record<string, string>;  // 所有属性
  selector: string;                    // 唯一 CSS 选择器
  xpath: string;                       // XPath
  parentText?: string;                 // 父元素文本
  childCount: number;                  // 子元素数量
}
```

## LLM 适配

### 提供商能力矩阵

```typescript
const providerCapabilities: Record<string, { functionCalling: boolean, vision: boolean }> = {
  google:    { functionCalling: true,  vision: true  },
  openai:    { functionCalling: true,  vision: true  },
  anthropic: { functionCalling: true,  vision: true  },
  deepseek:  { functionCalling: true,  vision: false },
  qwen:      { functionCalling: true,  vision: true  },
  glm:       { functionCalling: true,  vision: true  },
  ollama:    { functionCalling: false, vision: false },
  custom:    { functionCalling: false, vision: false },
};
```

### 模式选择逻辑

```typescript
function selectMode(provider: string): 'dom' | 'vision' | 'hybrid' {
  const caps = providerCapabilities[provider] ?? { functionCalling: false, vision: false };
  if (caps.vision) return 'hybrid';  // 有视觉能力用混合模式
  return 'dom';                       // 否则纯 DOM 模式
}
```

### Fallback 解析

不支持 Function Calling 的 LLM，解析 JSON in Markdown：

```typescript
function parseMarkdownJSON(content: string): BrowserAction[] {
  // 匹配 ```json ... ``` 代码块
  const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[1]);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  throw new Error('无法解析 LLM 响应');
}
```

## 安全机制

### 敏感操作检测

```typescript
const sensitivePatterns = {
  // URL 模式
  urlPatterns: [
    /checkout/i, /payment/i, /pay\//i, /billing/i,
    /login/i, /signin/i, /signup/i, /auth/i, /oauth/i,
    /delete/i, /remove/i, /cancel/i, /unsubscribe/i,
    /admin/i, /settings/i, /account/i, /profile/i,
    /bank/i, /transfer/i, /wire/i
  ],

  // 页面内容关键词
  contentKeywords: [
    '确认支付', '立即支付', '删除账户', '注销', '取消订阅',
    '确认删除', '永久删除', '不可恢复',
    'confirm payment', 'delete account', 'unsubscribe',
    'permanently delete', 'cannot be undone'
  ],

  // 始终需要确认的操作
  alwaysConfirmActions: [
    'executeJS',
    'uploadFile'
  ],

  // 表单提交检测
  formSubmitPatterns: [
    { textMatch: /(submit|确认|提交|pay|支付|purchase|购买|order|下单)/i },
    { textMatch: /(delete|删除|remove|移除|cancel|取消)/i }
  ]
};
```

### 确认级别

```typescript
type ConfirmLevel =
  | 'auto'      // 自动执行，不提示
  | 'notify'    // 显示通知，但不阻断
  | 'confirm'   // 需要用户点击确认
  | 'block';    // 禁止执行

function getConfirmLevel(action: BrowserAction, pageContext: PageSummary): ConfirmLevel {
  // 1. 始终需要确认的操作
  if (sensitivePatterns.alwaysConfirmActions.includes(action.action)) {
    return 'confirm';
  }

  // 2. 检查 URL 是否敏感
  const urlSensitive = sensitivePatterns.urlPatterns.some(p => p.test(pageContext.url));

  // 3. 检查页面内容是否包含敏感关键词
  const contentSensitive = sensitivePatterns.contentKeywords.some(
    k => pageContext.visibleText.toLowerCase().includes(k.toLowerCase())
  );

  // 4. 检查操作目标是否是敏感按钮
  if (action.action === 'click' && action.params?.text) {
    const isSensitiveButton = sensitivePatterns.formSubmitPatterns.some(
      p => p.textMatch.test(action.params.text)
    );
    if (isSensitiveButton && (urlSensitive || contentSensitive)) {
      return 'confirm';
    }
  }

  // 5. 敏感页面上的表单提交
  if (urlSensitive && action.action === 'pressKey' && action.params?.key === 'Enter') {
    return 'confirm';
  }

  return 'auto';
}
```

## System Prompt

### DOM 模式

```
你是一个浏览器自动化助手。根据用户任务和页面信息执行操作。

## 当前页面
URL: {url}
标题: {title}
可见元素: {buttons} 个按钮, {inputs} 个输入框, {links} 个链接
页面内容摘要: {visibleText}

## 用户任务
{userTask}

## 可用操作
使用 browser_action 工具执行操作：
- getElements: 获取页面元素列表
- click: 点击元素 (使用 index 或 selector)
- type: 输入文本
- scroll: 滚动页面
- navigate: 跳转 URL
- 其他: hover, select, pressKey, goBack, goForward, refresh

## 执行流程
1. 先用 getElements 了解页面结构
2. 根据元素 index 执行操作
3. 每次操作后观察结果
4. 任务完成时说明结果
```

### Vision 模式（附加）

```
## 截图
[附加当前页面截图]

你可以：
- 通过元素 index 操作（更可靠）
- 通过坐标 x, y 操作（当元素难以定位时）
```

## 文件结构

```
src/core/browser-agent/
├── index.ts              # 主入口，导出 BrowserAgent 类
├── types.ts              # 类型定义
├── actions.ts            # 操作定义与 Function Calling schema
├── page-context.ts       # 智能分层 DOM 提取
├── llm-adapter.ts        # LLM 适配器（处理不同提供商）
├── action-executor.ts    # 操作执行器（调用 content script）
├── safety.ts             # 敏感操作检测
└── prompts.ts            # System prompt 模板

# 修改现有文件
content.ts                # 扩展 DOM 提取能力和操作执行
background.ts             # 添加新的消息类型处理
sidepanel.tsx             # 集成 BrowserAgent，替代 Gemini Computer Use
types.ts                  # 添加 BrowserAgent 相关类型
```

## 实现计划

1. **Phase 1: 核心类型与操作定义** (~100 行)
   - types.ts, actions.ts

2. **Phase 2: DOM 提取** (~200 行)
   - page-context.ts
   - content.ts 增强

3. **Phase 3: 操作执行** (~150 行)
   - action-executor.ts
   - content.ts 扩展操作

4. **Phase 4: LLM 集成** (~200 行)
   - llm-adapter.ts
   - prompts.ts

5. **Phase 5: 安全机制** (~100 行)
   - safety.ts

6. **Phase 6: UI 集成** (~150 行)
   - sidepanel.tsx 修改
   - background.ts 修改

7. **Phase 7: 测试与调优** (~100 行)
   - 测试用例
   - 边界情况处理

**预计总代码量:** 800-1000 行
