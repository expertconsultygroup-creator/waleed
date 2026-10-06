/* Islamic geometry, constructed rather than drawn: a circle divided into n
   equal parts, joined every k-th division, gives the star polygon {n/k}. The
   khatam is {8/2} (two squares), the octagram {8/3}, the rosette {12/5}.
   Built from the rule, the figures stay exact at any size. */

const r2 = (v: number) => Math.round(v * 1000) / 1000;

export function divisions(cx: number, cy: number, r: number, n: number, offset = 0): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + offset + (2 * Math.PI * i) / n;
    return [r2(cx + r * Math.cos(a)), r2(cy + r * Math.sin(a))];
  });
}

/* {n/k} as one path; where n and k share a factor the figure splits into
   separate loops ({8/2} is two squares), each its own subpath. */
export function starPolygon(cx: number, cy: number, r: number, n: number, k: number, offset = 0): string {
  const pts = divisions(cx, cy, r, n, offset);
  const seen = new Array(n).fill(false);
  let d = "";
  for (let start = 0; start < n; start += 1) {
    if (seen[start]) continue;
    let i = start;
    d += `M${pts[i][0]} ${pts[i][1]}`;
    do {
      seen[i] = true;
      i = (i + k) % n;
      d += `L${pts[i][0]} ${pts[i][1]}`;
    } while (i !== start);
    d += "Z";
  }
  return d;
}

/* Outline of an n-pointed star with alternating outer and inner radii. */
export function starOutline(cx: number, cy: number, rOuter: number, rInner: number, n: number, offset = 0): string {
  const outer = divisions(cx, cy, rOuter, n, offset);
  const inner = divisions(cx, cy, rInner, n, offset + Math.PI / n);
  return outer.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}L${inner[i][0]} ${inner[i][1]}`).join("") + "Z";
}

export function circle(cx: number, cy: number, r: number): string {
  return `M${r2(cx - r)} ${cy}a${r} ${r} 0 1 0 ${r2(2 * r)} 0a${r} ${r} 0 1 0 ${r2(-2 * r)} 0Z`;
}

/* Inner radius of the khatam outline (two squares): r·cos(π/4)/cos(π/8). */
export const KHATAM_INNER = Math.cos(Math.PI / 4) / Math.cos(Math.PI / 8);
/* Inner radius of the regular octagram {8/3}: r·cos(3π/8)/cos(π/8). */
export const OCTAGRAM_INNER = Math.cos((3 * Math.PI) / 8) / Math.cos(Math.PI / 8);
