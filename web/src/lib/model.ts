"use client";

import { IsnadError } from "./api";
import { useIsnad } from "./store";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/* Streams from any OpenAI-compatible endpoint. Streaming only: the citation
   gate has to see tokens as they arrive, or quotations would be on screen
   before they were checked. */
export async function streamChat(
  messages: ChatMessage[],
  opts: { signal: AbortSignal; onText: (text: string) => void },
): Promise<void> {
  const { settings, modelKey } = useIsnad.getState();
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "text/event-stream" };
  if (modelKey) headers.Authorization = `Bearer ${modelKey}`;

  let response: Response;
  try {
    response = await fetch(settings.modelBase.replace(/\/+$/, "") + "/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({ model: settings.modelName, messages, stream: true, temperature: settings.temperature }),
      signal: opts.signal,
      cache: "no-store",
      credentials: "omit",
    });
  } catch {
    if (opts.signal.aborted) throw new IsnadError({ scope: "model", code: "cancelled" });
    throw new IsnadError({ scope: "model", code: "network", base: settings.modelBase });
  }

  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.text()).slice(0, 400);
    } catch {
      /* the status alone will do */
    }
    throw new IsnadError({ scope: "model", code: `http_${response.status}`, httpStatus: response.status, detail });
  }
  if (!response.body) throw new IsnadError({ scope: "model", code: "no_stream" });

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  try {
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        if (opts.signal.aborted) throw new IsnadError({ scope: "model", code: "cancelled" });
        throw new IsnadError({ scope: "model", code: "network", base: settings.modelBase });
      }
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        let parsed: { choices?: { delta?: { content?: unknown }; message?: { content?: unknown } }[]; error?: { message?: string } };
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }
        const choice = parsed?.choices?.[0];
        const delta = choice?.delta ?? choice?.message;
        if (delta && typeof delta.content === "string" && delta.content) opts.onText(delta.content);
        if (parsed?.error) {
          throw new IsnadError({ scope: "model", code: "provider_error", message: String(parsed.error.message ?? "") });
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* already released */
    }
  }
}
