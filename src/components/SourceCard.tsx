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
    if (minutes < 1) return `< 1 min ${t('sources.card.ago')}`;
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
