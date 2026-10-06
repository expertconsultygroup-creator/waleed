/* ============================================================================
   ISNAD — dashboard charts, written by hand.

   No chart library: the page loads nothing from the network and runs under a
   CSP with no external scripts. The charts are plain HTML and CSS wherever
   that is enough (bars and columns), so they mirror for right-to-left on
   their own: in Arabic, time runs from right to left, as the text does.
   SVG is used only for the sparkline and the ring, which CSS mirrors.

   Every function returns an HTML string built from escaped values, and every
   chart is paired with a visually hidden table for screen readers.
   ========================================================================= */
(function (global) {
  'use strict';

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function pct(value, max) {
    if (!max || value <= 0) return 0;
    return Math.max(1.5, Math.min(100, (value / max) * 100));
  }

  /* Horizontal bars, one row each: label, track, value.
     rows: [{ label, value, display, tone, title }] */
  function barList(rows, options) {
    const opts = options || {};
    const max = opts.max || rows.reduce(function (m, r) { return Math.max(m, r.value); }, 0);
    return '<ul class="barlist" role="list">' + rows.map(function (row) {
      return '<li class="barlist__row"' + (row.title ? ' title="' + esc(row.title) + '"' : '') + '>' +
        '<span class="barlist__label">' + esc(row.label) + '</span>' +
        '<span class="barlist__track" aria-hidden="true">' +
          '<span class="barlist__fill" data-tone="' + esc(row.tone || 'info') + '"' +
          ' style="inline-size:' + pct(row.value, max).toFixed(1) + '%"></span>' +
        '</span>' +
        '<span class="barlist__value">' + esc(row.display == null ? row.value : row.display) + '</span>' +
      '</li>';
    }).join('') + '</ul>';
  }

  /* Stacked columns over time. columns: [{ label, axis, segments: [{ value,
     tone, label }] }]. The axis label is shown on every `every`-th column. */
  function columns(cols, options) {
    const opts = options || {};
    const every = opts.every || 1;
    const max = cols.reduce(function (m, c) {
      return Math.max(m, c.segments.reduce(function (s, seg) { return s + seg.value; }, 0));
    }, 0);
    return '<div class="columns" aria-hidden="true">' +
      '<div class="columns__plot">' + cols.map(function (col) {
        const total = col.segments.reduce(function (s, seg) { return s + seg.value; }, 0);
        const title = col.label + (col.segments.length
          ? ' — ' + col.segments.filter(function (s) { return s.value > 0; })
            .map(function (s) { return s.label + ': ' + s.display; }).join(' · ')
          : '');
        return '<div class="columns__col" title="' + esc(title) + '">' +
          '<div class="columns__stack" style="block-size:' + (max ? (total / max) * 100 : 0).toFixed(1) + '%">' +
            col.segments.filter(function (s) { return s.value > 0; }).map(function (seg) {
              return '<span class="columns__seg" data-tone="' + esc(seg.tone) + '"' +
                ' style="flex-grow:' + seg.value + '"></span>';
            }).join('') +
          '</div>' +
        '</div>';
      }).join('') + '</div>' +
      '<div class="columns__axis">' + cols.map(function (col, i) {
        return '<span class="columns__tick">' + (i % every === 0 || i === cols.length - 1 ? esc(col.axis) : '') + '</span>';
      }).join('') + '</div>' +
    '</div>';
  }

  /* A line of values, oldest first. Mirrored by CSS in right-to-left. */
  function sparkline(values) {
    if (!values.length) return '';
    const max = Math.max.apply(null, values.concat([1]));
    const step = values.length > 1 ? 100 / (values.length - 1) : 100;
    const points = values.map(function (v, i) {
      return (i * step).toFixed(2) + ',' + (22 - (v / max) * 20).toFixed(2);
    });
    const area = 'M0,24L' + points.join('L') + 'L100,24Z';
    return '<svg class="spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
      '<path class="spark__area" d="' + area + '"/>' +
      '<polyline class="spark__line" points="' + points.join(' ') + '" vector-effect="non-scaling-stroke"/>' +
    '</svg>';
  }

  /* A ring showing one ratio from 0 to 1. */
  function ring(ratio) {
    const r = 15.9155;
    const value = Math.max(0, Math.min(1, ratio || 0)) * 100;
    return '<svg class="ring" viewBox="0 0 36 36" aria-hidden="true" focusable="false">' +
      '<circle class="ring__track" cx="18" cy="18" r="' + r + '"/>' +
      '<circle class="ring__value" cx="18" cy="18" r="' + r + '" pathLength="100"' +
      ' stroke-dasharray="' + value.toFixed(1) + ' 100"/>' +
    '</svg>';
  }

  function dataTable(caption, headers, rows) {
    return '<table class="sr-only"><caption>' + esc(caption) + '</caption><thead><tr>' +
      headers.map(function (h) { return '<th scope="col">' + esc(h) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows.map(function (row) {
        return '<tr>' + row.map(function (cell, i) {
          return i === 0 ? '<th scope="row">' + esc(cell) + '</th>' : '<td>' + esc(cell) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
  }

  global.IsnadCharts = {
    barList: barList,
    columns: columns,
    sparkline: sparkline,
    ring: ring,
    dataTable: dataTable
  };
})(window);
