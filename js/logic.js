// Pure business logic: no DOM, no storage. Runs in the browser and in `node tests/selftest.mjs`.
import { CONFIG } from './config.js';
import { INGREDIENTS, DISHES, SUPPLIERS, GUESTHOUSES, LANDMARKS, CAFE, REGULARS, TABS, basePrices, QUOTES } from './data.js';

export const ING = Object.fromEntries(INGREDIENTS.map((g) => [g.id, g]));
export const DISH = Object.fromEntries(DISHES.map((d) => [d.id, d]));
export const SUP = Object.fromEntries(SUPPLIERS.map((s) => [s.id, s]));
export const GH = Object.fromEntries(GUESTHOUSES.map((g) => [g.id, g]));
export const MIN = 6e4;
export const DAY = 864e5;
const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;

// The boats come in at 6:10. Before that, show last evening's landing.
const landed = (now) => { const m = new Date(now).setHours(6, 10, 0, 0); return m < now ? m : now - 5 * 36e5; };

export function seedState(now) {
  const prices = basePrices();
  const stock = Object.fromEntries(INGREDIENTS.map((g) => [g.id, g.stock]));
  const assign = Object.fromEntries(INGREDIENTS.filter((g) => g.sup).map((g) => [g.id, g.sup]));
  const s = {
    v: 1, seq: 1040, nid: 0, notes: [], cur: 'MVR',
    status: { mode: 'open', wait: CONFIG.defaultWait, prayerEnds: 0 },
    off: {}, stock, prices, assign, imported: {},
    catch: { fish: 'Red snapper', kg: 6, at: landed(now) },
    cart: { items: {}, notes: '', type: 'dinein', table: null, pin: null, gh: null, room: '' },
    orders: [],
    list: [{ ing: 'kurumba', qty: 20 }],
    lastQty: { tuna: 25, chicken: 30, rice: 25, flour: 30, eggs: 240, oil: 10, onion: 15, coconut: 60, kurumba: 20, lime: 6, cocomilk: 12, veg: 10, sugar: 5, soda: 24, curry: 3, chili: 1, tea: 1 },
    sent: [{ id: 'PO-218', sup: 'malefresh', at: now - 2 * DAY, arrived: null, lines: [{ ing: 'veg', qty: 10 }, { ing: 'lime', qty: 6 }] }],
    counts: [
      ['chicken', 21, 30, 23.5], ['chicken', 13, 26, 20.8], ['chicken', 5, 18, 11.5], ['tuna', 13, 22, 18.9], ['tuna', 5, 15, 12.6],
      ['oil', 13, 12, 8], ['eggs', 5, 210, 174], ['coconut', 13, 54, 40], ['rice', 5, 32, 33.5],
    ].map(([ing, ago, expected, counted]) => ({ at: now - ago * DAY, ing, expected, counted, value: r2((counted - expected) * prices[assign[ing]][ing]) })),
    tabs: TABS(now),
    transfers: [
      { id: 'x1', at: now - 190 * MIN, from: 'A. Zahra', amount: 142.56, ref: 'KC-1021-7Q', status: 'matched' },
      { id: 'x2', at: now - 150 * MIN, from: 'M. Rilwan', amount: 91.8, ref: 'KC-1026-M2', status: 'matched' },
      { id: 'x3', at: now - 95 * MIN, from: 'H. Liusha', amount: 185, ref: '(none)', status: 'unmatched' },
      { id: 'x4', at: now - 60 * MIN, from: 'A. Shaheem', amount: 120, ref: 'KC-1033-T8', status: 'mismatch', note: 'Order total was MVR 129.60' },
      { id: 'x5', at: now - 40 * MIN, from: 'Y. Fayaz', amount: 59.4, ref: 'KC-1036-K4', status: 'matched' },
    ],
  };
  // A few live orders already in progress. Seeded with stock untouched.
  const live = [
    { type: 'dinein', table: 5, items: { mashuni: 2, tea: 2 }, pay: 'card', ago: 34, stage: 3, name: 'Walk-in' },
    { type: 'dinein', table: 3, items: { kothu: 2, tea: 2 }, pay: 'card', ago: 7, stage: 1, name: 'Walk-in' },
    { type: 'delivery', pin: { x: 132, y: 150 }, items: { tunacurry: 1, limejuice: 2 }, pay: 'cod', ago: 14, stage: 2, name: 'Mariyam Shifa' },
    { type: 'guesthouse', gh: 'thundi', room: '4', items: { catch: 2, kurumba: 2 }, pay: 'room', ago: 2, stage: 0, name: 'Guest, room 4', notes: 'No chili please, one fish well done' },
    { type: 'pickup', items: { hedhikaa: 2, mashuni: 1 }, pay: 'transfer', ago: 1, stage: 0, name: 'Ali Zaheen', proof: true },
  ];
  for (const o of live) {
    const ord = placeOrder(s, o, now - o.ago * MIN, { keepStock: true, silent: true });
    if (o.proof) ord.pay.uploadedAt = now - 5000;
    for (let i = 0; i < o.stage; i++) advance(s, ord.id, now - (o.ago * MIN * (o.stage - i - 1)) / (o.stage + 1) - MIN, true);
  }
  return s;
}

// ---- costing and stock -----------------------------------------------------
export const unitCost = (s, id) => ING[id].cost ?? s.prices[s.assign[id]]?.[id] ?? 0;
export const dishCost = (s, d) => Object.entries(d.recipe).reduce((t, [id, amt]) => t + amt * unitCost(s, id), 0);
export const margin = (s, d) => 1 - dishCost(s, d) / d.price;

export function limiting(s, d) {
  let best = { n: Infinity, ing: null };
  for (const [id, amt] of Object.entries(d.recipe)) {
    const n = Math.floor((s.stock[id] + 1e-9) / amt);
    if (n < best.n) best = { n, ing: id };
  }
  return best;
}
export const portions = (s, d) => (s.off[d.id] ? 0 : Math.max(0, limiting(s, d).n));

export function needs(items) {
  const need = {};
  for (const [id, qty] of Object.entries(items)) for (const [g, amt] of Object.entries(DISH[id].recipe)) need[g] = (need[g] || 0) + amt * qty;
  return need;
}
// The whole cart has to fit in stock, because dishes share ingredients.
export function canAdd(s, items, id) {
  if (s.off[id]) return false;
  const need = needs({ ...items, [id]: (items[id] || 0) + 1 });
  return Object.entries(need).every(([g, q]) => q <= s.stock[g] + 1e-9);
}

export function totals(items, type) {
  const sub = Object.entries(items).reduce((t, [id, q]) => t + DISH[id].price * q, 0);
  const fee = type === 'delivery' && sub ? CONFIG.deliveryFee : 0;
  const gst = r2((sub + fee) * CONFIG.gstRate);
  return { sub, fee, gst, total: r2(sub + fee + gst) };
}

// ---- places ------------------------------------------------------------------
export function nearest(pin) {
  return LANDMARKS.reduce((b, l) => (Math.hypot(l.x - pin.x, l.y - pin.y) < Math.hypot(b.x - pin.x, b.y - pin.y) ? l : b));
}
export const rideMin = (pin) => 2 + Math.round(Math.hypot(pin.x - CAFE.x, pin.y - CAFE.y) / 30);
export const etaMin = (s, type, pin) => s.status.wait + (type === 'delivery' && pin ? rideMin(pin) : 0);

export function whereLabel(o) {
  if (o.type === 'dinein') return `Table ${o.table}`;
  if (o.type === 'pickup') return 'Pickup at counter';
  if (o.type === 'delivery') return `Near ${nearest(o.pin).name}`;
  return `${GH[o.gh].name} · Room ${o.room}`;
}
export const stageLabels = (type) => [
  'Received',
  'Preparing',
  type === 'delivery' || type === 'guesthouse' ? 'Out for delivery' : 'Ready',
  type === 'dinein' ? 'Served' : type === 'pickup' ? 'Collected' : 'Delivered',
];
export const STAGES = ['new', 'prep', 'ready', 'done'];

// ---- orders ------------------------------------------------------------------
export const effectiveMode = (s, now) => (s.status.mode === 'prayer' && now >= s.status.prayerEnds ? 'open' : s.status.mode);

// order: the order a message belongs to (only that customer sees it). staff: for the manager only.
export function note(s, title, text, now, { order = null, staff = false } = {}) {
  s.notes.push({ id: ++s.nid, at: now, title, text, order, staff });
  if (s.notes.length > 30) s.notes.shift();
}

export function placeOrder(s, o, now, opt = {}) {
  const t = totals(o.items, o.type);
  const id = ++s.seq;
  const order = {
    id, type: o.type,
    // Keep only the location that belongs to this order type; the cart remembers the others.
    table: o.type === 'dinein' ? o.table : null, pin: o.type === 'delivery' ? o.pin : null, gh: o.type === 'guesthouse' ? o.gh : null, room: o.type === 'guesthouse' ? o.room : '',
    items: { ...o.items }, notes: o.notes || '', name: o.name || 'Guest', mine: !!o.mine,
    pre: effectiveMode(s, now) !== 'open' && !opt.silent,
    status: 'new', at: { new: now }, eta: etaMin(s, o.type, o.pin), ...t,
    pay: { method: o.pay, tab: o.tab || null, ref: o.pay === 'transfer' ? `KC-${id}-${(id * 7919).toString(36).slice(-2).toUpperCase()}` : null, uploadedAt: 0, paid: o.pay === 'card' },
  };
  if (!opt.keepStock) for (const [g, q] of Object.entries(needs(o.items))) s.stock[g] = Math.max(0, r2(s.stock[g] - q));
  if (o.pay === 'tab') {
    const tab = s.tabs.find((x) => x.id === o.tab);
    if (tab) tab.balance = r2(tab.balance + t.total);
  }
  s.orders.push(order);
  if (!opt.silent) note(s, `Order #${id} received`, `${order.pre ? 'Pre-order' : 'New order'} · ${whereLabel(order)} · MVR ${t.total.toFixed(2)}`, now, { order: id });
  return order;
}

export function advance(s, id, now, silent) {
  const o = s.orders.find((x) => x.id === id);
  const i = STAGES.indexOf(o?.status);
  if (!o || i < 0 || i > 2) return;
  o.status = STAGES[i + 1];
  o.at[o.status] = now;
  if (o.status === 'done' && o.pay.method === 'cod') o.pay.paid = true;
  if (!silent) {
    const label = stageLabels(o.type)[i + 1];
    const msg = { prep: 'The kitchen has started on your order.', ready: o.type === 'dinein' ? 'Coming to your table now.' : o.type === 'pickup' ? 'Ready at the counter.' : 'Your rider is on the way.', done: 'Enjoy! Thank you for ordering from Kandu Café.' }[o.status];
    note(s, `Order #${o.id} · ${label}`, msg, now, { order: o.id });
  }
}

export function payStatus(o) {
  const p = o.pay;
  if (p.method === 'card') return { label: 'Paid by card', ok: true };
  if (p.method === 'room') return { label: 'Charged to room', ok: true };
  if (p.method === 'tab') return { label: 'Added to tab', ok: true };
  if (p.method === 'cod') return p.paid ? { label: 'Cash received', ok: true } : { label: 'Cash on delivery', ok: false };
  if (p.paid) return { label: 'Transfer confirmed', ok: true };
  return p.uploadedAt ? { label: 'Verifying transfer', ok: false } : { label: 'Awaiting transfer', ok: false };
}

export function confirmTransfer(s, o, now) {
  o.pay.paid = true;
  s.transfers.push({ id: 'o' + o.id, at: now, from: o.name, amount: o.total, ref: o.pay.ref, status: 'matched' });
  note(s, `Payment confirmed · #${o.id}`, `Transfer ${o.pay.ref} matched automatically. MVR ${o.total.toFixed(2)}`, now, { order: o.id });
}

// Time-driven changes. Idempotent, so it is safe when two tabs both run it.
export function normalize(s, now) {
  let changed = false;
  if (s.status.mode === 'prayer' && now >= s.status.prayerEnds) {
    s.status.mode = 'open';
    note(s, 'We’re open again', 'Prayer break is over. Orders are being prepared.', now);
    changed = true;
  }
  for (const o of s.orders) {
    if (o.pay.method === 'transfer' && !o.pay.paid && o.pay.uploadedAt && now >= o.pay.uploadedAt + CONFIG.transferConfirmSec * 1000) {
      confirmTransfer(s, o, now);
      changed = true;
    }
  }
  return changed;
}

export function simOrder(s, now, rnd = Math.random) {
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const type = pick(['dinein', 'dinein', 'delivery', 'pickup', 'guesthouse']);
  const items = {};
  const pool = DISHES.filter((d) => portions(s, d) > 0);
  for (let i = 0, n = 1 + Math.floor(rnd() * 3); i < n && pool.length; i++) {
    const d = pick(pool);
    if (canAdd(s, items, d.id)) items[d.id] = (items[d.id] || 0) + 1;
  }
  if (!Object.keys(items).length) return null;
  const lm = pick(LANDMARKS);
  const gh = pick(GUESTHOUSES);
  return placeOrder(s, {
    type, items, name: pick(REGULARS),
    table: 1 + Math.floor(rnd() * CONFIG.tables),
    pin: { x: lm.x + 6, y: lm.y + 8 }, gh: gh.id, room: String(1 + Math.floor(rnd() * gh.rooms)),
    notes: rnd() < 0.3 ? pick(['Extra chili', 'No onion please', 'Less sugar', 'Pack the lime separately']) : '',
    pay: pick({ dinein: ['card', 'transfer'], delivery: ['cod', 'card'], pickup: ['card', 'cod'], guesthouse: ['room'] }[type]),
  }, now);
}

// ---- inventory ---------------------------------------------------------------
export function applyCount(s, counted, now) {
  const out = [];
  for (const [id, raw] of Object.entries(counted)) {
    const c = Number(raw);
    if (raw === '' || !isFinite(c) || c < 0) continue;
    const expected = s.stock[id];
    const rec = { at: now, ing: id, expected, counted: c, value: r2((c - expected) * unitCost(s, id)) };
    s.counts.push(rec);
    s.stock[id] = c;
    out.push(rec);
  }
  return out;
}

// ---- supply ------------------------------------------------------------------
export function nextBoat(now) {
  const dow = new Date(now).getDay();
  const ahead = (from) => { for (let d = 1; d <= 7; d++) if (CONFIG.boatDays.includes((from + d) % 7)) return d; return 7; };
  const days = ahead(dow);
  return { days, interval: ahead(dow + days), date: now + days * DAY };
}

// usage: average daily use per ingredient.
export function restock(s, usage, now) {
  const { days, interval } = nextBoat(now);
  return INGREDIENTS.filter((g) => g.sup).map((g) => {
    const avg = usage[g.id] || 0;
    const stock = s.stock[g.id];
    const daysLeft = avg ? stock / avg : Infinity;
    // Cover the wait for the boat, then the gap to the following boat plus a safety buffer.
    const raw = avg * (days + interval * (1 + CONFIG.safetyBuffer)) - stock;
    const qty = raw > 0 ? Math.ceil(raw / g.pack) * g.pack : 0;
    return { ing: g.id, avg: r1(avg), daysLeft, qty, runsOut: daysLeft < days, low: stock <= g.low };
  }).sort((a, b) => a.daysLeft - b.daysLeft);
}

export function cheapest(s, id) {
  let best = null;
  for (const sup of SUPPLIERS) {
    const p = s.prices[sup.id][id];
    if (p && (!best || p < best.price)) best = { sup: sup.id, price: p };
  }
  return best;
}

// Reassign every ingredient to its cheapest supplier. Returns the saving on the order list and per month.
export function useCheapest(s, usage) {
  let list = 0, month = 0, moved = 0;
  const qty = Object.fromEntries(s.list.map((l) => [l.ing, l.qty]));
  for (const g of INGREDIENTS.filter((x) => x.sup)) {
    const best = cheapest(s, g.id);
    const diff = unitCost(s, g.id) - best.price;
    if (diff > 0.001) {
      list += diff * (qty[g.id] || 0);
      month += diff * (usage[g.id] || 0) * 30;
      s.assign[g.id] = best.sup;
      moved++;
    }
  }
  return { list: r2(list), month: Math.round(month), moved };
}

export function importQuote(s, sup) {
  const q = QUOTES.find((x) => x.sup === sup);
  const changes = Object.entries(q.lines).filter(([id, p]) => s.prices[sup][id] !== p).map(([id, p]) => ({ ing: id, from: s.prices[sup][id], to: p }));
  s.prices[sup] = { ...s.prices[sup], ...q.lines };
  s.imported[sup] = true;
  return changes;
}

export function sendOrder(s, sup, now) {
  const lines = s.list.filter((l) => s.assign[l.ing] === sup);
  if (!lines.length) return null;
  s.list = s.list.filter((l) => s.assign[l.ing] !== sup);
  const po = { id: `PO-${219 + s.sent.length}`, sup, at: now, arrived: null, lines };
  s.sent.unshift(po);
  return po;
}

export function receive(s, poId, arrived, now) {
  const po = s.sent.find((p) => p.id === poId);
  if (!po || po.arrived) return;
  po.arrived = now;
  for (const l of po.lines) {
    const got = Math.max(0, Number(arrived[l.ing] ?? l.qty) || 0);
    l.got = got;
    s.stock[l.ing] = r2(s.stock[l.ing] + got);
    s.lastQty[l.ing] = l.qty;
  }
}

export const money = (mvr, cur = 'MVR') => (cur === 'USD' ? `$${(mvr / CONFIG.usdRate).toFixed(2)}` : `MVR ${Number.isInteger(mvr) ? mvr : mvr.toFixed(2)}`);
export const kfmt = (n) => (Math.abs(n) >= 10000 ? (n / 1000).toFixed(1) + 'K' : Math.round(n).toLocaleString('en-US'));
