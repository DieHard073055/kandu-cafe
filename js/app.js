// App shell: hash routing (so a refresh always works on GitHub Pages), rendering, the 1-second clock, tab sync.
import { CONFIG } from './config.js';
import * as L from './logic.js';
import { S, load, save, reset, onRemote } from './store.js';
import { ui, ACT, SHEETS, bus, toast, mmss, open, icon } from './ui.js';
import { customer, riderXY } from './customer.js';
import { manager } from './manager.js';

const app = document.getElementById('app'), phone = document.getElementById('phone'), tip = document.getElementById('tip');
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
let lastKey = '', lastSheet = null, seen = 0, pending = false;

function route() {
  const [view = 'c', page, arg] = location.hash.slice(2).split('?')[0].split('/');
  return view === 'm' ? { view: 'm', page: page || 'orders' } : { view: 'c', page: page || 'home', arg };
}

function tickDom(now) {
  for (const el of app.querySelectorAll('[data-cd]')) el.textContent = mmss(+el.dataset.cd - now);
  for (const el of app.querySelectorAll('[data-since]')) {
    const ms = now - +el.dataset.since;
    el.textContent = mmss(ms);
    el.classList.toggle('late', ms > +el.dataset.late * L.MIN);
  }
  for (const el of app.querySelectorAll('[data-rider]')) {
    const o = S().orders.find((x) => x.id === +el.dataset.rider);
    if (o) { const p = riderXY(o, now); el.style.transform = `translate(${p.x}px,${p.y}px)`; }
  }
}

function countUp() {
  if (calm) return;
  for (const el of app.querySelectorAll('[data-count]')) {
    const txt = el.textContent, m = txt.match(/[\d,]+(\.\d+)?/);
    if (!m) continue;
    const target = parseFloat(m[0].replace(/,/g, '')), dec = m[1] ? m[1].length - 1 : 0, t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 700);
      el.textContent = txt.replace(m[0], (target * (1 - (1 - k) ** 3)).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
      if (k < 1 && el.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

// ext = true when the render was not caused by the user (clock, other tab): never yank a field someone is typing in.
function render(ext) {
  const a = document.activeElement;
  if (ext === true && a && app.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'range') { pending = true; return; }
  pending = false;
  const r = route(), s = S(), now = Date.now();
  if (r.view === 'm') ui.mpage = r.page;
  const { view, bar, nav } = (r.view === 'm' ? manager : customer)(r, s, now);
  const key = location.hash + ui.inv + ui.sup + ui.ins + ui.range;
  const fresh = key !== lastKey, newSheet = ui.sheet !== lastSheet;
  const top = fresh ? 0 : document.getElementById('view')?.scrollTop || 0;
  const sheetTop = newSheet ? 0 : app.querySelector('.sheet-body')?.scrollTop || 0;
  const sheet = ui.sheet && SHEETS[ui.sheet] ? SHEETS[ui.sheet](s, now) : null;
  phone.className = `phone theme-${r.view}`;
  app.innerHTML = `<header class="top"><a class="brand" href="#/c" aria-label="${CONFIG.cafeName}"><span>K</span></a>
      <div class="seg viewtoggle"><a href="#/c" class="${r.view === 'c' ? 'on' : ''}">Customer</a><a href="#/m/${ui.mpage || 'orders'}" class="${r.view === 'm' ? 'on' : ''}">Manager</a></div>
      <button class="iconbtn" data-act="sheet:more" aria-label="Demo options">${icon('dots')}</button></header>
    <main id="view" class="view ${fresh ? 'anim' : ''}">${view}</main>${bar}${nav}
    ${sheet ? `<div class="backdrop ${newSheet ? 'in' : ''}" data-act="close"></div><section class="sheet ${newSheet ? 'in' : ''}" role="dialog" aria-modal="true" aria-label="${sheet.title}"><header><h2>${sheet.title}</h2><button class="x" data-act="close" aria-label="Close">×</button></header><div class="sheet-body">${sheet.body}</div>${sheet.foot ? `<footer>${sheet.foot}</footer>` : ''}</section>` : ''}`;
  document.getElementById('view').scrollTop = top;
  if (sheet) app.querySelector('.sheet-body').scrollTop = sheetTop;
  if (fresh) countUp();
  lastKey = key;
  lastSheet = ui.sheet;
  tip.hidden = true;
  if (s.nid < seen) seen = s.nid; // the demo was reset
  // The manager sees every message that goes out. A customer only sees messages about their own orders.
  const mine = (n) => !n.staff && (n.order == null || s.orders.some((o) => o.id === n.order && o.mine));
  for (const n of s.notes) if (n.id > seen && (r.view === 'm' || mine(n))) toast(n.title, n.text, 'wa');
  seen = s.nid;
  tickDom(now);
}
bus.commit = () => { save(); render(); };

SHEETS.more = () => {
  const m = route().view === 'm';
  return {
    title: 'Demo options',
    body: `<div class="pays">
      <a class="opt" href="${m ? '#/c' : '#/m/orders'}" target="_blank" rel="noopener"><span><b>Open the ${m ? 'Customer' : 'Manager'} view in a new tab</b><small>Put the two side by side. Everything stays in sync, live.</small></span></a>
      <button class="opt" data-act="reset"><span><b>Reset demo</b><small>Restore the sample orders, stock and prices.</small></span></button></div>
      <p class="fine">This is a demo. All data is simulated and saved only in this browser. No payments, messages or orders are real. Add it to your home screen from the browser’s share menu to use it like an app.</p>`,
  };
};
Object.assign(ACT, {
  sheet: (name, _el, _e, arg) => open(name, arg ?? null),
  close: () => { open(null); ui.back = null; },
  reset: () => { reset(); seen = 0; ui.flash = null; open(null); toast('Demo reset', 'Sample data restored.'); },
});

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const [name, a1, a2] = el.dataset.act.split(':');
  if (!ACT[name]) return;
  ACT[name](a1, el, e, a2);
  bus.commit();
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-chg]');
  if (!el) return;
  const [name, a1] = el.dataset.chg.split(':');
  ACT[name]?.(a1, el, e);
  // A number field commits on blur, which is usually a tap on a button. Rendering now would swallow that tap.
  if (el.type === 'number') { save(); pending = true; } else bus.commit();
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-inp]');
  if (!el) return;
  ACT[el.dataset.inp]?.(null, el, e);
  save();
});
document.addEventListener('focusout', () => setTimeout(() => pending && render(true), 250));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.sheet) { ACT.close(); render(); } });

// Tooltips for chart marks: hover on desktop, tap on a phone.
document.addEventListener('pointerover', (e) => {
  const el = e.target.closest?.('[data-tip]');
  if (!el?.dataset.tip) { tip.hidden = true; return; }
  const r = el.getBoundingClientRect(), p = phone.getBoundingClientRect();
  tip.textContent = el.dataset.tip;
  tip.hidden = false;
  tip.style.left = `${Math.max(100, Math.min(p.width - 100, r.left + r.width / 2 - p.left))}px`;
  tip.style.top = `${Math.max(70, r.top - p.top)}px`;
});

document.addEventListener('scroll', () => { tip.hidden = true; }, true);

addEventListener('hashchange', () => { open(null); render(); });
onRemote(() => render(true));
setInterval(() => {
  const now = Date.now();
  if (L.normalize(S(), now)) { save(); render(true); } else tickDom(now);
}, 1000);

load();
seen = S().nid;
// A table QR code is just a link: …/?table=4 (or #/c?table=4).
const table = +new URLSearchParams(location.search || location.hash.split('?')[1] || '').get('table');
if (table >= 1 && table <= CONFIG.tables) { Object.assign(S().cart, { type: 'dinein', table }); save(); }
if (!location.hash) history.replaceState(null, '', '#/c');
render();
if (table) toast(`Table ${table}`, 'Scanned from your table’s QR code.');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
