/**
 * Translations: the plumbing. The strings live in `locales/`, one file per
 * language, and `locales/index.ts` is the only place that knows the list.
 *
 * ponytail: a dict, a context and one `t()`. No i18next, no ICU parser, no
 * plural engine — the app has ~120 strings and one interpolation form (`{n}`).
 * English is the source of truth; a locale may omit any key and falls back to
 * it, so a half-finished translation still renders a working app.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { usePersisted } from "./hooks/usePersisted";
import { LOCALES, detectLocale, isRtl } from "./locales";
import { en } from "./locales/en";
import type { Key, Locale } from "./locales";

export { LOCALES, detectLocale, isRtl } from "./locales";
export type { Key, Locale, Strings } from "./locales";

/** `{name}` placeholders only — the one form every string here needs. */
function format(template: string, params?: Record<string, string | number>) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key) =>
    key in params ? String(params[key]) : whole,
  );
}

export type T = (key: Key, params?: Record<string, string | number>) => string;

const Ctx = createContext<{ locale: Locale; setLocale: (l: Locale) => void; t: T }>(
  {
    locale: "en",
    setLocale: () => {},
    t: (k) => en[k],
  },
);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = usePersisted<Locale>("locale", detectLocale());

  const value = useMemo(() => {
    // A locale stored by an older build may no longer exist.
    const table = LOCALES[locale]?.dict ?? en;
    const t: T = (key, params) => format(table[key] ?? en[key] ?? key, params);
    return { locale: locale in LOCALES ? locale : ("en" as Locale), setLocale, t };
  }, [locale, setLocale]);

  // `lang` is not decoration: CSS `text-transform: uppercase` is locale-aware,
  // and a Turkish "i" only becomes "İ" when the document says it is Turkish.
  // `dir` is what mirrors the whole layout for Arabic, Hebrew, Persian, Urdu.
  useEffect(() => {
    document.documentElement.lang = value.locale;
    document.documentElement.dir = isRtl(value.locale) ? "rtl" : "ltr";
  }, [value.locale]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
/** The common case: only the translate function. */
export const useT = (): T => useContext(Ctx).t;
