/* Shapes shared by the store, the API clients and the views.
   The persisted shapes (Chat, Item, Settings) match what the classic
   interface writes, so both read the same history on the same origin. */

export type Lang = "ar" | "en";
export type Theme = "light" | "dark";
export type Numerals = "arab" | "latn";
export type Calendar = "gregory" | "islamic-umalqura";
export type Mode = "chat" | "verify";
export type Tone = "positive" | "caution" | "negative" | "info";

export type MatchStatus =
  | "exact_match"
  | "normalized_match"
  | "partial_match"
  | "mismatch_at_cited_reference"
  | "quote_found_wrong_reference"
  | "reference_found_without_quote"
  | "not_found_in_checked_corpus"
  | "ambiguous_multiple_matches"
  | "unsupported_source_or_language";

export interface SourceMetadata {
  source_id?: string;
  name?: string;
  display_name?: string;
  version?: string;
  license?: string | null;
  url?: string | null;
  content_sha256?: string | null;
  coverage_note?: string | null;
}

export interface Evidence {
  reference?: string;
  source_text?: string;
  matched_fragment?: string | null;
  source_id?: string;
  source_version?: string;
  source_url?: string | null;
  footnotes?: string | null;
  record_title?: string | null;
  attribution_text?: string | null;
  grade_text?: string | null;
  grade_source?: string | null;
  graded_by?: string | null;
  bibliographic_reference?: string | null;
}

export interface WordingDifference {
  kind?: string;
  submitted_text?: string;
  source_text?: string;
}

export interface Report {
  status: MatchStatus | string;
  sourceType: string;
  language: string;
  sourceMetadata: SourceMetadata | null;
  submittedQuote: string | null;
  citedReference: string | null;
  matchedReferences: string[];
  evidence: Evidence[];
  wordingDifferences: WordingDifference[];
  explanation: string;
  explanationKey?: string | null;
  candidateCount: number | null;
  evidenceTruncated: boolean;
}

/* A failure as it happened: codes and numbers, worded at render time in the
   reader's language. Items saved by the classic interface carry `title` and
   `message` already worded; those are shown as they were saved. */
export interface Failure {
  scope: "api" | "model" | "citation";
  code: string;
  message?: string;
  httpStatus?: number;
  retryAfter?: string | null;
  details?: { location?: (string | number)[]; code?: string }[];
  detail?: string;
  reason?: string;
  withheld?: number;
  base?: string;
  title?: string;
  tone?: string;
}

export interface CitationHeader {
  source: string;
  language: string;
  reference: string;
}

export interface Citation {
  id: number | string;
  header: CitationHeader;
  state: "checking" | "done" | "error";
  report?: Report | null;
  error?: Failure | null;
  modelQuote?: string;
  durationMs?: number;
}

export type Part = { kind: "prose"; text: string } | { kind: "citation"; id: number | string };

export interface VerifyRequest {
  source_type: string;
  language: string;
  quote: string | null;
  reference: string | null;
}

export interface StatsData {
  elapsedMs: number;
  checked: number;
  failed: number;
  stopped?: boolean;
}

export interface Item {
  id: string;
  kind: "message" | "pending" | "streaming" | "assistant" | "error" | "request" | "report" | "notice";
  role: "user" | "assistant" | "tool";
  status?: string;
  createdAt: number;
  text?: string | null;
  request?: VerifyRequest | null;
  report?: Report | null;
  citations?: Citation[] | null;
  parts?: Part[] | null;
  error?: Failure | null;
  model?: string | null;
  durationMs?: number | null;
  statsData?: StatsData | null;
  stats?: string | null;
  feedback?: "up" | "down" | null;
}

export interface Chat {
  id: string;
  title: string;
  items: Item[];
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  apiBase: string;
  modelBase: string;
  modelName: string;
  modelRememberKey: boolean;
  temperature: number;
  numerals: Numerals;
  calendar: Calendar;
  showTimestamps: boolean;
}

export interface SourceCapability {
  source_type: string;
  language: string;
  source_id: string;
  name: string;
  display_name?: string;
  source_version: string;
  mode: string;
  reference_format: string;
  coverage_note?: string | null;
}

export interface Capabilities {
  api_version?: string;
  statuses?: string[];
  sources?: SourceCapability[];
  limits?: { max_quote_characters?: number; max_websocket_message_bytes?: number };
  system_prompt_version?: string;
  stats_enabled?: boolean;
  chat_prompt_suggestions?: { label: string; text: string }[];
}

export interface ReadySource {
  source_type: string;
  language: string;
  source_id: string;
  source_version: string;
  source_sha256: string | null;
  mode: string;
}

export interface Ready {
  status: string;
  sources?: ReadySource[];
}

export interface SystemPrompt {
  version: string;
  prompt: string;
}

export type ApiState = "checking" | "ready" | "unavailable";
