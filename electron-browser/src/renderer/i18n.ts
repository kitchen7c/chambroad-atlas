import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import zhTranslation from './locales/zh/translation.json';
import enTranslation from './locales/en/translation.json';

/**
 * Detect system language
 * - Electron: via preload API
 * - Browser fallback: navigator.language
 */
export function detectLanguage(): string {
  let lang = 'en';

  // Electron environment (exposed via preload)
  if (typeof window !== 'undefined' && (window as any).electronAPI?.getLocale) {
    lang = (window as any).electronAPI.getLocale();
  }
  // Browser fallback
  else if (typeof navigator !== 'undefined') {
    lang = navigator.language;
  }

  // Normalize Chinese variants
  if (lang.startsWith('zh')) {
    return 'zh';
  }

  return 'en';
}

/**
 * Get user's saved language preference
 */
export async function getUserLanguagePreference(): Promise<string | null> {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.getSetting) {
    try {
      const pref = await (window as any).electronAPI.getSetting('atlasLanguage');
      return pref || null;
    } catch {
      return null;
    }
  } else if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('atlasLanguage');
  }
  return null;
}

/**
 * Save user's language preference
 */
export async function saveLanguagePreference(lang: string | 'auto'): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.setSetting) {
    if (lang === 'auto') {
      await (window as any).electronAPI.setSetting('atlasLanguage', null);
    } else {
      await (window as any).electronAPI.setSetting('atlasLanguage', lang);
    }
  } else if (typeof localStorage !== 'undefined') {
    if (lang === 'auto') {
      localStorage.removeItem('atlasLanguage');
    } else {
      localStorage.setItem('atlasLanguage', lang);
    }
  }
}

/**
 * Initialize i18n
 */
export async function initI18n(): Promise<typeof i18n> {
  const userLang = await getUserLanguagePreference();
  const detectedLang = detectLanguage();
  const initialLang = userLang || detectedLang;

  await i18n.use(initReactI18next).init({
    lng: initialLang,
    fallbackLng: 'en',
    resources: {
      zh: { translation: zhTranslation },
      en: { translation: enTranslation },
    },
    interpolation: {
      escapeValue: false, // React already handles XSS
    },
  });

  return i18n;
}

/**
 * Change language and save preference
 */
export async function changeLanguage(lang: string): Promise<void> {
  await i18n.changeLanguage(lang);
  await saveLanguagePreference(lang);
}

export default i18n;
