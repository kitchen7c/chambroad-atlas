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
