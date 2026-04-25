import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, LangKey } from '../constants/translations';

interface LanguageContextType {
  language: LangKey;
  setLanguage: (lang: LangKey) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({} as LanguageContextType);
export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLang] = useState<LangKey>('en');

  useEffect(() => {
    AsyncStorage.getItem('parcela_lang').then(lang => {
      if (lang === 'en' || lang === 'rw') setLang(lang);
    });
  }, []);

  const setLanguage = async (lang: LangKey) => {
    setLang(lang);
    await AsyncStorage.setItem('parcela_lang', lang);
  };

  const t = (key: string): string =>
    translations[language]?.[key] || translations['en']?.[key] || key;

  return (
    <LanguageContext.Provider value={{ language, t, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};
