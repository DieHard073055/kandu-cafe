// Manager view: kitchen board, menu & stock, inventory, supply, status. Insights live in insights.js.
import { CONFIG } from './config.js';
import { DISHES, INGREDIENTS, SUPPLIERS, QUOTES, CHANNELS, FISH } from './data.js';
import * as L from './logic.js';
import { history, usage } from './history.js';
import { S } from './store.js';
import { ui, ACT, SHEETS, bus, esc, icon, toast, time, mmss, dayName, open, copy } from './ui.js';
import { statusCard } from './customer.js';
import { insights } from './insights.js';

const { ING, DISH, SUP } = L;
const mvr = (v) => `MVR ${L.kfmt(v)}`;
const qty = (n, unit) => `${+(+n).toFixed(2)} ${unit}`;
const small = (amt, unit) => (unit === 'kg' && amt < 1 ? `${Math.round(amt * 1000)} g` : unit === 'L' && amt < 1 ? `${Math.round(amt * 1000)} ml` : qty(amt, unit));
const per = (unit) => (unit === 'pcs' ? 'pc' : unit);
const plate = (d) => `<div class="plate sm" style="--h:${d.hue}"><span>${d.emoji}</span></div>`;
const subtabs = (key, tabs) => `<div class="chips sub">${tabs.map(([id, label]) => `<button class="${ui[key] === id ? 'on' : ''}" data-act="${key}:${id}">${label}</button>`).join('')}</div>`;
const head = (eyebrow, title, right = '') => `<div class="mhead"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1></div>${right}</div>`;
const use = (now) => usage(history(now).orders);

// ---- 1. Orders -----------------------------------------------------------------
function orderCard(o, now) {
  const i = L.STAGES.indexOf(o.status), labels = L.stageLabels(o.type), pay = L.payStatus(o);
  const next = ['Start preparing', o.type === 'delivery' || o.type === 'guesthouse' ? 'Send out for delivery' : 'Mark ready', `Mark ${labels[3].toLowerCase()}`][i];
  return `<article class="ocard s-${o.status}">
    <header><b class="ono">#${o.id}</b><span class="pill t-${o.type}">${CHANNELS[o.type]}</span>${o.pre ? '<span class="pill pre">Pre-order</span>' : ''}
      ${i < 3 ? `<span class="timer" data-since="${o.at.new}" data-late="${o.eta}">${mmss(now - o.at.new)}</span>` : `<span class="timer done">${mmss(o.at.done - o.at.new)}</span>`}</header>
    <p class="where">${L.whereLabel(o)}${o.type === 'dinein' ? '' : ` · ${esc(o.name)}`}</p>
    <ul class="items">${Object.entries(o.items).map(([d, q]) => `<li><b>${q}×</b> ${DISH[d].name}</li>`).join('')}</ul>
    ${o.notes ? `<p class="knote">“${esc(o.notes)}”</p>` : ''}
    <footer><span class="paytag ${pay.ok ? 'ok' : 'wait'}">${pay.ok ? '✓' : '…'} ${pay.label}</span><b>MVR ${o.total.toFixed(2)}</b></footer>
    ${i < 3 ? `<button class="btn big stage" data-act="adv:${o.id}">${next} →</button>` : `<p class="stage-done">✓ ${labels[3]} at ${time(o.at.done)}</p>`}
  </article>`;
}
function orders(s, now) {
  const g = { active: s.orders.filter((o) => o.status !== 'done'), new: s.orders.filter((o) => o.status === 'new'), done: s.orders.filter((o) => o.status === 'done').reverse() };
  return `${head('Kitchen board', 'Orders', '<button class="btn ghost" data-act="sim">+ Simulate order</button>')}
    <div class="chips">${[['active', 'Active'], ['new', 'New'], ['done', 'Done']].map(([id, label]) => `<button class="${ui.of === id ? 'on' : ''}" data-act="of:${id}">${label} <i>${g[id].length}</i></button>`).join('')}</div>
    ${g[ui.of].map((o) => orderCard(o, now)).join('') || '<div class="empty"><span>🍃</span><b>Nothing here</b><p>Tap “Simulate order” to see one come in.</p></div>'}`;
}

// ---- 2. Menu & stock -----------------------------------------------------------
function menuPage(s) {
  return `${head('Live on the customer menu', 'Menu & Stock')}
    <div class="card list">${DISHES.map((d) => {
      const lim = L.limiting(s, d), n = Math.max(0, lim.n), on = !s.off[d.id];
      const sub = !on ? 'Switched off · customers see “Sold out”' : n ? `Limited by ${ING[lim.ing].name.toLowerCase()}` : `Out of ${ING[lim.ing].name.toLowerCase()} · shows “Sold out”`;
      return `<div class="mrow ${on && n ? '' : 'off'}">${plate(d)}<div class="grow"><b>${d.name}</b><small>${sub}</small></div><div class="pcount ${n <= 5 ? 'warn' : ''}"><b>${n}</b><small>portions</small></div><button class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="${d.name} on the menu" data-act="toggle:${d.id}"><i></i></button></div>`;
    }).join('')}</div>
    <p class="fine">Portions are worked out from the recipes and the ingredient stock, and update with every order.</p>`;
}

// ---- 3. Inventory --------------------------------------------------------------
function inventory(s, now) {
  const tabs = subtabs('inv', [['stock', 'Stock'], ['recipes', 'Recipes & cost'], ['count', 'Stock count'], ['catch', 'Catch of the day']]);
  let body = '';
  if (ui.inv === 'stock') {
    const value = INGREDIENTS.reduce((t, g) => t + s.stock[g.id] * L.unitCost(s, g.id), 0);
    const low = INGREDIENTS.filter((g) => s.stock[g.id] <= g.low);
    body = `<div class="tiles"><div class="tile"><small>Stock on hand</small><b>${mvr(value)}</b></div><div class="tile ${low.length ? 'warn' : ''}"><small>Low items</small><b>${low.length}</b></div></div>
      <div class="card list">${INGREDIENTS.map((g) => {
        const st = s.stock[g.id], isLow = st <= g.low, full = Math.max(g.low * 3, st);
        return `<div class="irow"><div class="between"><b>${g.name}</b><span class="${isLow ? 'bad' : ''}">${qty(st, g.unit)}${isLow ? ' · low' : ''}</span></div>
          <div class="level ${isLow ? 'low' : ''}"><i style="width:${(st / full) * 100}%"></i><u style="left:${(g.low / full) * 100}%"></u></div>
          <small>Low at ${qty(g.low, g.unit)} · ${g.sup ? `${SUP[s.assign[g.id]].name} · MVR ${L.unitCost(s, g.id)}/${per(g.unit)}` : 'Dhangethi fishermen · logged each morning'}</small></div>`;
      }).join('')}</div>`;
  } else if (ui.inv === 'recipes') {
    body = DISHES.map((d) => {
      const c = L.dishCost(s, d), m = L.margin(s, d) * 100;
      return `<div class="card recipe"><div class="between"><div class="rhead">${plate(d)}<div><b>${d.name}</b><small>Sells for MVR ${d.price} · costs MVR ${c.toFixed(2)}</small></div></div><span class="pill ${m < 55 ? 'bad' : m < 65 ? 'mid' : 'ok'}">${m.toFixed(0)}% margin</span></div>
        <div class="ingr">${Object.entries(d.recipe).map(([id, amt]) => `<div class="line"><span>${ING[id].name}</span><span>${small(amt, ING[id].unit)} · MVR ${(amt * L.unitCost(s, id)).toFixed(2)}</span></div>`).join('')}</div></div>`;
    }).join('');
  } else if (ui.inv === 'count') {
    const res = ui.flash?.counts;
    body = `${res ? `<div class="card result"><p class="eyebrow">Count saved</p>${res.map((r) => `<div class="line"><span><b>${ING[r.ing].name}</b><small>expected ${qty(r.expected, ING[r.ing].unit)}, counted ${qty(r.counted, ING[r.ing].unit)}</small></span><span class="${r.value < 0 ? 'bad' : 'good'}">${r.value < 0 ? '−' : '+'}MVR ${Math.abs(r.value).toFixed(0)}${r.value < 0 ? ' loss' : ''}</span></div>`).join('')}</div>` : ''}
      <p class="fine">Count what’s on the shelf. Leave a line empty to skip it. The gap is recorded as waste or loss.</p>
      <div class="card list">${INGREDIENTS.map((g) => `<label class="crow"><span><b>${g.name}</b><small>Expected ${qty(s.stock[g.id], g.unit)}</small></span><input type="number" inputmode="decimal" min="0" step="any" placeholder="${+s.stock[g.id].toFixed(2)}" data-cnt="${g.id}" aria-label="Counted ${g.name}"><em>${g.unit}</em></label>`).join('')}</div>
      <button class="btn big" data-act="savecount">Save count</button>
      <p class="eyebrow">Recent counts</p>
      <div class="card list">${s.counts.slice().sort((a, b) => b.at - a.at).slice(0, 8).map((r) => `<div class="line"><span><b>${ING[r.ing].name}</b><small>${new Date(r.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · expected ${qty(r.expected, ING[r.ing].unit)}, counted ${qty(r.counted, ING[r.ing].unit)}</small></span><span class="${r.value < 0 ? 'bad' : 'good'}">${r.value < 0 ? '−' : '+'}MVR ${Math.abs(r.value).toFixed(0)}</span></div>`).join('')}</div>`;
  } else {
    const d = DISH.catch, n = L.portions(s, d);
    body = `<div class="card catchlog"><div class="catch-art sm"><span>🐟</span></div><p class="eyebrow">Received today · ${time(s.catch.at)}</p><h2>${esc(s.catch.fish)}</h2>
        <div class="tiles"><div class="tile"><small>Landed</small><b>${qty(s.catch.kg, 'kg')}</b></div><div class="tile"><small>In stock</small><b>${qty(s.stock.reef, 'kg')}</b></div><div class="tile ${n <= 5 ? 'warn' : ''}"><small>Portions left</small><b>${n}</b></div></div>
        <small>${small(d.recipe.reef, 'kg')} of fish per portion. The customer menu shows portions left, live.</small></div>
      <div class="card"><p class="eyebrow">Log a landing</p>
        <label class="field"><span>Fish</span><select id="catch-fish">${FISH.map((f) => `<option ${f === s.catch.fish ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
        <label class="field"><span>Weight received (kg)</span><input id="catch-kg" type="number" inputmode="decimal" min="0" step="any" placeholder="e.g. 8"></label>
        <button class="btn big" data-act="logcatch">Log today’s catch</button></div>`;
  }
  return `${head('Ingredients & recipes', 'Inventory')}${tabs}${body}`;
}

// ---- 4. Supply -----------------------------------------------------------------
const listText = (s, sup, lines, boat) => `${CONFIG.cafeName} order for the ${dayName(boat.date)} boat\n${SUP[sup].name}\n${lines.map((l) => `• ${ING[l.ing].name}: ${qty(l.qty, ING[l.ing].unit)}`).join('\n')}\nPlease confirm price and availability. Thank you!`;
const rfqText = (s, boat) => `Hello, this is ${CONFIG.cafeName}, ${CONFIG.island.split(' ·')[0]}.\nPlease send your best quote for the ${dayName(boat.date)} boat:\n${(s.list.length ? s.list : L.restock(s, use(Date.now()), Date.now()).filter((r) => r.qty)).map((l) => `• ${ING[l.ing].name}: ${qty(l.qty, ING[l.ing].unit)}`).join('\n')}\nA PDF quote is perfect. Thank you!`;

function supply(s, now) {
  const boat = L.nextBoat(now), rs = L.restock(s, use(now), now), sugg = Object.fromEntries(rs.map((r) => [r.ing, r]));
  const out = rs.filter((r) => r.runsOut), inList = new Set(s.list.map((l) => l.ing));
  const strip = `<div class="boat"><span class="boat-ic">⛴️</span><div><b>Next supply boat: ${dayName(boat.date)}</b><small>in ${boat.days} day${boat.days > 1 ? 's' : ''} · ${out.length ? `${out.length} item${out.length > 1 ? 's' : ''} will run out first: ${out.map((r) => ING[r.ing].name.toLowerCase()).join(', ')}` : 'nothing runs out before it arrives'}</small></div></div>`;
  const tabs = subtabs('sup', [['restock', 'Restock'], ['list', `Order list${s.list.length ? ` · ${s.list.length}` : ''}`], ['quotes', 'Quotes'], ['suppliers', 'Suppliers'], ['receive', 'Receiving']]);
  let body = '';
  if (ui.sup === 'restock') {
    const todo = rs.filter((r) => r.qty && !inList.has(r.ing));
    body = `<div class="between"><p class="fine">From average daily use, days to the boat, current stock and a ${Math.round(CONFIG.safetyBuffer * 100)}% safety buffer.</p>${todo.length ? `<button class="btn sm" data-act="requestall">Request all ${todo.length}</button>` : ''}</div>
      <div class="card list">${rs.map((r) => {
        const g = ING[r.ing], d = Math.min(r.daysLeft, 99);
        return `<div class="rrow"><div class="grow"><b>${g.name}</b><small>${qty(s.stock[g.id], g.unit)} left · uses about ${r.avg} ${g.unit} a day</small>
          <div class="days ${r.runsOut ? 'low' : ''}"><i style="width:${Math.min(100, (d / 7) * 100)}%"></i><u style="left:${(boat.days / 7) * 100}%" title="Boat"></u></div>
          <small class="${r.runsOut ? 'bad' : ''}">${r.runsOut ? `Runs out in ${d.toFixed(1)} days, before the boat` : `${d.toFixed(1)} days of stock`}</small></div>
          ${r.qty ? (inList.has(r.ing) ? '<span class="pill ok">✓ On the list</span>' : `<button class="btn sm" data-act="request:${r.ing}">Request ${r.qty} ${g.unit}</button>`) : '<span class="pill">Enough</span>'}</div>`;
      }).join('')}</div>`;
  } else if (ui.sup === 'list') {
    const groups = SUPPLIERS.map((sp) => ({ sp, lines: s.list.filter((l) => s.assign[l.ing] === sp.id) })).filter((g) => g.lines.length);
    body = groups.map(({ sp, lines }) => `<div class="card group"><div class="between"><div><b>${sp.name}</b><small>${sp.city} · ${sp.phone}</small></div><b>${mvr(lines.reduce((t, l) => t + l.qty * L.unitCost(s, l.ing), 0))}</b></div>
      ${lines.map((l) => {
        const g = ING[l.ing], best = L.cheapest(s, l.ing), price = L.unitCost(s, l.ing), diff = price - best.price;
        return `<div class="oline"><div class="between"><b>${g.name}</b><button class="x" data-act="unlist:${l.ing}" aria-label="Remove ${g.name}">×</button></div>
          <div class="oline-g"><label><span>Quantity (${g.unit})</span><input type="number" inputmode="decimal" min="0" step="any" value="${l.qty}" data-chg="qty:${l.ing}"></label>
            <label><span>Supplier</span><select data-chg="assign:${l.ing}">${SUPPLIERS.filter((x) => s.prices[x.id][l.ing]).map((x) => `<option value="${x.id}" ${x.id === sp.id ? 'selected' : ''}>${x.name} · ${s.prices[x.id][l.ing]}</option>`).join('')}</select></label></div>
          <small>Suggested ${qty(sugg[l.ing]?.qty || 0, g.unit)} · last order ${s.lastQty[l.ing] ? qty(s.lastQty[l.ing], g.unit) : 'none'} · MVR ${price}/${per(g.unit)}</small>
          ${diff > 0.001 ? `<p class="hint"><span>💡 ${SUP[best.sup].name} sells this for MVR ${+diff.toFixed(2)}/${per(g.unit)} less</span><button class="link" data-act="switch:${l.ing}">Switch</button></p>` : ''}</div>`;
      }).join('')}
      <div class="btnrow"><button class="btn ghost" data-act="copylist:${sp.id}">Copy list</button><button class="btn" data-act="send:${sp.id}">Mark as sent</button></div></div>`).join('')
      || '<div class="empty"><span>📝</span><b>The order list is empty</b><p>Request items from the Restock tab and they land here, grouped by supplier.</p></div>';
  } else if (ui.sup === 'quotes') {
    const rows = INGREDIENTS.filter((g) => g.sup);
    body = `<button class="btn big ghost" data-act="sheet:rfq">Request quotes from all suppliers</button>
      <p class="eyebrow">Quotes received (PDF)</p>
      ${QUOTES.map((q) => `<div class="card quote"><span class="pdf">PDF</span><div class="grow"><b>${SUP[q.sup].name}</b><small>Quote ${q.no} · ${Object.keys(q.lines).length} lines · <a href="${q.file}" target="_blank" rel="noopener">view PDF</a></small></div>${s.imported[q.sup] ? '<span class="pill ok">✓ Imported</span>' : `<button class="btn sm" data-act="importq:${q.sup}">Import</button>`}</div>`).join('')}
      <p class="eyebrow">Compare prices</p>
      ${ui.flash?.saved ? `<div class="card result"><b>${ui.flash.saved.moved ? `Moved ${ui.flash.saved.moved} items to cheaper suppliers` : 'Already on the cheapest supplier for everything'}</b>${ui.flash.saved.moved ? `<small>Saves MVR ${ui.flash.saved.list.toFixed(0)} on the current order list and about <b>MVR ${L.kfmt(ui.flash.saved.month)} a month</b>.</small>` : ''}</div>` : ''}
      <div class="card cmp"><table><thead><tr><th>MVR per unit</th>${SUPPLIERS.map((x) => `<th>${x.name.split(' ')[0]}</th>`).join('')}</tr></thead><tbody>
        ${rows.map((g) => { const best = L.cheapest(s, g.id); return `<tr><th>${g.name}<small>/${per(g.unit)}</small></th>${SUPPLIERS.map((x) => { const p = s.prices[x.id][g.id]; return `<td class="${p && x.id === best.sup ? 'best' : ''} ${s.assign[g.id] === x.id ? 'cur' : ''}">${p ?? '–'}</td>`; }).join('')}</tr>`; }).join('')}
      </tbody></table><p class="fine"><span class="k best">cheapest</span><span class="k cur">buying from</span></p></div>
      <button class="btn big" data-act="cheapest">Use cheapest for everything</button>`;
  } else if (ui.sup === 'suppliers') {
    body = SUPPLIERS.map((sp) => `<div class="card supplier"><div class="between"><div><b>${sp.name}</b><small>${sp.city}</small></div><a class="btn sm ghost" href="tel:${sp.phone.replace(/\s/g, '')}">${sp.phone}</a></div>
      <div class="pricechips">${Object.entries(s.prices[sp.id]).map(([id, p]) => `<span class="${s.assign[id] === sp.id ? 'on' : ''}">${ING[id].name} <b>${p}</b>/${per(ING[id].unit)}</span>`).join('')}</div>
      <small>${Object.values(s.assign).filter((x) => x === sp.id).length} items bought here · ${s.imported[sp.id] ? 'prices from the latest quote' : 'latest known prices'}</small></div>`).join('');
  } else {
    body = s.sent.map((po) => `<div class="card po"><div class="between"><div><b>${po.id} · ${SUP[po.sup].name}</b><small>Sent ${dayName(po.at)} ${time(po.at)}</small></div><span class="pill ${po.arrived ? 'ok' : 'mid'}">${po.arrived ? '✓ Received' : 'On the boat'}</span></div>
      ${po.lines.map((l) => `<div class="line"><span>${ING[l.ing].name}</span><span>${po.arrived ? `<b class="${l.got < l.qty ? 'bad' : ''}">${qty(l.got, ING[l.ing].unit)}</b> of ${qty(l.qty, ING[l.ing].unit)}` : qty(l.qty, ING[l.ing].unit)}</span></div>`).join('')}
      ${po.arrived ? '' : `<button class="btn big" data-act="sheet:arrive:${po.id}">Arrived</button>`}</div>`).join('') || '<div class="empty"><span>⛴️</span><b>No orders sent yet</b></div>';
  }
  return `${head('Ordering from suppliers', 'Supply')}${strip}${tabs}${body}`;
}

// ---- 5. Status -----------------------------------------------------------------
function statusPage(s, now) {
  const mode = L.effectiveMode(s, now);
  return `${head('What customers see right now', 'Status')}
    <div class="modes">${[['open', 'Open', '🟢'], ['prayer', 'Prayer break', '🕌'], ['closed', 'Closed', '🌙']].map(([id, label, ic]) => `<button class="${mode === id ? 'on' : ''}" data-act="mode:${id}"><span>${ic}</span><b>${label}</b><small>${id === 'prayer' ? (mode === 'prayer' ? `<span data-cd="${s.status.prayerEnds}">${mmss(s.status.prayerEnds - now)}</span> left` : `${CONFIG.prayerMinutes} min, reopens itself`) : id === 'open' ? 'Taking orders' : 'Pre-orders only'}</small></button>`).join('')}</div>
    <div class="card"><div class="between"><b>Wait time</b><b class="waitnum"><span id="waitv">${s.status.wait}</span> min</b></div>
      <input type="range" min="5" max="60" step="5" value="${s.status.wait}" data-chg="wait" data-inp="waitlive" aria-label="Wait time in minutes"><div class="between fine"><span>5</span><span>60 min</span></div></div>
    <p class="eyebrow">Live preview</p>
    <div class="preview theme-c"><p class="eyebrow">${CONFIG.island}</p><b class="pv-name">${CONFIG.cafeName}</b>${statusCard(s, now)}</div>
    <p class="fine">Open the Customer view in another tab and watch it change as you tap.</p>`;
}

const NAV = [['orders', 'Orders', 'orders'], ['menu', 'Menu', 'menu'], ['inventory', 'Stock', 'box'], ['supply', 'Supply', 'boat'], ['status', 'Status', 'clock'], ['insights', 'Insights', 'chart']];
export function manager(r, s, now) {
  const pages = { orders, menu: menuPage, inventory, supply, status: statusPage, insights };
  const nNew = s.orders.filter((o) => o.status === 'new').length;
  return {
    view: `<section class="pad">${(pages[r.page] || orders)(s, now)}</section>`,
    bar: '',
    nav: `<nav class="tabs six">${NAV.map(([id, label, ic]) => `<a href="#/m/${id}" class="${r.page === id ? 'on' : ''}">${icon(ic)}<span>${label}</span>${id === 'orders' && nNew ? `<i class="nb">${nNew}</i>` : ''}</a>`).join('')}</nav>`,
  };
}

// ---- sheets ------------------------------------------------------------------
SHEETS.rfq = (s) => {
  const text = rfqText(s, L.nextBoat(Date.now()));
  return { title: 'Request quotes', body: `<p class="fine">Send this to ${SUPPLIERS.map((x) => x.name).join(', ')}.</p><pre class="msg">${esc(text)}</pre>`, foot: `<button class="btn big" data-act="copytext">Copy message</button>`, text };
};
SHEETS.text = () => ({ title: 'Copy this', body: `<textarea class="msg" rows="9" readonly>${esc(ui.arg)}</textarea><p class="fine">Select the text and copy it.</p>` });
SHEETS.scanq = (s) => {
  const a = ui.arg, q = QUOTES.find((x) => x.sup === a.sup);
  if (a.phase === 'scan') return { title: `Reading ${SUP[a.sup].name}`, body: `<div class="docscan"><div class="doc"><b>${SUP[a.sup].name}</b><small>Quotation ${q.no}</small>${Object.keys(q.lines).map((_, i) => `<i style="--i:${i}"></i>`).join('')}</div><u></u></div><p class="center fine">Scanning the PDF and pulling out every line…</p>` };
  const ch = Object.fromEntries(a.changes.map((c) => [c.ing, c]));
  return {
    title: `${Object.keys(q.lines).length} lines imported`,
    body: `<p class="fine">Prices for ${SUP[a.sup].name} are updated everywhere: recipe costs, margins and the order list.</p>
      <div class="card list">${Object.entries(q.lines).map(([id, p], i) => { const c = ch[id]; const pct = c ? ((c.to - c.from) / c.from) * 100 : 0; return `<div class="line pop" style="--i:${i}"><span><b>${ING[id].name}</b><small>per ${per(ING[id].unit)}</small></span><span>MVR ${p}${c ? ` <em class="${pct > 0 ? 'bad' : 'good'}">${pct > 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}%</em>` : ''}</span></div>`; }).join('')}</div>
      <p class="fine">In this demo the lines are pre-extracted. In the real product an AI document reader does this for any supplier’s PDF.</p>`,
    foot: `<button class="btn big" data-act="close">Done</button>`,
  };
};
SHEETS.arrive = (s) => {
  const po = s.sent.find((p) => p.id === ui.arg);
  return { title: `${po.id} arrived`, body: `<p class="fine">Change any line that came short or damaged. Stock goes up by what actually arrived.</p><div class="card list">${po.lines.map((l) => `<label class="crow"><span><b>${ING[l.ing].name}</b><small>Ordered ${qty(l.qty, ING[l.ing].unit)}</small></span><input type="number" inputmode="decimal" min="0" step="any" value="${l.qty}" data-got="${l.ing}" aria-label="${ING[l.ing].name} received"><em>${ING[l.ing].unit}</em></label>`).join('')}</div>`, foot: `<button class="btn big" data-act="arrived:${po.id}">Confirm arrival</button>` };
};

// ---- actions -----------------------------------------------------------------
const addLine = (s, ing, q) => { if (!s.list.some((l) => l.ing === ing)) s.list.push({ ing, qty: q }); };
Object.assign(ACT, {
  of: (v) => { ui.of = v; },
  inv: (v) => { ui.inv = v; ui.flash = null; },
  sup: (v) => { ui.sup = v; ui.flash = null; },
  sim: () => { if (!L.simOrder(S(), Date.now())) toast('Kitchen is out of stock', 'Receive a delivery or log a catch first.', 'warn'); else ui.of = ui.of === 'done' ? 'active' : ui.of; },
  adv: (id) => L.advance(S(), +id, Date.now()),
  toggle: (id) => { const s = S(); if (s.off[id]) delete s.off[id]; else s.off[id] = true; },
  savecount: () => {
    const counted = Object.fromEntries([...document.querySelectorAll('[data-cnt]')].map((el) => [el.dataset.cnt, el.value]));
    const recs = L.applyCount(S(), counted, Date.now());
    if (!recs.length) return toast('Nothing counted yet', 'Type what you counted next to an ingredient.', 'warn');
    ui.flash = { counts: recs };
    const loss = recs.reduce((t, r) => t + Math.min(0, r.value), 0);
    toast('Stock count saved', loss < 0 ? `MVR ${Math.abs(loss).toFixed(0)} recorded as waste or loss.` : 'Stock matches the books.');
  },
  logcatch: () => {
    const kg = Number(document.getElementById('catch-kg').value), s = S();
    if (!(kg > 0)) return toast('Enter the weight', 'How many kg came in?', 'warn');
    s.catch = { fish: document.getElementById('catch-fish').value, kg, at: Date.now() };
    s.stock.reef = +(s.stock.reef + kg).toFixed(2);
    toast('Catch logged', `${L.portions(s, DISH.catch)} portions now on the menu.`);
  },
  request: (ing) => { const s = S(), r = L.restock(s, use(Date.now()), Date.now()).find((x) => x.ing === ing); addLine(s, ing, r.qty); L.note(s, 'Restock request', `${ING[ing].name}: ${qty(r.qty, ING[ing].unit)} → ${CONFIG.restockContact}`, Date.now(), { staff: true }); },
  requestall: () => { const s = S(), rs = L.restock(s, use(Date.now()), Date.now()).filter((r) => r.qty && !s.list.some((l) => l.ing === r.ing)); rs.forEach((r) => addLine(s, r.ing, r.qty)); L.note(s, 'Restock request', `${rs.length} items added to the order list → ${CONFIG.restockContact}`, Date.now(), { staff: true }); },
  unlist: (ing) => { const s = S(); s.list = s.list.filter((l) => l.ing !== ing); },
  qty: (ing, el) => { const l = S().list.find((x) => x.ing === ing), v = Number(el.value); if (l && v >= 0) l.qty = v; },
  assign: (ing, el) => { if (S().prices[el.value]?.[ing]) S().assign[ing] = el.value; },
  switch: (ing) => { S().assign[ing] = L.cheapest(S(), ing).sup; },
  copylist: (sup) => { const s = S(); copy(listText(s, sup, s.list.filter((l) => s.assign[l.ing] === sup), L.nextBoat(Date.now()))); },
  copytext: () => copy(SHEETS.rfq(S()).text),
  send: (sup) => { const po = L.sendOrder(S(), sup, Date.now()); if (po) toast(`${po.id} sent`, `${SUP[sup].name} · find it under Receiving when the boat lands.`); },
  importq: (sup) => {
    open('scanq', { sup, phase: 'scan' });
    setTimeout(() => {
      if (ui.sheet !== 'scanq') return;
      ui.arg = { sup, phase: 'done', changes: L.importQuote(S(), sup) };
      bus.commit();
    }, 2600);
  },
  cheapest: () => { ui.flash = { saved: L.useCheapest(S(), use(Date.now())) }; },
  arrived: (id) => {
    const got = Object.fromEntries([...document.querySelectorAll('[data-got]')].map((el) => [el.dataset.got, el.value]));
    L.receive(S(), id, got, Date.now());
    open(null);
    toast('Stock updated', `${id} received. The menu has the new portions.`);
  },
  mode: (m) => { const st = S().status; st.mode = m; st.prayerEnds = m === 'prayer' ? Date.now() + CONFIG.prayerMinutes * L.MIN : 0; },
  wait: (_, el) => { S().status.wait = +el.value; },
  waitlive: (_, el) => { document.getElementById('waitv').textContent = el.value; },
});
