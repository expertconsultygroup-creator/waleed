"use client";

import { apiBase, useIsnad } from "./store";
import type { Capabilities, Failure, Ready, Report, SystemPrompt } from "./types";

export class IsnadError extends Error {
  failure: Failure;
  constructor(failure: Failure) {
    super(failure.message || failure.code);
    this.failure = failure;
  }
}

export function describeBase(): string {
  const base = apiBase(useIsnad.getState().settings);
  if (base) return base;
  return typeof window !== "undefined" ? window.location.origin : "";
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<{ payload: T; durationMs: number }> {
  const s = useIsnad.getState();
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", onAbort, { once: true });
  }
  const timer = window.setTimeout(() => controller.abort("timeout"), opts.timeoutMs ?? 15000);
  const started = performance.now();
  const base = describeBase();

  let response: Response;
  try {
    response = await fetch(apiBase(s.settings) + path, {
      method: opts.method ?? "GET",
      headers: {
        Accept: "application/json",
        "Accept-Language": s.lang,
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
      credentials: "omit",
      mode: "cors",
    });
  } catch {
    const external = opts.signal?.aborted;
    if (controller.signal.aborted && !external && controller.signal.reason === "timeout") {
      throw new IsnadError({ scope: "api", code: "timeout", base });
    }
    if (external || controller.signal.aborted) throw new IsnadError({ scope: "api", code: "cancelled" });
    throw new IsnadError({ scope: "api", code: "network", base });
  } finally {
    window.clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    const body = (payload as { error?: { code?: string; message?: string; details?: Failure["details"] } } | null)?.error ?? {};
    throw new IsnadError({
      scope: "api",
      code: body.code || `http_${response.status}`,
      message: body.message || response.statusText,
      httpStatus: response.status,
      retryAfter: response.headers.get("Retry-After"),
      details: body.details ?? [],
      base,
    });
  }
  if (!payload || typeof payload !== "object") throw new IsnadError({ scope: "api", code: "invalid_response" });
  return { payload: payload as T, durationMs: performance.now() - started };
}

export const Api = {
  capabilities: (o?: RequestOptions) => request<Capabilities>("/v1/capabilities", o),
  ready: (o?: RequestOptions) => request<Ready>("/health/ready", o),
  systemPrompt: (o?: RequestOptions) => request<SystemPrompt>(`/v1/system-prompt?lang=${useIsnad.getState().lang}`, o),
  stats: (o?: RequestOptions) => request<ServerStats>("/v1/stats", o),
  verify: (body: unknown, o?: RequestOptions) =>
    request<VerifyPayload>("/v1/verify", { method: "POST", body, timeoutMs: 45000, ...o }),
};

export interface ServerStats {
  persistent: boolean;
  started_at?: string;
  collecting_since?: string;
  totals: { verifications: number; source_unavailable_errors: number; by_status: Record<string, number> };
  breakdown: { status: string; source_type: string; language: string; count: number }[];
  latency: { mean_ms: number | null; count: number };
  daily: { date: string; total: number; by_status: Record<string, number> }[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type VerifyPayload = Record<string, any>;

export function normalizeReport(payload: VerifyPayload): Report {
  return {
    status: payload.status,
    sourceType: payload.source_type,
    language: payload.language,
    sourceMetadata: payload.source_metadata ?? null,
    submittedQuote: payload.submitted_quote ?? null,
    citedReference: payload.cited_reference ?? null,
    matchedReferences: payload.matched_references ?? [],
    evidence: (payload.evidence ?? []).map((e: any) => ({
      reference: e.reference,
      source_text: e.source_text,
      matched_fragment: e.matched_fragment,
      source_id: e.source_id,
      source_version: e.source_version,
      source_url: e.source_url,
      footnotes: e.footnotes,
      record_title: e.record_title,
      attribution_text: e.attribution_text,
      grade_text: e.grade_text,
      grade_source: e.grade_source,
      graded_by: e.graded_by,
      bibliographic_reference: e.bibliographic_reference,
    })),
    wordingDifferences: (payload.wording_differences ?? []).map((d: any) => ({
      kind: d.kind,
      submitted_text: d.submitted_text,
      source_text: d.source_text,
    })),
    explanation: payload.explanation ?? "",
    explanationKey: payload.explanation_key ?? null,
    candidateCount: typeof payload.candidate_count === "number" ? payload.candidate_count : null,
    evidenceTruncated: payload.evidence_truncated === true,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
