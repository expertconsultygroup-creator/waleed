"use client";

import { useMemo } from "react";
import { useIsnad } from "../store";
import { formatDate, formatNumber, translate, type Formatter, type Params } from "./translate";

export interface T {
  (key: string, params?: Params): string;
  lang: Formatter["lang"];
  dir: "rtl" | "ltr";
  number: (n: number, options?: Intl.NumberFormatOptions) => string;
  percent: (ratio: number) => string;
  date: (ts: number | string, options?: Intl.DateTimeFormatOptions) => string;
  time: (ts: number) => string;
  duration: (ms: number | null | undefined) => string;
}

export function makeT(f: Formatter): T {
  const t = ((key: string, params?: Params) => translate(f, key, params)) as T;
  t.lang = f.lang;
  t.dir = f.lang === "ar" ? "rtl" : "ltr";
  t.number = (n, options) => formatNumber(f, n, options);
  t.percent = (ratio) => formatNumber(f, ratio, { style: "percent", maximumFractionDigits: 0 });
  t.date = (ts, options) => formatDate(f, ts, options);
  t.time = (ts) => formatDate(f, ts, { hour: "2-digit", minute: "2-digit" });
  t.duration = (ms) => {
    if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return "";
    // Readers are told seconds; milliseconds are an engineer's unit.
    return ms >= 1000
      ? translate(f, "duration.s", { n: formatNumber(f, ms / 1000, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })
      : translate(f, "duration.underSecond");
  };
  return t;
}

/* The translator for the reader's language, numerals and calendar. Every
   component that shows words calls this; changing any of the three re-renders
   it in place. */
export function useT(): T {
  const lang = useIsnad((s) => s.lang);
  const numerals = useIsnad((s) => s.settings.numerals);
  const calendar = useIsnad((s) => s.settings.calendar);
  return useMemo(() => makeT({ lang, numerals, calendar }), [lang, numerals, calendar]);
}

export function currentT(): T {
  const s = useIsnad.getState();
  return makeT({ lang: s.lang, numerals: s.settings.numerals, calendar: s.settings.calendar });
}
