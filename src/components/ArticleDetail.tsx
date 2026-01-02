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
