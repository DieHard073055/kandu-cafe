// Demo data. All names, suppliers, guesthouses and people are fictional.

export const SUPPLIERS = [
  { id: 'rasheed', name: 'Rasheed Trading', phone: '+960 771 0142', city: 'Malé' },
  { id: 'malefresh', name: 'Malé Fresh Supplies', phone: '+960 790 2218', city: 'Malé' },
  { id: 'hulhu', name: 'Hulhumalé Wholesale', phone: '+960 911 3375', city: 'Hulhumalé' },
];
const SUP_IDS = SUPPLIERS.map((s) => s.id);

// price: [rasheed, malefresh, hulhu] in MVR per unit, 0 = not supplied.
// usage figures in comments are rough daily use, which the stock levels are tuned to.
export const INGREDIENTS = [
  { id: 'reef', name: 'Reef fish (today’s catch)', unit: 'kg', stock: 2.4, low: 1.5, pack: 1, sup: null, cost: 70 },
  { id: 'tuna', name: 'Tuna', unit: 'kg', stock: 24, low: 10, pack: 5, sup: 'rasheed', price: [62, 58, 0] },
  { id: 'chicken', name: 'Chicken', unit: 'kg', stock: 11, low: 12, pack: 5, sup: 'rasheed', price: [68, 74, 63] },
  { id: 'rice', name: 'Rice', unit: 'kg', stock: 40, low: 14, pack: 5, sup: 'rasheed', price: [18, 16.5, 17] },
  { id: 'flour', name: 'Flour', unit: 'kg', stock: 32, low: 14, pack: 5, sup: 'rasheed', price: [14, 13, 15] },
  { id: 'eggs', name: 'Eggs', unit: 'pcs', stock: 260, low: 110, pack: 30, sup: 'rasheed', price: [2.8, 2.6, 3] },
  { id: 'oil', name: 'Cooking oil', unit: 'L', stock: 14, low: 5, pack: 5, sup: 'rasheed', price: [38, 42, 35] },
  { id: 'onion', name: 'Onions', unit: 'kg', stock: 9, low: 10, pack: 5, sup: 'rasheed', price: [22, 19, 24] },
  { id: 'coconut', name: 'Coconut (grating)', unit: 'pcs', stock: 60, low: 28, pack: 10, sup: 'rasheed', price: [9, 8, 0] },
  { id: 'kurumba', name: 'Kurumba (young coconut)', unit: 'pcs', stock: 4, low: 10, pack: 10, sup: 'rasheed', price: [12, 11, 0] },
  { id: 'lime', name: 'Limes', unit: 'kg', stock: 5, low: 3, pack: 1, sup: 'malefresh', price: [60, 52, 65] },
  { id: 'chili', name: 'Chili (githeyo mirus)', unit: 'kg', stock: 2, low: 0.6, pack: 1, sup: 'rasheed', price: [90, 85, 95] },
  { id: 'curry', name: 'Curry paste & spices', unit: 'kg', stock: 4, low: 1.5, pack: 1, sup: 'rasheed', price: [140, 150, 128] },
  { id: 'cocomilk', name: 'Coconut milk', unit: 'L', stock: 16, low: 6, pack: 6, sup: 'rasheed', price: [34, 36, 30] },
  { id: 'veg', name: 'Cabbage & carrot', unit: 'kg', stock: 10, low: 5, pack: 5, sup: 'malefresh', price: [28, 24, 30] },
  { id: 'tea', name: 'Tea leaves', unit: 'kg', stock: 1.5, low: 0.3, pack: 1, sup: 'rasheed', price: [180, 170, 165] },
  { id: 'sugar', name: 'Sugar', unit: 'kg', stock: 12, low: 2, pack: 5, sup: 'rasheed', price: [16, 15, 14.5] },
  { id: 'soda', name: 'Soft drinks', unit: 'pcs', stock: 30, low: 12, pack: 24, sup: 'hulhu', price: [8.5, 9, 7.8] },
];

// "Latest known" price table, per supplier.
export const basePrices = () =>
  Object.fromEntries(
    SUP_IDS.map((s, i) => [
      s,
      Object.fromEntries(INGREDIENTS.filter((g) => g.price?.[i]).map((g) => [g.id, g.price[i]])),
    ])
  );

// Last month's prices where they differ. Drives the "supplier raised a price" alerts.
export const PREV_PRICES = { rasheed: { chicken: 62, oil: 35 }, malefresh: { lime: 48 } };

// New quotes: only the lines that change. The PDF and the import carry every line the supplier sells.
const QUOTE_CHANGES = {
  rasheed: { chicken: 79, oil: 40, tuna: 61, onion: 21 },
  malefresh: { tuna: 56, chicken: 72, eggs: 2.5, veg: 23, lime: 50, onion: 18.5, kurumba: 10.5 },
  hulhu: { chicken: 61, oil: 34, curry: 125, cocomilk: 29, soda: 7.5, sugar: 14, tea: 160, rice: 16.8 },
};
export const QUOTES = SUP_IDS.map((sup, i) => ({
  sup,
  no: `Q-${2611 + i * 37}`,
  file: `quotes/quote-${sup}.pdf`,
  lines: { ...basePrices()[sup], ...QUOTE_CHANGES[sup] },
}));

// when: demand multiplier for [breakfast, lunch, tea time, dinner]
export const DISHES = [
  { id: 'catch', name: 'Catch of the Day', dv: 'Fihunu mas', desc: 'Reef fish grilled over coconut husk, rice, lime and chili.', cat: 'mains', price: 145, emoji: '🐟', hue: 188, pop: 10, prep: 16, when: [0, 1.6, 0.2, 1.4], recipe: { reef: 0.35, rice: 0.15, lime: 0.04, chili: 0.01, oil: 0.03, onion: 0.04 } },
  { id: 'mashuni', name: 'Mas Huni & Roshi', dv: 'The island breakfast', desc: 'Tuna, fresh coconut, onion and lime with warm roshi.', cat: 'breakfast', price: 55, emoji: '🥥', hue: 38, pop: 14, prep: 7, when: [3.2, 0.2, 0.1, 0.1], recipe: { tuna: 0.1, coconut: 0.5, onion: 0.04, chili: 0.006, lime: 0.03, flour: 0.12 } },
  { id: 'garudhiya', name: 'Garudhiya', dv: 'Clear tuna broth', desc: 'Slow tuna broth with rice, lime, onion and chili.', cat: 'mains', price: 75, emoji: '🍲', hue: 22, pop: 3, prep: 9, when: [0.2, 1.6, 0.2, 1.2], recipe: { tuna: 0.18, rice: 0.18, lime: 0.04, onion: 0.03, chili: 0.006 } },
  { id: 'tunacurry', name: 'Mas Riha', dv: 'Tuna curry', desc: 'Tuna simmered in coconut milk and roasted spices, with rice.', cat: 'mains', price: 85, emoji: '🍛', hue: 28, pop: 8, prep: 11, when: [0.3, 1.5, 0.2, 1.4], recipe: { tuna: 0.18, cocomilk: 0.15, curry: 0.025, onion: 0.06, rice: 0.18, oil: 0.02 } },
  { id: 'chickencurry', name: 'Kukulhu Riha', dv: 'Chicken curry', desc: 'Island chicken curry, rich with coconut milk, with rice.', cat: 'mains', price: 95, emoji: '🍗', hue: 14, pop: 8, prep: 12, when: [0.1, 1.4, 0.2, 1.6], recipe: { chicken: 0.25, cocomilk: 0.15, curry: 0.025, onion: 0.06, rice: 0.18, oil: 0.02 } },
  { id: 'kothu', name: 'Kothu Roshi', dv: 'Chopped roshi, chicken, egg', desc: 'Roshi chopped on the hot plate with chicken, egg and vegetables.', cat: 'mains', price: 65, emoji: '🥘', hue: 8, pop: 15, prep: 13, when: [0.1, 0.9, 0.5, 2.2], recipe: { flour: 0.2, chicken: 0.2, eggs: 2, veg: 0.12, onion: 0.05, oil: 0.04, curry: 0.015 } },
  { id: 'friedrice', name: 'Tuna Fried Rice', dv: 'Mas baiy', desc: 'Wok-fried rice with tuna, egg and vegetables.', cat: 'mains', price: 48, emoji: '🍚', hue: 48, pop: 3, prep: 10, when: [0.1, 1.3, 0.3, 1.3], recipe: { rice: 0.22, tuna: 0.1, eggs: 2, veg: 0.08, oil: 0.04, onion: 0.04 } },
  { id: 'hedhikaa', name: 'Hedhikaa Plate', dv: 'Short eats · 6 pieces', desc: 'Gulha, bajiya, kavaabu and masroshi, fried fresh.', cat: 'shorteats', price: 45, emoji: '🥟', hue: 32, pop: 11, prep: 6, when: [0.6, 0.3, 3.2, 0.5], recipe: { flour: 0.1, tuna: 0.08, coconut: 0.4, onion: 0.04, oil: 0.08, chili: 0.006, eggs: 1 } },
  { id: 'kurumba', name: 'Fresh Coconut', dv: 'Kurumba', desc: 'Young coconut, opened to order.', cat: 'drinks', price: 40, emoji: '🌴', hue: 150, pop: 4.5, prep: 2, when: [0.6, 1.3, 1.2, 0.7], recipe: { kurumba: 1 } },
  { id: 'limejuice', name: 'Lime Juice', dv: 'Lumbo fani', desc: 'Island limes pressed over ice.', cat: 'drinks', price: 25, emoji: '🍋', hue: 80, pop: 3.5, prep: 3, when: [0.5, 1.2, 1.1, 0.9], recipe: { lime: 0.1, sugar: 0.04 } },
  { id: 'tea', name: 'Kalhu Sai', dv: 'Black tea', desc: 'Strong, sweet island tea.', cat: 'drinks', price: 12, emoji: '☕', hue: 18, pop: 16, prep: 2, when: [2.2, 0.4, 2.4, 0.7], recipe: { tea: 0.005, sugar: 0.02 } },
  { id: 'soda', name: 'Soft Drink', dv: 'Chilled can', desc: 'Ask for what’s cold.', cat: 'drinks', price: 20, emoji: '🥤', hue: 350, pop: 3.5, prep: 1, when: [0.2, 1.2, 0.9, 1.1], recipe: { soda: 1 } },
];
export const CATS = [['all', 'All'], ['breakfast', 'Breakfast'], ['mains', 'Mains'], ['shorteats', 'Short eats'], ['drinks', 'Drinks']];

export const CHANNELS = { dinein: 'Dine-in', delivery: 'Delivery', pickup: 'Pickup', guesthouse: 'Guesthouse' };

// Island map, drawn in a 360 x 260 box.
export const ISLAND = 'M66,130 C60,84 108,50 172,48 C238,44 300,70 306,124 C312,176 262,212 194,214 C124,218 72,182 66,130 Z';
export const CAFE = { x: 150, y: 86 };
export const GUESTHOUSES = [
  { id: 'thundi', name: 'Thundi Beach Inn', x: 250, y: 184, rooms: 8 },
  { id: 'kaani', name: 'Kaani Palm Stay', x: 100, y: 160, rooms: 10 },
  { id: 'dhoani', name: 'Dhoani Lagoon House', x: 278, y: 118, rooms: 6 },
  { id: 'veli', name: 'Veli Garden Guesthouse', x: 164, y: 188, rooms: 5 },
];
export const LANDMARKS = [
  { name: 'Harbour jetty', x: 180, y: 58, icon: '⚓' },
  { name: 'Friday Mosque', x: 192, y: 120, icon: '🕌' },
  { name: 'School', x: 234, y: 98, icon: '🏫' },
  { name: 'Health centre', x: 246, y: 144, icon: '➕' },
  { name: 'Football ground', x: 138, y: 138, icon: '⚽' },
  { name: 'Council office', x: 112, y: 108, icon: '🏛️' },
  { name: 'Bikini beach', x: 284, y: 160, icon: '🏖️' },
  { name: 'Sunset point', x: 82, y: 134, icon: '🌅' },
  { name: 'Banyan tree', x: 204, y: 170, icon: '🌳' },
  ...GUESTHOUSES.map((g) => ({ name: g.name, x: g.x, y: g.y, icon: '🏠' })),
];

export const REGULARS = ['Ahmed Shareef', 'Aminath Zahra', 'Ibrahim Naseer', 'Hassan Ali', 'Mariyam Shifa', 'Mohamed Rilwan', 'Fathimath Nisha', 'Ali Zaheen', 'Hawwa Liusha', 'Abdulla Shaheem', 'Aishath Raya', 'Yoosuf Fayaz'];
export const FISH = ['Red snapper', 'Yellowfin tuna', 'Grouper', 'Jackfish', 'Wahoo'];

const DAY = 864e5;
export const TABS = (now) => [
  { id: 't1', name: 'Dhangethi Dive Centre', kind: 'Business', balance: 4820, limit: 5000, lastPaid: now - 12 * DAY },
  { id: 't2', name: 'Ibrahim Naseer', kind: 'Regular', balance: 1240, limit: 1000, lastPaid: now - 19 * DAY },
  { id: 't3', name: 'Island Council office', kind: 'Business', balance: 2150, limit: 3000, lastPaid: now - 41 * DAY },
  { id: 't4', name: 'Hassan Ali', kind: 'Regular', balance: 380, limit: 1000, lastPaid: now - 6 * DAY },
  { id: 't5', name: 'Kaani Palm Stay (staff meals)', kind: 'Business', balance: 960, limit: 2000, lastPaid: now - 34 * DAY },
];
