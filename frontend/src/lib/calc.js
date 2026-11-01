// ---------- Date helpers (ISO yyyy-mm-dd strings, calendar days) ----------
const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => iso(new Date());
export const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + Math.round(n)); return iso(d); };
export const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5); // b - a
export const maxDate = (...x) => x.reduce((m, v) => (v > m ? v : m));
export const minDate = (...x) => x.reduce((m, v) => (v < m ? v : m));
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const fmtDate = (s) => (s ? toDate(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const expectedPct = (s, e, at) => (e <= s ? 1 : clamp(diffDays(s, at) / diffDays(s, e)));

// ---------- Schedule: forward pass, delay detection and downstream impact ----------
export function buildSchedule(acts, statusDate) {
  const byId = Object.fromEntries(acts.map((a) => [a.id, a]));
  const order = []; const state = {}; let cycle = null;
  const visit = (id, path) => {
    if (cycle || !byId[id] || state[id] === 2) return;
    if (state[id] === 1) { cycle = [...path, id]; return; }
    state[id] = 1;
    (byId[id].deps || []).forEach((d) => visit(d, [...path, id]));
    state[id] = 2; order.push(id);
  };
  acts.forEach((a) => visit(a.id, []));
  if (cycle) return { rows: [], cycle, baselineFinish: null, finish: null, projectStart: null };

  const R = {};
  order.forEach((id) => {
    const a = byId[id];
    const dur = Math.max(1, +a.duration || 1);
    const preds = (a.deps || []).map((d) => R[d]).filter(Boolean);
    const bStart = maxDate(a.start, ...preds.map((p) => p.bEnd));
    const bEnd = addDays(bStart, dur);
    const pct = clamp((+a.percent || 0) / 100);
    const predF = preds.length ? maxDate(...preds.map((p) => p.fEnd)) : bStart;
    let fStart, fEnd, ownSlip = 0;
    if (pct >= 1) { fStart = bStart; fEnd = bEnd; }
    else if (pct > 0) {
      fStart = bStart;
      const own = addDays(statusDate, Math.ceil((1 - pct) * dur));
      ownSlip = Math.max(0, diffDays(bEnd, own));
      fEnd = maxDate(bEnd, own);
      if (predF > bStart) fEnd = maxDate(fEnd, addDays(predF, Math.ceil((1 - pct) * dur)));
    } else {
      ownSlip = Math.max(0, diffDays(bStart, statusDate));
      fStart = maxDate(bStart, predF, bStart < statusDate ? statusDate : bStart);
      fEnd = addDays(fStart, dur);
    }
    const delay = Math.max(0, diffDays(bEnd, fEnd));
    const exp = expectedPct(bStart, bEnd, statusDate);
    let status = 'not-started';
    if (pct >= 1) status = 'complete';
    else if (ownSlip > 0) status = 'delayed';
    else if (delay > 0) status = 'impacted';
    else if (pct > 0) status = 'on-track';
    R[id] = { ...a, duration: dur, pct, bStart, bEnd, fStart, fEnd, delay, ownSlip, expected: exp, status, cost: +a.plannedCost || 0 };
  });

  const children = {};
  acts.forEach((a) => (a.deps || []).forEach((d) => (children[d] = [...(children[d] || []), a.id])));
  const downstream = (id, seen = new Set()) => {
    (children[id] || []).forEach((c) => { if (!seen.has(c)) { seen.add(c); downstream(c, seen); } });
    return seen;
  };
  const rows = Object.values(R).sort((a, b) => a.bStart.localeCompare(b.bStart));
  rows.forEach((r) => { r.downstream = r.status === 'delayed' ? [...downstream(r.id)].map((i) => R[i]).filter((x) => x && x.delay > 0) : []; });
  return {
    rows, cycle: null,
    projectStart: rows.length ? minDate(...rows.map((r) => r.bStart)) : null,
    baselineFinish: rows.length ? maxDate(...rows.map((r) => r.bEnd)) : null,
    finish: rows.length ? maxDate(...rows.map((r) => r.fEnd)) : null,
  };
}

// ---------- Earned Value Management ----------
export function computeEVM(sched, expenses, statusDate, charter, plan) {
  const rows = sched.rows;
  const BAC = rows.reduce((s, r) => s + r.cost, 0);
  const PV = rows.reduce((s, r) => s + r.cost * expectedPct(r.bStart, r.bEnd, statusDate), 0);
  const EV = rows.reduce((s, r) => s + r.cost * r.pct, 0);
  const AC = expenses.filter((e) => e.date <= statusDate).reduce((s, e) => s + (+e.amount || 0), 0);
  const CPI = AC > 0 ? EV / AC : 1;
  const SPI = PV > 0 ? EV / PV : 1;
  const EAC = CPI > 0 ? BAC / CPI : BAC;
  const m = { BAC, PV, EV, AC, CPI, SPI, CV: EV - AC, SV: EV - PV, EAC, ETC: Math.max(0, EAC - AC), VAC: BAC - EAC, percent: BAC ? EV / BAC : 0 };
  const th = plan?.thresholds || { cpi: 0.9, spi: 0.9 };
  const warnings = [];
  const idx = (name, val, t, what) => {
    if (val < t) warnings.push({ level: val < t - 0.1 ? 'danger' : 'warn', text: `${name} is ${val.toFixed(2)}, below the ${Number(t).toFixed(2)} threshold. ${what}` });
  };
  idx('CPI', CPI, th.cpi, `Cost overrun: every PKR 1 of work is costing PKR ${(1 / CPI).toFixed(2)}.`);
  idx('SPI', SPI, th.spi, 'Schedule deviation: work is completing slower than planned.');
  if (charter) {
    if (BAC > charter.budget) warnings.push({ level: 'danger', text: `Planned cost (PKR ${Math.round(BAC).toLocaleString()}) exceeds the approved budget.` });
    if (EAC > charter.budget) warnings.push({ level: 'danger', text: `Forecast at completion (PKR ${Math.round(EAC).toLocaleString()}) exceeds the approved budget by PKR ${Math.round(EAC - charter.budget).toLocaleString()}.` });
    if (sched.finish && sched.finish > charter.deadline) warnings.push({ level: 'danger', text: `Forecast finish ${fmtDate(sched.finish)} is ${diffDays(charter.deadline, sched.finish)} days after the deadline.` });
  }
  const curve = [];
  if (sched.projectStart) {
    const end = addDays(maxDate(sched.finish, charter?.deadline || sched.finish), 7);
    const pts = new Set(); for (let d = sched.projectStart; d <= end; d = addDays(d, 7)) pts.add(d); pts.add(statusDate);
    [...pts].sort().forEach((d) => curve.push({
      date: d, pv: Math.round(rows.reduce((s, r) => s + r.cost * expectedPct(r.bStart, r.bEnd, d), 0)),
      ...(d === statusDate ? { ev: Math.round(EV), ac: Math.round(AC) } : {}),
    }));
  }
  return { ...m, warnings, curve, thresholds: th };
}

// ---------- Risk helpers ----------
export const riskScore = (r) => (+r.likelihood || 0) * (+r.impact || 0);
export const riskLevel = (s) => (s >= 15 ? 'critical' : s >= 10 ? 'high' : s >= 5 ? 'medium' : 'low');

// ---------- WBS helpers ----------
export function wbsTree(nodes) {
  const kids = (pid) => nodes.filter((n) => (n.parentId || null) === pid);
  const walk = (pid, prefix) => kids(pid).map((n, i) => {
    const code = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
    return { ...n, code, depth: prefix ? prefix.split('.').length : 0, children: walk(n.id, code) };
  });
  const flat = []; const push = (list) => list.forEach((n) => { flat.push(n); push(n.children); });
  const tree = walk(null, ''); push(tree);
  return { tree, flat };
}

// ---------- Cross-module integrity checks ----------
export function integrity({ requirements, wbs, activities, expenses, changes, defects }, sched, charter) {
  const out = []; const ok = (pass, text, detail) => out.push({ pass, text, detail });
  const reqById = Object.fromEntries(requirements.map((r) => [r.id, r]));
  const wbsById = Object.fromEntries(wbs.map((w) => [w.id, w]));
  const actIds = new Set(activities.map((a) => a.id));
  const badPk = wbs.filter((w) => w.type === 'package' && (!w.reqId || reqById[w.reqId]?.status !== 'approved'));
  ok(!badPk.length, 'Every work package traces to an approved requirement', badPk.map((w) => w.name).join(', '));
  const noPk = activities.filter((a) => !wbsById[a.wbsId]);
  ok(!noPk.length, 'Every activity belongs to a WBS work package', noPk.map((a) => a.name).join(', '));
  const covered = new Set(wbs.filter((w) => w.type === 'package').map((w) => w.reqId));
  const uncovered = requirements.filter((r) => r.status === 'approved' && !covered.has(r.id));
  ok(!uncovered.length, 'Every approved requirement is covered by the WBS', uncovered.map((r) => r.title).join(', '));
  const orphanExp = expenses.filter((e) => !actIds.has(e.activityId));
  ok(!orphanExp.length, 'All expenses are charged to a valid activity');
  const badCR = changes.filter((c) => c.status === 'approved' && reqById[c.requirementId]?.status !== 'approved');
  ok(!badCR.length, 'Approved change requests have approved requirements');
  ok(!sched.cycle, 'No circular task dependencies', sched.cycle ? sched.cycle.join(' → ') : '');
  const bac = sched.rows.reduce((s, r) => s + r.cost, 0);
  ok(bac <= charter.budget, 'Planned cost fits inside the approved budget');
  const orphanDef = defects.filter((d) => d.activityId && !actIds.has(d.activityId));
  ok(!orphanDef.length, 'Defects reference existing activities');
  return out;
}
