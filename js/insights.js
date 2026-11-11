// Insights: the owner's questions, answered from sales history, recipes, stock counts and supplier prices.
import { CONFIG } from './config.js';
import { DISHES, INGREDIENTS, GUESTHOUSES, CHANNELS, REGULARS, PREV_PRICES, basePrices } from './data.js';
import * as L from './logic.js';
import { history, usage, HOURS, HDAYS } from './history.js';
import { S } from './store.js';
import { ui, ACT, esc, islandMap, dayName, go } from './ui.js';
import { cols, spark, hbars, gauge, scatter, heat, legend } from './charts.js';

const { ING, DISH, SUP, DAY } = L;
const CC = { dinein: 'var(--s1)', delivery: 'var(--s2)', pickup: 'var(--s3)', guesthouse: 'var(--s4)' };
const CH = Object.keys(CC);
const PEAK = new Set([12, 13, 19, 20]);
const sum = (a, f = (x) => x) => a.reduce((t, x) => t + f(x), 0);
const mvr = (v) => `MVR ${L.kfmt(v)}`;
const pct = (v) => `${(v * 100).toFixed(0)}%`;
const hr = (h) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
const dlabel = (now, d, opt = { day: 'numeric', month: 'short' }) => new Date(now - d * DAY).toLocaleDateString('en-GB', opt);
const panel = (q, headline, body, foot = '') => `<div class="card panel"><p class="eyebrow">${q}</p><h3 class="headline">${headline}</h3>${body}${foot ? `<p class="fine">${foot}</p>` : ''}</div>`;
const tile = (label, value, extra = '') => `<div class="tile"><small>${label}</small><b data-count>${value}</b>${extra}</div>`;

// Live orders in the same shape as the history rows, so "today" includes what just happened.
const liveRows = (s) => s.orders.map((o) => {
  const dt = new Date(o.at.new);
  return { t: o.at.new, d: 0, dow: dt.getDay(), h: dt.getHours(), ch: o.type, it: Object.entries(o.items), sub: o.sub, tour: o.type === 'guesthouse', pay: o.pay.method, cu: null, gh: o.gh, pin: o.type === 'delivery' ? o.pin : null, slow: null, wait: o.at.done ? (o.at.done - o.at.new) / L.MIN : null, promised: o.eta };
});

function base(s, now) {
  const { orders: H, lost } = history(now);
  const all = H.concat(liveRows(s));
  const cost = Object.fromEntries(DISHES.map((d) => [d.id, L.dishCost(s, d)]));
  const days = Array.from({ length: HDAYS }, () => ({ sales: 0, cost: 0, n: 0, dinein: 0, delivery: 0, pickup: 0, guesthouse: 0 }));
  for (const o of all) {
    o.c = sum(o.it, ([id, q]) => cost[id] * q);
    const D = days[o.d];
    D.sales += o.sub; D.cost += o.c; D.n++; D[o.ch] += o.sub;
  }
  const m30 = all.filter((o) => o.d < 30);
  const dish = Object.fromEntries(DISHES.map((d) => [d.id, { d, units: 0, rev: 0, cost: cost[d.id], margin: 1 - cost[d.id] / d.price, n: 0, t: 0, pn: 0, pt: 0 }]));
  for (const o of m30) {
    for (const [id, q] of o.it) { dish[id].units += q; dish[id].rev += q * DISH[id].price; }
    if (o.slow) { const x = dish[o.slow]; x.n++; x.t += o.prep; if (PEAK.has(o.h)) { x.pn++; x.pt += o.prep; } }
  }
  const sales30 = sum(m30, (o) => o.sub), cost30 = sum(m30, (o) => o.c);
  return { H, all, lost, days, m30, dish: Object.values(dish), sales30, cost30, use: usage(H) };
}

// ---- Today -----------------------------------------------------------------------
function today(s, now, B) {
  const span = { today: 1, '7d': 7, '30d': 30 }[ui.range];
  const cur = B.all.filter((o) => o.d < span);
  const sales = sum(cur, (o) => o.sub), n = cur.length;
  const tod = (t) => t - new Date(t).setHours(0, 0, 0, 0);
  const yest = sum(B.all.filter((o) => o.d === 1 && tod(o.t) <= tod(now)), (o) => o.sub);
  const delta = ui.range === 'today' && yest ? (sales - yest) / yest : null;
  const byCh = CH.map((c) => [c, sum(cur.filter((o) => o.ch === c), (o) => o.sub)]);
  const units = {};
  for (const o of cur) for (const [id, q] of o.it) units[id] = (units[id] || 0) + q;
  const top = Object.entries(units).sort((a, b) => b[1] * DISH[b[0]].price - a[1] * DISH[a[0]].price).slice(0, 5);
  const costCur = sum(cur, (o) => o.c);
  const loss = -sum(s.counts.filter((c) => c.at > now - 30 * DAY && c.value < 0), (c) => c.value);
  const label = { today: 'today', '7d': 'in the last 7 days', '30d': 'in the last 30 days' }[ui.range];
  return `<div class="chips sub">${[['today', 'Today'], ['7d', '7 days'], ['30d', '30 days']].map(([id, l]) => `<button class="${ui.range === id ? 'on' : ''}" data-act="range:${id}">${l}</button>`).join('')}</div>
    <div class="card hero-kpi"><small>Sales ${label}</small><b data-count>MVR ${Math.round(sales).toLocaleString('en-US')}</b>
      ${delta != null ? `<span class="delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta * 100).toFixed(0)}% vs this time yesterday</span>` : '<span class="delta">including orders still in the kitchen</span>'}
      <div class="kpi-spark" data-tip="Daily sales, previous 14 days">${spark(B.days.slice(1, 15).reverse().map((d) => d.sales), 300, 46)}</div></div>
    <div class="tiles">${tile('Orders', n)}${tile('Average ticket', `MVR ${n ? (sales / n).toFixed(0) : 0}`)}${tile('GST collected', mvr(sales * CONFIG.gstRate))}</div>
    ${panel('Sales by channel', `${CHANNELS[byCh.slice().sort((a, b) => b[1] - a[1])[0][0]]} leads ${label}`, hbars(byCh.map(([c, v]) => ({ label: CHANNELS[c], v, color: CC[c], val: mvr(v), tip: `${CHANNELS[c]}: ${mvr(v)} · ${pct(v / (sales || 1))} of sales` }))))}
    ${panel('Top-selling dishes', top.length ? `${DISH[top[0][0]].name} is the best seller` : 'No sales yet', hbars(top.map(([id, q]) => ({ label: `${DISH[id].emoji} ${DISH[id].name}`, sub: `${q} sold`, v: q * DISH[id].price, val: mvr(q * DISH[id].price), tip: `${DISH[id].name}: ${q} sold, ${mvr(q * DISH[id].price)}` }))))}
    ${panel('Ingredient cost vs revenue', `Ingredients took ${pct(costCur / (sales || 1))} of sales ${label}`, hbars([{ label: 'Revenue', v: sales, val: mvr(sales) }, { label: 'Ingredients', v: costCur, color: 'var(--neutral)', val: mvr(costCur) }, { label: 'Stock loss', sub: 'from counts, 30 days', v: loss, color: 'var(--crit)', val: mvr(loss) }]))}
    ${panel('Bank transfers', `${s.transfers.filter((t) => t.status === 'matched').length} of ${s.transfers.length} matched automatically`, `<div class="list">${s.transfers.slice().reverse().map((t) => `<div class="line"><span><b>${esc(t.from)}</b><small>${esc(t.ref)}${t.note ? ` · ${esc(t.note)}` : ''}</small></span><span>MVR ${t.amount.toFixed(2)} <em class="tagx ${t.status === 'matched' ? 'good' : 'bad'}">${{ matched: '✓ matched', unmatched: '! no match', mismatch: '! amount differs' }[t.status]}</em></span></div>`).join('')}</div>`)}
    ${panel('Credit tabs', `${mvr(sum(s.tabs, (t) => t.balance))} owed across ${s.tabs.length} tabs`, tabsList(s, now))}`;
}
const tabsList = (s, now) => `<div class="list">${s.tabs.map((t) => {
  const over = t.balance > t.limit, age = Math.floor((now - t.lastPaid) / DAY);
  return `<div class="tabrow"><div class="between"><span><b>${esc(t.name)}</b><small>${t.kind} · last paid ${age} days ago</small></span><button class="btn sm ghost" data-act="statement:${t.id}">Send statement</button></div>
    <div class="level ${over ? 'low' : ''}"><i style="width:${Math.min(100, (t.balance / t.limit) * 100)}%"></i></div>
    <small>MVR ${t.balance.toFixed(0)} of MVR ${t.limit} limit ${over ? '<em class="tagx bad">! over limit</em>' : ''}${age >= 30 ? '<em class="tagx warn">! 30+ days</em>' : ''}</small></div>`;
}).join('')}</div>`;

// ---- Am I making money? ----------------------------------------------------------
function moneySection(s, now, B) {
  const d30 = B.days.slice(0, 30).reverse(); // oldest first; index 29 is today
  const full = B.days.slice(1, 30);
  const avgProfit = sum(full, (d) => d.sales - d.cost) / full.length;
  const fc = (B.cost30 / B.sales30) * 100, [lo, hi] = CONFIG.foodCostTarget;
  const fcStatus = fc > hi ? 'crit' : fc < lo ? 'warn' : 'good';
  const totalUnits = sum(B.dish, (x) => x.units);
  const xmid = (0.7 / B.dish.length) * 100, ymid = (1 - B.cost30 / B.sales30) * 100;
  const quad = (x) => { const pop = (x.units / totalUnits) * 100 >= xmid, prof = x.margin * 100 >= ymid; return pop ? (prof ? 'Stars' : 'Plowhorses') : prof ? 'Puzzles' : 'Dogs'; };
  const byPop = B.dish.slice().sort((a, b) => b.units - a.units);
  const weak = byPop.slice(0, 5).sort((a, b) => a.margin - b.margin)[0];
  const advice = { Stars: 'Popular and profitable. Keep them exactly as they are.', Plowhorses: 'Popular but thin. Raise the price slightly or trim the portion.', Puzzles: 'Profitable but rarely ordered. Promote them.', Dogs: 'Neither popular nor profitable. Consider dropping them.' };
  return `${panel('Daily profit estimate', `About ${mvr(avgProfit)} gross profit a day`, `${cols(d30.map((d, i) => ({ label: dlabel(now, 29 - i, { day: 'numeric' }), vals: [d.cost, d.sales - d.cost], tip: `${dlabel(now, 29 - i)}: sales ${mvr(d.sales)}, ingredients ${mvr(d.cost)}, profit ${mvr(d.sales - d.cost)}` })), { colors: ['var(--neutral)', 'var(--s3)'], every: 5 })}${legend([['Ingredient cost', 'var(--neutral)'], ['Profit (sales minus ingredients)', 'var(--s3)']])}`, 'Every day, without an accountant. Wages, rent and power are not included.')}
    ${panel('Food cost %', fc > hi ? `Food cost is above target, costing about ${mvr(((fc - hi) / 100) * B.sales30)} a month` : `Food cost is ${fc < lo ? 'below' : 'inside'} your ${lo}–${hi}% target`, `<div class="gaugewrap">${gauge(fc, lo, hi, 60, fcStatus)}<div><div class="line"><span>Sales, 30 days</span><b>${mvr(B.sales30)}</b></div><div class="line"><span>Ingredients</span><b>${mvr(B.cost30)}</b></div><div class="line"><span>Left after ingredients</span><b>${mvr(B.sales30 - B.cost30)}</b></div></div></div>`, 'Recalculated from recipes and supplier prices. Import a new quote and it moves straight away.')}
    ${panel('Profit per dish', `${weak.d.name} is your #${byPop.indexOf(weak) + 1} seller but keeps only ${pct(weak.margin)}`, `${hbars(B.dish.slice().sort((a, b) => a.margin - b.margin).map((x) => ({ label: `${x.d.emoji} ${x.d.name}`, sub: `keeps MVR ${(x.d.price - x.cost).toFixed(0)} a plate`, parts: [{ v: x.cost / x.d.price, color: 'var(--neutral)' }, { v: 1 - x.cost / x.d.price, color: 'var(--s3)' }], val: pct(x.margin), tag: x.margin < 0.56 ? ['thin', 'bad'] : null, tip: `${x.d.name}: sells MVR ${x.d.price}, ingredients MVR ${x.cost.toFixed(2)}, margin ${pct(x.margin)}` })), { max: 1 })}${legend([['Ingredients', 'var(--neutral)'], ['Kept', 'var(--s3)']])}`, `Each plate of ${weak.d.name} leaves MVR ${(weak.d.price - weak.cost).toFixed(0)}. ${weak.d.recipe.chicken ? 'Chicken is the cost to watch.' : ''}`)}
    ${panel('Menu matrix', 'Which dishes to keep, fix, promote or drop', `${scatter(B.dish.map((x) => ({ x: (x.units / totalUnits) * 100, y: x.margin * 100, emoji: x.d.emoji, tip: `${x.d.name} · ${quad(x)}: ${((x.units / totalUnits) * 100).toFixed(0)}% of plates, ${pct(x.margin)} margin` })), { xmid, ymid, xmax: 22, ymin: 45, ymax: 95, quads: ['★ Stars', 'Puzzles', 'Plowhorses', 'Dogs'], xlab: 'more popular', ylab: 'more profitable' })}
      <div class="quads">${['Stars', 'Plowhorses', 'Puzzles', 'Dogs'].map((qn) => `<div class="quad q-${qn}"><b>${qn}</b><p>${B.dish.filter((x) => quad(x) === qn).map((x) => `${x.d.emoji} ${x.d.name}`).join(' · ') || 'None'}</p><small>${advice[qn]}</small></div>`).join('')}</div>`, 'Restaurant consultants charge for this analysis. Here it updates with every order.')}`;
}

// ---- Where is money leaking? -----------------------------------------------------
export function savings(s, B) {
  const baseP = basePrices();
  let potential = 0, realized = 0, n = 0;
  for (const g of INGREDIENTS.filter((x) => x.sup)) {
    const monthly = (B.use[g.id] || 0) * 30, now = L.unitCost(s, g.id), best = L.cheapest(s, g.id).price;
    if (now - best > 0.001) { potential += (now - best) * monthly; n++; }
    realized += Math.max(0, (s.prices[g.sup][g.id] ?? baseP[g.sup][g.id]) - now) * monthly;
  }
  const alerts = [];
  for (const sp of Object.keys(s.prices)) for (const [id, p] of Object.entries(s.prices[sp])) {
    const was = PREV_PRICES[sp]?.[id] ?? baseP[sp][id];
    if (p > was * 1.03) alerts.push({ sp, id, was, p, up: (p - was) / was, mine: s.assign[id] === sp });
  }
  return { potential, realized, n, alerts: alerts.sort((a, b) => b.mine - a.mine || b.up - a.up) };
}
function leaks(s, now, B) {
  const loss = {};
  for (const c of s.counts) if (c.at > now - 30 * DAY && c.value < 0) { loss[c.ing] = loss[c.ing] || { v: 0, q: 0 }; loss[c.ing].v -= c.value; loss[c.ing].q += c.expected - c.counted; }
  const rows = Object.entries(loss).sort((a, b) => b[1].v - a[1].v), totalLoss = sum(rows, (r) => r[1].v);
  const sv = savings(s, B);
  const owed = sum(s.tabs, (t) => t.balance), over = s.tabs.filter((t) => t.balance > t.limit), old = s.tabs.filter((t) => now - t.lastPaid > 30 * DAY);
  const bad = s.transfers.filter((t) => t.status !== 'matched');
  return `${panel('Stock loss', rows.length ? `You lost ${mvr(rows[0][1].v)} of ${ING[rows[0][0]].name.toLowerCase()} this month` : 'No stock loss recorded this month', hbars(rows.map(([id, r]) => ({ label: ING[id].name, sub: `${+r.q.toFixed(1)} ${ING[id].unit} missing`, v: r.v, color: 'var(--crit)', val: mvr(r.v), tip: `${ING[id].name}: expected minus counted = ${+r.q.toFixed(1)} ${ING[id].unit}, worth ${mvr(r.v)}` }))), `${mvr(totalLoss)} in total, from expected stock versus what was counted. Waste, over-portioning or theft.`)}
    ${panel('Supplier savings', sv.realized > 1 ? `Cheapest quotes are saving ${mvr(sv.realized)} a month` : `You could save ${mvr(sv.potential)} a month by switching ${sv.n} items`, `${sv.potential > 1 && sv.realized > 1 ? `<p class="fine">Another ${mvr(sv.potential)} a month is still on the table.</p>` : ''}
      <div class="list">${sv.alerts.map((a) => `<div class="line"><span><b>▲ ${SUP[a.sp].name} raised ${ING[a.id].name.toLowerCase()}</b><small>MVR ${a.was} → ${a.p} per ${ING[a.id].unit === 'pcs' ? 'pc' : ING[a.id].unit}${a.mine ? ' · you buy this here' : ''}</small></span><em class="tagx ${a.mine ? 'bad' : 'warn'}">+${(a.up * 100).toFixed(0)}%</em></div>`).join('') || '<p class="fine">No supplier has raised a price.</p>'}</div>
      <button class="btn big ghost" data-act="goquotes">Compare quotes</button>`)}
    ${panel('Outstanding credit tabs', `${mvr(owed)} owed · ${over.length} over limit · ${old.length} unpaid for 30+ days`, tabsList(s, now))}
    ${panel('Unmatched transfers', bad.length ? `${bad.length} transfers (${mvr(sum(bad, (t) => t.amount))}) didn’t match an order` : 'Every transfer matched an order', `<div class="list">${bad.map((t) => `<div class="line"><span><b>${esc(t.from)}</b><small>Reference ${esc(t.ref)}${t.note ? ` · ${esc(t.note)}` : ''}</small></span><span>MVR ${t.amount.toFixed(2)}</span></div>`).join('')}</div>`, 'Money that arrived in the bank without a clear order. Worth a phone call.')}`;
}

// ---- When and who? ---------------------------------------------------------------
function who(s, now, B) {
  const past = B.H.filter((o) => o.d >= 1);
  const dowDays = Array(7).fill(0);
  for (let d = 1; d < HDAYS; d++) dowDays[new Date(now - d * DAY).getDay()]++;
  const order = [1, 2, 3, 4, 5, 6, 0]; // Monday first
  const m = order.map(() => HOURS.map(() => 0));
  for (const o of past) m[order.indexOf(o.dow)][HOURS.indexOf(o.h)] += 1 / dowDays[o.dow];
  const names = order.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]);
  let pk = { v: 0 };
  m.forEach((row, r) => row.forEach((v, c) => { if (v > pk.v) pk = { v, r, c }; }));
  const hourAvg = HOURS.map((_, c) => sum(m, (row) => row[c]) / 7);
  const start = HOURS[hourAvg.findIndex((v) => v >= hourAvg[2] * 0.5)];

  const tourRev = sum(B.m30.filter((o) => o.tour), (o) => o.sub), locRev = B.sales30 - tourRev;
  const SEASON = [1.25, 1.3, 1.25, 1.1, 0.8, 0.65, 0.7, 0.75, 0.7, 0.85, 1, 1.3], cm = new Date(now).getMonth();
  const year = Array.from({ length: 12 }, (_, i) => { const mo = (cm + 1 + i) % 12; return { label: new Date(2026, mo, 1).toLocaleDateString('en-GB', { month: 'short' })[0], loc: locRev * (0.9 + i * 0.009), tour: (tourRev * SEASON[mo]) / SEASON[cm], name: new Date(2026, mo, 1).toLocaleDateString('en-GB', { month: 'long' }) }; });

  const d14 = B.days.slice(0, 14).reverse();
  const chan = (c) => B.m30.filter((o) => o.ch === c), del = chan('delivery'), din = chan('dinein');
  const delRev = sum(del, (o) => o.sub), delTicket = delRev / del.length, dinTicket = sum(din, (o) => o.sub) / din.length;

  const gh = GUESTHOUSES.map((g) => { const os = B.m30.filter((o) => o.gh === g.id); return { g, rev: sum(os, (o) => o.sub), n: os.length }; }).sort((a, b) => b.rev - a.rev);

  const pins = del.map((o) => o.pin).filter(Boolean), near = {};
  for (const p of pins) { const nm = L.nearest(p).name; near[nm] = (near[nm] || 0) + 1; }
  const hot = Object.entries(near).sort((a, b) => b[1] - a[1]);

  const cust = {};
  for (const o of B.m30) if (o.cu != null) { cust[o.cu] = cust[o.cu] || { n: 0, v: 0 }; cust[o.cu].n++; cust[o.cu].v += o.sub; }
  const cs = Object.entries(cust), back = cs.filter(([, c]) => c.n >= 2), topc = cs.sort((a, b) => b[1].v - a[1].v).slice(0, 5);

  return `${panel('Busy hours', `Busiest: ${names[pk.r]} at ${hr(HOURS[pk.c])}. Breakfast rush starts at ${hr(start)}`, heat(names, HOURS.map((h) => (h % 3 === 0 ? hr(h) : '')), m, (r, c, v) => `${names[r]} ${hr(HOURS[c])}: about ${v.toFixed(1)} orders an hour`), `Start the breakfast roshi by ${start - 1}:30. Fridays go quiet over Jumu’ah prayer, then become the busiest evening of the week.`)}
    ${panel('Tourists vs locals', `Tourists bring ${pct(tourRev / B.sales30)} of revenue`, `<div class="split"><i style="flex:${locRev};background:var(--s1)"></i><i style="flex:${tourRev};background:var(--s2)"></i></div>${legend([[`Locals · ${mvr(locRev)} (MVR, cash, tabs)`, 'var(--s1)'], [`Tourists · ${mvr(tourRev)} (card, USD, guesthouse)`, 'var(--s2)']])}
      <p class="eyebrow sp">Across the year</p>${cols(year.map((y) => ({ label: y.label, vals: [y.loc, y.tour], tip: `${y.name}: locals ${mvr(y.loc)}, tourists ${mvr(y.tour)}` })), { colors: ['var(--s1)', 'var(--s2)'], h: 130 })}`, 'Tourist revenue roughly doubles from the low season (June) to the high season (December to April). Locals keep the lights on all year.')}
    ${panel('Channel mix', `Delivery is ${pct(delRev / B.sales30)} of sales. ${delTicket > dinTicket ? 'Its tickets are bigger than dine-in' : 'Worth keeping'}`, `${cols(d14.map((d, i) => ({ label: dlabel(now, 13 - i, { weekday: 'narrow' }), vals: CH.map((c) => d[c]), tip: `${dlabel(now, 13 - i, { weekday: 'short', day: 'numeric' })}: ${CH.map((c) => `${CHANNELS[c]} ${mvr(d[c])}`).join(', ')}` })), { colors: CH.map((c) => CC[c]) })}${legend(CH.map((c) => [CHANNELS[c], CC[c]]))}
      <div class="tiles">${tile('Delivery orders', del.length)}${tile('Avg delivery ticket', `MVR ${delTicket.toFixed(0)}`)}${tile('Fees earned', mvr(del.length * CONFIG.deliveryFee))}</div>`, `Dine-in tickets average MVR ${dinTicket.toFixed(0)}. Delivery adds ${mvr(del.length * CONFIG.deliveryFee)} a month in fees on top of the food.`)}
    ${panel('Guesthouse partners', `${gh[0].g.name} sent ${mvr(gh[0].rev)} this month`, hbars(gh.map((x) => ({ label: x.g.name, sub: `${x.n} orders · ${x.g.rooms} rooms`, v: x.rev, color: 'var(--s4)', val: mvr(x.rev), tip: `${x.g.name}: ${x.n} orders, ${mvr(x.rev)}, MVR ${(x.rev / x.g.rooms).toFixed(0)} per room` }))), 'Real numbers to bring to a commission or partnership conversation.')}
    ${panel('Delivery heatmap', `Most deliveries go near ${hot[0][0]}`, `<div class="mapwrap">${islandMap({ heat: pins, labels: false })}</div>`, `${pins.length} deliveries in 30 days. Next: ${hot.slice(1, 3).map((x) => x[0]).join(' and ')}.`)}
    ${panel('Repeat customers', `${pct(back.length / cs.length)} of known locals came back this month`, `<div class="tiles">${tile('Local customers', cs.length)}${tile('Came back', back.length)}${tile('Orders from them', pct(sum(back, ([, c]) => c.n) / B.m30.length))}</div><p class="eyebrow sp">Top regulars</p>${hbars(topc.map(([id, c]) => ({ label: REGULARS[id] || `Regular #${+id + 1}`, sub: `${c.n} visits`, v: c.v, val: mvr(c.v), tip: `${c.n} orders, ${mvr(c.v)} in 30 days` })))}`)}`;
}

// ---- Is the kitchen keeping up? --------------------------------------------------
function kitchen(s, now, B) {
  const prep = B.dish.filter((x) => x.pn).map((x) => ({ x, avg: x.t / x.n, peak: x.pt / x.pn })).sort((a, b) => b.peak - a.peak);
  const done = B.m30.filter((o) => o.wait != null && o.promised), avgWait = sum(done, (o) => o.wait) / done.length, onTime = done.filter((o) => o.wait <= o.promised).length / done.length;
  const byH = HOURS.map((h) => { const os = done.filter((o) => o.h === h); return os.length ? sum(os, (o) => o.wait) / os.length : 0; });
  const worst = byH.indexOf(Math.max(...byH));
  const lost30 = B.lost.filter((l) => l.d < 30 && l.n), lostUnits = sum(lost30, (l) => l.n), lostMvr = lostUnits * DISH.catch.price;
  const soldDays = new Set(lost30.map((l) => l.d));
  return `${panel('Prep time per dish', `${prep[0].x.d.name} takes ${prep[0].peak.toFixed(0)} min at peak, your slowest dish`, hbars(prep.map((p) => ({ label: `${p.x.d.emoji} ${p.x.d.name}`, sub: `${p.avg.toFixed(0)} min on average`, v: p.peak, mark: p.avg, color: p.peak > CONFIG.defaultWait ? 'var(--serious)' : 'var(--s1)', val: `${p.peak.toFixed(0)} min`, tag: p.peak > CONFIG.defaultWait ? ['slow', 'warn'] : null, tip: `${p.x.d.name}: ${p.avg.toFixed(1)} min on average, ${p.peak.toFixed(1)} min at peak hours` }))), 'Bars show peak hours (12–2 and 7–9). The line marks the all-day average.')}
    ${panel('Order to served', `${avgWait.toFixed(0)} min on average. ${pct(onTime)} arrive inside the promised time`, cols(HOURS.map((h, i) => ({ label: h % 3 === 0 ? hr(h) : '', vals: [byH[i]], flag: byH[i] > CONFIG.defaultWait, tip: `${hr(h)}: ${byH[i].toFixed(1)} min from order to served` })), { colors: ['var(--s1)'], ref: { v: CONFIG.defaultWait, label: `promised ${CONFIG.defaultWait} min` }, fmt: (v) => `${v}m` }), `Slowest hour is ${hr(HOURS[worst])} at ${byH[worst].toFixed(0)} min. A dot marks hours that run past the promise.`)}
    ${panel('Lost sales from sold-out items', `The catch sold out by 1pm on ${soldDays.size} days this month`, `<div class="daydots">${Array.from({ length: 30 }, (_, i) => `<i class="${soldDays.has(29 - i) ? 'x' : ''}" data-tip="${dlabel(now, 29 - i)}${soldDays.has(29 - i) ? ': sold out by 1pm' : ''}"></i>`).join('')}</div>${legend([['Sold out early', 'var(--crit)'], ['Lasted all day', 'var(--neutral)']])}
      <div class="tiles">${tile('Orders turned away', lostUnits)}${tile('Sales lost', mvr(lostMvr))}${tile('Extra fish needed', `${(lostUnits / (soldDays.size || 1) * DISH.catch.recipe.reef).toFixed(1)} kg/day`)}</div>`, 'Order more fish. Guests asked for it and you had none to sell.')}`;
}

// ---- What's coming? ---------------------------------------------------------------
function coming(s, now, B) {
  const boat = L.nextBoat(now), rs = L.restock(s, B.use, now).slice(0, 9), out = rs.filter((r) => r.runsOut);
  const byDow = Array.from({ length: 7 }, () => ({ v: 0, n: 0 }));
  for (let d = 1; d < 29; d++) { const x = byDow[new Date(now - d * DAY).getDay()]; x.v += B.days[d].sales; x.n++; }
  const fc = Array.from({ length: 7 }, (_, i) => { const t = now + (i + 1) * DAY, dw = byDow[new Date(t).getDay()], ev = CONFIG.events.find((e) => e.inDays === i + 1), basev = dw.v / dw.n; return { t, basev, ev, v: basev * (1 + (ev?.lift || 0)) }; });
  const next7 = sum(fc, (f) => f.v), last7 = sum(B.days.slice(1, 8), (d) => d.sales);
  const tmr = fc[0], share = B.dish.slice().sort((a, b) => b.units - a.units).slice(0, 3);
  return `${panel('Ingredient run-out forecast', out.length ? `${out.length} ingredients run out before ${dayName(boat.date)}’s boat` : `Stock lasts until ${dayName(boat.date)}’s boat`, hbars(rs.map((r) => ({ label: ING[r.ing].name, sub: `${+s.stock[r.ing].toFixed(1)} ${ING[r.ing].unit} left`, v: Math.min(r.daysLeft, 7), mark: boat.days, color: r.runsOut ? 'var(--crit)' : 'var(--s1)', val: `${Math.min(r.daysLeft, 99).toFixed(1)} d`, tag: r.runsOut ? ['! before boat', 'bad'] : null, tip: `${ING[r.ing].name}: ${r.daysLeft.toFixed(1)} days of stock at ${r.avg} ${ING[r.ing].unit} a day` })), { max: 7 }), `The line marks the boat, in ${boat.days} days.`)}
    <button class="btn big ghost" data-act="gorestock">Open the restock list</button>
    ${panel('Demand forecast', `Next 7 days: about ${mvr(next7)}, ${next7 >= last7 ? 'up' : 'down'} ${Math.abs(((next7 - last7) / last7) * 100).toFixed(0)}% on the last 7`, `${cols(fc.map((f) => ({ label: dayName(f.t, 'short'), vals: [f.basev, f.v - f.basev], flag: !!f.ev, tip: `${dayName(f.t)}: about ${mvr(f.v)}${f.ev ? ` · ${f.ev.label}` : ''}` })), { colors: ['var(--s1)', 'var(--s2)'] })}${legend([['Usual for that weekday', 'var(--s1)'], ['Extra from a known event', 'var(--s2)']])}
      <div class="list">${fc.filter((f) => f.ev).map((f) => `<div class="line"><span><b>${dayName(f.t)}</b><small>${f.ev.label}</small></span><em class="tagx warn">+${(f.ev.lift * 100).toFixed(0)}%</em></div>`).join('')}</div>`, `Tomorrow (${dayName(tmr.t)}): prep for about ${share.map((x) => `${Math.round((x.units / 30) * (tmr.v / (B.sales30 / 30)))} ${x.d.name}`).join(', ')}.`)}`;
}

const SECTIONS = [['today', 'Today'], ['money', 'Am I making money?'], ['leaks', 'Where is money leaking?'], ['who', 'When and who?'], ['kitchen', 'Is the kitchen keeping up?'], ['next', 'What’s coming?']];
export function insights(s, now) {
  const B = base(s, now);
  const body = { today, money: moneySection, leaks, who, kitchen, next: coming }[ui.ins](s, now, B);
  return `<div class="mhead"><div><p class="eyebrow">Answers, not spreadsheets</p><h1>Insights</h1></div></div>
    <div class="chips q">${SECTIONS.map(([id, label]) => `<button class="${ui.ins === id ? 'on' : ''}" data-act="ins:${id}">${label}</button>`).join('')}</div>${body}`;
}

Object.assign(ACT, {
  ins: (v) => { ui.ins = v; },
  range: (v) => { ui.range = v; },
  statement: (id) => { const t = S().tabs.find((x) => x.id === id); L.note(S(), `Statement sent to ${t.name}`, `Balance MVR ${t.balance.toFixed(2)}. Please settle by Friday. Thank you!`, Date.now(), { staff: true }); },
  goquotes: () => { ui.sup = 'quotes'; go('#/m/supply'); },
  gorestock: () => { ui.sup = 'restock'; go('#/m/supply'); },
});
