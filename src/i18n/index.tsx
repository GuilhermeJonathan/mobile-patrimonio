import React, { createContext, useContext, useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { translations, Lang } from './translations';
import { screensPt, screensEn } from './screens';

const STORAGE_KEY = 'app-lang';

// Dicionário efetivo = base (common/menu/login/inv/patrimonio) + namespaces por tela (screens.ts).
// Namespaces não colidem, então o spread raso é seguro.
const dict: Record<Lang, any> = {
  pt: { ...translations.pt, ...screensPt },
  en: { ...translations.en, ...screensEn },
};

/** Idioma inicial: preferência salva → idioma do navegador → pt. */
function idiomaInicial(): Lang {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const salvo = window.localStorage?.getItem(STORAGE_KEY);
      if (salvo === 'pt' || salvo === 'en') return salvo;
    } catch { /* ignora */ }
    const nav = (typeof navigator !== 'undefined' ? navigator.language : '') || '';
    if (nav.toLowerCase().startsWith('en')) return 'en';
  }
  return 'pt';
}

/** Resolve uma chave dot-path (ex.: "menu.inicio") no dicionário do idioma. */
function resolve(lang: Lang, key: string): string | undefined {
  const partes = key.split('.');
  let node: any = dict[lang];
  for (const p of partes) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[p];
  }
  return typeof node === 'string' ? node : undefined;
}

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'pt',
  setLang: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(idiomaInicial());

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try { window.localStorage?.setItem(STORAGE_KEY, l); } catch { /* ignora */ }
    }
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    // idioma atual → fallback pt → a própria chave (evita tela vazia se faltar tradução)
    let s = resolve(lang, key) ?? resolve('pt', key) ?? key;
    if (params) for (const k of Object.keys(params)) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(params[k]));
    return s;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  return useContext(I18nContext);
}
