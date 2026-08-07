/**
 * The locale registry.
 *
 * One file per language in this folder; this is the only place that knows the
 * list. To add a language: copy `en.ts`, translate it, and add one row here.
 *
 * ponytail: static imports, not `import()`. Every string in every language is
 * ~200 KB of the bundle — nothing for an app that loads off local disk, and it
 * buys a language switch with no loading state and no async in the provider.
 */
import { en } from "./en";
import { am } from "./am";
import { ar } from "./ar";
import { bn } from "./bn";
import { de } from "./de";
import { es } from "./es";
import { fa } from "./fa";
import { fil } from "./fil";
import { ha } from "./ha";
import { he } from "./he";
import { hi } from "./hi";
import { id } from "./id";
import { kk } from "./kk";
import { ky } from "./ky";
import { ms } from "./ms";
import { nl } from "./nl";
import { pt } from "./pt";
import { ru } from "./ru";
import { sw } from "./sw";
import { th } from "./th";
import { tk } from "./tk";
import { tr } from "./tr";
import { ur } from "./ur";
import { uz } from "./uz";
import { vi } from "./vi";
import { yo } from "./yo";
import { zh } from "./zh";
import { zu } from "./zu";

export type { Key, Strings } from "./en";

/**
 * Every language, named in itself — a picker you cannot read is no picker.
 * `rtl` is set only where it is true; everything else reads left to right.
 */
export const LOCALES = {
  en: { name: "English", dict: en },
  ar: { name: "العربية", dict: ar, rtl: true },
  am: { name: "አማርኛ", dict: am },
  bn: { name: "বাংলা", dict: bn },
  de: { name: "Deutsch", dict: de },
  es: { name: "Español", dict: es },
  fa: { name: "فارسی", dict: fa, rtl: true },
  fil: { name: "Filipino", dict: fil },
  ha: { name: "Hausa", dict: ha },
  he: { name: "עברית", dict: he, rtl: true },
  hi: { name: "हिन्दी", dict: hi },
  id: { name: "Bahasa Indonesia", dict: id },
  kk: { name: "Қазақша", dict: kk },
  ky: { name: "Кыргызча", dict: ky },
  ms: { name: "Bahasa Melayu", dict: ms },
  nl: { name: "Nederlands", dict: nl },
  pt: { name: "Português (Brasil)", dict: pt },
  ru: { name: "Русский", dict: ru },
  sw: { name: "Kiswahili", dict: sw },
  th: { name: "ไทย", dict: th },
  tk: { name: "Türkmençe", dict: tk },
  tr: { name: "Türkçe", dict: tr },
  ur: { name: "اردو", dict: ur, rtl: true },
  uz: { name: "O‘zbekcha", dict: uz },
  vi: { name: "Tiếng Việt", dict: vi },
  yo: { name: "Yorùbá", dict: yo },
  zh: { name: "中文", dict: zh },
  zu: { name: "isiZulu", dict: zu },
} as const;

export type Locale = keyof typeof LOCALES;

export const isRtl = (locale: Locale): boolean =>
  "rtl" in LOCALES[locale] && LOCALES[locale].rtl === true;

/**
 * Tags some systems still report for languages that were later renamed. A
 * Java-era `iw-IL` or an Android `tl-PH` has to land somewhere sensible.
 */
const ALIASES: Record<string, Locale> = {
  iw: "he",
  in: "id",
  tl: "fil",
  ji: "he",
};

/** `tr-TR`, `zh-Hans-CN`, `pt-BR` and friends all collapse to their base tag. */
export function detectLocale(): Locale {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.toLowerCase().split("-")[0];
    if (base in LOCALES) return base as Locale;
    if (base in ALIASES) return ALIASES[base];
  }
  return "en";
}
