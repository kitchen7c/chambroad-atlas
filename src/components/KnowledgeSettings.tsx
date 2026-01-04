import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface KnowledgeSettingsProps {
  settings: {
    enabled: boolean;
    tool: string;
    vaultPath: string;
    inboxFolder: string;
    linkFormat: string;
    tagFormat: string;
    vectorSearch: {
      enabled: boolean;
      provider: string;
    };
  };
  onSave: (settings: KnowledgeSettingsProps['settings']) => void;
}

export function KnowledgeSettings({ settings, onSave }: KnowledgeSettingsProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(settings);

  const handleChange = (field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="knowledge-settings">
      <h3>{t('settings.knowledgeBase', 'Knowledge Base')}</h3>

      <div className="form-field">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={formData.enabled}
            onChange={(e) => handleChange('enabled', e.target.checked)}
          />
          {t('settings.enableKnowledgeBase', 'Enable Knowledge Base')}
        </label>
      </div>

      {formData.enabled && (
        <>
          <div className="form-field">
            <label>{t('settings.noteTool', 'Note Tool')}</label>
            <select
              value={formData.tool}
              onChange={(e) => handleChange('tool', e.target.value)}
            >
              <option value="obsidian">Obsidian</option>
              <option value="logseq">Logseq</option>
              <option value="typora">Typora</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div className="form-field">
            <label>{t('settings.vaultPath', 'Vault Path')}</label>
            <input
              type="text"
              value={formData.vaultPath}
              onChange={(e) => handleChange('vaultPath', e.target.value)}
              placeholder="~/Documents/Obsidian/MyVault"
            />
          </div>

          <div className="form-field">
            <label>{t('settings.inboxFolder', 'Inbox Folder')}</label>
            <input
              type="text"
              value={formData.inboxFolder}
              onChange={(e) => handleChange('inboxFolder', e.target.value)}
              placeholder="Atlas/Inbox"
            />
          </div>

          <div className="form-field">
            <label>{t('settings.linkFormat', 'Link Format')}</label>
            <select
              value={formData.linkFormat}
              onChange={(e) => handleChange('linkFormat', e.target.value)}
            >
              <option value="wikilink">[[Wikilink]]</option>
              <option value="markdown">[Markdown](link)</option>
            </select>
          </div>

          <div className="form-field">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={formData.vectorSearch.enabled}
                onChange={(e) => handleChange('vectorSearch', {
                  ...formData.vectorSearch,
                  enabled: e.target.checked,
                })}
              />
              {t('settings.enableVectorSearch', 'Enable Semantic Search')}
            </label>
          </div>
        </>
      )}

      <button type="submit" className="primary">
        {t('settings.save', 'Save')}
      </button>
    </form>
  );
}
