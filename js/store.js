// State lives in localStorage; the `storage` event keeps other tabs in sync.
import { seedState } from './logic.js';

const KEY = 'kandu.demo.v1';
let state;
let last = '';
const dayKey = () => new Date().toDateString();

export const S = () => state;

export function reset() {
  state = seedState(Date.now());
  state.day = dayKey();
  save();
}
export function load() {
  try { state = JSON.parse((last = localStorage.getItem(KEY) || '')); } catch { state = null; }
  // A demo left open overnight starts fresh, so order timers and "today" always make sense.
  if (!state || state.v !== 1 || state.day !== dayKey()) reset();
}
export function save() {
  const json = JSON.stringify(state);
  if (json === last) return;
  last = json;
  try { localStorage.setItem(KEY, json); } catch { /* private mode: keep working in memory */ }
}
export function onRemote(fn) {
  addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try { state = JSON.parse((last = e.newValue)); fn(); } catch { /* ignore a corrupt write */ }
  });
}
