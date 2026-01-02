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
