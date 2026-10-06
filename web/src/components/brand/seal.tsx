import { Check, CircleDashed, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "cn";
import { KHATAM_INNER, starOutline } from "@/lib/geometry";
import type { Tone } from "@/lib/types";

const SEAL_PATH = starOutline(24, 24, 22, 22 * KHATAM_INNER, 8);

const TONE_CLASS: Record<Tone | "pending", string> = {
  positive: "text-match [--seal-fill:var(--match-soft)]",
  caution: "text-partial [--seal-fill:var(--partial-soft)]",
  negative: "text-mismatch [--seal-fill:var(--mismatch-soft)]",
  info: "text-info [--seal-fill:var(--info-soft)]",
  pending: "text-gold [--seal-fill:var(--gold-soft)]",
};

/* The verification seal: an eight-pointed khatam in the result's colour with
   the result's sign inside. The signature mark of every checked quotation. */
export function Seal({ tone, className }: { tone: Tone | "pending"; className?: string }) {
  const Icon = tone === "positive" ? Check : tone === "negative" ? X : tone === "caution" ? TriangleAlert : tone === "pending" ? CircleDashed : Info;
  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center", TONE_CLASS[tone], className ?? "size-11")} aria-hidden="true">
      <svg viewBox="0 0 48 48" className="absolute inset-0 size-full">
        <path d={SEAL_PATH} fill="var(--seal-fill)" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <Icon className="relative size-[38%]" strokeWidth={2.6} />
    </span>
  );
}
