"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, TriangleAlert } from "lucide-react";
import { cn } from "cn";
import { AyahMark, MushafCorners, OctagramLoader } from "@/components/brand/ornaments";
import { Seal } from "@/components/brand/seal";
import { describeFailure } from "@/lib/describe";
import { useT, type T } from "@/lib/i18n/use-t";
import { hasKey } from "@/lib/i18n/translate";
import { renderMarkdown } from "@/lib/markdown";
import { languageLabel, shortHash, sourceLabel, statusInfo, TONE_BORDER, versionText } from "@/lib/status";
import type { Evidence, Failure, Report } from "@/lib/types";

/* ------------------------------------------------------------------ pieces */

function Ref({ children, className }: { children: React.ReactNode; className?: string }) {
  return <bdi className={cn("ref", className)}>{children}</bdi>;
}

/* The source's wording, set the way it is read: Arabic on an ivory mushaf
   page in the Qur'anic face; a translation on the same page in the text face.
   The words are the source's, byte for byte. */
function SourcePage({ evidence, report }: { evidence: Evidence; report: Report }) {
  const t = useT();
  const arabic = report.language === "ar";
  return (
    <figure className="mushaf relative overflow-hidden rounded-xl px-6 pb-5 pt-7 sm:px-10">
      <MushafCorners />
      <blockquote
        lang={arabic ? "ar" : "en"}
        dir={arabic ? "rtl" : "ltr"}
        className={cn(
          "evidence-text relative",
          arabic ? "scripture text-center text-[1.6rem] sm:text-[1.75rem]" : "text-start text-[1.05rem] leading-8",
        )}
      >
        {evidence.source_text}
        {arabic && report.sourceType === "quran" ? <AyahMark reference={evidence.reference} /> : null}
      </blockquote>
      <figcaption className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <Ref className="font-semibold text-gold-ink">{evidence.reference || t("evidence.unknownRef")}</Ref>
        {evidence.source_url ? (
          <a href={evidence.source_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
            {evidence.source_id}
            <ExternalLink className="size-3" />
          </a>
        ) : (
          <span>{evidence.source_id}</span>
        )}
      </figcaption>
      {evidence.matched_fragment && evidence.matched_fragment !== evidence.source_text ? (
        <p className="mt-3 border-t border-mushaf-line pt-3 text-center text-sm text-muted-foreground">
          {t("evidence.fragment")}
          <span dir="auto" className={cn(arabic && "scripture text-lg text-foreground")}>
            {evidence.matched_fragment}
          </span>
        </p>
      ) : null}
    </figure>
  );
}

/* The chain of transmission for this check: what was submitted, where it was
   said to be, and the pinned edition that answered. It is a real sequence. */
function Chain({ report }: { report: Report }) {
  const t = useT();
  const meta = report.sourceMetadata;
  const matchedElsewhere =
    report.matchedReferences.length > 0 && report.citedReference && !report.matchedReferences.includes(report.citedReference);
  const steps = [
    {
      label: t("result.quotedText"),
      value: report.submittedQuote ? (
        <span dir="auto" className="line-clamp-1">
          {report.submittedQuote}
        </span>
      ) : (
        <span className="text-muted-foreground">{t("result.noQuote")}</span>
      ),
    },
    {
      label: matchedElsewhere ? t("result.matchedRefs") : t("result.citedRef"),
      value: matchedElsewhere ? (
        <span className="flex flex-wrap items-center gap-1.5">
          <Ref className="text-muted-foreground line-through decoration-mismatch/70">{report.citedReference}</Ref>
          {report.matchedReferences.map((r) => (
            <Ref key={r} className="font-semibold">
              {r}
            </Ref>
          ))}
        </span>
      ) : report.citedReference ? (
        <Ref className="font-semibold">{report.citedReference}</Ref>
      ) : (
        <span className="text-muted-foreground">{t("result.noRef")}</span>
      ),
    },
    {
      label: t("result.source"),
      value: meta ? (
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5">
          {meta.url ? (
            <a href={meta.url} target="_blank" rel="noopener noreferrer nofollow" className="truncate underline-offset-4 hover:underline">
              {meta.display_name || meta.name}
            </a>
          ) : (
            <span className="truncate">{meta.display_name || meta.name}</span>
          )}
          {meta.version ? <Ref className="text-muted-foreground">{versionText(meta.version)}</Ref> : null}
        </span>
      ) : (
        <span className="text-muted-foreground">{t("result.notReported")}</span>
      ),
    },
  ];
  return (
    <ol className="grid gap-3 sm:grid-cols-3 sm:gap-0">
      {steps.map((step, i) => (
        <li key={step.label} className="relative min-w-0 ps-5 sm:pe-4">
          {/* the link to the next step */}
          {i < steps.length - 1 ? (
            <span className="absolute start-[5px] top-4 h-[calc(100%+0.25rem)] w-px bg-border sm:start-3 sm:top-[5px] sm:h-px sm:w-[calc(100%-0.75rem)]" aria-hidden="true" />
          ) : null}
          <span className="absolute start-0 top-1 size-[11px] rounded-full border-2 border-gold bg-card" aria-hidden="true" />
          <span className="block text-xs text-muted-foreground sm:pt-4">{step.label}</span>
          <span className="mt-0.5 block min-w-0 text-sm">{step.value}</span>
        </li>
      ))}
    </ol>
  );
}

function diffKind(t: T, kind?: string) {
  const key = `diff.kind.${kind}`;
  return hasKey(key) ? t(key) : (kind ?? t("diff.difference")).replace(/_/g, " ");
}

function Differences({ report }: { report: Report }) {
  const t = useT();
  if (!report.wordingDifferences.length) return null;
  const arabic = report.language === "ar";
  return (
    <section>
      <h4 className="mb-2 font-sans text-sm font-medium text-muted-foreground">{t("result.differences")}</h4>
      <ul className="grid gap-2">
        {report.wordingDifferences.map((d, i) => (
          <li key={i} className="grid gap-1.5 rounded-xl bg-muted/60 p-3 sm:grid-cols-[7.5rem_1fr_1fr] sm:items-start sm:gap-3">
            <span className="text-xs font-medium text-muted-foreground sm:pt-1.5">{diffKind(t, d.kind)}</span>
            <p className="diff-submitted rounded-lg border-s-[3px] border-partial bg-partial-soft px-3 py-1.5 text-sm" data-side="submitted">
              <span className="sr-only">{t("diff.submitted")}</span>
              <span dir="auto" className={cn(arabic && "scripture text-lg leading-9")}>
                {d.submitted_text || "—"}
              </span>
            </p>
            <p className="diff-source rounded-lg border-s-[3px] border-match bg-match-soft px-3 py-1.5 text-sm" data-side="source">
              <span className="sr-only">{t("diff.source")}</span>
              <span dir="auto" className={cn(arabic && "scripture text-lg leading-9")}>
                {d.source_text || "—"}
              </span>
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-partial" />
          {t("diff.submitted").replace(/[:：]\s*$/, "")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-match" />
          {t("diff.source").replace(/[:：]\s*$/, "")}
        </span>
      </p>
    </section>
  );
}

function Details({ report, durationMs }: { report: Report; durationMs?: number | null }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const meta = report.sourceMetadata;
  const rows: [string, React.ReactNode][] = [];
  if (report.explanation) {
    rows.push([t("msg.statusLine"), <div key="e" className="prose-chat" dangerouslySetInnerHTML={{ __html: renderMarkdown(report.explanation) }} />]);
  }
  rows.push(["status", <code key="s" className="ref text-xs">{report.status}</code>]);
  if (meta?.license) rows.push([t("result.source"), <span key="l" dir="auto">{meta.license}</span>]);
  if (meta?.content_sha256) rows.push(["SHA-256", <Ref key="h" className="text-xs">{shortHash(meta.content_sha256)}</Ref>]);
  if (meta?.coverage_note) rows.push([t("result.coverage"), <span key="c" dir="auto">{meta.coverage_note}</span>]);
  if (typeof report.candidateCount === "number" && report.candidateCount > 0) {
    rows.push(["", <span key="n">{t("result.candidates", { n: report.candidateCount })}{report.evidenceTruncated ? ` · ${t("result.partialCoverage")}` : ""}</span>]);
  }
  if (typeof durationMs === "number") rows.push(["", <span key="d">{t.duration(durationMs)}</span>]);
  for (const e of report.evidence) {
    const rec: [string, string | null | undefined][] = [
      ["evidence.recordTitle", e.record_title],
      ["evidence.attribution", e.attribution_text],
      ["evidence.bibliographic", e.bibliographic_reference],
      ["evidence.grade", e.grade_text],
      ["evidence.gradeSource", e.grade_source],
      ["evidence.gradedBy", e.graded_by],
      ["evidence.footnotes", e.footnotes],
    ];
    for (const [key, value] of rec) if (value) rows.push([t(key), <span key={key + e.reference} dir="auto">{value}</span>]);
  }
  const graded = report.evidence.some((e) => e.grade_text || e.graded_by || e.grade_source);

  return (
    <div className="border-t border-border/70 pt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        {t("report.details")}
      </button>
      {open ? (
        <div className="pb-1">
          <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-[minmax(7rem,auto)_1fr]">
            {rows.map(([label, value], i) => (
              <div key={i} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="min-w-0 break-words">{value}</dd>
              </div>
            ))}
          </dl>
          {!graded && report.sourceType === "hadith" ? <p className="mt-3 text-xs text-muted-foreground">{t("evidence.noGrade")}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- the card */

export function ReportCard({ report, durationMs, className }: { report: Report; durationMs?: number | null; className?: string }) {
  const t = useT();
  const info = statusInfo(t, report.status);
  const showDiffs = report.status !== "exact_match";
  return (
    <article
      className={cn("report-card overflow-hidden rounded-2xl border border-border border-s-4 bg-card shadow-[0_1px_2px_rgb(10_59_44/0.05)]", TONE_BORDER[info.tone], className)}
      data-tone={info.tone}
      data-status={report.status}
    >
      <header className="flex items-start gap-3.5 p-4 pb-3 sm:p-5 sm:pb-3">
        <Seal tone={info.tone} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="report-status font-heading text-[1.05rem] font-bold leading-snug">{info.label}</h3>
            <span className="text-xs text-muted-foreground">
              {sourceLabel(t, report.sourceType)} · {languageLabel(t, report.language)}
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{info.meaning}</p>
        </div>
      </header>

      <div className="grid gap-4 px-4 pb-4 sm:px-5 sm:pb-5">
        {report.evidence.length ? (
          report.evidence.map((e, i) => <SourcePage key={i} evidence={e} report={report} />)
        ) : (
          <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">{t("result.noEvidence")}</p>
        )}
        <Chain report={report} />
        {showDiffs ? <Differences report={report} /> : null}
        <Details report={report} durationMs={durationMs} />
      </div>
    </article>
  );
}

export function CheckingCard({ reference, text }: { reference?: string | null; text: string }) {
  const t = useT();
  return (
    <article className="checking-card flex items-center gap-4 rounded-2xl border border-dashed border-gold/50 bg-gold-soft/40 p-4 sm:p-5" role="status">
      <OctagramLoader className="size-10 shrink-0 text-gold" />
      <div className="min-w-0">
        <p className="font-heading text-[0.98rem] font-semibold">
          {t("citation.checking")}
          {reference ? (
            <>
              {" "}
              <Ref className="text-gold-ink">{reference}</Ref>
            </>
          ) : null}
        </p>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </article>
  );
}

export function FailureCard({ failure, fromDisk }: { failure: Failure; fromDisk?: boolean }) {
  const t = useT();
  const d = describeFailure(t, failure, { fromDisk });
  return (
    <article className={cn("failure-card rounded-2xl border p-4 sm:p-5", d.cancelled ? "border-border bg-muted/50" : "border-mismatch/30 bg-mismatch-soft/50")}>
      <div className="flex items-start gap-3">
        <TriangleAlert className={cn("mt-0.5 size-5 shrink-0", d.cancelled ? "text-muted-foreground" : "text-mismatch")} />
        <div className="min-w-0">
          <h3 className="font-heading text-[0.98rem] font-bold">{d.title}</h3>
          <p className="mt-1 text-sm">{d.message}</p>
          {d.detail ? (
            <p className="mt-1.5 text-xs text-muted-foreground" dir="auto">
              {d.detail}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">{t("error.nothingDecided")}</p>
        </div>
      </div>
    </article>
  );
}
