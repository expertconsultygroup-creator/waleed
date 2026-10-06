"use client";

import { Api, IsnadError, normalizeReport } from "./api";
import citationStream from "./citation-stream.js";
import { currentT } from "./i18n/use-t";
import { streamChat, type ChatMessage } from "./model";
import { modelConfigured, persist, useIsnad } from "./store";
import type { Chat, Citation, Failure, Part, VerifyRequest } from "./types";
import { formatReference } from "./reference";

/* Rules this file exists to enforce (as the classic interface did):
   - Nothing unverified is shown as a quotation. A marked block is held whole
     until the verifier answers.
   - The model's own words for a quotation are never displayed: the card shows
     the source's wording, or the failure, and nothing in between.
   - A match status is never presented as a grade, a judgement or a ruling. */

const store = () => useIsnad.getState();

function failureOf(err: unknown, scope: Failure["scope"]): Failure {
  if (err instanceof IsnadError) return err.failure;
  return { scope, code: "unknown", message: String((err as Error)?.message ?? err) };
}

export function quoteLimit(): number {
  return store().capabilities?.limits?.max_quote_characters ?? 4000;
}

/* ---------------------------------------------------------------- API state */

let refreshing: Promise<void> | null = null;

export function refreshApiState(opts: { forcePrompt?: boolean } = {}): Promise<void> {
  if (refreshing && !opts.forcePrompt) return refreshing;
  refreshing = (async () => {
    store().setApi("checking");
    try {
      const caps = await Api.capabilities({ timeoutMs: 8000 });
      let ready = null;
      try {
        ready = (await Api.ready({ timeoutMs: 8000 })).payload;
      } catch {
        /* readiness is informational */
      }
      let prompt = store().systemPrompt;
      if (opts.forcePrompt || !prompt || prompt.version !== (caps.payload.system_prompt_version ?? prompt.version)) {
        try {
          prompt = (await Api.systemPrompt({ timeoutMs: 8000 })).payload;
        } catch {
          /* chat stays disabled without the protocol prompt */
        }
      }
      store().setApi("ready", { capabilities: caps.payload, ready, systemPrompt: prompt });
    } catch {
      store().setApi("unavailable", { capabilities: null, ready: null });
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/* --------------------------------------------------------------- chat flow */

function citationSuffix(citations: Citation[] | null | undefined): string {
  return (citations ?? [])
    .map(
      (c) =>
        `\n\n[[ISNAD-CITATION source=${c.header.source} language=${c.header.language}` +
        (c.header.reference ? ` reference=${c.header.reference}` : "") +
        `]]${c.modelQuote ?? ""}[[/ISNAD-CITATION]]`,
    )
    .join("");
}

function messagesFor(chat: Chat, upTo: number): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const prompt = store().systemPrompt?.prompt;
  if (prompt) messages.push({ role: "system", content: prompt });
  chat.items.slice(0, upTo).forEach((entry) => {
    if (entry.role === "user" && entry.kind !== "pending") messages.push({ role: "user", content: entry.text ?? "" });
    else if (entry.kind === "assistant" && entry.text) {
      // Replayed exactly as written, markers included: the protocol is part of
      // the conversation the model sees.
      messages.push({ role: "assistant", content: entry.text + citationSuffix(entry.citations) });
    }
  });
  return messages;
}

export async function sendMessage(text: string): Promise<boolean> {
  const s = store();
  if (s.running.active || !text.trim() || !modelConfigured(s)) return false;
  let chat = s.chats.find((c) => c.id === s.activeId) ?? null;
  if (!chat) chat = s.createChat();
  s.addItem(chat.id, { role: "user", kind: "message", text: text.trim(), status: "complete" });
  const fresh = store().chats.find((c) => c.id === chat!.id)!;
  if (fresh.items.filter((m) => m.role === "user").length === 1) {
    const title = text.trim();
    store().renameChat(chat.id, title.length > 52 ? `${title.slice(0, 52).trim()}…` : title);
  }
  persist();
  void runAssistant(chat.id);
  return true;
}

type StreamEvent =
  | { type: "prose"; text: string }
  | { type: "citation_start"; id: number; header: Citation["header"] }
  | { type: "citation_end"; id: number; quote: string }
  | { type: "citation_incomplete"; id: number; withheld_characters: number }
  | { type: "citation_invalid"; id?: number; reason: string };

export async function runAssistant(chatId: string) {
  const controller = new AbortController();
  store().setRunning({ active: true, kind: "chat", controller });
  const placeholder = store().addItem(chatId, { role: "assistant", kind: "pending", status: "pending" });
  if (!placeholder) return;

  const streamer = citationStream.createStreamer();
  const startedAt = performance.now();
  let text = "";
  let citations: Citation[] = [];
  let parts: Part[] = [];
  let queue: Promise<void> = Promise.resolve();

  const commit = () =>
    store().updateItem(chatId, placeholder.id, {
      kind: "streaming",
      status: "streaming",
      text,
      citations: citations.map((c) => ({ ...c })),
      parts: parts.map((p) => ({ ...p })),
      model: store().settings.modelName,
    });

  const appendProse = (chunk: string) => {
    const last = parts[parts.length - 1];
    if (last && last.kind === "prose") parts = [...parts.slice(0, -1), { kind: "prose", text: last.text + chunk }];
    else parts = [...parts, { kind: "prose", text: chunk }];
  };

  async function verifyCitation(citation: Citation) {
    try {
      const result = await Api.verify(
        {
          source_type: citation.header.source,
          language: citation.header.language,
          quote: citation.modelQuote || null,
          reference: citation.header.reference || null,
        },
        { signal: controller.signal },
      );
      citation.state = "done";
      citation.durationMs = result.durationMs;
      citation.report = normalizeReport(result.payload);
    } catch (err) {
      citation.state = "error";
      citation.error = failureOf(err, "api");
    }
    commit();
  }

  function apply(events: StreamEvent[]) {
    let changed = false;
    for (const event of events) {
      if (event.type === "prose") {
        text += event.text;
        appendProse(event.text);
        changed = true;
      } else if (event.type === "citation_start") {
        citations = [...citations, { id: event.id, header: event.header, state: "checking", report: null, error: null }];
        parts = [...parts, { kind: "citation", id: event.id }];
        changed = true;
      } else if (event.type === "citation_end") {
        const pending = citations[citations.length - 1];
        if (!pending || pending.id !== event.id) continue;
        pending.modelQuote = event.quote;
        queue = queue.then(() => verifyCitation(pending));
        changed = true;
      } else if (event.type === "citation_incomplete") {
        citations = [
          ...citations,
          {
            id: event.id,
            header: { source: "unknown", language: "unknown", reference: "" },
            state: "error",
            error: { scope: "citation", code: "incomplete", withheld: Number(event.withheld_characters) || 0 },
          },
        ];
        parts = [...parts, { kind: "citation", id: event.id }];
        changed = true;
      } else if (event.type === "citation_invalid") {
        const id = event.id ?? 0;
        citations = [
          ...citations,
          {
            id,
            header: { source: "unknown", language: "unknown", reference: "" },
            state: "error",
            error: { scope: "citation", code: "invalid", reason: event.reason },
          },
        ];
        parts = [...parts, { kind: "citation", id }];
        changed = true;
      }
    }
    if (changed) commit();
  }

  try {
    commit();
    const chat = store().chats.find((c) => c.id === chatId)!;
    const index = chat.items.findIndex((m) => m.id === placeholder.id);
    await streamChat(messagesFor(chat, index), {
      signal: controller.signal,
      onText: (chunk) => apply(streamer.push(chunk) as StreamEvent[]),
    });
    apply(streamer.finish() as StreamEvent[]);
    await queue;
    store().updateItem(chatId, placeholder.id, {
      kind: "assistant",
      status: "complete",
      text,
      citations,
      parts,
      statsData: {
        elapsedMs: performance.now() - startedAt,
        checked: citations.filter((c) => c.state === "done").length,
        failed: citations.filter((c) => c.state === "error").length,
      },
    });
  } catch (err) {
    apply(streamer.finish() as StreamEvent[]);
    const failure = failureOf(err, "model");
    if (failure.code === "cancelled") {
      store().updateItem(chatId, placeholder.id, {
        kind: "assistant",
        status: "complete",
        text,
        citations,
        parts,
        statsData: {
          elapsedMs: performance.now() - startedAt,
          checked: citations.filter((c) => c.state === "done").length,
          failed: 0,
          stopped: true,
        },
      });
    } else {
      store().updateItem(chatId, placeholder.id, {
        kind: "error",
        status: "error",
        text,
        citations,
        parts,
        error: failure,
        durationMs: performance.now() - startedAt,
      });
    }
  } finally {
    store().setRunning({ active: false, kind: null, controller: null });
    persist();
  }
}

export function stopGeneration() {
  store().running.controller?.abort();
}

export function regenerate(chatId: string, itemId: string) {
  if (store().running.active) return;
  store().truncateAfter(chatId, itemId, true);
  persist();
  void runAssistant(chatId);
}

/* ------------------------------------------------------------- hand checks */

export function validateVerify(request: VerifyRequest): string | null {
  const t = currentT();
  const quote = (request.quote ?? "").trim();
  const reference = (request.reference ?? "").trim();
  if (!quote && !reference) return t("validate.empty");
  if ((request.quote ?? "").length > quoteLimit()) {
    return t("validate.tooLong", { length: (request.quote ?? "").length, limit: quoteLimit() });
  }
  if (reference.length > 64) return t("validate.refTooLong");
  const sources = store().capabilities?.sources;
  if (sources && !sources.some((s) => s.source_type === request.source_type && s.language === request.language)) {
    return t("validate.unsupported", {
      pair: `${t(request.source_type === "hadith" ? "source.hadith" : "source.quran")} · ${t(request.language === "ar" ? "lang.ar" : "lang.en")}`,
    });
  }
  return null;
}

export async function runVerify(chatId: string, request: VerifyRequest, opts: { afterItemId?: string } = {}) {
  if (store().running.active) return;
  if (opts.afterItemId) store().truncateAfter(chatId, opts.afterItemId, true);
  const pending = store().addItem(chatId, { role: "tool", kind: "pending", status: "pending", request });
  if (!pending) return;
  const controller = new AbortController();
  store().setRunning({ active: true, kind: "verify", controller });
  const started = performance.now();
  try {
    const result = await Api.verify(request, { signal: controller.signal });
    store().updateItem(chatId, pending.id, {
      kind: "report",
      status: "complete",
      durationMs: result.durationMs,
      report: normalizeReport(result.payload),
    });
  } catch (err) {
    const failure = failureOf(err, "api");
    store().updateItem(chatId, pending.id, {
      kind: "error",
      status: failure.code === "cancelled" ? "cancelled" : "error",
      durationMs: performance.now() - started,
      error: failure,
      request,
    });
  } finally {
    store().setRunning({ active: false, kind: null, controller: null });
    persist();
  }
}

export function submitVerify(request: VerifyRequest): string | null {
  const problem = validateVerify(request);
  if (problem) return problem;
  const s = store();
  let chat = s.chats.find((c) => c.id === s.activeId) ?? null;
  if (!chat) chat = s.createChat();
  const trimmed: VerifyRequest = {
    source_type: request.source_type,
    language: request.language,
    quote: (request.quote ?? "").trim() || null,
    reference: (request.reference ?? "").trim() || null,
  };
  s.addItem(chat.id, { role: "tool", kind: "request", status: "complete", request: trimmed });
  const fresh = store().chats.find((c) => c.id === chat!.id)!;
  if (fresh.items.filter((m) => m.role === "tool").length === 1 && !fresh.title) {
    const t = currentT();
    store().renameChat(chat.id, t("chat.checkTitle", { ref: trimmed.reference ? formatReference(t, trimmed.reference) : (trimmed.quote ?? "").slice(0, 32) }));
  }
  persist();
  void runVerify(chat.id, trimmed);
  return null;
}
