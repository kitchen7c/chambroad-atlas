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
