import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage, detectLanguage, getUserLanguagePreference } from '../i18n';

export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  const [preference, setPreference] = useState<'auto' | 'zh' | 'en'>('auto');

  useEffect(() => {
    getUserLanguagePreference().then((pref) => {
      if (pref === 'zh' || pref === 'en') {
        setPreference(pref);
      } else {
        setPreference('auto');
      }
    });
  }, []);

  const handleChange = async (value: 'auto' | 'zh' | 'en') => {
    setPreference(value);
    if (value === 'auto') {
      const systemLang = detectLanguage();
      await i18n.changeLanguage(systemLang);
      // Clear saved preference
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.remove(['atlasLanguage']);
      } else {
        localStorage.removeItem('atlasLanguage');
      }
    } else {
      await changeLanguage(value);
    }
  };

  return (
    <div className="setting-group">
      <label htmlFor="language-select">🌐 {t('settings.language.title')}</label>
      <select
        id="language-select"
        value={preference}
        onChange={(e) => handleChange(e.target.value as 'auto' | 'zh' | 'en')}
      >
        <option value="auto">{t('settings.language.auto')}</option>
        <option value="zh">{t('settings.language.zh')}</option>
        <option value="en">{t('settings.language.en')}</option>
      </select>
    </div>
  );
}

export default LanguageSwitch;
