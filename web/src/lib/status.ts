import type { T } from "./i18n/use-t";
import type { Tone } from "./types";

/* Nine textual-correspondence outcomes. None is an authenticity grade; the
   catalog copy says so rather than leaving room to assume one. */
export const STATUS_ORDER = [
  "exact_match",
  "normalized_match",
  "partial_match",
  "mismatch_at_cited_reference",
  "quote_found_wrong_reference",
  "reference_found_without_quote",
  "not_found_in_checked_corpus",
  "ambiguous_multiple_matches",
  "unsupported_source_or_language",
] as const;

const TONES: Record<string, Tone> = {
  exact_match: "positive",
  normalized_match: "positive",
  partial_match: "caution",
  mismatch_at_cited_reference: "negative",
  quote_found_wrong_reference: "caution",
  reference_found_without_quote: "info",
  not_found_in_checked_corpus: "negative",
  ambiguous_multiple_matches: "caution",
  unsupported_source_or_language: "info",
};

export const MATCHED = ["exact_match", "normalized_match", "partial_match"];
export const NEEDS_REVIEW = [
  "mismatch_at_cited_reference",
  "quote_found_wrong_reference",
  "not_found_in_checked_corpus",
  "ambiguous_multiple_matches",
];

export interface StatusInfo {
  label: string;
  meaning: string;
  tone: Tone;
  known: boolean;
}

export function statusInfo(t: T, status: string): StatusInfo {
  if (status in TONES) {
    return {
      label: t(`status.${status}.label`),
      meaning: t(`status.${status}.meaning`),
      tone: TONES[status],
      known: true,
    };
  }
  return { label: String(status || t("status.unknown.label")), meaning: t("status.unknown.meaning"), tone: "info", known: false };
}

/* Tailwind classes per tone, written out in full so the compiler sees them. */
export const TONE_TEXT: Record<Tone, string> = {
  positive: "text-match",
  caution: "text-partial",
  negative: "text-mismatch",
  info: "text-info",
};
export const TONE_SOFT: Record<Tone, string> = {
  positive: "bg-match-soft text-match",
  caution: "bg-partial-soft text-partial",
  negative: "bg-mismatch-soft text-mismatch",
  info: "bg-info-soft text-info",
};
export const TONE_BORDER: Record<Tone, string> = {
  positive: "border-s-match",
  caution: "border-s-partial",
  negative: "border-s-mismatch",
  info: "border-s-info",
};
export const TONE_FILL: Record<Tone, string> = {
  positive: "bg-match",
  caution: "bg-partial",
  negative: "bg-mismatch",
  info: "bg-info",
};

export function sourceLabel(t: T, type: string | null | undefined): string {
  if (type === "hadith") return t("source.hadith");
  if (type === "quran") return t("source.quran");
  return String(type ?? "");
}

export function languageLabel(t: T, lang: string | null | undefined): string {
  if (lang === "ar") return t("lang.ar");
  if (lang === "en") return t("lang.en");
  return String(lang ?? "");
}

export function versionText(version: string | null | undefined): string {
  const text = String(version ?? "");
  return /^\d/.test(text) ? `v${text}` : text;
}

export function shortHash(value: string | null | undefined): string {
  const text = String(value ?? "");
  return text.length > 12 ? `${text.slice(0, 12)}…` : text;
}
