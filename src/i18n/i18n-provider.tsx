import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { translateStrings } from "@/lib/i18n/translate.functions";
import { STRINGS } from "@/i18n/strings";
import { RTL_LANGS, langHtmlAttr } from "@/i18n/languages";
import { InterfaceTranslator } from "@/i18n/interface-translator";

type Dict = Record<string, string>;

type I18nContextValue = {
  language: string;
  setLanguage: (code: string) => void;
  /** True whenever the interface is showing anything other than the English record copy. */
  translated: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
  loading: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_LANG = "instructbrain.lang";
const storageDict = (language: string) => `instructbrain.dict.${language}`;

function interpolate(value: string, vars?: Record<string, string | number>): string {
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState("en");
  const [dict, setDict] = useState<Dict>({});
  const [loading, setLoading] = useState(false);
  const inFlight = useRef<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_LANG);
      if (stored && stored !== "en") setLanguageState(stored);
    } catch {
      /* storage unavailable — English stands */
    }
  }, []);

  const loadDict = useCallback(async (target: string) => {
    if (target === "en") {
      setDict({});
      return;
    }

    try {
      const cached = localStorage.getItem(storageDict(target));
      if (cached) {
        const parsed = JSON.parse(cached) as Dict;
        setDict(parsed);
        const missing = Object.keys(STRINGS).filter((key) => !(key in parsed));
        if (missing.length === 0) return;
      }
    } catch {
      /* ignore a bad cache entry */
    }

    if (inFlight.current === target) return;
    inFlight.current = target;
    setLoading(true);
    try {
      const result = await translateStrings({
        data: { language: target, strings: STRINGS as unknown as Record<string, string> },
      });
      const translations = result.translations ?? {};
      if (Object.keys(translations).length === 0) throw new Error("Nothing came back.");
      setDict(translations);
      try {
        localStorage.setItem(storageDict(target), JSON.stringify(translations));
      } catch {
        /* ignore */
      }
    } catch (error) {
      console.error("Interface translation failed", error);
      toast.error("That language could not be loaded. Staying in English.");
      setDict({});
    } finally {
      inFlight.current = null;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_LANG, language);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = langHtmlAttr(language);
    document.documentElement.dir = RTL_LANGS.has(language) ? "rtl" : "ltr";
    void loadDict(language);
  }, [language, loadDict]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const english = (STRINGS as Record<string, string>)[key] ?? key;
      if (language === "en") return interpolate(english, vars);
      return interpolate(dict[key] ?? english, vars);
    },
    [language, dict],
  );

  const value = useMemo(
    () => ({ language, setLanguage: setLanguageState, translated: language !== "en", t, loading }),
    [language, t, loading],
  );

  return (
    <I18nContext.Provider value={value}>
      {children}
      <InterfaceTranslator language={language} />
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    // A component outside the provider still renders — in English.
    return {
      language: "en",
      setLanguage: () => {},
      translated: false,
      t: (key) => (STRINGS as Record<string, string>)[key] ?? key,
      loading: false,
    };
  }
  return context;
}
