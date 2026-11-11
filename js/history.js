// Simulated sales history: 35 days of orders, generated from a per-day seed so every reload shows the same past.
import { DISHES, GUESTHOUSES, LANDMARKS } from './data.js';
import { needs, DAY } from './logic.js';

export const HDAYS = 35;
export const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const WEIGHT = [2, 7, 9, 6, 3, 4, 8, 9, 5, 3, 5, 6, 4, 8, 9, 6, 3];
const slot = (h) => (h < 11 ? 0 : h < 15 ? 1 : h < 18 ? 2 : 3);

export const rng = (a) => () => {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
function pickW(r, items, w) {
  let t = r() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) if ((t -= w[i]) <= 0) return items[i];
  return items[items.length - 1];
}
const REG_W = Array.from({ length: 600 }, (_, i) => 1 / (i + 14)); // a few daily regulars, a long tail of occasional locals
const REG_I = REG_W.map((_, i) => i);

function buildDay(day0, d) {
  const r = rng(Math.round(day0 / DAY));
  const dow = new Date(day0).getDay();
  const fri = dow === 5;
  const n = Math.round(80 * (fri ? 1.25 : dow === 6 ? 1.18 : 1) * (1 + (HDAYS - d) * 0.004) * (0.9 + r() * 0.2));
  const soldOutAt = r() < 0.3 ? 13 : 99; // the catch runs out after lunch on some days
  // Friday: quiet over Jumu'ah prayer, busier afterwards.
  const w = WEIGHT.map((x, i) => (fri ? x * (HOURS[i] === 12 || HOURS[i] === 13 ? 0.25 : HOURS[i] >= 14 ? 1.35 : 1) : x));
  const orders = [];
  let lost = 0;
  for (let i = 0; i < n; i++) {
    const hi = pickW(r, HOURS.map((_, k) => k), w);
    const h = HOURS[hi];
    const ch = pickW(r, ['dinein', 'delivery', 'pickup', 'guesthouse'], [45, 22, 18, 15]);
    const it = {};
    for (let k = 0, m = 1 + (r() < 0.55) + (r() < 0.25); k < m; k++) {
      let dish = pickW(r, DISHES, DISHES.map((x) => x.pop * x.when[slot(h)]));
      if (dish.id === 'catch' && h >= soldOutAt) { lost++; dish = DISHES[3]; }
      it[dish.id] = (it[dish.id] || 0) + (r() < 0.25 ? 2 : 1);
    }
    const dishes = Object.keys(it).map((id) => DISHES.find((x) => x.id === id));
    const tour = r() < { guesthouse: 1, dinein: 0.35, pickup: 0.15, delivery: 0.08 }[ch];
    const lm = LANDMARKS[Math.floor(r() * LANDMARKS.length)];
    const slow = dishes.reduce((a, b) => (b.prep > a.prep ? b : a));
    const prep = slow.prep * (0.6 + r() * 0.45) * (1 + 0.5 * (WEIGHT[hi] / 9) ** 2);
    const promised = 15 + (ch === 'delivery' || ch === 'guesthouse' ? 5 : 0);
    const wait = prep + 1.5 + r() * 3 + (ch === 'delivery' ? 4 + r() * 5 : ch === 'guesthouse' ? 5 + r() * 5 : 0);
    orders.push({
      t: day0 + h * 36e5 + Math.floor(r() * 60) * 6e4, d, dow, h, ch, it: Object.entries(it),
      sub: dishes.reduce((s, x) => s + x.price * it[x.id], 0), tour,
      pay: tour ? (ch === 'guesthouse' && r() < 0.7 ? 'room' : 'card') : pickW(r, ['cod', 'transfer', 'tab', 'card'], [40, 35, 15, 10]),
      cu: tour ? null : pickW(r, REG_I, REG_W),
      gh: ch === 'guesthouse' ? pickW(r, GUESTHOUSES, [35, 30, 20, 15]).id : null,
      pin: ch === 'delivery' ? { x: lm.x + (r() - 0.5) * 34, y: lm.y + (r() - 0.5) * 30 } : null,
      slow: slow.id, prep, wait, promised,
    });
  }
  return { orders, lost: { d, n: lost, at: soldOutAt } };
}

let memo;
export function history(now) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (memo?.key !== +today) {
    const days = [];
    for (let d = HDAYS - 1; d >= 0; d--) {
      const day = new Date(today);
      day.setDate(day.getDate() - d);
      days.push(buildDay(+day, d));
    }
    memo = { key: +today, orders: days.flatMap((x) => x.orders), lost: days.map((x) => x.lost) };
  }
  return { orders: memo.orders.filter((o) => o.t <= now), lost: memo.lost };
}

// Average daily use per ingredient over the last `days` complete days.
export function usage(orders, days = 14) {
  const tot = {};
  for (const o of orders) {
    if (o.d < 1 || o.d > days) continue;
    for (const [g, q] of Object.entries(needs(Object.fromEntries(o.it)))) tot[g] = (tot[g] || 0) + q;
  }
  for (const g in tot) tot[g] /= days;
  return tot;
}
