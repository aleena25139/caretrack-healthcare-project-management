import { useState } from 'react';
import { CheckCircle2, FileSignature, Flag, Lock, Pencil, Plus, Trash2, Users, XCircle, ClipboardList } from 'lucide-react';
import { useStore } from '../store';
import { Badge, Card, Empty, FormModal, PageHead, Tabs, confirmDel, money, statusTone, Alert } from '../components/ui';
import { fmtDate } from '../lib/calc';
import { TEAM } from '../lib/seed';

const STAGES = ['Initiating', 'Planning', 'Executing', 'Monitoring', 'Closing', 'Closed'];
const lines = (s) => (s || '').split('\n').map((x) => x.trim()).filter(Boolean);

export default function Initiation() {
  const [tab, setTab] = useState('charter');
  return (
    <>
      <PageHead title="Initiation and plan" text="The charter authorises the project, the management plan says how it will be run, and milestones and closure record how it ends." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'charter', label: 'Project charter', icon: FileSignature }, { id: 'plan', label: 'Management plan', icon: ClipboardList }, { id: 'ms', label: 'Milestones and team', icon: Flag }, { id: 'closure', label: 'Closure', icon: Lock }]} />
      {tab === 'charter' && <Charter />}
      {tab === 'plan' && <Plan />}
      {tab === 'ms' && <Milestones />}
      {tab === 'closure' && <Closure />}
    </>
  );
}

function Charter() {
  const { charter, edit, derived } = useStore();
  const [open, setOpen] = useState(false);
  const [sh, setSh] = useState(null);
  const fields = [
    { k: 'name', label: 'Project name', required: true, full: true },
    { k: 'sponsor', label: 'Sponsor', required: true },
    { k: 'manager', label: 'Project manager', required: true },
    { k: 'startDate', label: 'Start date', type: 'date', required: true },
    { k: 'deadline', label: 'Deadline', type: 'date', required: true },
    { k: 'budget', label: 'Approved budget (PKR)', type: 'number', min: 1, required: true, hint: 'Changes through approved change requests only' },
    { k: 'objectives', label: 'Objectives (one per line)', type: 'textarea', required: true },
    { k: 'inScope', label: 'In scope (one per line)', type: 'textarea', required: true },
    { k: 'outScope', label: 'Out of scope (one per line)', type: 'textarea' },
  ];
  const stakeFields = [
    { k: 'name', label: 'Name', required: true }, { k: 'influence', label: 'Influence', type: 'select', options: ['High', 'Medium', 'Low'], required: true },
    { k: 'role', label: 'Role and interest', required: true, full: true },
  ];
  return (
    <div className="grid g-main">
      <div className="stack">
        <Card title="Charter" action={<button className="btn" onClick={() => setOpen(true)}><Pencil size={15} /> Edit charter</button>}>
          <dl className="kv">
            <dt>Project</dt><dd><b>{charter.name}</b></dd>
            <dt>Sponsor</dt><dd>{charter.sponsor}</dd>
            <dt>Project manager</dt><dd>{charter.manager}</dd>
            <dt>Timeline</dt><dd>{fmtDate(charter.startDate)} to {fmtDate(charter.deadline)}</dd>
            <dt>Approved budget</dt><dd><b className="num">{money(charter.budget)}</b></dd>
            <dt>Project stage</dt>
            <dd><select className="input" style={{ width: 'auto' }} value={charter.status} onChange={(e) => edit('charter', charter.id, { status: e.target.value }, `Stage set to ${e.target.value}`)}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select></dd>
          </dl>
        </Card>
        <div className="grid g2">
          <Card title="Objectives"><ul className="list">{lines(charter.objectives).map((o, i) => <li key={i}>{o}</li>)}</ul></Card>
          <Card title="Scope boundaries">
            <b className="small" style={{ color: 'var(--green)' }}>Inside the boundary</b><ul className="list" style={{ margin: '4px 0 14px' }}>{lines(charter.inScope).map((o, i) => <li key={i}>{o}</li>)}</ul>
            <b className="small" style={{ color: 'var(--red)' }}>Outside the boundary</b><ul className="list" style={{ marginTop: 4 }}>{lines(charter.outScope).map((o, i) => <li key={i}>{o}</li>)}</ul>
          </Card>
        </div>
      </div>
      <Card title="Stakeholders" action={<button className="btn sm" onClick={() => setSh({ name: '', role: '', influence: 'Medium', i: -1 })}><Plus size={14} /> Add</button>} flush>
        {charter.stakeholders.length === 0 ? <Empty title="No stakeholders yet" text="Add the people who approve, use or are affected by the project." /> : charter.stakeholders.map((s, i) => (
          <div key={i} className="wbs-row"><div style={{ flex: 1 }}><b>{s.name}</b><div className="muted small">{s.role}</div></div><Badge tone={s.influence === 'High' ? 'teal' : ''}>{s.influence}</Badge>
            <button className="btn icon sm" aria-label="Edit" onClick={() => setSh({ ...s, i })}><Pencil size={14} /></button>
            <button className="btn icon sm danger" aria-label="Remove" onClick={() => confirmDel(s.name) && edit('charter', charter.id, { stakeholders: charter.stakeholders.filter((_, j) => j !== i) }, 'Stakeholder removed')}><Trash2 size={14} /></button></div>
        ))}
      </Card>
      {open && <FormModal wide title="Edit project charter" fields={fields} initial={charter} onClose={() => setOpen(false)}
        validate={(v) => (v.deadline <= v.startDate ? { deadline: 'Deadline must be after the start date' } : v.budget < derived.evm.BAC ? { budget: `Budget is below the planned cost of ${money(derived.evm.BAC)}` } : {})}
        onSave={(v) => edit('charter', charter.id, v, 'Charter saved')} />}
      {sh && <FormModal title={sh.i < 0 ? 'Add stakeholder' : 'Edit stakeholder'} fields={stakeFields} initial={sh} onClose={() => setSh(null)}
        onSave={({ i, ...s }) => edit('charter', charter.id, { stakeholders: i < 0 ? [...charter.stakeholders, s] : charter.stakeholders.map((x, j) => (j === i ? s : x)) }, 'Stakeholder saved')} />}
    </div>
  );
}

function Plan() {
  const { plan, edit, derived, charter, requirements, activities, defects } = useStore();
  const [sec, setSec] = useState(null);
  const approved = requirements.filter((r) => r.status === 'approved').length;
  const parts = [['scope', 'Scope'], ['schedule', 'Schedule'], ['cost', 'Cost'], ['quality', 'Quality']];
  return (
    <div className="stack">
      <Card title="Live figures from the project">
        <div className="grid g4">
          {[['Approved requirements', approved], ['Activities', activities.length], ['Planned cost', money(derived.evm.BAC)], ['Open defects', defects.filter((d) => !['resolved', 'closed'].includes(d.status)).length]].map(([l, v]) => <div key={l}><div className="muted small">{l}</div><b style={{ font: '800 22px var(--display)' }}>{v}</b></div>)}
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>These are computed from the other modules, so the plan never drifts from the real data. Deadline {fmtDate(charter.deadline)}.</p>
      </Card>
      <div className="grid g2">
        {parts.map(([k, label]) => (
          <Card key={k} title={`${label} management`} action={<button className="btn sm" onClick={() => setSec({ k, label })}><Pencil size={14} /> Edit</button>}>
            <p style={{ margin: 0 }}>{plan[k] || <span className="muted">Nothing written yet.</span>}</p>
          </Card>
        ))}
      </div>
      <Card title="Performance thresholds" action={<button className="btn sm" onClick={() => setSec({ k: 'thresholds' })}><Pencil size={14} /> Edit</button>}>
        <p style={{ margin: 0 }}>Warnings appear when <b>CPI</b> drops below <b>{plan.thresholds.cpi}</b> or <b>SPI</b> drops below <b>{plan.thresholds.spi}</b>. Below 0.10 under the threshold turns the warning red.</p>
      </Card>
      {sec && sec.k !== 'thresholds' && <FormModal title={`Edit ${sec.label.toLowerCase()} management`} fields={[{ k: 'text', label: sec.label, type: 'textarea', required: true }]} initial={{ text: plan[sec.k] }} onClose={() => setSec(null)} onSave={({ text }) => edit('plan', plan.id, { [sec.k]: text }, 'Plan updated')} />}
      {sec?.k === 'thresholds' && <FormModal title="Performance thresholds" fields={[{ k: 'cpi', label: 'CPI warning below', type: 'number', min: 0.1, max: 1.5, required: true }, { k: 'spi', label: 'SPI warning below', type: 'number', min: 0.1, max: 1.5, required: true }]} initial={plan.thresholds} onClose={() => setSec(null)} onSave={(t) => edit('plan', plan.id, { thresholds: t }, 'Thresholds saved')} />}
    </div>
  );
}

function Milestones() {
  const { milestones, add, edit, del, charter, derived } = useStore();
  const [m, setM] = useState(null);
  const names = TEAM.map((t) => t.name);
  const fields = [{ k: 'name', label: 'Milestone', required: true, full: true }, { k: 'date', label: 'Target date', type: 'date', required: true }, { k: 'owner', label: 'Owner', type: 'select', options: names, required: true }, { k: 'status', label: 'Status', type: 'select', options: ['pending', 'achieved', 'at-risk'], placeholder: false }];
  const load = TEAM.map((t) => { const mine = derived.sched.rows.filter((r) => r.assignee === t.name); return { ...t, count: mine.length, active: mine.filter((r) => r.pct < 1).length, cost: mine.reduce((s, r) => s + r.cost, 0) }; });
  return (
    <div className="stack">
      <Card title="Milestones" flush action={<button className="btn primary sm" onClick={() => setM({ name: '', date: '', owner: '', status: 'pending' })}><Plus size={14} /> Add milestone</button>}>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Milestone</th><th>Target</th><th>Owner</th><th>Status</th><th /></tr></thead><tbody>
          {[...milestones].sort((a, b) => a.date.localeCompare(b.date)).map((x) => (
            <tr key={x.id}><td><b>{x.name}</b></td><td>{fmtDate(x.date)}</td><td>{x.owner}</td><td><Badge tone={statusTone[x.status]}>{x.status}</Badge></td>
              <td><div className="actions"><button className="btn sm" onClick={() => setM(x)}><Pencil size={13} /></button><button className="btn sm danger" onClick={() => confirmDel(x.name) && del('milestones', x.id, 'Milestone deleted')}><Trash2 size={13} /></button></div></td></tr>
          ))}</tbody></table></div>
      </Card>
      <Card title="Responsibilities" action={<Users size={18} />} flush>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Team member</th><th>Role</th><th>Activities</th><th>Still active</th><th className="right">Planned cost</th></tr></thead><tbody>
          {load.map((t) => <tr key={t.name}><td><b>{t.name}</b></td><td>{t.role}</td><td>{t.count}</td><td>{t.active}</td><td className="right num">{money(t.cost)}</td></tr>)}</tbody></table></div>
      </Card>
      {m && <FormModal title={m.id ? 'Edit milestone' : 'Add milestone'} fields={fields} initial={m} onClose={() => setM(null)}
        validate={(v) => (v.date < charter.startDate || v.date > charter.deadline ? { date: `Pick a date between ${fmtDate(charter.startDate)} and ${fmtDate(charter.deadline)}` } : {})}
        onSave={(v) => (m.id ? edit('milestones', m.id, v, 'Milestone saved') : add('milestones', v, 'Milestone added'))} />}
    </div>
  );
}

function Closure() {
  const { closure, edit, derived, milestones, activities, charter } = useStore();
  const [open, setOpen] = useState(false);
  const checks = [
    ['All activities are 100% complete', derived.sched.rows.every((r) => r.pct >= 1), `${derived.sched.rows.filter((r) => r.pct < 1).length} still open`],
    ['No unresolved critical defects', derived.openCritical.length === 0, `${derived.openCritical.length} open`],
    ['No change requests waiting for a decision', derived.pendingCR.length === 0, `${derived.pendingCR.length} pending`],
    ['All milestones achieved', milestones.every((m) => m.status === 'achieved'), `${milestones.filter((m) => m.status !== 'achieved').length} remaining`],
    ['Consistency checks pass', derived.checks.every((c) => c.pass), 'See dashboard'],
  ];
  const ready = checks.every((c) => c[1]);
  const closed = closure.status === 'closed';
  const fields = [{ k: 'deliverablesAccepted', label: 'Deliverables accepted by', required: true }, { k: 'signedOffBy', label: 'Sign-off by (sponsor)', required: true }, { k: 'handover', label: 'Handover and support notes', type: 'textarea', required: true }, { k: 'lessons', label: 'Lessons learned', type: 'textarea', required: true }];
  return (
    <div className="grid g2">
      <Card title="Closure readiness">
        {checks.map(([t, ok, d]) => <div className="check-row" key={t}>{ok ? <CheckCircle2 size={17} color="var(--green)" /> : <XCircle size={17} color="var(--red)" />}<div>{t}{!ok && <div className="small" style={{ color: 'var(--red)' }}>{d}</div>}</div></div>)}
      </Card>
      <Card title="Closure record" action={closed ? <Badge tone="green">Closed {fmtDate(closure.closedOn)}</Badge> : <Badge>Open</Badge>}>
        {closed ? (
          <dl className="kv"><dt>Accepted by</dt><dd>{closure.deliverablesAccepted}</dd><dt>Signed off by</dt><dd>{closure.signedOffBy}</dd><dt>Handover</dt><dd>{closure.handover}</dd><dt>Lessons</dt><dd>{closure.lessons}</dd></dl>
        ) : (
          <>
            {!ready && <Alert tone="info" icon={Lock}>The project can only be closed once every readiness check passes.</Alert>}
            <div style={{ marginTop: 14 }}><button className="btn primary" disabled={!ready} onClick={() => setOpen(true)}><Lock size={15} /> Close project</button></div>
          </>
        )}
      </Card>
      {open && <FormModal title="Close project" fields={fields} initial={closure} submitLabel="Close project" onClose={() => setOpen(false)}
        onSave={async (v) => { await edit('closure', closure.id, { ...v, status: 'closed', closedOn: new Date().toISOString().slice(0, 10) }); await edit('charter', charter.id, { status: 'Closed' }, 'Project closed'); }} />}
    </div>
  );
}
