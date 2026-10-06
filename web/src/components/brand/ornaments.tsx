import { useId } from "react";
import { cn } from "cn";
import { circle, KHATAM_INNER, OCTAGRAM_INNER, starOutline, starPolygon } from "@/lib/geometry";

/* All ornament is decorative and aria-hidden: it never carries meaning that
   the words next to it do not also carry. */

export function Khatam({ className, dot = true }: { className?: string; dot?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <path d={circle(24, 24, 22.5)} fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d={starPolygon(24, 24, 17.5, 8, 2)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d={starOutline(24, 24, 9.5, 9.5 * KHATAM_INNER, 8)} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" opacity="0.7" />
      {dot ? <circle cx="24" cy="24" r="3.2" fill="currentColor" /> : null}
    </svg>
  );
}

/* Star-and-cross field for the sidebar: one octagram per tile, tiles touching
   at their points so the gaps read as crosses. */
export function Lattice({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const tile = 44;
  const c = tile / 2;
  return (
    <svg className={className} aria-hidden="true" focusable="false" width="100%" height="100%">
      <defs>
        <pattern id={`lattice-${id}`} width={tile} height={tile} patternUnits="userSpaceOnUse">
          <path d={starPolygon(c, c, c, 8, 2)} fill="none" stroke="currentColor" strokeWidth="0.8" />
          <path d={starOutline(c, c, c * 0.42, c * 0.42 * KHATAM_INNER, 8)} fill="none" stroke="currentColor" strokeWidth="0.7" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#lattice-${id})`} />
    </svg>
  );
}

/* Medallion: circle, 12-fold rosette {12/5}, a second ring and the octagram
   {8/3} — the same circle divided twelve and then eight ways. */
export function Rosette({ className, animate = false }: { className?: string; animate?: boolean }) {
  const c = 100;
  const r = 98;
  const paths = [
    circle(c, c, r),
    starPolygon(c, c, r, 12, 5),
    circle(c, c, r * 0.5),
    starPolygon(c, c, r * 0.5, 8, 3, Math.PI / 8),
    starOutline(c, c, r * 0.22, r * 0.22 * OCTAGRAM_INNER, 8, Math.PI / 8),
  ];
  return (
    <svg viewBox="0 0 200 200" className={cn(animate && "draw-once", className)} aria-hidden="true" focusable="false">
      {paths.map((d, i) => (
        <path key={i} d={d} pathLength={1} fill="none" stroke="currentColor" strokeWidth={i === 1 ? 0.7 : 0.9} />
      ))}
    </svg>
  );
}

/* Loader for a source check: the octagram traced stroke by stroke. */
export function OctagramLoader({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("trace", className)} aria-hidden="true" focusable="false">
      <path
        d={starOutline(12, 12, 10, 10 * OCTAGRAM_INNER, 8)}
        pathLength={1}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Illumination for the four corners of a mushaf panel: two rules meeting at a
   small eight-pointed knot. One drawing, turned to each corner. */
export function MushafCorners() {
  const corner = (
    <svg viewBox="0 0 28 28" className="size-7" aria-hidden="true" focusable="false">
      <path d="M2 26V8Q2 2 8 2h18" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d={starOutline(9, 9, 4.6, 4.6 * KHATAM_INNER, 8)} fill="currentColor" opacity="0.9" />
      <path d="M17 2v3M2 17h3" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
  const place = "pointer-events-none absolute text-gold";
  return (
    <>
      <span className={cn(place, "top-1.5 left-1.5")}>{corner}</span>
      <span className={cn(place, "top-1.5 right-1.5 -scale-x-100")}>{corner}</span>
      <span className={cn(place, "bottom-1.5 left-1.5 -scale-y-100")}>{corner}</span>
      <span className={cn(place, "bottom-1.5 right-1.5 -scale-100")}>{corner}</span>
    </>
  );
}

/* The end-of-ayah sign with its number, as printed in a mushaf. Outside the
   source text and not copied with it. */
export function AyahMark({ reference }: { reference?: string | null }) {
  const match = /^\d{1,3}:(\d{1,3})$/.exec(String(reference ?? "").trim());
  if (!match) return null;
  const digits = match[1].replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)));
  return (
    <span aria-hidden="true" className="ms-1 inline-block select-none text-gold">
      {"۝"}
      {digits}
    </span>
  );
}
