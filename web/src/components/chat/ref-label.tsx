"use client";

import { cn } from "cn";
import { useT } from "@/lib/i18n/use-t";
import { formatReference } from "@/lib/reference";

/* A reference as readers say it ("الإخلاص: ١", "Hadith no. 4560"), set in the
   reader's direction. The API's own notation stays on data-reference. One the
   formatter does not know is shown as given, left to right. */
export function RefLabel({ reference, className }: { reference: string | null | undefined; className?: string }) {
  const t = useT();
  const raw = String(reference ?? "").trim();
  const label = formatReference(t, raw);
  const named = label !== raw;
  return (
    <bdi dir={named ? t.dir : "ltr"} data-reference={raw} className={cn(named ? "tabular-nums" : "ref", className)}>
      {label}
    </bdi>
  );
}
