/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useEffect, useState } from "react";
import translations from "../data/translations";

export const LanguageContext = createContext(null);

const STORAGE_KEY = "khemaj_mata_language";
const VALID_LANGS = new Set(["hi", "en", "gu"]);

function getInitialLanguage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && VALID_LANGS.has(saved)) {
        return saved;
      }
    }
  } catch {
    // ignore storage errors
  }
  return "hi";
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(getInitialLanguage);

  const setLanguage = useCallback((nextLang) => {
    const clean = VALID_LANGS.has(nextLang) ? nextLang : "hi";
    setLanguageState(clean);
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, clean);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.lang = language;
    }
  }, [language]);

  const t = translations[language] || translations.hi;

  return (
    <LanguageContext.Provider
      value={{ language, lang: language, setLanguage, t }}
    >
      {children}
    </LanguageContext.Provider>
  );
}
