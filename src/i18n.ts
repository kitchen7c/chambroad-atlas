import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import zhTranslation from './locales/zh/translation.json';
import enTranslation from './locales/en/translation.json';

/**
 * Detect system language
 * - Chrome Extension: chrome.i18n.getUILanguage()
 * - Electron: via preload API
 * - Browser: navigator.language
 */
export function detectLanguage(): string {
  let lang = 'en';

  // Chrome Extension environment
  if (typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage) {
    lang = chrome.i18n.getUILanguage();
  }
  // Electron environment (exposed via preload)
  else if (typeof window !== 'undefined' && (window as any).electronAPI?.getLocale) {
    lang = (window as any).electronAPI.getLocale();
  }
  // Browser environment
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
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['atlasLanguage'], (result) => {
        resolve(result.atlasLanguage || null);
      });
    } else if (typeof localStorage !== 'undefined') {
      resolve(localStorage.getItem('atlasLanguage'));
    } else {
      resolve(null);
    }
  });
}

/**
 * Save user's language preference
 */
export function saveLanguagePreference(lang: string | 'auto'): void {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    if (lang === 'auto') {
      chrome.storage.local.remove(['atlasLanguage']);
    } else {
      chrome.storage.local.set({ atlasLanguage: lang });
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
export function changeLanguage(lang: string): void {
  i18n.changeLanguage(lang);
  saveLanguagePreference(lang);
}

export default i18n;
