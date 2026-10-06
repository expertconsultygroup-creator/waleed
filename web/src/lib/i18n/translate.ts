import { ar, en, type Catalog } from "./messages";
import type { Calendar, Lang, Numerals } from "../types";

const CATALOGS: Record<Lang, Catalog> = { ar, en };

export interface Formatter {
  lang: Lang;
  numerals: Numerals;
  calendar: Calendar;
}

/* Locale tag for Intl: Arabic picks the reader's numeral system; English
   always uses Western digits. The calendar applies to both. */
export function localeTag({ lang, numerals, calendar }: Formatter): string {
  const base = lang === "ar" ? `ar-SA-u-nu-${numerals}` : "en-GB-u-nu-latn";
  return `${base}-ca-${calendar}`;
}

export function formatNumber(f: Formatter, n: number, options?: Intl.NumberFormatOptions): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "";
  try {
    return new Intl.NumberFormat(localeTag(f), options).format(n);
  } catch {
    return String(n);
  }
}

export function formatDate(f: Formatter, ts: number | string, options?: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat(localeTag(f), options ?? { dateStyle: "medium" }).format(new Date(ts));
  } catch {
    return "";
  }
}

export type Params = Record<string, string | number>;

/* t(key, params). A plural key needs params.n; {n} and any numeric param are
   formatted with the reader's numerals. Unknown keys fall back to English,
   then to the key itself, so a gap is visible rather than blank. */
export function translate(f: Formatter, key: string, params?: Params): string {
  let value = CATALOGS[f.lang][key];
  if (value === undefined) value = CATALOGS.en[key];
  if (value === undefined) return key;
  const p = params ?? {};
  if (typeof value === "object") {
    const n = typeof p.n === "number" ? p.n : 0;
    let rule: string = "other";
    try {
      rule = new Intl.PluralRules(f.lang).select(n);
    } catch {
      /* other */
    }
    if (n === 0 && value.zero !== undefined) rule = "zero";
    value = (value as Record<string, string>)[rule] ?? value.other;
  }
  return String(value).replace(/\{(\w+)\}/g, (match, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(p, name)) return match;
    const v = p[name];
    return typeof v === "number" ? formatNumber(f, v) : String(v);
  });
}

export function hasKey(key: string): boolean {
  return CATALOGS.en[key] !== undefined;
}

/* Search key for Arabic text: drops tashkeel, Qur'anic marks and tatweel, and
   folds the letter variants readers type interchangeably. For finding
   conversations only — verification uses the server's own profiles. */
export function searchKey(text: string | null | undefined): string {
  return String(text ?? "")
    .normalize("NFKC")
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, "")
    .replace(/[آأإٱٲٳ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLowerCase();
}
