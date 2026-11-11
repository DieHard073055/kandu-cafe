// Run: node tests/selftest.mjs
import assert from 'node:assert/strict';
import * as L from '../js/logic.js';
import { history, usage } from '../js/history.js';
import { DISHES, QUOTES } from '../js/data.js';
import { CONFIG } from '../js/config.js';

const now = new Date(2026, 10, 12, 14, 30).getTime(); // a Thursday afternoon
const s = L.seedState(now);

// totals: delivery adds the fee, GST applies to food + fee
const t = L.totals({ mashuni: 2 }, 'delivery');
assert.equal(t.sub, 110);
assert.equal(t.fee, CONFIG.deliveryFee);
assert.equal(t.total, +((110 + CONFIG.deliveryFee) * (1 + CONFIG.gstRate)).toFixed(2));

// portions come from the scarcest ingredient; an order subtracts its recipe
const kurumba = L.DISH.kurumba;
assert.equal(L.portions(s, kurumba), 4);
const tunaBefore = s.stock.tuna;
L.placeOrder(s, { type: 'pickup', items: { mashuni: 3, kurumba: 4 }, pay: 'card' }, now);
assert.equal(s.stock.tuna, +(tunaBefore - 0.3).toFixed(2));
assert.equal(L.portions(s, kurumba), 0);
assert.equal(L.canAdd(s, {}, 'kurumba'), false, 'cannot order more than stock');
s.off.tea = true;
assert.equal(L.canAdd(s, {}, 'tea'), false, 'switched-off dish cannot be ordered');

// shared ingredients: the cart as a whole must fit
s.stock.chicken = 0.4;
assert.equal(L.canAdd(s, { kothu: 1 }, 'chickencurry'), false);
assert.equal(L.canAdd(s, { kothu: 1 }, 'kothu'), true);

// order flow + cash on delivery is paid at the end
const o = L.placeOrder(s, { type: 'delivery', pin: { x: 150, y: 120 }, items: { limejuice: 1 }, pay: 'cod' }, now);
L.advance(s, o.id, now); L.advance(s, o.id, now); L.advance(s, o.id, now); L.advance(s, o.id, now);
assert.equal(o.status, 'done');
assert.equal(o.pay.paid, true);

// a dine-in order never carries a stale delivery pin from the cart
assert.equal(L.placeOrder(s, { type: 'dinein', table: 2, pin: { x: 1, y: 1 }, gh: 'veli', items: { limejuice: 1 }, pay: 'card' }, now).pin, null);

// transfer confirms itself after the upload
const tr = L.placeOrder(s, { type: 'pickup', items: { limejuice: 1 }, pay: 'transfer' }, now);
tr.pay.uploadedAt = now;
assert.equal(L.normalize(s, now + 1000), false);
assert.equal(L.normalize(s, now + CONFIG.transferConfirmSec * 1000 + 1), true);
assert.equal(tr.pay.paid, true);

// prayer break ends by itself
s.status = { mode: 'prayer', wait: 15, prayerEnds: now + 60000 };
assert.equal(L.effectiveMode(s, now), 'prayer');
assert.equal(L.effectiveMode(s, now + 60001), 'open');

// stock count records the gap in MVR
const [rec] = L.applyCount(s, { rice: 38 }, now);
assert.equal(rec.value, -2 * 18);
assert.equal(s.stock.rice, 38);

// boat: Thursday -> Saturday (2 days), then Tuesday (3 more)
assert.deepEqual([L.nextBoat(now).days, L.nextBoat(now).interval], [2, 3]);

// history is deterministic and usage drives restock
const H = history(now);
assert.deepEqual(H.orders.length, history(now).orders.length);
assert.ok(H.orders.length > 2000, 'five weeks of orders');
const use = usage(H.orders);
const rs = L.restock(s, use, now);
const chicken = rs.find((r) => r.ing === 'chicken');
assert.ok(chicken.runsOut && chicken.qty > 0 && chicken.qty % 5 === 0, 'chicken runs out before the boat and is rounded to packs');

// quotes + cheapest supplier
const before = L.unitCost(s, 'chicken');
L.importQuote(s, 'rasheed');
assert.equal(L.unitCost(s, 'chicken'), QUOTES[0].lines.chicken);
assert.ok(L.unitCost(s, 'chicken') > before);
const saved = L.useCheapest(s, use);
assert.equal(s.assign.chicken, 'hulhu');
assert.ok(saved.month > 0 && saved.moved > 5);
assert.equal(L.useCheapest(s, use).moved, 0, 'second run has nothing left to move');

// receiving adds what actually arrived
const riceNow = s.stock.rice;
s.list = [{ ing: 'rice', qty: 25 }];
const po = L.sendOrder(s, s.assign.rice, now);
L.receive(s, po.id, { rice: 20 }, now);
assert.equal(s.stock.rice, riceNow + 20);

// report: margins and overall food cost for a sanity look
const fresh = L.seedState(now);
const cost = Object.fromEntries(DISHES.map((d) => [d.id, L.dishCost(fresh, d)]));
let sales = 0, cogs = 0;
for (const x of H.orders) { sales += x.sub; for (const [id, q] of x.it) cogs += cost[id] * q; }
console.log(DISHES.map((d) => `${d.id.padEnd(13)} cost ${cost[d.id].toFixed(1).padStart(5)}  margin ${(L.margin(fresh, d) * 100).toFixed(0)}%`).join('\n'));
console.log(`orders ${H.orders.length}  food cost ${((cogs / sales) * 100).toFixed(1)}%  avg/day MVR ${Math.round(sales / 35)}`);
console.log('usage/day', Object.entries(use).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', '));
console.log('selftest ok');
