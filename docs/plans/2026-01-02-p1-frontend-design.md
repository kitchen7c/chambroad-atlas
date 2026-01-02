# P1 信息采集前端 UI 设计

## 概述

为已实现的 `src/core/` 信息采集后端模块创建前端 UI，集成到现有 Chrome Extension sidepanel 聊天界面中。

## 设计决策

| 决策点 | 选择 | 理由 |
|-------|------|------|
| UI 位置 | 集成到 Chat 界面 | 保持单一入口，用户体验一致 |
| 触发方式 | Header 按钮 + 命令 | 灵活，满足不同用户习惯 |
| 功能范围 | 完整功能 | 源管理 + 文章列表 + 详情阅读 + 收藏 + 搜索 |
| 布局方式 | 替换式 | sidepanel 宽度有限，替换式提供完整空间 |

## 视图结构

### 状态定义

```typescript
type ViewState =
  | { type: 'chat' }
  | { type: 'sources' }
  | { type: 'articles', sourceId?: string }
  | { type: 'article', articleId: string }
```

### 导航流程

```
[Chat 界面]
    ↓ 点击 📡 按钮 或输入 /sources
[Sources 视图] ←→ [Articles 视图] ←→ [Article 详情]
    ↓ 点击返回
[Chat 界面]
```

### 命令支持

- `/sources` → 切换到 Sources 视图
- `/articles` → 切换到 Articles 视图
- `/back` → 返回上一视图

## 组件设计

### 1. SourcesView 源管理视图

```
┌─────────────────────────────┐
│ ← Sources            [+ Add]│  Header
├─────────────────────────────┤
│ 🔍 Search sources...        │  搜索框
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ 📰 Hacker News      [⋯] │ │  源卡片
│ │ RSS · 每1小时 · ✓ 启用   │ │
│ │ 上次: 5分钟前 · 12篇新文章│ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

**源卡片功能：**
- 点击卡片 → 跳转到该源的文章列表
- 点击 `[⋯]` → 下拉菜单：编辑、立即刷新、禁用、删除
- 显示：名称、类型、调度频率、启用状态、上次抓取时间、新文章数

**添加源表单（模态框）：**
- 名称（必填）
- RSS URL（必填）
- 刷新频率（下拉：15分钟/30分钟/1小时/6小时/1天）
- 启用开关

### 2. ArticlesView 文章列表视图

```
┌─────────────────────────────┐
│ ← Articles           [Filter]│  Header
├─────────────────────────────┤
│ 🔍 Search articles...       │  搜索框
├─────────────────────────────┤
│ [All] [Unread] [Favorites]  │  过滤 Tab
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ OpenAI 发布 GPT-5      ● │ │  ● 未读标记
│ │ Hacker News · 10分钟前   │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ React 19 正式发布    ★  │ │  ★ 收藏标记
│ │ 36Kr · 1小时前          │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

**交互：**
- 点击文章 → 进入 ArticleDetail 详情视图
- 下拉刷新 → 触发所有源立即抓取

**过滤逻辑：**
- All：全部文章，按发布时间倒序
- Unread：仅未读
- Favorites：仅收藏

### 3. ArticleDetail 文章详情视图

```
┌─────────────────────────────┐
│ ←                    [★] [↗]│  ★收藏 ↗外链打开
├─────────────────────────────┤
│ OpenAI 发布 GPT-5           │  标题
│ Hacker News · John Doe      │  来源 · 作者
│ 2024-01-15 14:30            │  发布时间
├─────────────────────────────┤
│ Today we announce GPT-5,    │
│ our most advanced model...  │  正文内容
│                             │  (Markdown 渲染)
└─────────────────────────────┘
```

**功能：**
- 返回按钮 → 回到文章列表
- 收藏按钮 ★ → 切换收藏状态
- 外链按钮 ↗ → 在新标签页打开原文 URL
- 自动标记已读 → 进入详情即标记为已读

## 数据流

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  IndexedDB  │ ←──→ │  src/core   │ ←──→ │  React UI   │
│  (Dexie)    │      │  db/scheduler│      │  Components │
└─────────────┘      └─────────────┘      └─────────────┘
```

**操作流程：**

| 用户操作 | 调用方法 | 数据更新 |
|---------|---------|---------|
| 添加源 | `db.sources.add()` | 刷新 sources 列表 |
| 删除源 | `db.sources.delete()` | 刷新 sources 列表 |
| 手动刷新 | `scheduler.fetchNow(id)` | 刷新 articles 列表 |
| 标记已读 | `db.articles.update()` | 更新单条 article |
| 收藏 | `db.articles.update()` | 更新单条 article |

## 文件结构

**新增文件：**

```
src/components/
├── SourcesView.tsx        # 源管理视图
├── SourceCard.tsx         # 源卡片组件
├── SourceForm.tsx         # 添加/编辑源表单
├── ArticlesView.tsx       # 文章列表视图
├── ArticleCard.tsx        # 文章卡片组件
├── ArticleDetail.tsx      # 文章详情视图
└── ViewHeader.tsx         # 通用视图 Header
```

**修改文件：**

```
sidepanel.tsx              # 添加视图状态、命令解析、📡按钮
sidepanel.css              # 新增组件样式
src/locales/en.json        # 英文翻译
src/locales/zh.json        # 中文翻译
```

## 技术栈

- React 18 + TypeScript（现有）
- Dexie.js（已实现的 src/core）
- react-i18next（现有国际化）
- CSS（复用现有 dark-mode 样式变量）

---

*设计创建时间: 2026-01-02*
