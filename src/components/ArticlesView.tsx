import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ViewHeader } from './ViewHeader';
import { ArticleCard } from './ArticleCard';
import { db, type StoredArticle, type StoredSource } from '../core/storage/db';
import type { ExportFormat } from '../core/export/types';

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
  const [showExportMenu, setShowExportMenu] = useState(false);

  const loadArticles = async () => {
    const query = db.articles.orderBy('publishedAt').reverse();

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

  const handleExportAll = async (format: ExportFormat) => {
    if (filteredArticles.length === 0) return;

    const exportData = filteredArticles.map(a => {
      let tags: string[] = [];
      try {
        tags = a.tags ? JSON.parse(a.tags) : [];
      } catch {
        tags = [];
      }

      return {
        id: a.id,
        title: a.title,
        content: a.content || '',
        source: sources[a.sourceId]?.name,
        url: a.url,
        author: a.author,
        publishedAt: a.publishedAt ? new Date(a.publishedAt).toISOString() : undefined,
        tags,
        score: a.score,
        summary: a.summary,
        isRead: a.isRead,
        isFavorite: a.isFavorite,
      };
    });

    const { getFormatter } = await import('../core/export/formatters');
    const formatter = getFormatter(format);
    const content = formatter.renderMany(exportData);

    const mimeTypes: Record<ExportFormat, string> = {
      markdown: 'text/markdown',
      pdf: 'application/pdf',
      html: 'text/html',
      json: 'application/json',
      csv: 'text/csv',
    };

    const extensions: Record<ExportFormat, string> = {
      markdown: 'md',
      pdf: 'pdf',
      html: 'html',
      json: 'json',
      csv: 'csv',
    };

    // Handle both string and Buffer content
    const blobContent: BlobPart = typeof content === 'string'
      ? content
      : new Uint8Array(content);

    const blob = new Blob([blobContent], { type: mimeTypes[format] });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `articles-export-${new Date().toISOString().split('T')[0]}.${extensions[format]}`;
    a.click();
    URL.revokeObjectURL(url);

    setShowExportMenu(false);
  };

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
        <div className="export-dropdown" style={{ marginLeft: 'auto' }}>
          <button
            className="export-btn"
            onClick={() => setShowExportMenu(!showExportMenu)}
            title={t('articles.export') || 'Export'}
          >
            {t('articles.export') || 'Export'} ↓
          </button>
          {showExportMenu && (
            <div className="export-menu">
              <button onClick={() => handleExportAll('markdown')}>Markdown</button>
              <button onClick={() => handleExportAll('json')}>JSON</button>
              <button onClick={() => handleExportAll('csv')}>CSV</button>
              <button onClick={() => handleExportAll('html')}>HTML</button>
            </div>
          )}
        </div>
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
