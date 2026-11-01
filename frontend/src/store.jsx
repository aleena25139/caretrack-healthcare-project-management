import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './lib/api';
import { addDays, buildSchedule, computeEVM, integrity, riskScore, today } from './lib/calc';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);
const COLS = ['charter', 'plan', 'milestones', 'closure', 'requirements', 'wbs', 'changes', 'activities', 'expenses', 'defects', 'checklists', 'risks'];

export function StoreProvider({ children }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [statusDate, setStatusDate] = useState(today());
  const [toasts, setToasts] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('caretrack:theme') || 'light');

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('caretrack:theme', theme); }, [theme]);

  const toast = useCallback((text, tone = 'ok') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const load = useCallback(async () => {
    try {
      const all = await Promise.all(COLS.map((c) => api.list(c)));
      setData(Object.fromEntries(COLS.map((c, i) => [c, all[i]])));
      setError('');
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const wrap = async (fn, okMsg) => {
    try { const r = await fn(); if (okMsg) toast(okMsg); return r; }
    catch (e) { toast(e.message || 'Something went wrong', 'bad'); throw e; }
  };
  const add = (col, doc, msg) => wrap(async () => { const c = await api.create(col, doc); setData((d) => ({ ...d, [col]: [...d[col], c] })); return c; }, msg);
  const edit = (col, id, patch, msg) => wrap(async () => { const u = await api.update(col, id, patch); setData((d) => ({ ...d, [col]: d[col].map((x) => (x.id === id ? { ...x, ...u } : x)) })); return u; }, msg);
  const del = (col, id, msg) => wrap(async () => { await api.remove(col, id); setData((d) => ({ ...d, [col]: d[col].filter((x) => x.id !== id) })); }, msg);
  const reset = async () => { await wrap(() => api.reset()); await load(); setStatusDate(today()); toast('Sample data restored'); };

  const charter = data?.charter?.[0];
  const plan = data?.plan?.[0];
  const closure = data?.closure?.[0];

  const derived = useMemo(() => {
    if (!data) return null;
    const sched = buildSchedule(data.activities, statusDate);
    const evm = computeEVM(sched, data.expenses, statusDate, charter, plan);
    const checks = integrity(data, sched, charter);
    const risks = data.risks.map((r) => ({ ...r, score: riskScore(r) })).sort((a, b) => b.score - a.score);
    const openCritical = data.defects.filter((d) => d.severity === 'critical' && !['resolved', 'closed'].includes(d.status));
    const pendingCR = data.changes.filter((c) => c.status === 'pending');
    return { sched, evm, checks, risks, openCritical, pendingCR };
  }, [data, statusDate, charter, plan]);

  // Approving a change request is the one place where scope, schedule and budget move together.
  const approveChange = async (cr, note) => {
    const req = data.requirements.find((r) => r.id === cr.requirementId);
    if (!req) throw new Error('This change request is not linked to a requirement.');
    const oldDeadline = charter.deadline;
    const last = [...derived.sched.rows].sort((a, b) => b.bEnd.localeCompare(a.bEnd))[0];
    await edit('requirements', req.id, { status: 'approved' });
    let parent = data.wbs.find((w) => w.name === 'Enhancements');
    const root = data.wbs.find((w) => !w.parentId);
    if (!parent) parent = await add('wbs', { parentId: root?.id || null, name: 'Enhancements', type: 'deliverable' });
    const pkg = await add('wbs', { parentId: parent.id, name: req.title, type: 'package', reqId: req.id });
    const act = await add('activities', {
      name: req.title, wbsId: pkg.id, assignee: 'Sara Malik', start: oldDeadline, duration: Math.max(1, cr.scheduleImpact),
      plannedCost: cr.costImpact, percent: 0, deps: last ? [last.id] : [],
    });
    await edit('charter', charter.id, { budget: charter.budget + cr.costImpact, deadline: addDays(oldDeadline, cr.scheduleImpact) });
    await edit('changes', cr.id, { status: 'approved', decidedOn: today(), decisionNote: note || '', activityId: act.id });
    toast(`${cr.code} approved: scope, budget and deadline updated`);
  };
  const rejectChange = async (cr, note) => {
    await edit('requirements', cr.requirementId, { status: 'rejected' });
    await edit('changes', cr.id, { status: 'rejected', decidedOn: today(), decisionNote: note || '' });
    toast(`${cr.code} rejected: requirement stays out of scope`);
  };

  const value = { data, error, ...(data || {}), charter, plan, closure, derived, statusDate, setStatusDate, add, edit, del, reset, toast, toasts, theme, setTheme, approveChange, rejectChange, demo: api.demo };
  if (error) return <div style={{ padding: 40, fontFamily: 'sans-serif' }}><h2>Can't reach the server</h2><p>{error}</p><p>Check VITE_API_URL, or clear it to run in demo mode.</p></div>;
  if (!data) return <div className="boot"><div className="boot-mark" /></div>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
