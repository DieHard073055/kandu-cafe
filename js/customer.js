// Customer view: status, order type, live menu, bottom-sheet checkout, order tracking.
import { CONFIG } from './config.js';
import { DISHES, CATS, GUESTHOUSES, CHANNELS, CAFE } from './data.js';
import * as L from './logic.js';
import { S } from './store.js';
import { ui, ACT, SHEETS, bus, esc, icon, islandMap, mapPoint, toast, time, mmss, go, open, copy } from './ui.js';

const money = (v) => L.money(v, S().cur);
const TYPES = [['dinein', 'Dine-in', 'table'], ['pickup', 'Pickup', 'bag'], ['delivery', 'Delivery', 'pin'], ['guesthouse', 'Guesthouse', 'bed']];
const PAY = { dinein: ['card', 'transfer', 'tab'], pickup: ['card', 'transfer', 'tab'], delivery: ['cod', 'transfer', 'card'], guesthouse: ['room', 'card'] };
const PAY_INFO = {
  card: ['Card', 'Visa or Mastercard, pay now'],
  transfer: ['Bank transfer', 'Upload your receipt after ordering'],
  tab: ['Add to my tab', 'For regulars with an account'],
  cod: ['Cash on delivery', 'Pay the rider'],
  room: ['Charge to my room', 'Settle at checkout with your guesthouse'],
};
const RIDE_MS = 40000; // demo speed for the rider on the tracking map

export function statusCard(s, now) {
  const mode = L.effectiveMode(s, now);
  if (mode === 'open') return `<div class="status open"><i class="dot"></i><div><b>Open now</b><span>Kitchen is cooking · about ${s.status.wait} min wait</span></div><em>${s.status.wait}<small>min</small></em></div>`;
  if (mode === 'prayer') return `<div class="status prayer"><i class="dot"></i><div><b>Prayer break</b><span>Back shortly · pre-orders are open</span></div><em data-cd="${s.status.prayerEnds}">${mmss(s.status.prayerEnds - now)}</em></div>`;
  return `<div class="status closed"><i class="dot"></i><div><b>Closed for now</b><span>Pre-order and we’ll cook when we open</span></div><em>🌙</em></div>`;
}

// What still has to be chosen before this order type can be placed.
function missing(c) {
  if (c.type === 'dinein' && !c.table) return { msg: 'Scan your table’s QR code', sheet: 'scan' };
  if (c.type === 'delivery' && !c.pin) return { msg: 'Drop a pin for delivery', sheet: 'map' };
  if (c.type === 'guesthouse' && !(c.gh && c.room)) return { msg: 'Choose guesthouse and room', sheet: 'gh' };
  return null;
}
function typeDetail(s, now) {
  const c = s.cart, need = missing(c);
  if (need) return `<button class="tdetail todo" data-act="sheet:${need.sheet}">${icon(TYPES.find((t) => t[0] === c.type)[2])}<span><b>${need.msg}</b><small>${{ scan: 'Your table number fills in automatically', map: 'No street address needed', gh: 'We deliver to your door and charge your room' }[need.sheet]}</small></span><em>›</em></button>`;
  const [title, sub, sheet] = {
    dinein: [`Table ${c.table}`, 'Scanned from your table’s QR code. We’ll bring it over.', 'scan'],
    pickup: [`Ready about ${time(now + s.status.wait * L.MIN)}`, 'Collect at the counter. We’ll message you when it’s ready.', null],
    delivery: [`Near ${c.pin ? L.nearest(c.pin).name : ''}`, `About ${L.etaMin(s, 'delivery', c.pin)} min · delivery ${money(CONFIG.deliveryFee)}`, 'map'],
    guesthouse: [`${L.GH[c.gh]?.name} · Room ${esc(c.room)}`, 'Delivered to your door and charged to your room.', 'gh'],
  }[c.type];
  return `<div class="tdetail">${icon(TYPES.find((t) => t[0] === c.type)[2])}<span><b>${title}</b><small>${sub}</small></span>${sheet ? `<button class="link" data-act="sheet:${sheet}">Change</button>` : ''}</div>`;
}

function stepper(s, d) {
  const q = s.cart.items[d.id] || 0;
  if (!q) return `<button class="add" data-act="add:${d.id}" aria-label="Add ${d.name}" ${L.canAdd(s, s.cart.items, d.id) ? '' : 'disabled'}>+</button>`;
  return `<div class="stepper"><button data-act="sub:${d.id}" aria-label="One less ${d.name}">−</button><b>${q}</b><button data-act="add:${d.id}" aria-label="One more ${d.name}" ${L.canAdd(s, s.cart.items, d.id) ? '' : 'disabled'}>+</button></div>`;
}
const plate = (d, cls = '') => `<div class="plate ${cls}" style="--h:${d.hue}"><span>${d.emoji}</span></div>`;

function dishCard(s, d) {
  const n = L.portions(s, d), out = n <= 0;
  const badge = out ? '' : n <= 5 ? `<span class="left">Only ${n} left</span>` : '';
  return `<article class="dish ${out ? 'out' : ''}">${plate(d)}
    <div class="dish-info"><h3>${d.name}</h3><p class="dv">${d.dv}</p><p class="desc">${d.desc}</p><div class="dish-foot"><b class="price">${money(d.price)}</b>${badge}<span class="act">${out ? '<span class="sold">Sold out</span>' : stepper(s, d)}</span></div></div></article>`;
}

function catchCard(s) {
  const d = L.DISH.catch, n = L.portions(s, d), max = Math.max(n, Math.round(s.catch.kg / d.recipe.reef));
  return `<section class="catch ${n ? '' : 'out'}">
    <div class="catch-art"><span>🐟</span></div>
    <p class="eyebrow">Catch of the day · landed ${time(s.catch.at)}</p>
    <h2>${esc(s.catch.fish)}</h2>
    <p>${d.desc}</p>
    <div class="catch-left"><div class="meter"><i style="width:${(n / max) * 100}%"></i></div><span>${n ? `${n} portion${n > 1 ? 's' : ''} left today` : 'Sold out for today'}</span></div>
    <div class="catch-foot"><b class="price">${money(d.price)}</b>${n ? stepper(s, d) : '<span class="sold">Sold out</span>'}</div>
  </section>`;
}

function home(s, now) {
  const c = s.cart;
  return `<section class="hero">
      <svg class="waves" viewBox="0 0 430 60" preserveAspectRatio="none" aria-hidden="true"><path class="w1" d="M0,30 C70,5 140,55 215,30 C290,5 360,55 430,30 C500,5 570,55 645,30 C720,5 790,55 860,30 V60 H0 Z"/><path class="w2" d="M0,38 C80,18 150,58 215,38 C290,18 350,58 430,38 C510,18 580,58 645,38 C720,18 780,58 860,38 V60 H0 Z"/></svg>
      <p class="eyebrow">${CONFIG.island}</p>
      <h1>${CONFIG.cafeName}</h1>
      <p class="tagline">Fresh from the lagoon, cooked to order.</p>
      ${statusCard(s, now)}
    </section>
    <section class="pad">
      <h2 class="h">How would you like it?</h2>
      <div class="types">${TYPES.map(([id, label, ic]) => `<button class="${c.type === id ? 'on' : ''}" data-act="type:${id}">${icon(ic)}<span>${label}</span></button>`).join('')}</div>
      ${typeDetail(s, now)}
    </section>
    ${catchCard(s)}
    <section class="pad">
      <div class="between"><h2 class="h">Menu</h2><div class="seg mini">${['MVR', 'USD'].map((x) => `<button class="${s.cur === x ? 'on' : ''}" data-act="cur:${x}">${x}</button>`).join('')}</div></div>
      <div class="chips">${CATS.map(([id, label]) => `<button class="${ui.cat === id ? 'on' : ''}" data-act="cat:${id}">${label}</button>`).join('')}</div>
      <div class="dishes">${DISHES.filter((d) => d.id !== 'catch' && (ui.cat === 'all' || d.cat === ui.cat)).map((d) => dishCard(s, d)).join('')}</div>
      <p class="fine">Prices exclude ${Math.round(CONFIG.gstRate * 100)}% GST. USD is approximate at ${CONFIG.usdRate} MVR.</p>
    </section>`;
}

export function riderXY(o, now) {
  const dest = o.pin || L.GH[o.gh];
  const p = o.status === 'done' ? 1 : o.status === 'ready' ? Math.min(1, (now - o.at.ready) / RIDE_MS) : 0;
  return { id: o.id, x: +(CAFE.x + (dest.x - CAFE.x) * p).toFixed(1), y: +(CAFE.y + (dest.y - CAFE.y) * p).toFixed(1) };
}

function payCard(o) {
  const st = L.payStatus(o), p = o.pay;
  if (p.method !== 'transfer' || p.paid) return `<div class="card paycard ok-${st.ok}"><span class="tick">${st.ok ? '✓' : '…'}</span><div><b>${st.label}</b><small>${money(o.total)}${p.ref ? ` · ref ${p.ref}` : ''}</small></div></div>`;
  if (p.uploadedAt) return `<div class="card paycard verifying"><span class="spin"></span><div><b>Checking your transfer</b><small>Usually confirmed within 5 minutes. You can close this page.</small></div></div>`;
  return `<div class="card bank"><p class="eyebrow">Pay by bank transfer</p>
    <dl><dt>Bank</dt><dd>${CONFIG.bank.bank}</dd><dt>Account name</dt><dd>${CONFIG.bank.name}</dd><dt>Account</dt><dd>${CONFIG.bank.account}</dd><dt>Amount</dt><dd><b>MVR ${o.total.toFixed(2)}</b></dd>
    <dt>Reference</dt><dd><button class="ref" data-act="copyref:${p.ref}">${p.ref} <small>copy</small></button></dd></dl>
    <label class="btn big"><input type="file" accept="image/*" hidden data-chg="proof:${o.id}">Upload payment screenshot</label>
    <p class="fine">Put the reference in the transfer remarks so we can match it automatically.</p></div>`;
}

function track(s, id, now) {
  const o = s.orders.find((x) => x.id === +id && x.mine);
  if (!o) return `<section class="pad"><div class="empty"><span>🧾</span><b>We can’t find that order</b><a class="btn" href="#/c">Back to the menu</a></div></section>`;
  const i = L.STAGES.indexOf(o.status), labels = L.stageLabels(o.type);
  const head = [o.pre ? 'Pre-order received' : 'Order received', 'Being prepared', o.type === 'dinein' ? 'On its way to your table' : o.type === 'pickup' ? 'Ready to collect' : 'Out for delivery', o.type === 'dinein' ? 'Enjoy your meal' : o.type === 'pickup' ? 'Collected. Enjoy!' : 'Delivered. Enjoy!'][i];
  const dest = o.pin || L.GH[o.gh];
  return `<section class="pad track">
    <a class="back" href="#/c/orders">‹ My orders</a>
    <p class="eyebrow">Order #${o.id}${o.pre ? ' · Pre-order' : ''} · ${CHANNELS[o.type]}</p>
    <h1 class="track-h">${head}</h1>
    <p class="track-sub">${L.whereLabel(o)} · ${i < 3 ? `estimated ${time(o.at.new + o.eta * L.MIN)}` : `at ${time(o.at.done)}`}</p>
    <div class="progress" style="--p:${i / 3}"><div class="bar"><i></i></div>${labels.map((l, k) => `<div class="step ${k <= i ? 'on' : ''} ${k === i && i < 3 ? 'now' : ''}"><span>${k < i || i === 3 ? '✓' : k + 1}</span><small>${l}</small></div>`).join('')}</div>
    ${dest ? `<div class="card mapcard">${islandMap({ pin: dest, rider: riderXY(o, now), labels: false })}<p>${i === 2 ? '🛵 Your rider is on the way' : i === 3 ? '📍 Delivered' : '☕ Your rider leaves from the café when it’s ready'}</p></div>` : ''}
    ${payCard(o)}
    <div class="card"><p class="eyebrow">Your order</p>
      ${Object.entries(o.items).map(([d, q]) => `<div class="line"><span><b>${q}×</b> ${L.DISH[d].name}</span><span>${money(L.DISH[d].price * q)}</span></div>`).join('')}
      ${o.notes ? `<p class="knote">“${esc(o.notes)}”</p>` : ''}
      <div class="sum">${o.fee ? `<div class="line"><span>Delivery</span><span>${money(o.fee)}</span></div>` : ''}<div class="line"><span>GST</span><span>${money(o.gst)}</span></div><div class="line total"><span>Total</span><span>MVR ${o.total.toFixed(2)}</span></div></div>
    </div>
  </section>`;
}

function myOrders(s) {
  const mine = s.orders.filter((o) => o.mine).reverse();
  if (!mine.length) return `<section class="pad"><h1 class="page-h">My orders</h1><div class="empty"><span>🥥</span><b>No orders yet</b><p>Pick something from the menu and it’ll show up here, live.</p><a class="btn" href="#/c">See the menu</a></div></section>`;
  return `<section class="pad"><h1 class="page-h">My orders</h1>${mine.map((o) => {
    const i = L.STAGES.indexOf(o.status);
    return `<a class="card ord" href="#/c/track/${o.id}"><div><b>#${o.id} · ${CHANNELS[o.type]}</b><small>${Object.entries(o.items).map(([d, q]) => `${q}× ${L.DISH[d].name}`).join(', ')}</small></div><div class="ord-r"><span class="pill s-${o.status}">${L.stageLabels(o.type)[i]}</span><small>MVR ${o.total.toFixed(2)}</small></div></a>`;
  }).join('')}</section>`;
}

export function customer(r, s, now) {
  const count = Object.values(s.cart.items).reduce((a, b) => a + b, 0);
  const active = s.orders.filter((o) => o.mine && o.status !== 'done').length;
  const view = r.page === 'track' ? track(s, r.arg, now) : r.page === 'orders' ? myOrders(s) : home(s, now);
  const bar = count && r.page === 'home' ? `<button class="cartbar" data-act="sheet:cart"><span class="count">${count}</span><span>View order</span><b>${money(L.totals(s.cart.items, s.cart.type).total)}</b></button>` : '';
  const nav = `<nav class="tabs two"><a href="#/c" class="${r.page === 'home' ? 'on' : ''}">${icon('menu')}<span>Menu</span></a><a href="#/c/orders" class="${r.page !== 'home' ? 'on' : ''}">${icon('orders')}<span>My orders</span>${active ? `<i class="nb">${active}</i>` : ''}</a></nav>`;
  return { view, bar, nav };
}

// ---- sheets ------------------------------------------------------------------
const done = () => { open(ui.back || null); ui.back = null; };

SHEETS.cart = (s, now) => {
  const c = s.cart, ids = Object.keys(c.items);
  if (!ids.length) return { title: 'Your order', body: '<div class="empty"><span>🧺</span><b>Your basket is empty</b></div>' };
  const t = L.totals(c.items, c.type), need = missing(c), mode = L.effectiveMode(s, now);
  if (!PAY[c.type].includes(ui.pay)) ui.pay = PAY[c.type][0];
  const tab = s.tabs.find((x) => x.id === ui.tab);
  const over = ui.pay === 'tab' && tab.balance + t.total > tab.limit;
  const body = `
    ${mode !== 'open' ? `<p class="banner">${mode === 'prayer' ? 'We’re on a short prayer break.' : 'The café is closed right now.'} This will be a <b>pre-order</b>, cooked as soon as we reopen.</p>` : ''}
    ${ids.map((id) => { const d = L.DISH[id]; return `<div class="cline">${plate(d, 'sm')}<div><b>${d.name}</b><small>${money(d.price)}</small></div>${stepper(s, d)}</div>`; }).join('')}
    <label class="field"><span>Note for the kitchen</span><textarea rows="2" placeholder="Less chili, no onion, allergies…" data-inp="notes" maxlength="200">${esc(c.notes)}</textarea></label>
    ${need ? `<button class="tdetail todo" data-act="fix:${need.sheet}"><span><b>${need.msg}</b><small>Needed before you can order</small></span><em>›</em></button>` : `<div class="where">${icon(TYPES.find((x) => x[0] === c.type)[2])}<span>${CHANNELS[c.type]} · ${c.type === 'pickup' ? `ready about ${time(now + s.status.wait * L.MIN)}` : L.whereLabel(c)}</span></div>`}
    <div class="sum"><div class="line"><span>Subtotal</span><span>${money(t.sub)}</span></div>${t.fee ? `<div class="line"><span>Delivery fee</span><span>${money(t.fee)}</span></div>` : ''}<div class="line"><span>GST ${Math.round(CONFIG.gstRate * 100)}%</span><span>${money(t.gst)}</span></div>
      <div class="line total"><span>Total</span><span>MVR ${t.total.toFixed(2)} <small>≈ $${(t.total / CONFIG.usdRate).toFixed(2)}</small></span></div></div>
    <p class="eyebrow">Pay with</p>
    <div class="pays">${PAY[c.type].map((m) => `<button class="${ui.pay === m ? 'on' : ''}" data-act="pay:${m}"><i></i><span><b>${PAY_INFO[m][0]}</b><small>${PAY_INFO[m][1]}</small></span></button>`).join('')}</div>
    ${ui.pay === 'tab' ? `<label class="field"><span>Whose tab?</span><select data-chg="tabsel">${s.tabs.map((x) => `<option value="${x.id}" ${x.id === ui.tab ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label><p class="fine ${over ? 'bad' : ''}">${over ? `This would go over the MVR ${tab.limit} credit limit. Please choose another way to pay.` : `Balance MVR ${tab.balance.toFixed(2)} of MVR ${tab.limit} limit.`}</p>` : ''}
    ${ui.pay === 'transfer' ? `<p class="fine">${CONFIG.bank.bank} · ${CONFIG.bank.account}. You’ll get a unique reference for this order on the next screen.</p>` : ''}`;
  return { title: 'Your order', body, foot: `<button class="btn big" data-act="place" ${need || over ? 'disabled' : ''}>${mode === 'open' ? 'Place order' : 'Place pre-order'} · MVR ${t.total.toFixed(2)}</button>` };
};

SHEETS.scan = (s) => ({
  title: 'Scan your table',
  body: `<div class="scanner ${ui.arg === 'scanning' ? 'go' : ''}"><div class="qr"></div><i></i><p>${ui.arg === 'scanning' ? 'Reading the code…' : 'Point your camera at the QR code on your table'}</p></div>
    <button class="btn big" data-act="scan" ${ui.arg === 'scanning' ? 'disabled' : ''}>Scan QR code</button>
    <p class="eyebrow center">or choose your table</p>
    <div class="tablegrid">${Array.from({ length: CONFIG.tables }, (_, i) => `<button class="${s.cart.table === i + 1 ? 'on' : ''}" data-act="table:${i + 1}">${i + 1}</button>`).join('')}</div>`,
});

SHEETS.map = (s) => {
  const pin = s.cart.pin;
  return {
    title: 'Where should we deliver?',
    body: `<p class="fine">No street addresses on the island, so just tap where you are.</p><div class="mapwrap">${islandMap({ pin, pick: true })}</div>
      ${pin ? `<div class="tdetail">${icon('pin')}<span><b>Near ${L.nearest(pin).name}</b><small>About ${L.etaMin(s, 'delivery', pin)} min · delivery fee ${money(CONFIG.deliveryFee)}</small></span></div>` : ''}`,
    foot: `<button class="btn big" data-act="sheetdone" ${pin ? '' : 'disabled'}>${pin ? 'Deliver here' : 'Tap the map to drop a pin'}</button>`,
  };
};

SHEETS.gh = (s) => {
  const c = s.cart, g = L.GH[c.gh];
  return {
    title: 'Your guesthouse',
    body: `<div class="pays">${GUESTHOUSES.map((x) => `<button class="${c.gh === x.id ? 'on' : ''}" data-act="gh:${x.id}"><i></i><span><b>${x.name}</b><small>${x.rooms} rooms · charge to room available</small></span></button>`).join('')}</div>
      ${g ? `<label class="field"><span>Room number</span><select data-chg="room"><option value="">Choose…</option>${Array.from({ length: g.rooms }, (_, i) => `<option ${c.room === String(i + 1) ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label>` : ''}`,
    foot: `<button class="btn big" data-act="sheetdone" ${g && c.room ? '' : 'disabled'}>Confirm</button>`,
  };
};

// ---- actions -----------------------------------------------------------------
Object.assign(ACT, {
  type: (t) => { S().cart.type = t; },
  cat: (c) => { ui.cat = c; },
  cur: (c) => { S().cur = c; },
  add: (id) => { const c = S().cart; if (L.canAdd(S(), c.items, id)) c.items[id] = (c.items[id] || 0) + 1; else toast('That’s all we have', `No more ${L.DISH[id].name} available right now.`, 'warn'); },
  sub: (id) => { const it = S().cart.items; if (--it[id] <= 0) delete it[id]; },
  fix: (sheet) => { ui.back = 'cart'; open(sheet); },
  sheetdone: done,
  table: (n) => { S().cart.table = +n; done(); },
  scan: () => {
    ui.arg = 'scanning';
    setTimeout(() => {
      if (ui.sheet !== 'scan') return;
      const t = 1 + Math.floor(Math.random() * CONFIG.tables);
      S().cart.table = t;
      done();
      toast(`Table ${t}`, 'Scanned. We’ll bring your order to you.');
      bus.commit();
    }, 1700);
  },
  pin: (_, svg, e) => { const p = mapPoint(svg, e); if (p) S().cart.pin = p; else toast('That’s the lagoon', 'Drop the pin somewhere on the island.', 'warn'); },
  gh: (id) => { const c = S().cart; if (c.gh !== id) c.room = ''; c.gh = id; },
  room: (_, el) => { S().cart.room = el.value; },
  notes: (_, el) => { S().cart.notes = el.value.slice(0, 200); },
  pay: (m) => { ui.pay = m; },
  tabsel: (_, el) => { ui.tab = el.value; },
  place: () => {
    const s = S(), c = s.cart;
    if (missing(c) || !Object.keys(c.items).length) return;
    const tab = s.tabs.find((x) => x.id === ui.tab);
    const o = L.placeOrder(s, { ...c, pay: ui.pay, tab: ui.pay === 'tab' ? ui.tab : null, name: ui.pay === 'tab' ? tab.name : c.type === 'guesthouse' ? `Guest, room ${c.room}` : 'App customer', mine: true }, Date.now());
    c.items = {}; c.notes = '';
    open(null);
    go(`#/c/track/${o.id}`);
  },
  proof: (id, el) => { const o = S().orders.find((x) => x.id === +id); if (o && el.files?.length) { o.pay.uploadedAt = Date.now(); toast('Screenshot received', 'We’re matching it to your order now.'); } },
  copyref: (ref) => copy(ref, 'Reference copied. Paste it into the transfer remarks.'),
});
