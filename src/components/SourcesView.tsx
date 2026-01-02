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
