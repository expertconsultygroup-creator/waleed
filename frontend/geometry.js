/* ============================================================================
   ISNAD — geometric ornament, constructed rather than drawn.

   Every figure starts the traditional way: a circle divided into equal parts.
   Joining every k-th division of n gives the star polygon {n/k}; the 8-fold
   khatam is {8/3}, the 12-fold rosette {12/5}. Drawing them from that rule
   keeps the proportions exact at any size, where traced clip-art would not.

   Ornament is an accent only: the logo, a thin band under a heading, a faint
   medallion behind an empty state, the loader. It never sits behind text a
   reader needs, and every element it produces is aria-hidden.
   ========================================================================= */
(function (global) {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function round(v) { return Math.round(v * 100) / 100; }

  /* n equal divisions of a circle, the first one pointing up. */
  function divisions(cx, cy, r, n, offset) {
    const points = [];
    for (let i = 0; i < n; i += 1) {
      const a = -Math.PI / 2 + (offset || 0) + (2 * Math.PI * i) / n;
      points.push([round(cx + r * Math.cos(a)), round(cy + r * Math.sin(a))]);
    }
    return points;
  }

  /* The star polygon {n/k} as one path: from each division to the k-th next.
     Where n and k share a factor the figure splits into separate loops (as
     {8/2} splits into two squares), so each loop gets its own subpath. */
  function starPolygon(cx, cy, r, n, k, offset) {
    const pts = divisions(cx, cy, r, n, offset);
    const seen = new Array(n).fill(false);
    let d = '';
    for (let start = 0; start < n; start += 1) {
      if (seen[start]) continue;
      let i = start;
      d += 'M' + pts[i][0] + ' ' + pts[i][1];
      do {
        seen[i] = true;
        i = (i + k) % n;
        d += 'L' + pts[i][0] + ' ' + pts[i][1];
      } while (i !== start);
      d += 'Z';
    }
    return d;
  }

  /* Outline of an n-pointed star: alternating outer and inner radii. */
  function starOutline(cx, cy, rOuter, rInner, n, offset) {
    const outer = divisions(cx, cy, rOuter, n, offset);
    const inner = divisions(cx, cy, rInner, n, (offset || 0) + Math.PI / n);
    let d = '';
    for (let i = 0; i < n; i += 1) {
      d += (i ? 'L' : 'M') + outer[i][0] + ' ' + outer[i][1] + 'L' + inner[i][0] + ' ' + inner[i][1];
    }
    return d + 'Z';
  }

  function circle(cx, cy, r) {
    return 'M' + round(cx - r) + ' ' + cy + 'a' + r + ' ' + r + ' 0 1 0 ' + round(2 * r) + ' 0' +
      'a' + r + ' ' + r + ' 0 1 0 ' + round(-2 * r) + ' 0Z';
  }

  /* Inner radius of the regular octagram {8/3}, so its outline matches the
     interlaced figure exactly: r * cos(3π/8) / cos(π/8). */
  const OCTAGRAM_INNER = Math.cos(3 * Math.PI / 8) / Math.cos(Math.PI / 8);

  /* Medallion: circle, 12-fold rosette {12/5}, a second ring, and the 8-fold
     khatam at the centre — the same circle divided 12 and then 8 ways. */
  function medallion(size) {
    const c = size / 2;
    const r = c - 1;
    return [
      '<path d="' + circle(c, c, r) + '"/>',
      '<path d="' + starPolygon(c, c, r, 12, 5) + '"/>',
      '<path d="' + circle(c, c, r * 0.52) + '"/>',
      '<path d="' + starPolygon(c, c, r * 0.52, 8, 3, Math.PI / 8) + '"/>',
      '<path d="' + starOutline(c, c, r * 0.24, r * 0.24 * OCTAGRAM_INNER, 8, Math.PI / 8) + '"/>'
    ].join('');
  }

  /* Band: the star-and-cross field — one octagram per tile, tiles touching at
     their points, so the spaces between them read as crosses. */
  function band(tile) {
    const c = tile / 2;
    const r = tile / 2;
    return '<pattern id="isnad-band-tile" width="' + tile + '" height="' + tile + '" patternUnits="userSpaceOnUse">' +
      '<path d="' + starPolygon(c, c, r, 8, 2) + '"/>' +
      '<path d="' + circle(c, c, r * 0.18) + '"/>' +
      '</pattern>';
  }

  function svg(className, viewBox, inner, extra) {
    return '<svg class="' + className + '" xmlns="' + SVG_NS + '"' +
      (viewBox ? ' viewBox="' + viewBox + '"' : '') +
      ' aria-hidden="true" focusable="false"' + (extra || '') + '>' + inner + '</svg>';
  }

  /* Fills placeholders in the static markup:
       <span data-geo="band"></span>       a strip of star-and-cross
       <span data-geo="medallion"></span>  the rosette medallion
     Bands share one pattern definition per element, sized by CSS. */
  function mount(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-geo="band"]:not([data-geo-ready])').forEach(function (el, index) {
      const id = 'isnad-band-' + index + '-' + Math.random().toString(36).slice(2, 6);
      /* No viewBox: the pattern stays in CSS pixels, so the tiles keep their
         size however wide the strip is. */
      el.innerHTML = svg('geo-band', '',
        '<defs>' + band(16).replace('isnad-band-tile', id) + '</defs>' +
        '<rect width="100%" height="100%" fill="url(#' + id + ')"/>',
        ' width="100%" height="100%"');
      el.setAttribute('data-geo-ready', '');
    });
    scope.querySelectorAll('[data-geo="medallion"]:not([data-geo-ready])').forEach(function (el) {
      el.innerHTML = svg('geo-medallion', '0 0 200 200', medallion(200));
      el.setAttribute('data-geo-ready', '');
    });
  }

  global.IsnadGeometry = {
    divisions: divisions,
    starPolygon: starPolygon,
    starOutline: starOutline,
    medallion: function (size) { return svg('geo-medallion', '0 0 ' + size + ' ' + size, medallion(size)); },
    mount: mount
  };
})(window);
