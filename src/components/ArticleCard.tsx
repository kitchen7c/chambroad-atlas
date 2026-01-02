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

  const parseTags = (): string[] => {
    if (!article.tags) return [];
    try {
      return JSON.parse(article.tags);
    } catch {
      return [];
    }
  };

  const tags = parseTags();
  const isProcessed = article.processedAt > 0;
  const isFiltered = article.filtered === 1;

  return (
    <div className={`article-card ${article.isRead ? 'read' : ''} ${isFiltered ? 'filtered' : ''}`} onClick={onClick}>
      <div className="article-card-title">
        {article.title}
        <span className="article-card-indicators">
          {!article.isRead && <span className="unread-dot">●</span>}
          {article.isFavorite && <span className="favorite-star">★</span>}
          {isProcessed && article.score !== undefined && (
            <span className={`article-score score-${Math.floor(article.score / 3)}`}>
              {article.score}
            </span>
          )}
        </span>
      </div>
      {tags.length > 0 && (
        <div className="article-card-tags">
          {tags.slice(0, 3).map((tag, i) => (
            <span key={i} className="article-tag">{tag}</span>
          ))}
          {tags.length > 3 && <span className="article-tag-more">+{tags.length - 3}</span>}
        </div>
      )}
      <div className="article-card-meta">
        <span>{source?.name || 'Unknown'}</span>
        <span>·</span>
        <span>{formatTime(article.publishedAt)}</span>
      </div>
    </div>
  );
}
