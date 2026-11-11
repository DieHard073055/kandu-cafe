// Shared UI helpers: per-tab view state, action registry, toasts, icons, the island map.
import { ISLAND, CAFE, LANDMARKS } from './data.js';

export const ui = { sheet: null, arg: null, cat: 'all', of: 'active', inv: 'stock', sup: 'restock', ins: 'today', range: 'today', pay: null, tab: 't4', flash: null };
export const ACT = {}; // click / change handlers, registered by the views: ACT.name(arg, el)
export const SHEETS = {}; // bottom sheets, registered by the views: SHEETS.name(state, now) -> { title, body, foot }
export const bus = { commit() {} };

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const time = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const dayName = (t, fmt = 'long') => new Date(t).toLocaleDateString('en-GB', { weekday: fmt });
export const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const go = (hash) => { location.hash = hash; };
export const open = (sheet, arg = null) => { ui.sheet = sheet; ui.arg = arg; };

const ICONS = {
  orders: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
  menu: '<path d="M7 3v7a2 2 0 0 0 4 0V3M9 12v9M17 3c-2 2-3 5-3 8h3v10"/>',
  box: '<path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8"/>',
  boat: '<path d="M2 17l2 4h16l2-4zM5 17V8h8l6 9M9 8V4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chart: '<path d="M4 20V11M10 20V4M16 20v-7M2 20h20"/>',
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  bag: '<path d="M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  table: '<path d="M3 8h18M5 8v12M19 8v12M8 8V5h8v3"/>',
  bed: '<path d="M3 18V6M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5M7 11.500a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>',
  dots: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
};
export const icon = (n) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

const WA = '<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.100L2 22l5-1.300A10 10 0 1 0 12 2zm5.3 14.200c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.800s.7-2 1-2.300c.2-.3.5-.3.7-.300h.500c.2 0 .4 0 .6.500l.9 2.100c.1.2.1.4 0 .500l-.8 1c-.1.2-.3.3-.1.6.9 1.5 2 2.4 3.4 3 .2.1.4.1.6-.100l.9-1.100c.2-.2.4-.2.6-.100l2 1c.3.1.4.2.5.3.1.2.1.7-.1 1.300z"/></svg>';

// kind 'wa' renders as a WhatsApp notification; 'ok' and 'warn' are plain app toasts.
export function toast(title, text = '', kind = 'ok') {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<i>${kind === 'wa' ? WA : kind === 'warn' ? '!' : '✓'}</i><div><b>${esc(title)}</b><span>${esc(text)}</span></div>${kind === 'wa' ? '<small>WhatsApp · now</small>' : ''}`;
  box.prepend(el);
  while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => { el.classList.add('bye'); setTimeout(() => el.remove(), 400); }, 4600);
}

export function copy(text, done = 'Copied. Paste it into WhatsApp or Viber.') {
  const fallback = () => { open('text', text); bus.commit(); };
  if (!navigator.clipboard) return fallback();
  navigator.clipboard.writeText(text).then(() => toast('Copied', done), fallback);
}

const grow = (k) => `transform="translate(180 130) scale(${k}) translate(-180 -130)"`;

// One drawn map, used for the delivery pin, live tracking and the delivery heatmap.
export function islandMap({ pin, rider, heat, pick, labels = true } = {}) {
  const marks = LANDMARKS.map((l) => `<g transform="translate(${l.x} ${l.y})"><circle r="7.5" class="lm"/><text y="3.2" class="lm-ic">${l.icon}</text></g>`).join('');
  const names = labels ? LANDMARKS.slice(1, 9).map((l) => `<text x="${l.x}" y="${l.y + 16}" class="lm-name">${l.name}</text>`).join('') : '';
  const dots = heat ? `<g class="heat">${heat.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="9"/>`).join('')}</g>` : '';
  const route = pin ? `<path class="route" d="M${CAFE.x},${CAFE.y} L${pin.x},${pin.y}"/>` : '';
  const pinEl = pin ? `<g transform="translate(${pin.x} ${pin.y})"><g class="droppin"><ellipse cy="1" rx="6" ry="2.5" class="pin-shadow"/><path d="M0,0 C-9,-11 -8,-22 0,-22 C8,-22 9,-11 0,0 Z"/><circle cy="-14" r="3" fill="#fff"/></g></g>` : '';
  const riderEl = rider ? `<g class="rider" data-rider="${rider.id}" style="transform:translate(${rider.x}px,${rider.y}px)"><circle r="10"/><text y="4">🛵</text></g>` : '';
  return `<svg class="island" viewBox="0 0 360 260" ${pick ? 'data-act="pin"' : ''} role="img" aria-label="Map of Dhangethi island">
    <defs>
      <radialGradient id="lagoon" cx="50%" cy="50%" r="72%"><stop offset="0" stop-color="#8fe9df"/><stop offset=".5" stop-color="#2fbcc0"/><stop offset="1" stop-color="#0a6a7c"/></radialGradient>
      <radialGradient id="green" cx="45%" cy="40%" r="70%"><stop offset="0" stop-color="#a8dfa6"/><stop offset="1" stop-color="#6fbf8a"/></radialGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="6"/></filter>
    </defs>
    <rect width="360" height="260" fill="url(#lagoon)"/>
    <path d="${ISLAND}" class="reef" ${grow(1.3)}/>
    <path d="${ISLAND}" class="shallow" ${grow(1.1)}/>
    <path d="${ISLAND}" id="isle" class="beach"/>
    <path d="${ISLAND}" fill="url(#green)" ${grow(0.9)}/>
    <path class="roads" d="M180,60 V202 M84,130 H292 M112,108 L250,184 M234,98 L138,138 M100,160 L204,170 L284,160"/>
    <path class="jetty" d="M180,52 V24 M168,24 H200"/>
    ${dots}${marks}${names}${route}
    <g transform="translate(${CAFE.x} ${CAFE.y})" class="cafe"><circle r="11"/><text y="4.5">☕</text></g>
    <text x="${CAFE.x}" y="${CAFE.y - 15}" class="cafe-name">Kandu Café</text>
    ${pinEl}${riderEl}
  </svg>`;
}

// Tap point -> map coordinates, or null when the tap is in the water.
export function mapPoint(svg, e) {
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  return svg.querySelector('#isle').isPointInFill(p) ? { x: Math.round(p.x), y: Math.round(p.y) } : null;
}
