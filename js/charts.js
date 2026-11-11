// Small hand-rolled charts (SVG / HTML strings). Colours come from CSS variables so they follow the theme.
// Every mark carries data-tip, which the app shows as a tooltip on hover or tap.
import { esc } from './ui.js';
import { kfmt } from './logic.js';

const nice = (max) => { const p = 10 ** Math.floor(Math.log10(max || 1)); const m = max / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };
const topRound = (x, y, w, h, r) => { r = Math.min(r, h, w / 2); return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`; };

export const legend = (items) => `<div class="legend">${items.map(([label, color]) => `<span><i style="background:${color}"></i>${label}</span>`).join('')}</div>`;

// Stacked columns. data: [{ label, vals: [..], tip, flag }]
export function cols(data, { colors = ['var(--s1)'], h = 150, every = 1, ref, fmt = kfmt } = {}) {
  const W = 340, L = 34, T = 12, B = 18, plotH = h - T - B, slot = (W - L - 2) / data.length, bw = Math.max(3, Math.min(24, slot - 2));
  const max = nice(Math.max(ref?.v || 0, ...data.map((d) => d.vals.reduce((a, b) => a + b, 0))));
  const y = (v) => T + plotH * (1 - v / max);
  const grid = [0, max / 2, max].map((v) => `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="${v ? 'grid' : 'axis'}"/><text x="${L - 5}" y="${y(v) + 3}" class="tick" text-anchor="end">${fmt(v)}</text>`).join('');
  const bars = data.map((d, i) => {
    const x = L + 1 + i * slot + (slot - bw) / 2;
    let acc = 0;
    const last = d.vals.reduce((k, v, j) => (v > 0 ? j : k), 0);
    const segs = d.vals.map((v, j) => {
      if (v <= 0) return '';
      const y1 = y(acc + v), hh = Math.max(1, y(acc) - y1 - (acc ? 2 : 0)); // 2px surface gap between segments
      acc += v;
      return j === last ? `<path d="${topRound(x, y1, bw, hh, 4)}" fill="${colors[j]}"/>` : `<rect x="${x}" y="${y1}" width="${bw}" height="${hh}" fill="${colors[j]}"/>`;
    }).join('');
    const flag = d.flag ? `<circle cx="${x + bw / 2}" cy="${y(acc) - 8}" r="4" class="flag"/>` : '';
    const lab = i % every === 0 ? `<text x="${x + bw / 2}" y="${h - 4}" class="tick" text-anchor="middle">${d.label}</text>` : '';
    return `<g class="col" data-tip="${esc(d.tip || '')}" style="--i:${i}"><rect x="${L + 1 + i * slot}" y="${T}" width="${slot}" height="${plotH}" fill="transparent"/><g class="rise">${segs}</g>${flag}${lab}</g>`;
  }).join('');
  const line = ref ? `<line x1="${L}" x2="${W}" y1="${y(ref.v)}" y2="${y(ref.v)}" class="refline"/><text x="${W}" y="${y(ref.v) - 4}" class="tick ref" text-anchor="end">${ref.label}</text>` : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img">${grid}${bars}${line}</svg>`;
}

export function spark(vals, w = 96, h = 30) {
  const max = Math.max(...vals), min = Math.min(...vals), sx = (w - 6) / (vals.length - 1);
  const pt = (v, i) => [3 + i * sx, h - 4 - ((v - min) / (max - min || 1)) * (h - 8)];
  const pts = vals.map(pt);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const [ex, ey] = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="${d} L${ex},${h} L3,${h} Z" class="wash"/><path d="${d}" class="ln"/><circle cx="${ex}" cy="${ey}" r="3.5" class="end"/></svg>`;
}

// Horizontal bars. rows: [{ label, sub, v | parts: [{ v, color }], color, val, tip, mark, tag }]
export function hbars(rows, { max } = {}) {
  const tot = (r) => (r.parts ? r.parts.reduce((a, p) => a + p.v, 0) : r.v);
  const m = max ?? Math.max(...rows.map(tot), 1e-9);
  return `<div class="hbars">${rows.map((r, i) => {
    const parts = r.parts || [{ v: r.v, color: r.color || 'var(--s1)' }];
    return `<div class="hb" data-tip="${esc(r.tip || '')}" style="--i:${i}"><span class="hb-l">${r.label}${r.sub ? `<small>${r.sub}</small>` : ''}</span><span class="hb-t">${parts.map((p) => `<i style="width:${Math.max(0, (p.v / m) * 100).toFixed(1)}%;background:${p.color}"></i>`).join('')}${r.mark != null ? `<u style="left:${Math.min(100, (r.mark / m) * 100).toFixed(1)}%"></u>` : ''}</span><span class="hb-v">${r.val ?? ''}${r.tag ? `<em class="tagx ${r.tag[1]}">${r.tag[0]}</em>` : ''}</span></div>`;
  }).join('')}</div>`;
}

// Half-circle meter with a target band.
export function gauge(v, lo, hi, max, status) {
  const R = 70, cx = 90, cy = 86;
  const pt = (val) => { const a = Math.PI * (1 - Math.min(val, max) / max); return [cx + R * Math.cos(a), cy - R * Math.sin(a)]; };
  const arc = (a, b) => { const [x1, y1] = pt(a), [x2, y2] = pt(b); return `M${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R} 0 0 1 ${x2.toFixed(1)},${y2.toFixed(1)}`; };
  const [nx, ny] = pt(v);
  return `<svg class="gauge" viewBox="0 0 180 100" role="img" aria-label="${v.toFixed(1)} percent, target ${lo} to ${hi} percent">
    <path d="${arc(0, max)}" class="g-track"/><path d="${arc(lo, hi)}" class="g-band"/><path d="${arc(0, v)}" class="g-val ${status}"/>
    <circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="6" class="g-dot ${status}"/>
    <text x="${cx}" y="${cy - 8}" class="g-num">${v.toFixed(1)}%</text><text x="${cx}" y="${cy + 8}" class="g-lab">target ${lo}–${hi}%</text>
  </svg>`;
}

// Quadrant scatter with emoji marks. points: [{ x, y, emoji, tip }]
export function scatter(points, { xmid, ymid, xmax, ymin, ymax, quads, xlab, ylab }) {
  const W = 340, H = 250, L = 16, B = 20, T = 6, R = 6;
  const sx = (x) => L + (Math.min(x, xmax) / xmax) * (W - L - R), sy = (y) => T + (1 - (y - ymin) / (ymax - ymin)) * (H - T - B);
  const q = [[sx(xmid) + 6, T + 14, quads[0], 'start'], [sx(xmid) - 6, T + 14, quads[1], 'end'], [sx(xmid) + 6, H - B - 8, quads[2], 'start'], [sx(xmid) - 6, H - B - 8, quads[3], 'end']];
  return `<svg class="chart scatter" viewBox="0 0 ${W} ${H}" role="img">
    <rect x="${sx(xmid)}" y="${T}" width="${W - R - sx(xmid)}" height="${sy(ymid) - T}" class="q-star"/>
    <line x1="${sx(xmid)}" x2="${sx(xmid)}" y1="${T}" y2="${H - B}" class="axis"/><line x1="${L}" x2="${W - R}" y1="${sy(ymid)}" y2="${sy(ymid)}" class="axis"/>
    ${q.map(([x, y, t, a]) => `<text x="${x}" y="${y}" text-anchor="${a}" class="q-lab">${t}</text>`).join('')}
    <text x="${W - R}" y="${H - 5}" text-anchor="end" class="tick">${xlab} →</text><text x="${L - 4}" y="${T + 4}" class="tick" transform="rotate(-90 ${L - 4} ${T + 4})" text-anchor="end">${ylab} →</text>
    ${points.map((p, i) => `<g class="pt" data-tip="${esc(p.tip)}" style="--i:${i}" transform="translate(${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)})"><circle r="12"/><text y="5">${p.emoji}</text></g>`).join('')}
  </svg>`;
}

// Heatmap, one hue from surface to full colour.
export function heat(rowLabels, colLabels, m, tip) {
  const max = Math.max(...m.flat(), 1e-9);
  return `<div class="heatmap" style="--n:${colLabels.length}"><span></span>${colLabels.map((c) => `<span class="hm-c">${c}</span>`).join('')}${m.map((row, r) => `<span class="hm-r">${rowLabels[r]}</span>${row.map((v, c) => `<i style="--v:${(v / max).toFixed(2)}" data-tip="${esc(tip(r, c, v))}"></i>`).join('')}`).join('')}</div>
  <div class="hm-key"><span>Quiet</span><b></b><span>Busy</span></div>`;
}
