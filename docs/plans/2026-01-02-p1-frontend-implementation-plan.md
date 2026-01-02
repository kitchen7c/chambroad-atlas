# P1 信息采集前端 UI 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 src/core 信息采集模块创建前端 UI，集成到 sidepanel 聊天界面中。

**Architecture:** 新增 4 个视图组件（SourcesView、ArticlesView、ArticleDetail、ViewHeader），通过视图状态切换替换聊天内容区域。支持 Header 按钮和 /commands 触发。

**Tech Stack:** React 18, TypeScript, Dexie.js (src/core), react-i18next, CSS

---

## Task 1: 添加 i18n 翻译

**Files:**
- Modify: `src/locales/zh/translation.json`
- Modify: `src/locales/en/translation.json`

**Step 1: 添加中文翻译**

在 `src/locales/zh/translation.json` 的根对象中添加 `sources` 键：

```json
{
  "sources": {
    "title": "信息源",
    "add": "添加",
    "search": "搜索信息源...",
    "empty": "暂无信息源",
    "emptyDesc": "点击上方「添加」按钮添加你的第一个 RSS 源",
    "form": {
      "title": "添加信息源",
      "editTitle": "编辑信息源",
      "name": "名称",
      "namePlaceholder": "如：Hacker News",
      "url": "RSS URL",
      "urlPlaceholder": "https://example.com/feed.xml",
      "schedule": "刷新频率",
      "enabled": "启用",
      "save": "保存",
      "cancel": "取消",
      "delete": "删除",
      "deleteConfirm": "确定要删除这个信息源吗？"
    },
    "schedule": {
      "15m": "每 15 分钟",
      "30m": "每 30 分钟",
      "1h": "每小时",
      "6h": "每 6 小时",
      "1d": "每天"
    },
    "card": {
      "lastFetch": "上次抓取",
      "never": "从未",
      "ago": "前",
      "newArticles": "篇新文章",
      "refresh": "立即刷新",
      "edit": "编辑",
      "disable": "禁用",
      "enable": "启用",
      "delete": "删除"
    }
  },
  "articles": {
    "title": "文章",
    "search": "搜索文章...",
    "empty": "暂无文章",
    "emptyDesc": "添加信息源后，文章会自动抓取显示在这里",
    "all": "全部",
    "unread": "未读",
    "favorites": "收藏",
    "markRead": "标记已读",
    "markUnread": "标记未读",
    "favorite": "收藏",
    "unfavorite": "取消收藏",
    "openLink": "打开原文"
  },
  "common": {
    "back": "返回",
    "loading": "加载中...",
    "error": "出错了",
    "retry": "重试"
  }
}
```

**Step 2: 添加英文翻译**

在 `src/locales/en/translation.json` 的根对象中添加 `sources` 键：

```json
{
  "sources": {
    "title": "Sources",
    "add": "Add",
    "search": "Search sources...",
    "empty": "No sources yet",
    "emptyDesc": "Click the Add button above to add your first RSS source",
    "form": {
      "title": "Add Source",
      "editTitle": "Edit Source",
      "name": "Name",
      "namePlaceholder": "e.g., Hacker News",
      "url": "RSS URL",
      "urlPlaceholder": "https://example.com/feed.xml",
      "schedule": "Refresh Interval",
      "enabled": "Enabled",
      "save": "Save",
      "cancel": "Cancel",
      "delete": "Delete",
      "deleteConfirm": "Are you sure you want to delete this source?"
    },
    "schedule": {
      "15m": "Every 15 minutes",
      "30m": "Every 30 minutes",
      "1h": "Every hour",
      "6h": "Every 6 hours",
      "1d": "Every day"
    },
    "card": {
      "lastFetch": "Last fetch",
      "never": "Never",
      "ago": "ago",
      "newArticles": "new articles",
      "refresh": "Refresh now",
      "edit": "Edit",
      "disable": "Disable",
      "enable": "Enable",
      "delete": "Delete"
    }
  },
  "articles": {
    "title": "Articles",
    "search": "Search articles...",
    "empty": "No articles yet",
    "emptyDesc": "Articles will appear here after adding sources",
    "all": "All",
    "unread": "Unread",
    "favorites": "Favorites",
    "markRead": "Mark as read",
    "markUnread": "Mark as unread",
    "favorite": "Favorite",
    "unfavorite": "Unfavorite",
    "openLink": "Open original"
  },
  "common": {
    "back": "Back",
    "loading": "Loading...",
    "error": "Something went wrong",
    "retry": "Retry"
  }
}
```

**Step 3: 验证 JSON 格式**

Run: `node -e "require('./src/locales/zh/translation.json'); require('./src/locales/en/translation.json'); console.log('JSON valid')"`

Expected: `JSON valid`

**Step 4: Commit**

```bash
git add src/locales/
git commit -m "feat(i18n): add sources and articles translations"
```

---

## Task 2: 创建 ViewHeader 组件

**Files:**
- Create: `src/components/ViewHeader.tsx`

**Step 1: 创建 ViewHeader 组件**

创建文件 `src/components/ViewHeader.tsx`：

```typescript
import { useTranslation } from 'react-i18next';

interface ViewHeaderProps {
  title: string;
  onBack: () => void;
  rightAction?: {
    label: string;
    onClick: () => void;
  };
}

export function ViewHeader({ title, onBack, rightAction }: ViewHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="view-header">
      <button className="view-header-back" onClick={onBack} title={t('common.back')}>
        ←
      </button>
      <h1 className="view-header-title">{title}</h1>
      {rightAction && (
        <button className="view-header-action" onClick={rightAction.onClick}>
          {rightAction.label}
        </button>
      )}
    </div>
  );
}
```

**Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit 2>&1 | grep -E "^src/components/ViewHeader" || echo "No errors"`

Expected: `No errors`

**Step 3: Commit**

```bash
git add src/components/ViewHeader.tsx
git commit -m "feat(ui): add ViewHeader component"
```

---

## Task 3: 创建 SourceCard 组件

**Files:**
- Create: `src/components/SourceCard.tsx`

**Step 1: 创建 SourceCard 组件**

创建文件 `src/components/SourceCard.tsx`：

```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StoredSource } from '../core/storage/db';

interface SourceCardProps {
  source: StoredSource;
  unreadCount: number;
  onEdit: () => void;
  onRefresh: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
  onClick: () => void;
}

export function SourceCard({
  source,
  unreadCount,
  onEdit,
  onRefresh,
  onToggleEnabled,
  onDelete,
  onClick,
}: SourceCardProps) {
  const { t } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);

  const formatLastFetch = (timestamp?: number) => {
    if (!timestamp) return t('sources.card.never');
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t('sources.card.ago', { time: '< 1 min' });
    if (minutes < 60) return `${minutes} min ${t('sources.card.ago')}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h ${t('sources.card.ago')}`;
    const days = Math.floor(hours / 24);
    return `${days} d ${t('sources.card.ago')}`;
  };

  const scheduleLabels: Record<string, string> = {
    '15m': t('sources.schedule.15m'),
    '30m': t('sources.schedule.30m'),
    '1h': t('sources.schedule.1h'),
    '6h': t('sources.schedule.6h'),
    '1d': t('sources.schedule.1d'),
  };

  return (
    <div className={`source-card ${!source.enabled ? 'disabled' : ''}`} onClick={onClick}>
      <div className="source-card-header">
        <span className="source-card-icon">📰</span>
        <span className="source-card-name">{source.name}</span>
        <button
          className="source-card-menu-btn"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
        >
          ⋯
        </button>
        {showMenu && (
          <div className="source-card-menu" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { onEdit(); setShowMenu(false); }}>
              {t('sources.card.edit')}
            </button>
            <button onClick={() => { onRefresh(); setShowMenu(false); }}>
              {t('sources.card.refresh')}
            </button>
            <button onClick={() => { onToggleEnabled(); setShowMenu(false); }}>
              {source.enabled ? t('sources.card.disable') : t('sources.card.enable')}
            </button>
            <button className="danger" onClick={() => { onDelete(); setShowMenu(false); }}>
              {t('sources.card.delete')}
            </button>
          </div>
        )}
      </div>
      <div className="source-card-info">
        <span>{source.type.toUpperCase()}</span>
        <span>·</span>
        <span>{scheduleLabels[source.schedule] || source.schedule}</span>
        <span>·</span>
        <span>{source.enabled ? '✓' : '✗'}</span>
      </div>
      <div className="source-card-meta">
        <span>{t('sources.card.lastFetch')}: {formatLastFetch(source.lastFetchAt)}</span>
        {unreadCount > 0 && (
          <span className="source-card-unread">{unreadCount} {t('sources.card.newArticles')}</span>
        )}
      </div>
      {source.lastError && (
        <div className="source-card-error">⚠️ {source.lastError}</div>
      )}
    </div>
  );
}
```

**Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit 2>&1 | grep -E "^src/components/SourceCard" || echo "No errors"`

Expected: `No errors`

**Step 3: Commit**

```bash
git add src/components/SourceCard.tsx
git commit -m "feat(ui): add SourceCard component"
```

---

## Task 4: 创建 SourceForm 组件

**Files:**
- Create: `src/components/SourceForm.tsx`

**Step 1: 创建 SourceForm 组件**

创建文件 `src/components/SourceForm.tsx`：

```typescript
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { StoredSource } from '../core/storage/db';

interface SourceFormProps {
  source?: StoredSource;
  onSave: (data: { name: string; url: string; schedule: string; enabled: boolean }) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function SourceForm({ source, onSave, onCancel, onDelete }: SourceFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(source?.name || '');
  const [url, setUrl] = useState('');
  const [schedule, setSchedule] = useState(source?.schedule || '1h');
  const [enabled, setEnabled] = useState(source?.enabled ?? true);

  useEffect(() => {
    if (source) {
      try {
        const config = JSON.parse(source.config);
        setUrl(config.url || '');
      } catch {
        setUrl('');
      }
    }
  }, [source]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    onSave({ name: name.trim(), url: url.trim(), schedule, enabled });
  };

  return (
    <div className="source-form-overlay" onClick={onCancel}>
      <div className="source-form" onClick={(e) => e.stopPropagation()}>
        <h2>{source ? t('sources.form.editTitle') : t('sources.form.title')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label>{t('sources.form.name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('sources.form.namePlaceholder')}
              required
            />
          </div>
          <div className="form-field">
            <label>{t('sources.form.url')}</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('sources.form.urlPlaceholder')}
              required
            />
          </div>
          <div className="form-field">
            <label>{t('sources.form.schedule')}</label>
            <select value={schedule} onChange={(e) => setSchedule(e.target.value)}>
              <option value="15m">{t('sources.schedule.15m')}</option>
              <option value="30m">{t('sources.schedule.30m')}</option>
              <option value="1h">{t('sources.schedule.1h')}</option>
              <option value="6h">{t('sources.schedule.6h')}</option>
              <option value="1d">{t('sources.schedule.1d')}</option>
            </select>
          </div>
          <div className="form-field checkbox">
            <label>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              {t('sources.form.enabled')}
            </label>
          </div>
          <div className="form-actions">
            {source && onDelete && (
              <button type="button" className="danger" onClick={onDelete}>
                {t('sources.form.delete')}
              </button>
            )}
            <div className="form-actions-right">
              <button type="button" onClick={onCancel}>
                {t('sources.form.cancel')}
              </button>
              <button type="submit" className="primary">
                {t('sources.form.save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit 2>&1 | grep -E "^src/components/SourceForm" || echo "No errors"`

Expected: `No errors`

**Step 3: Commit**

```bash
git add src/components/SourceForm.tsx
git commit -m "feat(ui): add SourceForm component"
```

---

## Task 5: 创建 SourcesView 组件

**Files:**
- Create: `src/components/SourcesView.tsx`

**Step 1: 创建 SourcesView 组件**

创建文件 `src/components/SourcesView.tsx`：

```typescript
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ViewHeader } from './ViewHeader';
import { SourceCard } from './SourceCard';
import { SourceForm } from './SourceForm';
import { db, type StoredSource } from '../core/storage/db';
import { scheduler } from '../core/scheduler/scheduler';

interface SourcesViewProps {
  onBack: () => void;
  onSelectSource: (sourceId: string) => void;
}

export function SourcesView({ onBack, onSelectSource }: SourcesViewProps) {
  const { t } = useTranslation();
  const [sources, setSources] = useState<StoredSource[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSource, setEditingSource] = useState<StoredSource | undefined>();

  const loadSources = async () => {
    const allSources = await db.sources.toArray();
    setSources(allSources);

    // Calculate unread counts per source
    const counts: Record<string, number> = {};
    for (const source of allSources) {
      const unread = await db.articles
        .where('sourceId')
        .equals(source.id)
        .filter((a) => !a.isRead)
        .count();
      counts[source.id] = unread;
    }
    setUnreadCounts(counts);
  };

  useEffect(() => {
    loadSources();
  }, []);

  const filteredSources = sources.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (data: { name: string; url: string; schedule: string; enabled: boolean }) => {
    if (editingSource) {
      await db.sources.update(editingSource.id, {
        name: data.name,
        schedule: data.schedule,
        enabled: data.enabled,
        config: JSON.stringify({ url: data.url }),
      });
    } else {
      const id = `source-${Date.now()}`;
      await db.sources.add({
        id,
        name: data.name,
        type: 'rss',
        schedule: data.schedule,
        enabled: data.enabled,
        config: JSON.stringify({ url: data.url }),
      });
    }
    setShowForm(false);
    setEditingSource(undefined);
    loadSources();
  };

  const handleDelete = async (sourceId: string) => {
    if (!window.confirm(t('sources.form.deleteConfirm'))) return;
    await db.sources.delete(sourceId);
    await db.articles.where('sourceId').equals(sourceId).delete();
    setShowForm(false);
    setEditingSource(undefined);
    loadSources();
  };

  const handleRefresh = async (sourceId: string) => {
    await scheduler.fetchNow(sourceId);
    loadSources();
  };

  const handleToggleEnabled = async (source: StoredSource) => {
    await db.sources.update(source.id, { enabled: !source.enabled });
    loadSources();
  };

  return (
    <div className="sources-view">
      <ViewHeader
        title={t('sources.title')}
        onBack={onBack}
        rightAction={{ label: `+ ${t('sources.add')}`, onClick: () => setShowForm(true) }}
      />
      <div className="sources-search">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('sources.search')}
        />
      </div>
      <div className="sources-list">
        {filteredSources.length === 0 ? (
          <div className="sources-empty">
            <p>{t('sources.empty')}</p>
            <p>{t('sources.emptyDesc')}</p>
          </div>
        ) : (
          filteredSources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              unreadCount={unreadCounts[source.id] || 0}
              onClick={() => onSelectSource(source.id)}
              onEdit={() => {
                setEditingSource(source);
                setShowForm(true);
              }}
              onRefresh={() => handleRefresh(source.id)}
              onToggleEnabled={() => handleToggleEnabled(source)}
              onDelete={() => handleDelete(source.id)}
            />
          ))
        )}
      </div>
      {showForm && (
        <SourceForm
          source={editingSource}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditingSource(undefined);
          }}
          onDelete={editingSource ? () => handleDelete(editingSource.id) : undefined}
        />
      )}
    </div>
  );
}
```

**Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit 2>&1 | grep -E "^src/components/SourcesView" || echo "No errors"`

Expected: `No errors`

**Step 3: Commit**

```bash
git add src/components/SourcesView.tsx
git commit -m "feat(ui): add SourcesView component"
```

---

## Task 6: 创建 ArticleCard 组件

**Files:**
- Create: `src/components/ArticleCard.tsx`

**Step 1: 创建 ArticleCard 组件**

创建文件 `src/components/ArticleCard.tsx`：

```typescript
import type { StoredArticle, StoredSource } from '../core/storage/db';

interface ArticleCardProps {
  article: StoredArticle;
  source?: StoredSource;
  onClick: () => void;
}

export function ArticleCard({ article, source, onClick }: ArticleCardProps) {
  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h`;
    const days = Math.floor(hours / 24);
    return `${days} d`;
  };

  return (
    <div className={`article-card ${article.isRead ? 'read' : ''}`} onClick={onClick}>
      <div className="article-card-title">
        {article.title}
        <span className="article-card-indicators">
          {!article.isRead && <span className="unread-dot">●</span>}
          {article.isFavorite && <span className="favorite-star">★</span>}
        </span>
      </div>
      <div className="article-card-meta">
        <span>{source?.name || 'Unknown'}</span>
        <span>·</span>
        <span>{formatTime(article.publishedAt)}</span>
      </div>
    </div>
  );
}
```

**Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit 2>&1 | grep -E "^src/components/ArticleCard" || echo "No errors"`

Expected: `No errors`

**Step 3: Commit**

```bash
git add src/components/ArticleCard.tsx
git commit -m "feat(ui): add ArticleCard component"
```

---

## Task 7: 创建 ArticlesView 组件

**Files:**
- Create: `src/components/ArticlesView.tsx`

**Step 1: 创建 ArticlesView 组件**

创建文件 `src/components/ArticlesView.tsx`：

```typescript
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ViewHeader } from './ViewHeader';
import { ArticleCard } from './ArticleCard';
import { db, type StoredArticle, type StoredSource } from '../core/storage/db';

type FilterType = 'all' | 'unread' | 'favorites';

interface ArticlesViewProps {
  sourceId?: string;
  onBack: () => void;
  onSelectArticle: (articleId: string) => void;
}

export function ArticlesView({ sourceId, onBack, onSelectArticle }: ArticlesViewProps) {
  const { t } = useTranslation();
  const [articles, setArticles] = useState<StoredArticle[]>([]);
  const [sources, setSources] = useState<Record<string, StoredSource>>({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const loadArticles = async () => {
    let query = db.articles.orderBy('publishedAt').reverse();

    const allArticles = await query.toArray();

    // Filter by sourceId if provided
    const filtered = sourceId
      ? allArticles.filter((a) => a.sourceId === sourceId)
      : allArticles;

    setArticles(filtered);

    // Load sources for display
    const allSources = await db.sources.toArray();
    const sourcesMap: Record<string, StoredSource> = {};
    allSources.forEach((s) => {
      sourcesMap[s.id] = s;
    });
    setSources(sourcesMap);
  };

  useEffect(() => {
    loadArticles();
  }, [sourceId]);

  const filteredArticles = articles
    .filter((a) => {
      if (filter === 'unread') return !a.isRead;
      if (filter === 'favorites') return a.isFavorite;
      return true;
    })
    .filter((a) =>
      a.title.toLowerCase().includes(search.toLowerCase())
    );

  const sourceName = sourceId ? sources[sourceId]?.name : undefined;

  return (
    <div className="articles-view">
      <ViewHeader
        title={sourceName || t('articles.title')}
        onBack={onBack}
      />
      <div className="articles-search">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('articles.search')}
        />
      </div>
      <div className="articles-filter">
        <button
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          {t('articles.all')}
        </button>
        <button
          className={filter === 'unread' ? 'active' : ''}
          onClick={() => setFilter('unread')}
        >
          {t('articles.unread')}
        </button>
        <button
          className={filter === 'favorites' ? 'active' : ''}
          onClick={() => setFilter('favorites')}
        >
          {t('articles.favorites')}
        </button>
      </div>
      <div className="articles-list">
        {filteredArticles.length === 0 ? (
          <div className="articles-empty">
            <p>{t('articles.empty')}</p>
            <p>{t('articles.emptyDesc')}</p>
          </div>
        ) : (
          filteredArticles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              source={sources[article.sourceId]}
              onClick={() => onSelectArticle(article.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

**Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit 2>&1 | grep -E "^src/components/ArticlesView" || echo "No errors"`

Expected: `No errors`

**Step 3: Commit**

```bash
git add src/components/ArticlesView.tsx
git commit -m "feat(ui): add ArticlesView component"
```

---

## Task 8: 创建 ArticleDetail 组件

**Files:**
- Create: `src/components/ArticleDetail.tsx`

**Step 1: 创建 ArticleDetail 组件**

创建文件 `src/components/ArticleDetail.tsx`：

```typescript
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { db, type StoredArticle, type StoredSource } from '../core/storage/db';

interface ArticleDetailProps {
  articleId: string;
  onBack: () => void;
}

export function ArticleDetail({ articleId, onBack }: ArticleDetailProps) {
  const { t } = useTranslation();
  const [article, setArticle] = useState<StoredArticle | null>(null);
  const [source, setSource] = useState<StoredSource | null>(null);

  useEffect(() => {
    const loadArticle = async () => {
      const a = await db.articles.get(articleId);
      if (a) {
        setArticle(a);
        // Mark as read
        if (!a.isRead) {
          await db.articles.update(articleId, { isRead: true });
          setArticle({ ...a, isRead: true });
        }
        // Load source
        const s = await db.sources.get(a.sourceId);
        setSource(s || null);
      }
    };
    loadArticle();
  }, [articleId]);

  const toggleFavorite = async () => {
    if (!article) return;
    const newValue = !article.isFavorite;
    await db.articles.update(articleId, { isFavorite: newValue });
    setArticle({ ...article, isFavorite: newValue });
  };

  const openLink = () => {
    if (article?.url) {
      chrome.tabs.create({ url: article.url });
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (!article) {
    return (
      <div className="article-detail">
        <div className="article-detail-header">
          <button className="view-header-back" onClick={onBack}>←</button>
        </div>
        <div className="article-detail-loading">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="article-detail">
      <div className="article-detail-header">
        <button className="view-header-back" onClick={onBack}>←</button>
        <div className="article-detail-actions">
          <button
            className={`action-btn ${article.isFavorite ? 'active' : ''}`}
            onClick={toggleFavorite}
            title={article.isFavorite ? t('articles.unfavorite') : t('articles.favorite')}
          >
            {article.isFavorite ? '★' : '☆'}
          </button>
          <button
            className="action-btn"
            onClick={openLink}
            title={t('articles.openLink')}
          >
            ↗
          </button>
        </div>
      </div>
      <div className="article-detail-content">
        <h1 className="article-title">{article.title}</h1>
        <div className="article-meta">
          <span>{source?.name || 'Unknown'}</span>
          {article.author && (
            <>
              <span>·</span>
              <span>{article.author}</span>
            </>
          )}
          <span>·</span>
          <span>{formatDate(article.publishedAt)}</span>
        </div>
        <div className="article-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {article.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit 2>&1 | grep -E "^src/components/ArticleDetail" || echo "No errors"`

Expected: `No errors`

**Step 3: Commit**

```bash
git add src/components/ArticleDetail.tsx
git commit -m "feat(ui): add ArticleDetail component"
```

---

## Task 9: 添加 CSS 样式

**Files:**
- Modify: `sidepanel.css`

**Step 1: 添加组件样式**

在 `sidepanel.css` 文件末尾追加以下样式：

```css
/* ===== View Header ===== */
.view-header {
  padding: 12px 16px;
  background: #1a1a1a;
  border-bottom: 1px solid #333333;
  display: flex;
  align-items: center;
  gap: 12px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.view-header-back {
  background: none;
  border: none;
  color: #ffffff;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
}

.view-header-back:hover {
  background: #333333;
  border-radius: 4px;
}

.view-header-title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}

.view-header-action {
  background: #333333;
  border: none;
  color: #ffffff;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.view-header-action:hover {
  background: #444444;
}

/* ===== Sources View ===== */
.sources-view,
.articles-view,
.article-detail {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1a1a1a;
}

.sources-search,
.articles-search {
  padding: 12px 16px;
}

.sources-search input,
.articles-search input {
  width: 100%;
  padding: 10px 14px;
  background: #262626;
  border: 1px solid #333333;
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
}

.sources-search input::placeholder,
.articles-search input::placeholder {
  color: #666666;
}

.sources-search input:focus,
.articles-search input:focus {
  outline: none;
  border-color: #2563eb;
}

.sources-list,
.articles-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px;
}

.sources-empty,
.articles-empty {
  text-align: center;
  padding: 40px 20px;
  color: #666666;
}

.sources-empty p:first-child,
.articles-empty p:first-child {
  font-size: 16px;
  margin-bottom: 8px;
}

/* ===== Source Card ===== */
.source-card {
  background: #262626;
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
}

.source-card:hover {
  background: #333333;
}

.source-card.disabled {
  opacity: 0.5;
}

.source-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.source-card-icon {
  font-size: 16px;
}

.source-card-name {
  flex: 1;
  font-weight: 500;
  color: #ffffff;
}

.source-card-menu-btn {
  background: none;
  border: none;
  color: #888888;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 16px;
}

.source-card-menu-btn:hover {
  color: #ffffff;
}

.source-card-menu {
  position: absolute;
  top: 40px;
  right: 14px;
  background: #333333;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  z-index: 100;
  overflow: hidden;
}

.source-card-menu button {
  display: block;
  width: 100%;
  padding: 10px 16px;
  background: none;
  border: none;
  color: #ffffff;
  text-align: left;
  cursor: pointer;
  font-size: 13px;
}

.source-card-menu button:hover {
  background: #444444;
}

.source-card-menu button.danger {
  color: #ef4444;
}

.source-card-info {
  display: flex;
  gap: 6px;
  font-size: 12px;
  color: #888888;
  margin-bottom: 4px;
}

.source-card-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #666666;
}

.source-card-unread {
  color: #2563eb;
}

.source-card-error {
  margin-top: 8px;
  font-size: 12px;
  color: #ef4444;
}

/* ===== Source Form ===== */
.source-form-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.source-form {
  background: #262626;
  border-radius: 12px;
  padding: 24px;
  width: 90%;
  max-width: 400px;
}

.source-form h2 {
  margin: 0 0 20px;
  font-size: 18px;
  color: #ffffff;
}

.form-field {
  margin-bottom: 16px;
}

.form-field label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #888888;
}

.form-field input[type="text"],
.form-field input[type="url"],
.form-field select {
  width: 100%;
  padding: 10px 12px;
  background: #1a1a1a;
  border: 1px solid #333333;
  border-radius: 6px;
  color: #ffffff;
  font-size: 14px;
}

.form-field input:focus,
.form-field select:focus {
  outline: none;
  border-color: #2563eb;
}

.form-field.checkbox label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.form-field.checkbox input {
  width: auto;
}

.form-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 24px;
}

.form-actions-right {
  display: flex;
  gap: 8px;
}

.form-actions button {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.form-actions button.primary {
  background: #2563eb;
  color: #ffffff;
}

.form-actions button.primary:hover {
  background: #1d4ed8;
}

.form-actions button.danger {
  background: #ef4444;
  color: #ffffff;
}

.form-actions button:not(.primary):not(.danger) {
  background: #333333;
  color: #ffffff;
}

.form-actions button:not(.primary):not(.danger):hover {
  background: #444444;
}

/* ===== Articles Filter ===== */
.articles-filter {
  display: flex;
  gap: 8px;
  padding: 0 16px 12px;
}

.articles-filter button {
  padding: 6px 14px;
  background: #262626;
  border: none;
  border-radius: 16px;
  color: #888888;
  font-size: 13px;
  cursor: pointer;
}

.articles-filter button.active {
  background: #2563eb;
  color: #ffffff;
}

.articles-filter button:hover:not(.active) {
  background: #333333;
}

/* ===== Article Card ===== */
.article-card {
  background: #262626;
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.article-card:hover {
  background: #333333;
}

.article-card.read {
  opacity: 0.7;
}

.article-card-title {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #ffffff;
  margin-bottom: 6px;
  line-height: 1.4;
}

.article-card-indicators {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.unread-dot {
  color: #2563eb;
  font-size: 10px;
}

.favorite-star {
  color: #fbbf24;
  font-size: 12px;
}

.article-card-meta {
  display: flex;
  gap: 6px;
  font-size: 12px;
  color: #666666;
}

/* ===== Article Detail ===== */
.article-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #1a1a1a;
  border-bottom: 1px solid #333333;
}

.article-detail-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  background: none;
  border: none;
  color: #888888;
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
}

.action-btn:hover {
  color: #ffffff;
}

.action-btn.active {
  color: #fbbf24;
}

.article-detail-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 16px;
}

.article-title {
  font-size: 20px;
  font-weight: 600;
  color: #ffffff;
  margin: 0 0 12px;
  line-height: 1.4;
}

.article-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 13px;
  color: #888888;
  margin-bottom: 20px;
}

.article-body {
  color: #e0e0e0;
  font-size: 15px;
  line-height: 1.7;
}

.article-body p {
  margin: 0 0 16px;
}

.article-body a {
  color: #2563eb;
}

.article-body img {
  max-width: 100%;
  border-radius: 8px;
}

.article-detail-loading {
  padding: 40px;
  text-align: center;
  color: #666666;
}
```

**Step 2: 验证 CSS 语法**

Run: `npm run build 2>&1 | tail -5`

Expected: 构建成功

**Step 3: Commit**

```bash
git add sidepanel.css
git commit -m "feat(ui): add styles for sources and articles views"
```

---

## Task 10: 集成到 sidepanel.tsx

**Files:**
- Modify: `sidepanel.tsx`

**Step 1: 添加导入和类型定义**

在 `sidepanel.tsx` 文件顶部的导入语句后添加：

```typescript
import { SourcesView } from './src/components/SourcesView';
import { ArticlesView } from './src/components/ArticlesView';
import { ArticleDetail } from './src/components/ArticleDetail';

type ViewState =
  | { type: 'chat' }
  | { type: 'sources' }
  | { type: 'articles'; sourceId?: string }
  | { type: 'article'; articleId: string };
```

**Step 2: 在 ChatSidebar 组件中添加视图状态**

在 `ChatSidebar` 函数组件的 state 声明部分添加：

```typescript
const [view, setView] = useState<ViewState>({ type: 'chat' });
```

**Step 3: 修改 handleSubmit 添加命令支持**

在 `handleSubmit` 函数开头（`e.preventDefault()` 后）添加命令解析：

```typescript
// Handle commands
if (input.trim().startsWith('/')) {
  const cmd = input.trim().toLowerCase();
  if (cmd === '/sources') {
    setView({ type: 'sources' });
    setInput('');
    return;
  }
  if (cmd === '/articles') {
    setView({ type: 'articles' });
    setInput('');
    return;
  }
  if (cmd === '/back') {
    setView({ type: 'chat' });
    setInput('');
    return;
  }
}
```

**Step 4: 在 header 添加 📡 按钮**

在 header 的按钮区域（`toggleBrowserTools` 按钮前）添加：

```typescript
<button
  onClick={() => setView({ type: 'sources' })}
  className="settings-icon-btn"
  title="Sources"
>
  📡
</button>
```

**Step 5: 添加视图切换渲染**

在 `return` 语句中，将整个 chat UI 包装在条件渲染中：

```typescript
// 在 return 开头添加视图切换
if (view.type === 'sources') {
  return (
    <div className="chat-container dark-mode">
      <SourcesView
        onBack={() => setView({ type: 'chat' })}
        onSelectSource={(sourceId) => setView({ type: 'articles', sourceId })}
      />
    </div>
  );
}

if (view.type === 'articles') {
  return (
    <div className="chat-container dark-mode">
      <ArticlesView
        sourceId={view.sourceId}
        onBack={() => setView(view.sourceId ? { type: 'sources' } : { type: 'chat' })}
        onSelectArticle={(articleId) => setView({ type: 'article', articleId })}
      />
    </div>
  );
}

if (view.type === 'article') {
  return (
    <div className="chat-container dark-mode">
      <ArticleDetail
        articleId={view.articleId}
        onBack={() => setView({ type: 'articles' })}
      />
    </div>
  );
}

// 原有的 chat UI return...
```

**Step 6: 运行测试和构建**

Run: `npm test && npm run build`

Expected: 全部通过

**Step 7: Commit**

```bash
git add sidepanel.tsx
git commit -m "feat(ui): integrate sources and articles views into sidepanel"
```

---

## Task 11: 最终验证

**Step 1: 运行所有测试**

Run: `npm test`

Expected: 全部 PASS

**Step 2: 运行构建**

Run: `npm run build`

Expected: 构建成功

**Step 3: 在浏览器中测试**

1. 加载扩展到 Chrome
2. 打开 sidepanel
3. 点击 📡 按钮验证 Sources 视图
4. 添加一个 RSS 源
5. 验证文章列表和详情

**Step 4: Commit（如有修复）**

```bash
git add .
git commit -m "fix: resolve any remaining issues"
```

---

## 完成检查清单

- [ ] i18n 翻译已添加
- [ ] ViewHeader 组件已创建
- [ ] SourceCard 组件已创建
- [ ] SourceForm 组件已创建
- [ ] SourcesView 组件已创建
- [ ] ArticleCard 组件已创建
- [ ] ArticlesView 组件已创建
- [ ] ArticleDetail 组件已创建
- [ ] CSS 样式已添加
- [ ] sidepanel.tsx 已集成视图切换
- [ ] 命令支持（/sources, /articles, /back）已实现
- [ ] 所有测试通过
- [ ] 构建成功

---

*计划创建时间: 2026-01-02*
