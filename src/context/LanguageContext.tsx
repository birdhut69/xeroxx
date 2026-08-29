import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { translations, SupportedLanguage, Translations } from '../i18n/translations';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: keyof Translations) => string;
  availableLanguages: { code: SupportedLanguage; label: string; flag: string }[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const AVAILABLE_LANGUAGES: { code: SupportedLanguage; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'mr', label: 'मराठी', flag: '🚩' },
  { code: 'hi', label: 'हिंदी', flag: '🇮🇳' },
];

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    try {
      const saved = localStorage.getItem('cipherprint_lang');
      if (saved === 'en' || saved === 'mr' || saved === 'hi') {
        return saved;
      }
    } catch {}
    return 'en';
  });

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('cipherprint_lang', lang);
    } catch {}
  };

  const t = useMemo(() => {
    return (key: keyof Translations): string => {
      const currentDict = translations[language] || translations.en;
      return currentDict[key] || translations.en[key] || String(key);
    };
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      availableLanguages: AVAILABLE_LANGUAGES,
    }),
    [language, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
