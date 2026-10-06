import type { ServerStats } from "./api";
import { MATCHED, NEEDS_REVIEW, STATUS_ORDER } from "./status";
import type { Chat, Report } from "./types";

/* The dashboard's numbers, from either scope:
   - this device: the saved conversations, so flagged quotations can be listed;
   - the server: anonymous counters with no quotation text or references. */

const DAY = 86400000;

export interface CheckRecord {
  ts: number;
  report: Report;
  durationMs?: number | null;
  chatId: string;
  itemId: string;
  reference?: string | null;
}

export interface DayBucket {
  ts: number;
  matched: number;
  review: number;
  other: number;
  latencySum: number;
  latencyCount: number;
}

export interface DashboardModel {
  scope: "device" | "server";
  total: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  days: DayBucket[];
  meanLatency: number | null;
  notChecked: number;
  flagged: CheckRecord[] | null;
  hasAny: boolean;
  persistent?: boolean;
  since?: string | null;
}

export function group(status: string): "matched" | "review" | "other" {
  if (MATCHED.includes(status)) return "matched";
  if (NEEDS_REVIEW.includes(status)) return "review";
  return "other";
}

function startOfDay(ts: number) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function emptyCounts() {
  return Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<string, number>;
}

export function deviceRecords(chats: Chat[]) {
  const records: CheckRecord[] = [];
  const failures: number[] = [];
  for (const chat of chats) {
    for (const entry of chat.items) {
      const ts = entry.createdAt || chat.updatedAt;
      for (const c of entry.citations ?? []) {
        if (c.state === "done" && c.report) {
          records.push({ ts, report: c.report, durationMs: c.durationMs, chatId: chat.id, itemId: entry.id, reference: c.header?.reference });
        } else if (c.state === "error") failures.push(ts);
      }
      if (entry.role === "tool" && entry.kind === "report" && entry.report) {
        records.push({ ts, report: entry.report, durationMs: entry.durationMs, chatId: chat.id, itemId: entry.id, reference: entry.report.citedReference });
      } else if (entry.role === "tool" && entry.kind === "error") failures.push(ts);
    }
  }
  return { records, failures };
}

export function deviceModel(chats: Chat[], range: number, now = Date.now()): DashboardModel {
  const all = deviceRecords(chats);
  const earliest = all.records.reduce((m, r) => Math.min(m, r.ts), now);
  const span = range || Math.min(90, Math.max(7, Math.ceil((now - earliest) / DAY) + 1));
  const from = startOfDay(now) - (span - 1) * DAY;
  const inRange = (ts: number) => (range ? ts >= from : true);
  const records = all.records.filter((r) => inRange(r.ts));

  const byStatus = emptyCounts();
  const bySource: Record<string, number> = {};
  const days: DayBucket[] = [];
  const index: Record<string, number> = {};
  for (let i = 0; i < span; i += 1) {
    const ts = from + i * DAY;
    index[dayKey(ts)] = days.length;
    days.push({ ts, matched: 0, review: 0, other: 0, latencySum: 0, latencyCount: 0 });
  }
  let sum = 0;
  let count = 0;
  for (const r of records) {
    const status = String(r.report.status);
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    const pair = `${r.report.sourceType || "other"}:${r.report.language || "other"}`;
    bySource[pair] = (bySource[pair] ?? 0) + 1;
    const day = days[index[dayKey(r.ts)]];
    if (day) day[group(status)] += 1;
    if (typeof r.durationMs === "number" && Number.isFinite(r.durationMs)) {
      sum += r.durationMs;
      count += 1;
      if (day) {
        day.latencySum += r.durationMs;
        day.latencyCount += 1;
      }
    }
  }
  return {
    scope: "device",
    total: records.length,
    byStatus,
    bySource,
    days,
    meanLatency: count ? sum / count : null,
    notChecked: all.failures.filter(inRange).length,
    flagged: records.filter((r) => NEEDS_REVIEW.includes(String(r.report.status))).sort((a, b) => b.ts - a.ts),
    hasAny: all.records.length > 0 || all.failures.length > 0,
  };
}

export function serverModel(payload: ServerStats, range: number): DashboardModel {
  const byStatus = emptyCounts();
  for (const [status, n] of Object.entries(payload.totals?.by_status ?? {})) byStatus[status] = n;
  const bySource: Record<string, number> = {};
  for (const row of payload.breakdown ?? []) {
    const pair = `${row.source_type}:${row.language}`;
    bySource[pair] = (bySource[pair] ?? 0) + row.count;
  }
  let daily = payload.daily ?? [];
  if (range && daily.length > range) daily = daily.slice(daily.length - range);
  const days = daily.map((d) => {
    const [y, m, dd] = d.date.split("-").map(Number);
    const bucket: DayBucket = { ts: new Date(y, m - 1, dd).getTime(), matched: 0, review: 0, other: 0, latencySum: 0, latencyCount: 0 };
    for (const [status, n] of Object.entries(d.by_status ?? {})) bucket[group(status)] += n;
    return bucket;
  });
  return {
    scope: "server",
    total: payload.totals?.verifications ?? 0,
    byStatus,
    bySource,
    days,
    meanLatency: typeof payload.latency?.mean_ms === "number" ? payload.latency.mean_ms : null,
    notChecked: payload.totals?.source_unavailable_errors ?? 0,
    flagged: null,
    hasAny: true,
    persistent: payload.persistent === true,
    since: payload.collecting_since ?? payload.started_at ?? null,
  };
}

export function matchedCount(model: DashboardModel) {
  return MATCHED.reduce((n, s) => n + (model.byStatus[s] ?? 0), 0);
}

export function reviewCount(model: DashboardModel) {
  return NEEDS_REVIEW.reduce((n, s) => n + (model.byStatus[s] ?? 0), 0);
}
