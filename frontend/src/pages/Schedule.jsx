import { useState } from 'react';
import { AlertTriangle, BarChart3, Clock, ListTodo, Pencil, Plus, Trash2, Waypoints } from 'lucide-react';
import { useStore } from '../store';
import { Alert, Badge, Card, Empty, FormModal, PageHead, Progress, Tabs, confirmDel, money } from '../components/ui';
import { addDays, buildSchedule, diffDays, fmtDate, maxDate } from '../lib/calc';
import { TEAM } from '../lib/seed';

const COLOR = { complete: '#1d9a62', 'on-track': '#0ea5a0', delayed: '#dc3f45', impacted: '#c98a00', 'not-started': '#8a9ac0' };
const LABEL = { complete: 'Complete', 'on-track': 'On track', delayed: 'Delayed', impacted: 'Affected by delay', 'not-started': 'Not started' };
const TONE = { complete: 'green', 'on-track': 'teal', delayed: 'red', impacted: 'amber', 'not-started': '' };

export default function Schedule() {
  const [tab, setTab] = useState('gantt');
  const { derived, charter } = useStore();
  const { sched } = derived;
  const late = sched.finish && sched.finish > charter.deadline;
  return (
    <>
      <PageHead title="Schedule and resources" text="Dates follow dependencies. A late task pushes everything that depends on it, and the forecast finish shows what that does to the deadline." />
      {late && <div style={{ marginBottom: 18 }}><Alert tone="danger" icon={AlertTriangle}>Forecast finish {fmtDate(sched.finish)} is <b>{diffDays(charter.deadline, sched.finish)} days after</b> the deadline of {fmtDate(charter.deadline)}.</Alert></div>}
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'gantt', label: 'Gantt chart', icon: BarChart3 }, { id: 'act', label: 'Activities', icon: ListTodo }, { id: 'delay', label: 'Delay impact', icon: Waypoints }]} />
      {tab === 'gantt' && <Gantt />}
      {tab === 'act' && <Activities />}
      {tab === 'delay' && <Delays />}
    </>
  );
}

function Gantt() {
  const { derived, milestones, charter, statusDate } = useStore();
  const { rows, projectStart, finish } = derived.sched;
  if (!rows.length) return <Card><Empty title="No activities yet" text="Add activities to see the timeline." /></Card>;
  const DAY = 13;
  const origin = addDays(projectStart, -2);
  const end = addDays(maxDate(finish, charter.deadline, ...milestones.map((m) => m.date)), 10);
  const total = diffDays(origin, end);
  const x = (d) => diffDays(origin, d) * DAY;
  const weeks = []; for (let d = origin, i = 1; d < end; d = addDays(d, 7), i++) weeks.push({ d, i });
  const W = total * DAY;
  return (
    <Card title="Timeline" flush action={<div className="legend">{Object.entries(LABEL).map(([k, v]) => <span key={k}><i style={{ background: COLOR[k] }} />{v}</span>)}<span><i style={{ background: 'var(--muted)', opacity: .5 }} />Baseline</span></div>}>
      <div className="gantt"><div className="g-inner" style={{ width: 230 + W }}>
        <div className="g-head"><div className="g-label"><b>Activity</b></div><div className="g-weeks" style={{ width: W }}>{weeks.map((w) => <span key={w.d} style={{ left: x(w.d), width: 7 * DAY }}>W{w.i}<br />{fmtDate(w.d).slice(0, 6)}</span>)}</div></div>
        <div className="g-row"><div className="g-label" style={{ fontWeight: 700 }}>Milestones</div><div className="g-track" style={{ width: W }}>{milestones.map((m) => <span key={m.id} className="g-ms" title={`${m.name} · ${fmtDate(m.date)}`} style={{ left: x(m.date), '--c': m.status === 'achieved' ? '#1d9a62' : m.status === 'at-risk' ? '#dc3f45' : '#2f6bff' }} />)}</div></div>
        {rows.map((r) => (
          <div className="g-row" key={r.id}>
            <div className="g-label" title={r.name}>{r.name}</div>
            <div className="g-track" style={{ width: W }}>
              <div className="g-bar" title={`${r.name}: ${fmtDate(r.fStart)} to ${fmtDate(r.fEnd)} · ${Math.round(r.pct * 100)}%`} style={{ left: x(r.fStart), width: Math.max(8, (diffDays(r.fStart, r.fEnd)) * DAY), '--c': COLOR[r.status] }}><i style={{ width: `${r.pct * 100}%` }} /></div>
              <div className="g-base" style={{ left: x(r.bStart), width: diffDays(r.bStart, r.bEnd) * DAY }} />
            </div>
          </div>
        ))}
        <div className="g-line" style={{ left: 230 + x(statusDate), '--c': '#0ea5a0' }}><em>Status</em></div>
        <div className="g-line" style={{ left: 230 + x(charter.deadline), '--c': '#dc3f45' }}><em>Deadline</em></div>
      </div></div>
    </Card>
  );
}

function Activities() {
  const { activities, wbs, add, edit, del, charter, derived, expenses, statusDate } = useStore();
  const [m, setM] = useState(null);
  const packages = wbs.filter((w) => w.type === 'package');
  const fields = [
    { k: 'name', label: 'Activity', required: true, full: true },
    { k: 'wbsId', label: 'WBS work package', type: 'select', options: packages.map((p) => ({ value: p.id, label: p.name })), required: true },
    { k: 'assignee', label: 'Assigned to', type: 'select', options: TEAM.map((t) => ({ value: t.name, label: `${t.name} (${t.role})` })), required: true },
    { k: 'start', label: 'Planned start', type: 'date', required: true },
    { k: 'duration', label: 'Duration (days)', type: 'number', min: 1, required: true },
    { k: 'plannedCost', label: 'Planned cost (PKR)', type: 'number', min: 0, required: true },
    { k: 'percent', label: 'Percent complete', type: 'number', min: 0, max: 100, required: true },
    { k: 'deps', label: 'Depends on (finish-to-start)', type: 'multi', options: activities.filter((a) => a.id !== m?.id).map((a) => ({ value: a.id, label: a.name })) },
  ];
  const validate = (v) => {
    const e = {};
    if (v.start < charter.startDate) e.start = `Cannot start before the project start (${fmtDate(charter.startDate)})`;
    const cand = m.id ? activities.map((a) => (a.id === m.id ? { ...a, ...v, id: m.id } : a)) : [...activities, { ...v, id: '__new' }];
    const s = buildSchedule(cand, statusDate);
    if (s.cycle) e.deps = 'These dependencies create a loop';
    return e;
  };
  const remove = (a) => {
    if (activities.some((x) => (x.deps || []).includes(a.id))) return alert('Other activities depend on this one. Remove the dependency first.');
    if (expenses.some((e) => e.activityId === a.id)) return alert('Expenses are recorded against this activity.');
    confirmDel(a.name) && del('activities', a.id, 'Activity deleted');
  };
  const nameOf = (id) => activities.find((a) => a.id === id)?.name || '?';
  return (
    <Card title="Activities" flush action={<button className="btn primary sm" onClick={() => setM({ name: '', wbsId: '', assignee: '', start: charter.startDate, duration: '', plannedCost: '', percent: 0, deps: [] })}><Plus size={14} /> Add activity</button>}>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Activity</th><th>Owner</th><th>Planned</th><th>Forecast end</th><th>Depends on</th><th style={{ width: 130 }}>Progress</th><th>Status</th><th /></tr></thead><tbody>
        {derived.sched.rows.map((r) => (
          <tr key={r.id}><td><b>{r.name}</b><div className="muted small">{money(r.cost)} · {r.duration} days</div></td><td>{r.assignee}</td><td className="small">{fmtDate(r.bStart)} to<br />{fmtDate(r.bEnd)}</td>
            <td className="small">{fmtDate(r.fEnd)}{r.delay > 0 && <div style={{ color: 'var(--red)' }}>+{r.delay} days</div>}</td>
            <td className="small muted">{(r.deps || []).map(nameOf).join(', ') || '—'}</td><td><Progress value={r.pct * 100} tone={r.status === 'delayed' ? 'red' : r.pct >= 1 ? 'green' : ''} /><span className="small muted">{Math.round(r.pct * 100)}%</span></td>
            <td><Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge></td>
            <td><div className="actions"><button className="btn sm" onClick={() => setM(activities.find((a) => a.id === r.id))}><Pencil size={13} /></button><button className="btn sm danger" onClick={() => remove(r)}><Trash2 size={13} /></button></div></td></tr>
        ))}</tbody></table></div>
      {m && <FormModal wide title={m.id ? 'Edit activity' : 'Add activity'} fields={fields} initial={m} onClose={() => setM(null)} validate={validate}
        onSave={(v) => (m.id ? edit('activities', m.id, v, 'Activity saved') : add('activities', v, 'Activity added'))} />}
    </Card>
  );
}

function Delays() {
  const { derived, charter } = useStore();
  const { rows, finish, baselineFinish } = derived.sched;
  const delayed = rows.filter((r) => r.status === 'delayed');
  const impacted = rows.filter((r) => r.status === 'impacted');
  const slip = baselineFinish && finish ? diffDays(baselineFinish, finish) : 0;
  const slack = diffDays(finish, charter.deadline);
  return (
    <div className="stack">
      <div className="grid g4">
        <div className="kpi"><small>Baseline finish</small><strong>{fmtDate(baselineFinish)}</strong><span>from dependency dates</span></div>
        <div className={`kpi ${slip ? 'amber' : 'green'}`}><small>Forecast finish</small><strong>{fmtDate(finish)}</strong><span>{slip ? `${slip} days later than baseline` : 'matches baseline'}</span></div>
        <div className="kpi"><small>Approved deadline</small><strong>{fmtDate(charter.deadline)}</strong><span>from the charter</span></div>
        <div className={`kpi ${slack < 0 ? 'red' : 'green'}`}><small>Margin to deadline</small><strong>{slack < 0 ? `${-slack} d late` : `${slack} d`}</strong><span>{slack < 0 ? 'deadline will be missed' : 'deadline holds'}</span></div>
      </div>
      <Card title="Delayed activities" flush>
        {delayed.length === 0 ? <Empty title="No delayed activities" text="Every started activity is at or ahead of its planned pace." /> : delayed.map((r) => (
          <div key={r.id} className="wbs-row" style={{ alignItems: 'flex-start' }}>
            <span className="wbs-ico" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}><Clock size={15} /></span>
            <div style={{ flex: 1 }}><b>{r.name}</b> <span className="muted small">· {r.assignee}</span>
              <div className="small muted">Planned end {fmtDate(r.bEnd)}, now forecast {fmtDate(r.fEnd)} ({Math.round(r.pct * 100)}% done, {Math.round(r.expected * 100)}% expected)</div>
              {r.downstream.length > 0 && <div className="small" style={{ marginTop: 6 }}>Pushes: {r.downstream.map((d) => <Badge key={d.id} tone="amber">{d.name} +{d.delay}d</Badge>)}</div>}</div>
            <Badge tone="red">+{r.delay} days</Badge>
          </div>
        ))}
      </Card>
      <Card title="Activities affected downstream" flush>
        {impacted.length === 0 ? <Empty title="Nothing affected" text="No activity is waiting on a late predecessor." /> : impacted.map((r) => (
          <div key={r.id} className="wbs-row"><div style={{ flex: 1 }}><b>{r.name}</b><div className="small muted">Starts {fmtDate(r.fStart)} instead of {fmtDate(r.bStart)} · ends {fmtDate(r.fEnd)}</div></div><Badge tone="amber">+{r.delay} days</Badge></div>
        ))}
      </Card>
    </div>
  );
}
