"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, BadgeCheck, Download, MessageCircle, ServerCog, Smartphone } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lattice, Rosette } from "@/components/brand/ornaments";
import { Seal } from "@/components/brand/seal";
import { Api, describeBase, type ServerStats } from "@/lib/api";
import { deviceModel, deviceRecords, matchedCount, reviewCount, serverModel, type DashboardModel } from "@/lib/dashboard";
import { download } from "@/lib/export";
import { KHATAM_INNER, starOutline } from "@/lib/geometry";
import { useT, type T } from "@/lib/i18n/use-t";
import { languageLabel, NEEDS_REVIEW, shortHash, sourceLabel, STATUS_ORDER, statusInfo, TONE_FILL, TONE_SOFT, versionText } from "@/lib/status";
import { modelConfigured, useIsnad } from "@/lib/store";

const GAUGE_PATH = starOutline(60, 60, 56, 56 * KHATAM_INNER, 8);

/* The match rate drawn on the khatam: gold traces the star's outline as far
   as the rate goes. */
function StarGauge({ ratio, label }: { ratio: number; label: string }) {
  const value = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className="relative size-36 shrink-0 sm:size-40">
      <svg viewBox="0 0 120 120" className="size-full" aria-hidden="true">
        <path d={GAUGE_PATH} pathLength={100} fill="rgb(255 255 255 / 0.04)" stroke="rgb(255 255 255 / 0.14)" strokeWidth="2.5" strokeLinejoin="round" />
        <path
          d={GAUGE_PATH}
          pathLength={100}
          fill="none"
          stroke="var(--gold)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray={`${value} 100`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-heading text-[2.2rem] font-bold leading-none text-white sm:text-[2.5rem]">{label}</p>
        </div>
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const step = 100 / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(2)},${(26 - (v / max) * 22).toFixed(2)}`);
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-8 w-full rtl:-scale-x-100" aria-hidden="true">
      <path d={`M0,28L${pts.join("L")}L100,28Z`} fill="var(--gold-soft)" />
      <polyline points={pts.join(" ")} fill="none" stroke="var(--gold)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function Hero({ model }: { model: DashboardModel }) {
  const t = useT();
  const matched = matchedCount(model);
  const review = reviewCount(model);
  const rate = model.total ? matched / model.total : 0;
  const totals = model.days.map((d) => d.matched + d.review + d.other);
  const stats = [
    { label: t("dash.kpiChecked"), value: t.number(model.total), hint: model.notChecked ? t("dash.kpiNotChecked", { n: model.notChecked }) : "" },
    { label: t("dash.kpiReview"), value: t.number(review), hint: t("dash.kpiReviewHint"), alert: review > 0 },
    { label: t("dash.kpiLatency"), value: model.meanLatency == null ? "—" : t.duration(model.meanLatency), hint: "" },
  ];
  return (
    <section className="dash-hero relative overflow-hidden rounded-3xl bg-mihrab text-mihrab-foreground dark:bg-mihrab-2 dark:ring-1 dark:ring-gold/15" aria-label={t("dash.kpiMatchRate")}>
      <div className="pointer-events-none absolute inset-y-0 end-0 w-2/3 text-gold opacity-[0.08] [mask-image:linear-gradient(to_left,#000,transparent)] rtl:[mask-image:linear-gradient(to_right,#000,transparent)]">
        <Lattice className="size-full" />
      </div>
      <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-10">
        <div className="flex items-center gap-5">
          <StarGauge ratio={rate} label={model.total ? t.percent(rate) : "—"} />
          <div>
            <p className="font-heading text-lg font-bold text-white">{t("dash.kpiMatchRate")}</p>
            <p className="mt-1 max-w-[14rem] text-sm leading-relaxed text-mihrab-muted">{t("dash.kpiMatchRateHint")}</p>
          </div>
        </div>
        <dl className="grid grid-cols-3 divide-x divide-gold/25 rounded-2xl bg-white/[0.04] ring-1 ring-white/10 rtl:divide-x-reverse">
          {stats.map((s) => (
            <div key={s.label} className="kpi min-w-0 px-3 py-3.5 sm:px-6 sm:py-4">
              <dt className="text-xs leading-snug text-mihrab-muted sm:text-sm">{s.label}</dt>
              <dd className={cn("kpi-value mt-1.5 font-heading text-xl font-bold sm:text-3xl", s.alert ? "text-[#f3b7ad]" : "text-white")}>{s.value}</dd>
              {s.hint ? <dd className="mt-1 hidden text-[0.72rem] leading-snug text-mihrab-muted md:block">{s.hint}</dd> : null}
            </div>
          ))}
        </dl>
      </div>
      {totals.filter((n) => n > 0).length > 1 ? (
        <div className="relative px-6 pb-4 sm:px-8">
          <Sparkline values={totals} />
        </div>
      ) : null}
    </section>
  );
}

function Panel({ title, children, className, tools }: { title: string; children: React.ReactNode; className?: string; tools?: React.ReactNode }) {
  return (
    <section className={cn("min-w-0 rounded-3xl border border-border bg-card p-5 sm:p-6", className)} aria-label={title}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-heading text-[1.05rem] font-bold">{title}</h3>
        {tools}
      </div>
      {children}
    </section>
  );
}

function Activity({ model }: { model: DashboardModel }) {
  const t = useT();
  const rtl = t.dir === "rtl";
  const data = model.days.map((d) => ({
    day: t.date(d.ts, { day: "numeric", month: "short" }),
    full: t.date(d.ts, { dateStyle: "medium" }),
    matched: d.matched,
    review: d.review,
    other: d.other,
  }));
  const series = [
    { key: "matched", label: t("dash.activityMatched"), color: "var(--match)" },
    { key: "review", label: t("dash.activityReview"), color: "var(--mismatch)" },
    { key: "other", label: t("dash.activityOther"), color: "var(--info)" },
  ];
  return (
    <>
      <div className="h-64 w-full" dir="ltr" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="day" reversed={rtl} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} interval="preserveStartEnd" minTickGap={18} />
            <YAxis
              orientation={rtl ? "right" : "left"}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={28}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickFormatter={(v: number) => t.number(v)}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, direction: rtl ? "rtl" : "ltr", fontFamily: "inherit" }}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ""}
              formatter={(value, name) => [t.number(Number(value)), series.find((s) => s.key === name)?.label ?? String(name)]}
            />
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} stackId="a" fill={s.color} radius={i === series.length - 1 ? [5, 5, 0, 0] : 0} maxBarSize={28} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        {series.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
      <table className="sr-only">
        <caption>{t("dash.activityTitle")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("dash.day")}</th>
            {series.map((s) => (
              <th key={s.key} scope="col">{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.full}>
              <th scope="row">{d.full}</th>
              <td>{t.number(d.matched)}</td>
              <td>{t.number(d.review)}</td>
              <td>{t.number(d.other)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Bars({ rows, caption }: { rows: { key: string; label: string; value: number; fill: string; title?: string }[]; caption: string }) {
  const t = useT();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <>
      <ul className="grid gap-3" aria-hidden="true">
        {rows.map((r) => (
          <li key={r.key} className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5", r.value === 0 && "opacity-55")} title={r.title}>
            <span className="truncate text-sm">{r.label}</span>
            <span className="ref text-sm font-semibold">{t.number(r.value)}</span>
            <span className="col-span-2 h-2 overflow-hidden rounded-full bg-muted">
              <span className={cn("block h-full rounded-full", r.fill)} style={{ width: `${r.value ? Math.max(3, (r.value / max) * 100) : 0}%` }} />
            </span>
          </li>
        ))}
      </ul>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.label}</th>
              <td>{t.number(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Health() {
  const t = useT();
  const apiState = useIsnad((s) => s.apiState);
  const caps = useIsnad((s) => s.capabilities);
  const ready = useIsnad((s) => s.ready);
  const prompt = useIsnad((s) => s.systemPrompt);
  const configured = useIsnad(modelConfigured);
  const modelName = useIsnad((s) => s.settings.modelName);
  const rows: { state: "ok" | "warn" | "down"; name: string; status: string; meta?: React.ReactNode }[] = [
    {
      state: apiState === "ready" ? "ok" : apiState === "checking" ? "warn" : "down",
      name: t("dash.healthApi"),
      status: apiState === "ready" ? t("dash.healthReady") : apiState === "checking" ? t("api.checking") : t("api.unavailable"),
      meta: <bdi className="ref">{describeBase()}{caps?.api_version ? ` · ${versionText(caps.api_version)}` : ""}</bdi>,
    },
  ];
  for (const s of caps?.sources ?? []) {
    const loaded = ready?.sources?.find((r) => r.source_type === s.source_type && r.language === s.language);
    const remote = /remote/.test(s.mode ?? "");
    rows.push({
      state: loaded ? (remote ? "warn" : "ok") : "warn",
      name: s.display_name || s.name,
      status: remote ? t("dash.healthRemote") : loaded ? t("dash.healthLoaded") : t("dash.healthUnknown"),
      meta: (
        <>
          {sourceLabel(t, s.source_type)} · {languageLabel(t, s.language)} · <bdi className="ref">{versionText(s.source_version)}</bdi>
          {loaded?.source_sha256 ? (
            <>
              {" · "}
              <bdi className="ref">sha256 {shortHash(loaded.source_sha256)}</bdi>
            </>
          ) : null}
        </>
      ),
    });
  }
  rows.push({ state: prompt ? "ok" : "down", name: t("dash.healthProtocol"), status: prompt ? t("dash.healthLoaded") : t("prompt.notLoaded"), meta: prompt ? <bdi className="ref">{prompt.version}</bdi> : undefined });
  rows.push({ state: configured ? "ok" : "down", name: t("dash.healthModel"), status: configured ? t("dash.healthReady") : t("model.none"), meta: configured ? <bdi className="ref">{modelName}</bdi> : undefined });

  const dot = { ok: "bg-match shadow-[0_0_0_3px_var(--match-soft)]", warn: "bg-partial shadow-[0_0_0_3px_var(--partial-soft)]", down: "bg-mismatch shadow-[0_0_0_3px_var(--mismatch-soft)]" };
  return (
    <ul className="divide-y divide-border">
      {rows.map((r, i) => (
        <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-3 first:pt-0 last:pb-0">
          <span className={cn("size-2.5 rounded-full", dot[r.state])} aria-hidden="true" />
          <span className="truncate text-sm font-medium" dir="auto">
            {r.name}
          </span>
          <span className="text-xs text-muted-foreground">{r.status}</span>
          {r.meta ? <span className="col-start-2 col-end-4 truncate text-xs text-muted-foreground">{r.meta}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function Flagged({ model, filter }: { model: DashboardModel; filter: string }) {
  const t = useT();
  const router = useRouter();
  if (!model.flagged) return <p className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">{t("dash.flaggedServer")}</p>;
  const rows = model.flagged.filter((r) => !filter || r.report.status === filter).slice(0, 50);
  if (!rows.length) return <p className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">{t("dash.flaggedEmpty")}</p>;
  const open = (chatId: string, itemId: string) => {
    const s = useIsnad.getState();
    s.selectChat(chatId);
    const item = s.chats.find((c) => c.id === chatId)?.items.find((m) => m.id === itemId);
    s.setMode(item?.role === "tool" ? "verify" : "chat");
    router.push(`/#m-${itemId}`);
  };
  return (
    <div className="-mx-5 overflow-x-auto sm:-mx-6">
      <table className="flagged-table w-full min-w-[40rem] text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="px-5 pb-2 text-start font-medium sm:px-6">{t("dash.colText")}</th>
            <th className="px-3 pb-2 text-start font-medium">{t("dash.colRef")}</th>
            <th className="px-3 pb-2 text-start font-medium">{t("dash.colStatus")}</th>
            <th className="px-3 pb-2 text-start font-medium">{t("dash.colWhen")}</th>
            <th className="px-5 pb-2 sm:px-6">
              <span className="sr-only">{t("dash.open")}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => {
            const info = statusInfo(t, String(r.report.status));
            return (
              <tr key={`${r.itemId}-${r.reference}-${r.ts}`} className="transition hover:bg-muted/40">
                <td className="max-w-[22rem] px-5 py-3 sm:px-6">
                  <p dir="auto" className={cn("line-clamp-2", r.report.language === "ar" && "font-scripture text-lg leading-9")}>
                    {r.report.submittedQuote || t("result.referenceOnly")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {sourceLabel(t, r.report.sourceType)} · {languageLabel(t, r.report.language)}
                  </p>
                </td>
                <td className="px-3 py-3">{r.reference || r.report.citedReference ? <bdi className="ref font-semibold">{r.reference || r.report.citedReference}</bdi> : "—"}</td>
                <td className="px-3 py-3">
                  <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", TONE_SOFT[info.tone])}>{info.label}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{t.date(r.ts, { dateStyle: "medium" })}</td>
                <td className="px-5 py-3 text-end sm:px-6">
                  <Button variant="ghost" size="sm" className="rounded-lg text-primary" onClick={() => open(r.chatId, r.itemId)} data-open-chat={r.chatId}>
                    {t("dash.open")}
                    <ArrowUpRight className="size-3.5 rtl:-scale-x-100" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function csv(t: T, chats: ReturnType<typeof useIsnad.getState>["chats"], range: number) {
  const from = range ? new Date(new Date().setHours(0, 0, 0, 0)).getTime() - (range - 1) * 86400000 : 0;
  const rows = deviceRecords(chats).records.filter((r) => r.ts >= from).sort((a, b) => b.ts - a.ts);
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["date", "status", "status_label", "source_type", "language", "cited_reference", "matched_references", "quoted_text", "duration_ms"];
  const lines = [header.join(",")].concat(
    rows.map((r) =>
      [
        new Date(r.ts).toISOString(),
        r.report.status,
        statusInfo(t, String(r.report.status)).label,
        r.report.sourceType,
        r.report.language,
        r.reference || r.report.citedReference || "",
        r.report.matchedReferences.join(" "),
        r.report.submittedQuote ?? "",
        typeof r.durationMs === "number" ? Math.round(r.durationMs) : "",
      ]
        .map(q)
        .join(","),
    ),
  );
  // The BOM makes spreadsheet apps read the Arabic as UTF-8.
  download(`isnad-citations-${new Date().toISOString().slice(0, 10)}.csv`, "﻿" + lines.join("\r\n"), "text/csv;charset=utf-8");
  toast.success(t("dash.csvDone"));
}

export function DashboardView() {
  const t = useT();
  const router = useRouter();
  const chats = useIsnad((s) => s.chats);
  const statsEnabled = useIsnad((s) => s.capabilities?.stats_enabled === true);
  const apiState = useIsnad((s) => s.apiState);
  const [scope, setScope] = useState<"device" | "server">("device");
  const [range, setRange] = useState(30);
  const [filter, setFilter] = useState("");
  const [fetched, setFetched] = useState<{ data?: ServerStats; failed?: boolean; at: number } | null>(null);
  const [requested, setRequested] = useState(0);
  const wantServer = scope === "server" && statsEnabled && apiState === "ready";

  useEffect(() => {
    if (!wantServer) return;
    let live = true;
    const at = Date.now();
    Api.stats({ timeoutMs: 8000 }).then(
      (r) => live && setFetched({ data: r.payload, at }),
      () => live && setFetched({ failed: true, at }),
    );
    return () => {
      live = false;
    };
  }, [wantServer, requested]);

  // What the server scope shows, derived rather than stored.
  const server = useMemo<{ state: "loading" | "ready" | "error" | "disabled"; data?: ServerStats }>(
    () =>
      apiState !== "checking" && !statsEnabled
        ? { state: "disabled" }
        : !fetched
          ? { state: "loading" }
          : fetched.failed
            ? { state: "error" }
            : { state: "ready", data: fetched.data },
    [apiState, statsEnabled, fetched],
  );

  const model = useMemo<DashboardModel | null>(() => {
    if (scope === "device") return deviceModel(chats, range);
    return server.state === "ready" && server.data ? serverModel(server.data, range) : null;
  }, [scope, chats, range, server]);

  const start = (mode: "chat" | "verify") => {
    useIsnad.getState().setMode(mode);
    router.push("/");
  };

  const statusRows = model
    ? STATUS_ORDER.map((s) => {
        const info = statusInfo(t, s);
        return { key: s, label: info.label, value: model.byStatus[s] ?? 0, fill: TONE_FILL[info.tone], title: info.meaning };
      })
    : [];
  const sourceRows = model
    ? (["quran:ar", "quran:en", "hadith:ar", "hadith:en"] as const).map((pair, i) => {
        const [type, lang] = pair.split(":");
        return {
          key: pair,
          label: `${sourceLabel(t, type)} · ${languageLabel(t, lang)}`,
          value: model.bySource[pair] ?? 0,
          fill: ["bg-primary", "bg-info", "bg-gold", "bg-partial"][i],
        };
      })
    : [];

  return (
    <div className="scrollbar-quiet absolute inset-0 overflow-y-auto" id="dashboard">
      <div className="mx-auto grid max-w-6xl gap-5 px-4 pb-16 pt-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[0.95rem] text-muted-foreground">{t("dash.subtitle")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label={t("dash.scope")} className="inline-flex rounded-xl bg-muted p-1">
              {(["device", "server"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={scope === s}
                  data-dash-scope={s}
                  onClick={() => {
                    setScope(s);
                    if (s === "server") setRequested((n) => n + 1);
                  }}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition",
                    scope === s ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s === "device" ? <Smartphone className="size-4" /> : <ServerCog className="size-4" />}
                  {t(s === "device" ? "dash.scopeDevice" : "dash.scopeServer")}
                </button>
              ))}
            </div>
            <Select value={String(range)} onValueChange={(v) => setRange(Number(v))}>
              <SelectTrigger className="h-10 w-40 rounded-xl" aria-label={t("dash.range")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">{t("dash.range7")}</SelectItem>
                <SelectItem value="30">{t("dash.range30")}</SelectItem>
                <SelectItem value="90">{t("dash.range90")}</SelectItem>
                <SelectItem value="0">{t("dash.rangeAll")}</SelectItem>
              </SelectContent>
            </Select>
            {scope === "device" ? (
              <Button variant="outline" className="h-10 rounded-xl" onClick={() => csv(t, chats, range)}>
                <Download className="size-4" />
                {t("dash.exportCsv")}
              </Button>
            ) : null}
          </div>
        </div>

        {scope === "server" && server.state !== "ready" ? (
          <p className={cn("server-note rounded-2xl border p-4 text-sm", server.state === "disabled" || server.state === "error" ? "border-partial/30 bg-partial-soft" : "border-border bg-card")}>
            {server.state === "disabled" ? t("dash.serverDisabled") : server.state === "error" ? t("dash.serverError") : t("dash.serverLoading")}
          </p>
        ) : null}
        {scope === "server" && model ? (
          <p className="text-xs text-muted-foreground">
            {[!model.persistent ? t("dash.serverVolatile") : "", model.since ? t("dash.serverSince", { date: t.date(model.since, { dateStyle: "medium", timeStyle: "short" }) }) : ""]
              .filter(Boolean)
              .join(" ")}
          </p>
        ) : null}

        {model && !model.hasAny ? (
          <div className="relative grid place-items-center overflow-hidden rounded-3xl border border-border bg-card px-6 py-16 text-center">
            <Rosette className="pointer-events-none absolute size-80 text-gold/30" />
            <div className="relative">
              <Seal tone="pending" className="mx-auto size-14" />
              <h2 className="mt-5 font-heading text-2xl font-bold">{t("dash.emptyTitle")}</h2>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground">{t("dash.emptySub")}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button className="h-10 rounded-xl px-4" onClick={() => start("chat")}>
                  <MessageCircle className="size-4" />
                  {t("dash.startChat")}
                </Button>
                <Button variant="outline" className="h-10 rounded-xl px-4" onClick={() => start("verify")}>
                  <BadgeCheck className="size-4" />
                  {t("dash.startVerify")}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {model && model.hasAny ? (
          <>
            <Hero model={model} />
            <div className="grid gap-5 lg:grid-cols-3">
              <Panel title={t("dash.activityTitle")} className="lg:col-span-2">
                <Activity model={model} />
              </Panel>
              <Panel title={t("dash.statusTitle")}>
                <Bars rows={statusRows} caption={t("dash.statusTitle")} />
              </Panel>
              <Panel title={t("dash.sourcesTitle")}>
                <Bars rows={sourceRows} caption={t("dash.sourcesTitle")} />
              </Panel>
              <Panel title={t("dash.healthTitle")} className="lg:col-span-2">
                <Health />
              </Panel>
              <Panel
                title={t("dash.flaggedTitle")}
                className="lg:col-span-3"
                tools={
                  model.flagged ? (
                    <Select value={filter || "all"} onValueChange={(v) => setFilter(v === "all" ? "" : v)}>
                      <SelectTrigger className="h-9 w-56 rounded-xl" aria-label={t("dash.colStatus")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("dash.filterAll")}</SelectItem>
                        {NEEDS_REVIEW.map((s) => (
                          <SelectItem key={s} value={s}>
                            {statusInfo(t, s).label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null
                }
              >
                <Flagged model={model} filter={filter} />
              </Panel>
            </div>
          </>
        ) : null}

        <p className="text-center text-xs text-muted-foreground">{t("dash.disclaimer")}</p>
      </div>
    </div>
  );
}
