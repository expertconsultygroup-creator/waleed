"use client";

import { BookOpen, MessageCircleQuestion, ScrollText, TriangleAlert } from "lucide-react";
import { cn } from "cn";
import { Rosette } from "@/components/brand/ornaments";
import { Seal } from "@/components/brand/seal";
import { sendMessage } from "@/lib/actions";
import { useT } from "@/lib/i18n/use-t";
import { languageLabel, sourceLabel, STATUS_ORDER, statusInfo, versionText } from "@/lib/status";
import { modelConfigured, useIsnad } from "@/lib/store";
import { useUi } from "@/lib/ui";

function ApiNotice() {
  const t = useT();
  const apiState = useIsnad((s) => s.apiState);
  if (apiState !== "unavailable") return null;
  return (
    <p className="flex items-start gap-2.5 rounded-xl border border-partial/30 bg-partial-soft px-4 py-3 text-start text-sm text-foreground">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-partial" />
      {t("empty.apiDown")}
    </p>
  );
}

/* The first screen: what Isnad does, said once, with the rosette drawing
   itself behind the headline — the page's single orchestrated moment. */
export function ChatWelcome() {
  const t = useT();
  const configured = useIsnad(modelConfigured);
  const capabilities = useIsnad((s) => s.capabilities);
  const openSettings = useUi((s) => s.openSettings);
  const suggestions = capabilities?.chat_prompt_suggestions?.length
    ? capabilities.chat_prompt_suggestions.map((p, i) => ({ ...p, icon: [BookOpen, ScrollText, MessageCircleQuestion][i % 3] }))
    : [
        { label: t("empty.suggestVerse"), text: t("empty.suggestVerseText"), icon: BookOpen },
        { label: t("empty.suggestHadith"), text: t("empty.suggestHadithText"), icon: ScrollText },
        { label: t("empty.suggestAsk"), text: t("empty.suggestAskText"), icon: MessageCircleQuestion },
      ];
  const steps = [t("welcome.step1"), t("welcome.step2"), t("welcome.step3")];

  return (
    <div className="welcome relative mx-auto flex max-w-3xl flex-col items-center px-1 pt-4 text-center sm:px-2 sm:pt-10">
      <Rosette animate className="pointer-events-none absolute -top-2 left-1/2 -z-0 size-[18rem] -translate-x-1/2 text-gold/25 sm:-top-4 sm:size-[26rem] sm:text-gold/35" />
      <div className="relative">
        <h2 className="empty-title mx-auto max-w-2xl font-heading text-[1.85rem] font-bold leading-[1.35] sm:text-[2.5rem] [:lang(en)_&]:text-[1.7rem] [:lang(en)_&]:sm:text-[2.15rem] [:lang(en)_&]:leading-tight">
          {configured ? t("welcome.title") : t("welcome.connectTitle")}
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[1.02rem] leading-relaxed text-muted-foreground">
          {configured ? t("empty.chatSub") : t("empty.connectSub")}
        </p>
      </div>

      <ol className="relative mt-10 grid w-full gap-3 text-start sm:grid-cols-3 sm:gap-0" aria-label={t("welcome.stepsLabel")}>
        {steps.map((step, i) => (
          <li key={i} className="relative flex items-center gap-3 sm:flex-col sm:items-center sm:gap-2 sm:px-3 sm:text-center">
            {i < steps.length - 1 ? (
              <span className="absolute start-[1.05rem] top-9 h-[calc(100%-1.5rem)] w-px bg-gold/40 sm:start-[calc(50%+1.4rem)] sm:top-[1.05rem] sm:h-px sm:w-[calc(100%-2.8rem)]" aria-hidden="true" />
            ) : null}
            <span className="relative grid size-[2.1rem] shrink-0 place-items-center rounded-full border border-gold/60 bg-card font-heading text-sm font-bold text-gold-ink">
              {t.number(i + 1)}
            </span>
            <span className="text-sm leading-snug text-foreground/85">{step}</span>
          </li>
        ))}
      </ol>

      <div className="relative mt-10 w-full">
        <ApiNotice />
        <h3 className="sr-only">{t("welcome.tryLabel")}</h3>
        <ul className="mt-3 grid gap-2.5 sm:grid-cols-3">
          {suggestions.map(({ label, text, icon: Icon }) => (
            <li key={text}>
              <button
                type="button"
                onClick={() => (configured ? void sendMessage(text) : openSettings("model"))}
                className="suggestion group flex h-full w-full flex-col gap-2 rounded-2xl border border-border bg-card p-4 text-start transition hover:border-primary/40 hover:bg-raised focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span className="flex items-center gap-2 text-xs font-semibold text-gold-ink">
                  <Icon className="size-4" />
                  {label}
                </span>
                <span className="text-[0.95rem] leading-relaxed text-foreground" dir="auto">
                  {text}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function VerifyWelcome() {
  const t = useT();
  const capabilities = useIsnad((s) => s.capabilities);
  const apiState = useIsnad((s) => s.apiState);
  return (
    <div className="welcome mx-auto max-w-3xl px-2 pt-6 sm:pt-10">
      <div className="text-center">
        <h2 className="empty-title font-heading text-[1.9rem] font-bold leading-[1.4] sm:text-[2.3rem]">{t("empty.verifyTitle")}</h2>
        <p className="mx-auto mt-3 max-w-xl text-[1.02rem] leading-relaxed text-muted-foreground">{t("empty.verifySub")}</p>
      </div>

      <div className="mt-8">
        <ApiNotice />
      </div>

      {capabilities?.sources?.length ? (
        <section className="mt-6">
          <h3 className="mb-3 font-heading text-base font-bold">{t("verify.sourcesTitle")}</h3>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {capabilities.sources.map((s) => (
              <li key={`${s.source_type}-${s.language}`} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium" dir="auto">
                    {s.display_name || s.name}
                  </span>
                  <bdi className="ref shrink-0 text-xs text-muted-foreground">{versionText(s.source_version)}</bdi>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {sourceLabel(t, s.source_type)} · {languageLabel(t, s.language)}
                </p>
                <p className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{t("verify.formatLabel")}</span>
                  <bdi className="ref rounded-md bg-muted px-1.5 py-0.5">{s.reference_format}</bdi>
                </p>
                {s.coverage_note ? (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground" dir="auto">
                    {s.coverage_note}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : apiState === "checking" ? (
        <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : null}

      <section className="mt-8">
        <h3 className="mb-3 font-heading text-base font-bold">{t("verify.statusTitle")}</h3>
        <ul className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border">
          {STATUS_ORDER.map((status) => {
            const info = statusInfo(t, status);
            return (
              <li key={status} className="flex items-start gap-3 bg-card p-3.5">
                <Seal tone={info.tone} className="size-8" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{info.label}</p>
                  <p className="text-[0.82rem] leading-relaxed text-muted-foreground">{info.meaning}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <p className={cn("mt-3 text-xs text-muted-foreground")}>{t("empty.statusGuideNote")}</p>
      </section>
    </div>
  );
}
