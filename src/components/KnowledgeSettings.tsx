import { useTranslation } from 'react-i18next';

export interface KnowledgeSettingsData {
  enabled: boolean;
  tool: 'obsidian' | 'logseq' | 'typora' | 'custom';
  vaultPath: string;
  inboxFolder: string;
  dailyFolder: string;
  archiveFolder: string;
  linkFormat: 'wikilink' | 'markdown';
  tagFormat: 'frontmatter' | 'inline' | 'both';
  vectorSearch: {
    enabled: boolean;
    provider: 'openai' | 'local';
  };
}

interface KnowledgeSettingsProps {
  settings: KnowledgeSettingsData;
  onChange: (settings: KnowledgeSettingsData) => void;
}

export function KnowledgeSettings({ settings, onChange }: KnowledgeSettingsProps) {
  const { t } = useTranslation();

  const handleChange = (field: string, value: unknown) => {
    onChange({ ...settings, [field]: value });
  };

  return (
    <div className="settings-section knowledge-settings">
      <h3 className="section-title">{t('settings.knowledge.title')}</h3>

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => handleChange('enabled', e.target.checked)}
          />
          <span>{t('settings.knowledge.enable')}</span>
        </label>
        <p className="field-hint">{t('settings.knowledge.enableDesc')}</p>
      </div>

      {settings.enabled && (
        <>
          <div className="form-group">
            <label>{t('settings.knowledge.tool')}</label>
            <select
              value={settings.tool}
              onChange={(e) => handleChange('tool', e.target.value)}
            >
              <option value="obsidian">Obsidian</option>
              <option value="logseq">Logseq</option>
              <option value="typora">Typora</option>
              <option value="custom">Custom</option>
            </select>
            <p className="field-hint">{t('settings.knowledge.toolDesc')}</p>
          </div>

          <div className="form-group">
            <label>{t('settings.knowledge.vaultPath')}</label>
            <input
              type="text"
              value={settings.vaultPath}
              onChange={(e) => handleChange('vaultPath', e.target.value)}
              placeholder={t('settings.knowledge.vaultPathPlaceholder')}
            />
            <p className="field-hint">{t('settings.knowledge.vaultPathDesc')}</p>
          </div>

          <div className="form-group">
            <label>{t('settings.knowledge.inboxFolder')}</label>
            <input
              type="text"
              value={settings.inboxFolder}
              onChange={(e) => handleChange('inboxFolder', e.target.value)}
              placeholder={t('settings.knowledge.inboxFolderPlaceholder')}
            />
            <p className="field-hint">{t('settings.knowledge.inboxFolderDesc')}</p>
          </div>

          <div className="form-group">
            <label>{t('settings.knowledge.linkFormat')}</label>
            <select
              value={settings.linkFormat}
              onChange={(e) => handleChange('linkFormat', e.target.value)}
            >
              <option value="wikilink">{t('settings.knowledge.wikilink')}</option>
              <option value="markdown">{t('settings.knowledge.markdown')}</option>
            </select>
          </div>

          <div className="form-group">
            <label>{t('settings.knowledge.tagFormat')}</label>
            <select
              value={settings.tagFormat}
              onChange={(e) => handleChange('tagFormat', e.target.value)}
            >
              <option value="frontmatter">{t('settings.knowledge.frontmatter')}</option>
              <option value="inline">{t('settings.knowledge.inline')}</option>
              <option value="both">{t('settings.knowledge.both')}</option>
            </select>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.vectorSearch.enabled}
                onChange={(e) => handleChange('vectorSearch', {
                  ...settings.vectorSearch,
                  enabled: e.target.checked,
                })}
              />
              <span>{t('settings.knowledge.vectorSearch')}</span>
            </label>
            <p className="field-hint">{t('settings.knowledge.vectorSearchDesc')}</p>
          </div>
        </>
      )}
    </div>
  );
}

export const DEFAULT_KNOWLEDGE_SETTINGS: KnowledgeSettingsData = {
  enabled: false,
  tool: 'obsidian',
  vaultPath: '',
  inboxFolder: 'Atlas/Inbox',
  dailyFolder: 'Atlas/Daily',
  archiveFolder: 'Atlas/Archive',
  linkFormat: 'wikilink',
  tagFormat: 'frontmatter',
  vectorSearch: {
    enabled: false,
    provider: 'openai',
  },
};
