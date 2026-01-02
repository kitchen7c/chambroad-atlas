# Atlas 智能信息中枢设计方案

> 日期: 2026-01-02
> 状态: 已确认
> 版本: 1.0

## 概述

基于 Chambroad Atlas 现有架构，扩展为可高度定制的**个人 AI 信息中枢**，实现多领域信息的自动采集、智能处理、知识沉淀和多渠道输出。

### 核心目标

- **多领域覆盖**: 技术/开发、投资/金融、学术/研究、行业资讯、化工新材料等，用户可自定义
- **全流程可配置**: 信息源、处理方式、输出渠道均可按需配置
- **AI 驱动**: 自然语言配置、智能摘要、关联发现、行动建议
- **多端同步**: 应用内、笔记工具、通讯工具、本地文件

---

## 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    Atlas 智能信息中枢                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  信息源层     │  │  处理引擎层   │  │  输出层      │          │
│  │  (Sources)   │→│  (Processors)│→│  (Outputs)   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         ↑                 ↑                 ↑                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              配置中心 (Config Hub)                       │   │
│  │   • 领域订阅管理  • 处理规则设置  • 输出渠道配置           │   │
│  └─────────────────────────────────────────────────────────┘   │
│         ↑                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           AI 配置助手 (自然语言 → 配置)                    │   │
│  │   "每天早上给我一份 AI 领域简报，发到 Notion"              │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 设计原则

1. **三层解耦** - 信息源、处理逻辑、输出渠道完全独立，可自由组合
2. **配置驱动** - 所有行为通过配置定义，无需改代码即可调整
3. **AI 优先** - 复杂配置可通过自然语言完成，降低使用门槛

---

## 第一部分：信息源层 (Sources)

```
信息源层 (Sources)
├── 网页抓取器 (Web Scrapers)
│   ├── RSS/Atom 订阅
│   ├── 网页定时爬取 (支持 JS 渲染)
│   └── 社交媒体监控 (Twitter/X, Reddit, HackerNews)
│
├── API 集成器 (API Connectors)
│   ├── GitHub (仓库动态、Release、Issues)
│   ├── arXiv / Google Scholar (论文)
│   ├── 财经 API (股票、财报、研报)
│   └── 自定义 API (用户可添加任意 REST API)
│
├── 工作应用 (Work Apps) - 通过 Composio
│   ├── 邮件 (Gmail, Outlook)
│   ├── 协作工具 (Slack, Teams, 飞书)
│   ├── 文档 (Notion, Google Docs)
│   └── 项目管理 (Jira, Linear, Trello)
│
└── 本地文件 (Local Files)
    ├── 文件夹监控 (PDF, Markdown, Word)
    └── 浏览器书签/历史
```

### 配置示例

```yaml
sources:
  - name: "AI 前沿论文"
    type: arxiv
    query: "cat:cs.AI OR cat:cs.LG"
    frequency: daily

  - name: "化工新材料资讯"
    type: web_scrape
    urls:
      - "https://www.chemicalbook.com/news/"
      - "https://www.dx2025.com/"
    keywords: ["新材料", "电池", "催化剂"]
    frequency: 6h

  - name: "投资组合监控"
    type: finance_api
    symbols: ["AAPL", "TSLA", "BTC-USD"]
    alerts:
      - condition: "price_change > 5%"
        priority: high
```

### 关键能力

- 统一的数据格式输出，无论来源是什么
- 支持增量抓取，避免重复
- 内置去重和相似度检测

---

## 第二部分：处理引擎层 (Processors)

```
处理引擎层 (Processors)
├── 预处理器 (Pre-processors)
│   ├── 内容提取 (正文提取、去广告)
│   ├── 翻译 (多语言 → 中文/英文)
│   ├── 去重 (基于语义相似度)
│   └── 分类 (自动打标签、归类)
│
├── AI 分析器 (AI Analyzers)
│   ├── 摘要生成 (可配置长度和风格)
│   ├── 关键信息提取 (实体、数据、观点)
│   ├── 情感/趋势分析
│   └── 关联发现 (与已有知识库关联)
│
├── 过滤器 (Filters)
│   ├── 关键词过滤 (包含/排除)
│   ├── 重要性评分 (AI 打分 1-10)
│   ├── 时效性过滤 (只要最新的)
│   └── 自定义规则 (用户定义条件)
│
└── 触发器 (Triggers)
    ├── 定时触发 (每日/每周/自定义 cron)
    ├── 事件触发 (检测到关键词时)
    ├── 阈值触发 (如股价变动 > 5%)
    └── 手动触发 (用户主动请求)
```

### 处理管道配置示例

```yaml
pipelines:
  - name: "每日 AI 简报"
    trigger:
      type: cron
      schedule: "0 8 * * *"  # 每天早上 8 点

    steps:
      - processor: filter
        config:
          sources: ["AI 前沿论文", "HackerNews AI"]
          time_range: "last_24h"
          min_importance: 6

      - processor: summarize
        config:
          style: "executive_brief"  # 简洁要点式
          max_items: 10
          include_links: true

      - processor: group_by
        config:
          field: "topic"  # 按主题分组

    output: ["notion_daily", "wechat_push"]

  - name: "投资预警"
    trigger:
      type: realtime
      condition: "price_change > 5% OR breaking_news"

    steps:
      - processor: analyze
        config:
          type: "impact_assessment"
          context: "my_portfolio"

      - processor: suggest_action
        config:
          style: "brief"

    output: ["telegram_urgent", "app_notification"]
```

### 核心特性

- **管道式处理** - 多个处理器串联，灵活组合
- **上下文感知** - AI 结合你的知识库和偏好进行分析
- **可解释性** - 每条信息标注来源、处理过程、重要性依据

---

## 第三部分：输出层与知识库

```
输出层 (Outputs)
├── 应用内展示
│   ├── 信息流视图 (时间线、卡片式)
│   ├── 仪表盘 (自定义布局的概览面板)
│   └── 搜索界面 (全文搜索 + 语义搜索)
│
├── 外部推送
│   ├── 即时通讯: 微信、Telegram、Slack、飞书
│   ├── 邮件: 定时邮件简报
│   └── Webhook: 自定义 HTTP 回调
│
├── 知识工具同步
│   ├── Notion (数据库/页面)
│   ├── Obsidian (本地 Markdown + 双链)
│   ├── 语雀、Roam Research
│   └── 自定义 API 推送
│
└── 本地导出
    ├── Markdown / PDF / HTML
    ├── JSON / CSV (结构化数据)
    └── 自动备份 (定时导出)
```

### 知识库设计

```
┌─────────────────────────────────────────────────────────┐
│                  个人知识库 (Knowledge Base)              │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ 向量存储     │  │ 全文索引    │  │ 图谱存储     │     │
│  │ (语义搜索)   │  │ (关键词)    │  │ (实体关联)   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                          ↓                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │              智能检索层                           │   │
│  │  • "最近关于锂电池的论文"                          │   │
│  │  • "这篇和我之前看的那篇有什么关联"                 │   │
│  │  • "总结我这个月收集的 AI Agent 资料"              │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 输出配置示例

```yaml
outputs:
  notion_daily:
    type: notion
    database_id: "xxx-xxx-xxx"
    template: "daily_brief"
    properties:
      title: "{{date}} {{domain}} 简报"
      tags: "{{auto_tags}}"

  wechat_push:
    type: wechat_webhook
    url: "https://qyapi.weixin.qq.com/..."
    format: "markdown"
    only_if: "importance >= 7"

  obsidian_sync:
    type: local_markdown
    path: "~/Obsidian/Atlas/"
    naming: "{{date}}-{{title}}"
    auto_link: true  # 自动生成双向链接
```

### 知识库能力

- **自动归档** - 所有处理过的信息自动入库
- **智能标签** - AI 自动打标签、建立关联
- **时间旅行** - 查看任意时间点的信息快照
- **个性化推荐** - 基于阅读历史推荐相关内容

---

## 第四部分：AI 配置助手与用户界面

### AI 配置助手

```
┌─────────────────────────────────────────────────────────────┐
│  用户: "帮我追踪 OpenAI 和 Anthropic 的最新动态，            │
│        有重要发布时微信通知我，每周日整理一份周报到 Notion"   │
│                              ↓                              │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ AI 解析结果:                                          │ │
│  │ • 信息源: Twitter(@OpenAI, @AnthropicAI),            │ │
│  │          官网博客, GitHub Releases                    │ │
│  │ • 触发器: 实时监控 + 每周日 9:00                       │ │
│  │ • 处理: 重要性过滤(>=7) + 周报汇总                    │ │
│  │ • 输出: 微信(即时) + Notion(周报)                     │ │
│  └───────────────────────────────────────────────────────┘ │
│                              ↓                              │
│  [确认创建] [调整细节] [取消]                                │
└─────────────────────────────────────────────────────────────┘
```

### 界面布局

```
┌────────────────────────────────────────────────────────────────┐
│  ◉ Atlas                              [搜索...]  [+新建] [⚙]  │
├──────────────┬─────────────────────────────────────────────────┤
│              │                                                 │
│  📥 信息流    │  ┌─────────────────────────────────────────┐   │
│  ├ 今日未读   │  │  📊 今日概览                 2024-01-15  │   │
│  ├ AI/科技   │  │  ─────────────────────────────────────  │   │
│  ├ 投资理财   │  │  • 新信息: 47 条 (重要: 5)               │   │
│  └ 化工材料   │  │  • 待处理: 3 条行动建议                  │   │
│              │  │  • 本周已读: 156 篇                      │   │
│  📋 简报      │  └─────────────────────────────────────────┘   │
│  ├ 每日简报   │                                                │
│  └ 周报      │  ┌─────────────────────────────────────────┐   │
│              │  │  🔥 重要更新                              │   │
│  🔔 监控预警  │  │  ─────────────────────────────────────  │   │
│  ├ 投资组合   │  │  [!] Anthropic 发布 Claude 4.0          │   │
│  └ 竞品动态   │  │      2小时前 · 来源: 官方博客             │   │
│              │  │      → 查看详情 | 添加笔记 | 标记已读     │   │
│  📚 知识库    │  │                                         │   │
│  ├ 最近添加   │  │  [i] 宁德时代钠电池量产进展               │   │
│  ├ 收藏      │  │      5小时前 · 来源: 财联社               │   │
│  └ 标签管理   │  │      相关: 你收藏的「钠电池技术路线」      │   │
│              │  └─────────────────────────────────────────┘   │
│  ⚙ 配置中心  │                                                │
│              │  [与 AI 对话输入框...]              [发送]     │
└──────────────┴─────────────────────────────────────────────────┘
```

### 交互设计要点

| 功能 | 交互方式 |
|------|----------|
| 快速订阅 | 浏览任意网页时，侧边栏一键 "追踪此站点" |
| 智能配置 | 对话式创建复杂规则，AI 生成配置后可微调 |
| 信息卡片 | 展开查看原文、AI 摘要、关联内容、操作按钮 |
| 快捷操作 | 右键菜单: 稀后阅读、添加到知识库、分享、创建任务 |
| 键盘优先 | 支持 Vim 风格快捷键快速浏览和操作 |

---

## 第五部分：技术实现方案

### 基于现有架构扩展

```
现有能力                          新增模块
─────────────────────────────────────────────────────────
Chrome Extension
├── Sidepanel (React)        →   + 信息流/知识库 UI
├── Background Worker        →   + 定时任务调度器
└── Content Script           →   + 一键订阅注入

Electron App
├── Main Process            →   + 本地知识库存储
├── BrowserView             →   + 网页抓取引擎
└── Renderer (React)        →   + 仪表盘/配置中心

已有集成
├── Gemini AI               →   + 摘要/分析/配置解析
├── Composio (500+ Apps)    →   + 输出渠道连接
└── MCP Protocol            →   + 信息源插件协议
```

### 核心技术选型

| 模块 | 技术方案 | 说明 |
|------|----------|------|
| 定时调度 | `node-cron` + Background SW | 支持 cron 表达式 |
| 网页抓取 | Playwright + Readability | 支持 JS 渲染站点 |
| 本地存储 | SQLite + `better-sqlite3` | 轻量、无需服务器 |
| 向量搜索 | `vectra` (本地) 或 Pinecone | 语义搜索能力 |
| 配置管理 | YAML + JSON Schema | 可读性 + 校验 |
| 插件系统 | 动态 import + 标准接口 | 用户可开发插件 |

### 数据流

```
[信息源] ──抓取──→ [原始数据]
                      ↓
              [预处理 & 去重]
                      ↓
              [AI 分析 & 打分]
                      ↓
         ┌──────────┴──────────┐
         ↓                     ↓
   [知识库存储]           [触发输出]
         ↓                     ↓
   [本地 SQLite]      [Notion/微信/邮件...]
   [向量索引]
```

### 开发阶段

| 阶段 | 核心功能 | 关键产出 |
|------|----------|----------|
| **P0 - 基础框架** | 配置系统、插件接口、基础 UI | 可运行的骨架 |
| **P1 - 信息采集** | RSS/网页抓取、API 连接器 | 能收集信息 |
| **P2 - AI 处理** | 摘要、分类、评分、关联 | 智能处理管道 |
| **P3 - 知识库** | 存储、搜索、标签、双链 | 可检索的知识库 |
| **P4 - 输出集成** | Notion/微信/邮件/本地导出 | 多渠道输出 |
| **P5 - AI 助手** | 自然语言配置、智能推荐 | 完整体验 |

---

## 第六部分：灵活的 LLM 配置

### 设计目标

支持任意 OpenAI 兼容 API，用户可自定义 Base URL 和模型名称。

### 配置界面

```
┌─────────────────────────────────────────────────────────────┐
│  🤖 大模型配置                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  预设服务商: [Google Gemini ▼]                              │
│              ├── Google Gemini                              │
│              ├── OpenAI                                     │
│              ├── Anthropic Claude                           │
│              ├── 本地模型 (Ollama)                          │
│              └── 自定义 API                                 │
│                                                             │
│  ─────────────── 或 自定义配置 ───────────────              │
│                                                             │
│  Base URL:    [https://api.openai.com/v1          ]        │
│  API Key:     [sk-xxxxxxxxxxxxx                   ] 👁      │
│  模型名称:    [gpt-4-turbo                        ]        │
│                                                             │
│  ─────────────── 高级选项 ───────────────                   │
│                                                             │
│  Temperature:     [0.7        ]                             │
│  Max Tokens:      [4096       ]                             │
│  请求超时(秒):    [60         ]                             │
│  自定义 Headers:  [{"X-Custom": "value"}          ]        │
│                                                             │
│  [测试连接]                           [保存配置]            │
└─────────────────────────────────────────────────────────────┘
```

### 数据结构

```typescript
interface LLMConfig {
  // 预设或自定义
  provider: 'google' | 'openai' | 'anthropic' | 'ollama' | 'custom';

  // 核心配置
  baseUrl: string;        // 如 "https://api.openai.com/v1"
  apiKey: string;
  model: string;          // 如 "gpt-4-turbo", "claude-3-opus"

  // 高级选项
  options?: {
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
    headers?: Record<string, string>;
  };
}

// 预设模板
const PROVIDER_PRESETS: Record<string, Partial<LLMConfig>> = {
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.0-flash-exp',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4-turbo',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-3-opus-20240229',
  },
  ollama: {
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3',
  },
};
```

### 支持场景

| 场景 | 配置示例 |
|------|----------|
| 国内代理 | `baseUrl: "https://your-proxy.com/v1"` |
| Azure OpenAI | `baseUrl: "https://xxx.openai.azure.com/"` |
| 本地 Ollama | `baseUrl: "http://localhost:11434/v1"` |
| 第三方兼容 API | 任意 OpenAI 兼容接口 |

---

## 第七部分：多语言支持 (i18n)

### 设计原则

- 自动检测系统语言，无需手动设置
- 支持中/英文，架构可扩展更多语言
- 使用 `react-i18next` 实现

### 语言加载流程

```
1. 检测系统语言
   ├── Electron: app.getLocale()
   └── Chrome: chrome.i18n.getUILanguage()
                    ↓
2. 匹配语言包
   ├── zh-CN, zh-TW, zh → 中文
   └── en-US, en-GB, * → English (fallback)
                    ↓
3. 动态加载语言文件
   └── /locales/{lang}/translation.json
```

### 语言包结构

```
src/
└── locales/
    ├── zh/
    │   └── translation.json
    └── en/
        └── translation.json
```

### 语言包示例

**中文 (zh/translation.json)**:
```json
{
  "app": {
    "title": "Atlas 智能信息中枢",
    "search": "搜索...",
    "newPipeline": "新建管道"
  },
  "sources": {
    "title": "信息源",
    "add": "添加信息源",
    "web": "网页抓取",
    "rss": "RSS 订阅",
    "api": "API 集成"
  },
  "settings": {
    "title": "设置",
    "llm": "大模型配置",
    "baseUrl": "API 地址",
    "apiKey": "API 密钥",
    "model": "模型名称",
    "testConnection": "测试连接",
    "save": "保存"
  }
}
```

**英文 (en/translation.json)**:
```json
{
  "app": {
    "title": "Atlas Information Hub",
    "search": "Search...",
    "newPipeline": "New Pipeline"
  },
  "sources": {
    "title": "Sources",
    "add": "Add Source",
    "web": "Web Scraper",
    "rss": "RSS Feed",
    "api": "API Connector"
  },
  "settings": {
    "title": "Settings",
    "llm": "LLM Configuration",
    "baseUrl": "Base URL",
    "apiKey": "API Key",
    "model": "Model Name",
    "testConnection": "Test Connection",
    "save": "Save"
  }
}
```

### 实现代码

```typescript
// i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const detectLanguage = (): string => {
  let lang = 'en';

  // Electron 环境
  if (window.electronAPI?.getLocale) {
    lang = window.electronAPI.getLocale();
  }
  // Chrome 扩展环境
  else if (chrome?.i18n?.getUILanguage) {
    lang = chrome.i18n.getUILanguage();
  }
  // 浏览器环境
  else {
    lang = navigator.language;
  }

  // 中文变体统一处理
  if (lang.startsWith('zh')) return 'zh';
  return 'en';
};

i18n.use(initReactI18next).init({
  lng: detectLanguage(),
  fallbackLng: 'en',
  resources: {
    zh: { translation: require('./locales/zh/translation.json') },
    en: { translation: require('./locales/en/translation.json') },
  },
});
```

### 设置界面 (可选覆盖)

```
┌─────────────────────────────────────────────────────────────┐
│  🌐 语言设置                                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  界面语言: [跟随系统 ▼]                                      │
│            ├── 跟随系统 (Auto)                              │
│            ├── 中文                                         │
│            └── English                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 总结

本设计方案基于 Chambroad Atlas 现有架构，扩展为完整的个人 AI 信息中枢，核心特性包括：

1. **三层插件化架构** - 信息源/处理器/输出完全解耦
2. **多领域支持** - 技术、金融、学术、行业资讯等可自定义
3. **AI 处理管道** - 摘要、过滤、评分、关联发现
4. **多渠道输出** - 应用内、Notion、微信、本地文件
5. **本地知识库** - 向量搜索 + 全文索引 + 知识图谱
6. **AI 配置助手** - 自然语言创建复杂规则
7. **灵活 LLM 配置** - 支持自定义 Base URL 和模型
8. **多语言支持** - 中英双语，自动检测系统语言

---

*文档生成时间: 2026-01-02*
