"use client";

import { chatTitle } from "./chat-title";
import { describeFailure } from "./describe";
import type { T } from "./i18n/use-t";
import { formatReference } from "./reference";
import { statusInfo } from "./status";
import type { Chat } from "./types";

export function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* A conversation as Markdown: the model's prose, then each citation with the
   source's wording, its status and the grade only where the source gave one.
   It is written for readers: references named, no status codes or checksums. */
export function conversationMarkdown(t: T, chat: Chat): string {
  const lines = [`# ${chatTitle(t, chat)}`, ""];
  for (const entry of chat.items) {
    if (entry.role === "user") {
      lines.push(`**${t("export.you")}**`, "", entry.text ?? "", "");
    } else if (entry.kind === "assistant") {
      lines.push(`**${t("msg.isnad")}**`, "");
      if (entry.text) lines.push(entry.text, "");
      for (const c of entry.citations ?? []) {
        lines.push(`### ${t("export.citation")} · ${c.header.reference ? formatReference(t, c.header.reference) : t("citation.noRef")}`);
        if (c.state === "done" && c.report) {
          const r = c.report;
          lines.push("", `- ${t("export.status")}: ${statusInfo(t, r.status).label}`);
          if (r.sourceMetadata) {
            const m = r.sourceMetadata;
            lines.push(`- ${t("export.source")}: ${m.display_name || m.name}`);
          }
          for (const e of r.evidence) {
            lines.push("", `> ${formatReference(t, e.reference)}`, ">", `> ${e.source_text}`);
            if (e.attribution_text) lines.push(">", `> ${t("export.attribution")}: ${e.attribution_text}`);
            lines.push(">", `> ${t("export.grade")}: ${e.grade_text ? e.grade_text + (e.grade_source ? ` (${e.grade_source})` : "") : t("export.gradeNone")}`);
          }
          lines.push("", `_${statusInfo(t, r.status).meaning}_`, "");
        } else if (c.state === "error" && c.error) {
          const d = describeFailure(t, c.error);
          lines.push("", `- ${t("export.notChecked")}: ${d.title} — ${d.message}`, "");
        }
      }
      lines.push("");
    } else if (entry.role === "tool" && entry.kind === "report" && entry.report) {
      lines.push(`**${t("export.handCheck")}**`, "", `- ${t("export.status")}: ${statusInfo(t, entry.report.status).label}`, "");
      for (const e of entry.report.evidence) lines.push(`> ${formatReference(t, e.reference)}`, ">", `> ${e.source_text}`, "");
    }
  }
  return lines.join("\n");
}
