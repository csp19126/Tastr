import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/locales/en';
import vi from '@/locales/vi';

export type Lang = 'en' | 'vi';

/** First launch: Vietnamese phones get Vietnamese, everyone else English. Changeable in Settings. */
export function deviceLanguage(): Lang {
  return getLocales()[0]?.languageCode === 'vi' ? 'vi' : 'en';
}

// eslint-disable-next-line import/no-named-as-default-member
i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, vi: { translation: vi } },
  lng: deviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
