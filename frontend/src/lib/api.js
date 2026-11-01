import { makeSeed } from './seed';

// Demo mode (no VITE_API_URL): everything is stored in localStorage.
// API mode: generic REST calls against your Express + MongoDB server.
//   GET    {API}/:collection          -> [docs]
//   POST   {API}/:collection          -> created doc
//   PATCH  {API}/:collection/:id      -> updated doc
//   DELETE {API}/:collection/:id
//   POST   {API}/reset                -> (optional) re-seed sample data
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const LS = 'caretrack:v1:';
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
const norm = (d) => (d && d._id && !d.id ? { ...d, id: d._id } : d);

const lsRead = (c) => JSON.parse(localStorage.getItem(LS + c) || 'null');
const lsWrite = (c, v) => localStorage.setItem(LS + c, JSON.stringify(v));

async function http(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).message || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  demo: !BASE,
  async list(col) {
    if (BASE) return (await http(`/${col}`)).map(norm);
    let v = lsRead(col);
    if (!v) { const seed = makeSeed(); Object.keys(seed).forEach((k) => lsWrite(k, seed[k])); v = seed[col]; }
    return v;
  },
  async create(col, doc) {
    if (BASE) return norm(await http(`/${col}`, { method: 'POST', body: JSON.stringify(doc) }));
    const created = { ...doc, id: uid() };
    lsWrite(col, [...(lsRead(col) || []), created]);
    return created;
  },
  async update(col, id, patch) {
    if (BASE) return norm(await http(`/${col}/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }));
    let out;
    lsWrite(col, (lsRead(col) || []).map((d) => (d.id === id ? (out = { ...d, ...patch }) : d)));
    return out;
  },
  async remove(col, id) {
    if (BASE) return http(`/${col}/${id}`, { method: 'DELETE' });
    lsWrite(col, (lsRead(col) || []).filter((d) => d.id !== id));
  },
  async reset() {
    if (BASE) return http('/reset', { method: 'POST' });
    const seed = makeSeed(); Object.keys(seed).forEach((k) => lsWrite(k, seed[k]));
  },
};
