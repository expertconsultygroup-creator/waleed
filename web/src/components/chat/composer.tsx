"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, BadgeCheck, MessageCircle, Square } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { quoteLimit, sendMessage, stopGeneration, submitVerify, validateVerify } from "@/lib/actions";
import { useT } from "@/lib/i18n/use-t";
import { modelConfigured, persist, useIsnad } from "@/lib/store";
import { useUi } from "@/lib/ui";

export function Composer() {
  const t = useT();
  const mode = useIsnad((s) => s.mode);
  const running = useIsnad((s) => s.running);
  const configured = useIsnad(modelConfigured);
  const capabilities = useIsnad((s) => s.capabilities);
  const draft = useUi((s) => s.draft);
  const openSettings = useUi((s) => s.openSettings);

  const [text, setText] = useState("");
  const [source, setSource] = useState("quran");
  const [language, setLanguage] = useState("ar");
  const [reference, setReference] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const verify = mode === "verify";
  const limit = quoteLimit();

  // "Edit and resend" hands its text over here: taken once per hand-over.
  const [takenDraft, setTakenDraft] = useState(0);
  if (draft && draft.nonce !== takenDraft) {
    setTakenDraft(draft.nonce);
    setText(draft.text);
  }
  useEffect(() => {
    if (!draft) return;
    useIsnad.getState().setMode("chat");
    window.setTimeout(() => field.current?.focus(), 30);
  }, [draft]);

  useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [text, mode]);

  const pair = capabilities?.sources?.find((s) => s.source_type === source && s.language === language);
  const request = { source_type: source, language, quote: text, reference };
  const problem = verify ? validateVerify(request) : null;
  const canSend = verify ? !problem && !running.active : configured && !!text.trim() && !running.active;

  const submit = async () => {
    if (verify) {
      const error = submitVerify(request);
      if (error) {
        toast.error(error);
        return;
      }
      setText("");
      return;
    }
    if (!configured) {
      openSettings("model");
      return;
    }
    if (await sendMessage(text)) setText("");
  };

  const setMode = (next: "chat" | "verify") => {
    useIsnad.getState().setMode(next);
    persist();
    window.setTimeout(() => field.current?.focus(), 20);
  };

  const hint = verify
    ? !pair
      ? capabilities
        ? t("composer.hintNoAdapter")
        : t("composer.hintDefault")
      : reference.trim()
        ? t("composer.hintFormat", { format: pair.reference_format })
        : t("composer.hintOptional")
    : t("composer.hintChat");

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background from-60% to-transparent px-2 pb-2 pt-8 sm:px-6 sm:pb-5 sm:pt-10">
      <form
        className="pointer-events-auto mx-auto max-w-3xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) void submit();
        }}
      >
        <div className="rounded-[1.4rem] border border-border bg-card shadow-float transition focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10">
          <div className="flex items-center justify-between gap-3 px-3 pt-3">
            <div role="radiogroup" aria-label={t("mode.label")} className="inline-flex rounded-full bg-muted p-1">
              {(["chat", "verify"] as const).map((m) => {
                const Icon = m === "chat" ? MessageCircle : BadgeCheck;
                const active = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    id={m === "chat" ? "mode-chat" : "mode-verify"}
                    onClick={() => setMode(m)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition",
                      active ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    {t(m === "chat" ? "mode.chat" : "mode.verify")}
                  </button>
                );
              })}
            </div>
            <span className={cn("ref text-xs", text.length > limit ? "text-mismatch" : "text-muted-foreground")} aria-label={t("composer.charCount")}>
              {t.number(text.length)} / {t.number(limit)}
            </span>
          </div>

          {verify ? (
            <div className="grid grid-cols-3 gap-2 px-3 pt-3 sm:grid-cols-[1fr_1fr_1.4fr]">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">{t("verify.source")}</span>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger id="verify-source" className="h-10 w-full rounded-xl bg-raised">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quran">{t("verify.quran")}</SelectItem>
                    <SelectItem value="hadith">{t("verify.hadith")}</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">{t("verify.language")}</span>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="verify-language" className="h-10 w-full rounded-xl bg-raised">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">{t("verify.arabic")}</SelectItem>
                    <SelectItem value="en">{t("verify.english")}</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("verify.reference")} <span className="font-normal opacity-70">{t("verify.optional")}</span>
                </span>
                <input
                  id="verify-reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={64}
                  dir="ltr"
                  spellCheck={false}
                  autoComplete="off"
                  placeholder={pair?.reference_format?.slice(0, 40) || "2:255"}
                  className="ref h-10 rounded-xl border border-input bg-raised px-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-3 focus:ring-primary/15 rtl:text-right"
                />
              </label>
            </div>
          ) : null}

          <label htmlFor="composer-input" className="sr-only">
            {t("composer.label")}
          </label>
          <textarea
            id="composer-input"
            ref={field}
            rows={1}
            dir="auto"
            value={text}
            maxLength={4000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (canSend) void submit();
                else if (verify && problem) toast.error(problem);
              }
            }}
            placeholder={verify ? t("composer.placeholderVerify") : t("composer.placeholderChat")}
            className={cn(
              "block max-h-56 min-h-14 w-full resize-none bg-transparent px-4 pt-3 text-[1.02rem] leading-relaxed outline-none placeholder:text-muted-foreground/80",
              verify && language === "ar" && "font-scripture text-xl leading-10",
            )}
          />

          <div className="flex items-end justify-end gap-3 px-3 pb-3 pt-1">
            <p className="hidden min-w-0 flex-1 ps-1 text-xs leading-relaxed text-muted-foreground sm:block" id="composer-hint">
              {hint}
            </p>
            {running.active && running.kind === "chat" ? (
              <Button type="button" variant="outline" onClick={stopGeneration} className="h-10 rounded-full px-4" id="stop-button">
                <Square className="size-3.5 fill-current" />
                {t("composer.stop")}
              </Button>
            ) : (
              <Button
                type="submit"
                id="send-button"
                disabled={!canSend}
                title={verify ? problem ?? t("composer.verifyTitle") : configured ? t("composer.send") : t("composer.configureFirst")}
                className="h-10 rounded-full px-4 text-[0.95rem] font-semibold shadow-[0_8px_18px_-10px_rgb(14_107_79/0.8)]"
              >
                {verify ? <BadgeCheck className="size-[18px]" /> : <ArrowUp className="size-[18px]" strokeWidth={2.4} />}
                {verify ? t("composer.verify") : t("composer.send")}
              </Button>
            )}
          </div>
        </div>
        <p className="mx-auto mt-2 hidden max-w-2xl text-center text-[0.72rem] leading-relaxed text-muted-foreground sm:block" id="disclaimer">
          {t("composer.note")}
        </p>
      </form>
    </div>
  );
}
