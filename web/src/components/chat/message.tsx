"use client";

import { memo } from "react";
import { Copy, Info, Pencil, RotateCcw, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Khatam } from "@/components/brand/ornaments";
import { regenerate, runVerify } from "@/lib/actions";
import { describeBase } from "@/lib/api";
import { describeFailure } from "@/lib/describe";
import { useT, type T } from "@/lib/i18n/use-t";
import { renderMarkdown } from "@/lib/markdown";
import { languageLabel, sourceLabel, statusInfo } from "@/lib/status";
import { persist, useIsnad } from "@/lib/store";
import type { Citation, Item, Part } from "@/lib/types";
import { useUi } from "@/lib/ui";
import { CheckingCard, FailureCard, ReportCard } from "./report";

function copy(t: T, text: string, okKey = "copy.copied") {
  if (!navigator.clipboard?.writeText) return toast.error(t("copy.unavailable"));
  navigator.clipboard.writeText(text).then(
    () => toast.success(t(okKey)),
    () => toast.error(t("copy.failed")),
  );
}

function Action({ label, onClick, children, pressed }: { label: string; onClick: () => void; children: React.ReactNode; pressed?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          aria-label={label}
          aria-pressed={pressed}
          className={cn("size-8 rounded-lg text-muted-foreground hover:text-foreground", pressed && "bg-secondary text-secondary-foreground")}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/* Copied text carries the source's wording with its status: the model's own
   version of a quotation is never repeated as if it were one. */
function plainText(t: T, entry: Item): string {
  const parts: string[] = [];
  if (entry.text) parts.push(entry.text);
  for (const c of entry.citations ?? []) {
    if (c.state === "done" && c.report) {
      const ref = c.report.matchedReferences[0] || c.report.citedReference || "";
      const text = c.report.evidence[0]?.source_text ?? "";
      parts.push(`[${ref || t("citation.kind")}] ${[text, statusInfo(t, c.report.status).label].filter(Boolean).join(" — ")}`);
    } else if (c.state === "error" && c.error) {
      parts.push(t("citation.notCheckedPlain", { title: describeFailure(t, c.error).title }));
    }
  }
  return parts.join("\n\n").trim();
}

function statsLine(t: T, entry: Item): string {
  const d = entry.statsData;
  if (!d) return entry.stats ?? "";
  return [
    t.duration(d.elapsedMs),
    t("msg.statsChecked", { n: d.checked || 0 }),
    d.failed ? t("msg.statsFailed", { n: d.failed }) : "",
    d.stopped ? t("msg.statsStopped") : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function partsOf(entry: Item): Part[] {
  if (entry.parts?.length) return entry.parts;
  const parts: Part[] = [];
  if (entry.text) parts.push({ kind: "prose", text: entry.text });
  for (const c of entry.citations ?? []) parts.push({ kind: "citation", id: c.id });
  return parts;
}

function CitationSlot({ citation }: { citation: Citation }) {
  const t = useT();
  if (citation.state === "checking") return <CheckingCard reference={citation.header.reference} text={t("citation.holding")} />;
  if (citation.state === "error" && citation.error) return <FailureCard failure={citation.error} />;
  if (citation.report) return <ReportCard report={citation.report} durationMs={citation.durationMs} />;
  return null;
}

function Meta({ who, entry }: { who: string; entry: Item }) {
  const t = useT();
  const showTime = useIsnad((s) => s.settings.showTimestamps);
  return (
    <div className="flex items-baseline gap-2.5 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">{who}</span>
      {showTime && entry.createdAt ? <time dateTime={new Date(entry.createdAt).toISOString()}>{t.time(entry.createdAt)}</time> : null}
      {entry.model && entry.kind === "assistant" ? <span className="ref truncate">{entry.model}</span> : null}
    </div>
  );
}

function UserMessage({ entry, chatId }: { entry: Item; chatId: string }) {
  const t = useT();
  const setDraft = useUi((s) => s.setDraft);
  return (
    <div className="group/msg flex flex-col items-start gap-1.5" id={`m-${entry.id}`}>
      <Meta who={t("msg.you")} entry={entry} />
      <div className="max-w-[min(42rem,92%)] rounded-2xl rounded-ss-md bg-secondary px-4 py-2.5 text-secondary-foreground">
        <p dir="auto" className="whitespace-pre-wrap break-words">
          {entry.text}
        </p>
      </div>
      <div className="flex opacity-0 transition-opacity group-focus-within/msg:opacity-100 group-hover/msg:opacity-100 [@media(pointer:coarse)]:opacity-100">
        <Action
          label={t("msg.edit")}
          onClick={() => {
            useIsnad.getState().truncateAfter(chatId, entry.id, true);
            persist();
            setDraft(entry.text ?? "");
          }}
        >
          <Pencil className="size-4" />
        </Action>
        <Action label={t("msg.copyMessage")} onClick={() => copy(t, entry.text ?? "")}>
          <Copy className="size-4" />
        </Action>
      </div>
    </div>
  );
}

function AssistantMessage({ entry, chatId }: { entry: Item; chatId: string }) {
  const t = useT();
  const running = useIsnad((s) => s.running.active);
  const setPromptOpen = useUi((s) => s.setPromptOpen);
  const parts = partsOf(entry);
  const citations = entry.citations ?? [];
  const streaming = entry.kind === "pending" || entry.kind === "streaming";
  // The n-th citation part shows the n-th citation, in the order written.
  const slots = parts.reduce<(Citation | undefined)[]>((acc, part) => {
    const seen = acc.filter((_, i) => parts[i].kind === "citation").length;
    acc.push(part.kind === "citation" ? citations[seen] ?? citations.find((c) => c.id === part.id) : undefined);
    return acc;
  }, []);

  const feedback = (value: "up" | "down") => {
    const next = entry.feedback === value ? null : value;
    useIsnad.getState().updateItem(chatId, entry.id, { feedback: next });
    if (next) toast.success(t("msg.feedbackThanks"));
  };

  return (
    <div className="group/msg flex gap-3" id={`m-${entry.id}`} data-kind={entry.kind}>
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-mihrab text-gold" aria-hidden="true">
        <Khatam className="size-6" />
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <Meta who={t("msg.isnad")} entry={entry} />
        {entry.kind === "pending" ? (
          <div className="flex gap-1.5 py-2" role="status" aria-label={t("msg.waiting")}>
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-2 animate-bounce rounded-full bg-primary/60" style={{ animationDelay: `${i * 140}ms` }} />
            ))}
          </div>
        ) : null}
        <div className="assistant-content space-y-3">
          {parts.map((part, i) => {
            if (part.kind === "prose") {
              return part.text.trim() ? (
                <div key={i} className="prose-chat text-[1.02em] leading-[1.85]" dangerouslySetInnerHTML={{ __html: renderMarkdown(part.text) }} />
              ) : null;
            }
            const citation = slots[i];
            return citation ? (
              <div key={i} className="citation-slot">
                <CitationSlot citation={citation} />
              </div>
            ) : null;
          })}
        </div>
        {entry.kind === "error" && entry.error ? <FailureCard failure={entry.error} /> : null}
        {entry.kind === "assistant" && (entry.statsData || entry.stats) ? (
          <p className="text-xs text-muted-foreground">{statsLine(t, entry)}</p>
        ) : null}
        {!streaming ? (
          <div className="-ms-2 flex flex-wrap opacity-0 transition-opacity group-focus-within/msg:opacity-100 group-hover/msg:opacity-100 [@media(pointer:coarse)]:opacity-100">
            <Action label={t("msg.copyReply")} onClick={() => copy(t, plainText(t, entry))}>
              <Copy className="size-4" />
            </Action>
            <Action label={t("msg.regenerate")} onClick={() => !running && regenerate(chatId, entry.id)}>
              <RotateCcw className="size-4" />
            </Action>
            <Action label={t("msg.good")} onClick={() => feedback("up")} pressed={entry.feedback === "up"}>
              <ThumbsUp className="size-4" />
            </Action>
            <Action label={t("msg.poor")} onClick={() => feedback("down")} pressed={entry.feedback === "down"}>
              <ThumbsDown className="size-4" />
            </Action>
            <Action label={t("msg.prompt")} onClick={() => setPromptOpen(true)}>
              <Info className="size-4" />
            </Action>
            <Action label={t("msg.remove")} onClick={() => useIsnad.getState().removeItem(chatId, entry.id)}>
              <Trash2 className="size-4" />
            </Action>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ToolItem({ entry, chatId }: { entry: Item; chatId: string }) {
  const t = useT();
  if (entry.kind === "request" && entry.request) {
    const r = entry.request;
    return (
      <div className="flex flex-col items-start gap-1.5" id={`m-${entry.id}`}>
        <Meta who={t("msg.handCheck")} entry={entry} />
        <div className="max-w-[min(42rem,92%)] rounded-2xl rounded-ss-md bg-secondary px-4 py-2.5 text-secondary-foreground">
          <p dir="auto" className={cn("whitespace-pre-wrap break-words", r.language === "ar" && "scripture text-xl leading-10")}>
            {r.quote || t("result.referenceOnly")}
          </p>
          <p className="mt-2 flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-full bg-card/70 px-2 py-0.5">{sourceLabel(t, r.source_type)}</span>
            <span className="rounded-full bg-card/70 px-2 py-0.5">{languageLabel(t, r.language)}</span>
            {r.reference ? <bdi className="ref rounded-full bg-card/70 px-2 py-0.5 font-semibold">{r.reference}</bdi> : null}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3" id={`m-${entry.id}`}>
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-mihrab text-gold" aria-hidden="true">
        <Khatam className="size-6" />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <Meta who={t("msg.isnad")} entry={entry} />
        {entry.kind === "pending" ? <CheckingCard reference={entry.request?.reference} text={t("result.waitingApi", { base: describeBase() })} /> : null}
        {entry.kind === "report" && entry.report ? <ReportCard report={entry.report} durationMs={entry.durationMs} /> : null}
        {entry.kind === "error" && entry.error ? (
          <>
            <FailureCard failure={entry.error} />
            {entry.request ? (
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => runVerify(chatId, entry.request!, { afterItemId: entry.id })}>
                <RotateCcw className="size-3.5" />
                {t("msg.retry")}
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

export const Message = memo(function Message({ entry, chatId }: { entry: Item; chatId: string }) {
  if (entry.role === "user") return <UserMessage entry={entry} chatId={chatId} />;
  if (entry.role === "tool") return <ToolItem entry={entry} chatId={chatId} />;
  return <AssistantMessage entry={entry} chatId={chatId} />;
});
