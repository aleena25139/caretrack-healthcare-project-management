import { useState } from 'react';
import { ArrowRight, Boxes, Check, FileDiff, FolderTree, ListChecks, Package, Pencil, Plus, ShieldAlert, Trash2, X } from 'lucide-react';
import { useStore } from '../store';
import { Alert, Badge, Card, Empty, FormModal, Modal, PageHead, Tabs, confirmDel, money, statusTone } from '../components/ui';
import { addDays, diffDays, fmtDate, wbsTree } from '../lib/calc';

export default function Scope() {
  const [tab, setTab] = useState('req');
  const { derived } = useStore();
  return (
    <>
      <PageHead title="Scope and WBS" text="Only approved requirements are in scope. Everything else needs an approved change request first." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'req', label: 'Requirements', icon: ListChecks }, { id: 'wbs', label: 'Work breakdown', icon: FolderTree }, { id: 'cr', label: `Change requests${derived.pendingCR.length ? ` (${derived.pendingCR.length})` : ''}`, icon: FileDiff }]} />
      {tab === 'req' && <Requirements goCR={() => setTab('cr')} />}
      {tab === 'wbs' && <Wbs />}
      {tab === 'cr' && <Changes />}
    </>
  );
}

const PRIO = ['Must', 'Should', 'Could', 'Wont'];

function Requirements({ goCR }) {
  const { requirements, wbs, add, edit, del, charter, toast, changes } = useStore();
  const [f, setF] = useState('all'); const [m, setM] = useState(null);
  const list = requirements.filter((r) => f === 'all' || r.status === f);
  const count = (s) => requirements.filter((r) => r.status === s).length;
  const afterBaseline = !['Initiating', 'Planning'].includes(charter.status);
  const fields = [{ k: 'title', label: 'Requirement', required: true, full: true }, { k: 'priority', label: 'Priority (MoSCoW)', type: 'select', options: PRIO, required: true }, { k: 'description', label: 'Notes', type: 'textarea' }];
  const save = (v) => {
    if (m.id) return edit('requirements', m.id, v, 'Requirement updated');
    const code = `REQ-${String(requirements.length + 1).padStart(2, '0')}`;
    if (afterBaseline) toast('Added as proposed. Raise a change request to bring it into scope.');
    return add('requirements', { ...v, code, status: afterBaseline ? 'proposed' : 'approved', origin: afterBaseline ? 'change' : 'baseline' }, afterBaseline ? undefined : 'Requirement added and approved');
  };
  const remove = (r) => {
    if (wbs.some((w) => w.reqId === r.id)) return toast('This requirement is used by the WBS. Remove those work packages first.', 'bad');
    if (changes.some((c) => c.requirementId === r.id)) return toast('A change request refers to this requirement.', 'bad');
    if (confirmDel(r.code)) del('requirements', r.id, 'Requirement deleted');
  };
  return (
    <div className="stack">
      <div className="grid g4">
        {[['approved', 'In approved scope', 'green'], ['proposed', 'Awaiting approval', 'amber'], ['rejected', 'Rejected', 'red']].map(([s, l, t]) => (
          <div key={s} className={`kpi ${t}`}><small>{l}</small><strong>{count(s)}</strong></div>
        ))}
        <div className="kpi teal"><small>Total requirements</small><strong>{requirements.length}</strong></div>
      </div>
      <Card title="Requirements register" flush action={<button className="btn primary sm" onClick={() => setM({ title: '', priority: 'Must', description: '' })}><Plus size={14} /> Add requirement</button>}>
        <div style={{ padding: '0 20px' }} className="chips">{['all', 'approved', 'proposed', 'rejected'].map((s) => <button key={s} className={`chip ${f === s ? 'on' : ''}`} onClick={() => setF(s)}>{s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)}</button>)}</div>
        {list.length === 0 ? <Empty title="Nothing here" text="No requirements match this filter." /> : (
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>ID</th><th>Requirement</th><th>Priority</th><th>Status</th><th>Origin</th><th /></tr></thead><tbody>
            {list.map((r) => (
              <tr key={r.id}><td className="num"><b>{r.code}</b></td><td>{r.title}</td><td><Badge tone={r.priority === 'Must' ? 'teal' : ''}>{r.priority}</Badge></td><td><Badge tone={statusTone[r.status]}>{r.status}</Badge></td><td className="muted">{r.origin === 'change' ? 'Change request' : 'Baseline'}</td>
                <td><div className="actions">
                  {r.status === 'proposed' && (r.origin === 'baseline'
                    ? <button className="btn sm" onClick={() => edit('requirements', r.id, { status: 'approved' }, `${r.code} approved`)}><Check size={13} /> Approve</button>
                    : <button className="btn sm" title="Added after baseline" onClick={goCR}><ShieldAlert size={13} /> Needs change request</button>)}
                  <button className="btn sm" onClick={() => setM(r)}><Pencil size={13} /></button>
                  <button className="btn sm danger" onClick={() => remove(r)}><Trash2 size={13} /></button></div></td></tr>
            ))}</tbody></table></div>
        )}
      </Card>
      {m && <FormModal title={m.id ? `Edit ${m.code}` : 'Add requirement'} fields={fields} initial={m} onClose={() => setM(null)} onSave={save}
        validate={(v) => (v.title.trim().length < 8 ? { title: 'Describe the requirement in at least 8 characters' } : {})} />}
    </div>
  );
}

function Wbs() {
  const { wbs, requirements, activities, add, edit, del, toast } = useStore();
  const [m, setM] = useState(null);
  const { tree, flat } = wbsTree(wbs);
  const reqById = Object.fromEntries(requirements.map((r) => [r.id, r]));
  const cost = (n) => activities.filter((a) => a.wbsId === n.id).reduce((s, a) => s + (+a.plannedCost || 0), 0) + n.children.reduce((s, c) => s + cost(c), 0);
  const approved = requirements.filter((r) => r.status === 'approved');
  const fields = [
    { k: 'name', label: 'Name', required: true, full: true },
    { k: 'type', label: 'Type', type: 'select', options: [{ value: 'deliverable', label: 'Deliverable (can have children)' }, { value: 'package', label: 'Work package (holds activities)' }], required: true, placeholder: false },
    { k: 'parentId', label: 'Parent', type: 'select', options: flat.filter((n) => n.type === 'deliverable' && n.id !== m?.id).map((n) => ({ value: n.id, label: `${n.code} ${n.name}` })), placeholder: 'None (top level)' },
    { k: 'reqId', label: 'Approved requirement', type: 'select', options: approved.map((r) => ({ value: r.id, label: `${r.code} ${r.title}` })), hint: 'Required for work packages. Unapproved requirements are not listed.', full: true },
  ];
  const remove = (n) => {
    if (n.children.length) return toast('Delete or move the children first.', 'bad');
    if (activities.some((a) => a.wbsId === n.id)) return toast('Activities are assigned to this package. Reassign them first.', 'bad');
    if (confirmDel(n.name)) del('wbs', n.id, 'WBS element deleted');
  };
  const row = (n) => (
    <div key={n.id}>
      <div className="wbs-row" style={{ paddingLeft: 20 + n.depth * 26 }}>
        <span className="wbs-code">{n.code}</span>
        <span className={`wbs-ico ${n.type === 'package' ? 'pkg' : ''}`}>{n.type === 'package' ? <Package size={15} /> : <Boxes size={15} />}</span>
        <div style={{ flex: 1, minWidth: 0 }}><b>{n.name}</b>{n.reqId && <div className="muted small">{reqById[n.reqId]?.code} · {reqById[n.reqId]?.title}</div>}</div>
        <span className="num muted small">{money(cost(n))}</span>
        {n.type === 'deliverable' && <button className="btn sm" onClick={() => setM({ name: '', type: 'package', parentId: n.id, reqId: '' })}><Plus size={13} /> Child</button>}
        <button className="btn sm" onClick={() => setM(n)}><Pencil size={13} /></button>
        <button className="btn sm danger" onClick={() => remove(n)}><Trash2 size={13} /></button>
      </div>
      {n.children.map(row)}
    </div>
  );
  return (
    <>
      <Card title="Work breakdown structure" flush action={<button className="btn primary sm" onClick={() => setM({ name: '', type: 'deliverable', parentId: '', reqId: '' })}><Plus size={14} /> Add element</button>}>
        {tree.length ? tree.map(row) : <Empty title="No WBS yet" text="Start with the top-level deliverable, then break it down into work packages." />}
      </Card>
      {m && <FormModal title={m.id ? 'Edit WBS element' : 'Add WBS element'} fields={fields} initial={{ ...m, parentId: m.parentId || '', reqId: m.reqId || '' }} onClose={() => setM(null)}
        validate={(v) => {
          const e = {};
          if (v.type === 'package' && !v.reqId) e.reqId = 'A work package must trace to an approved requirement';
          if (v.type === 'deliverable' && v.reqId) e.reqId = 'Only work packages link to requirements';
          if (m.id && v.type === 'package' && flat.some((n) => n.parentId === m.id)) e.type = 'This element has children, so it must stay a deliverable';
          return e;
        }}
        onSave={(v) => { const doc = { ...v, parentId: v.parentId || null, reqId: v.reqId || null }; return m.id ? edit('wbs', m.id, doc, 'WBS updated') : add('wbs', doc, 'WBS element added'); }} />}
    </>
  );
}

function Changes() {
  const { changes, requirements, add, charter, derived, approveChange, rejectChange } = useStore();
  const [m, setM] = useState(null); const [review, setReview] = useState(null);
  const proposed = requirements.filter((r) => r.status === 'proposed' && r.origin === 'change' && !changes.some((c) => c.requirementId === r.id && c.status === 'pending'));
  const fields = [
    { k: 'title', label: 'Change title', required: true, full: true },
    { k: 'requirementId', label: 'Requirement affected', type: 'select', options: proposed.map((r) => ({ value: r.id, label: `${r.code} ${r.title}` })), required: true, full: true, hint: proposed.length ? undefined : 'Add the new requirement on the Requirements tab first' },
    { k: 'justification', label: 'Justification', type: 'textarea', required: true },
    { k: 'costImpact', label: 'Cost impact (PKR)', type: 'number', min: 0, required: true },
    { k: 'scheduleImpact', label: 'Schedule impact (days)', type: 'number', min: 0, required: true },
    { k: 'requestedBy', label: 'Requested by', required: true },
  ];
  const list = [...changes].sort((a, b) => b.code.localeCompare(a.code));
  return (
    <>
      <Card title="Change requests" flush action={<button className="btn primary sm" onClick={() => setM({ title: '', requirementId: '', justification: '', costImpact: '', scheduleImpact: '', requestedBy: '' })}><Plus size={14} /> New change request</button>}>
        {list.length === 0 ? <Empty title="No change requests" text="Scope is stable. When someone asks for more, record it here." /> : (
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>ID</th><th>Change</th><th className="right">Cost</th><th className="right">Schedule</th><th>Status</th><th /></tr></thead><tbody>
            {list.map((c) => (
              <tr key={c.id}><td><b>{c.code}</b></td><td>{c.title}<div className="muted small">{c.requestedBy} · {fmtDate(c.date)}</div></td><td className="right num">+{money(c.costImpact)}</td><td className="right num">+{c.scheduleImpact} d</td><td><Badge tone={statusTone[c.status]}>{c.status}</Badge></td>
                <td><div className="actions"><button className="btn sm" onClick={() => setReview(c)}>{c.status === 'pending' ? 'Review' : 'View'}</button></div></td></tr>
            ))}</tbody></table></div>
        )}
      </Card>
      {m && <FormModal title="New change request" fields={fields} initial={m} onClose={() => setM(null)}
        validate={(v) => (v.justification.trim().length < 15 ? { justification: 'Explain why in at least 15 characters' } : {})}
        onSave={(v) => add('changes', { ...v, code: `CR-${String(changes.length + 1).padStart(3, '0')}`, status: 'pending', date: new Date().toISOString().slice(0, 10) }, 'Change request submitted')} />}
      {review && <Review cr={review} onClose={() => setReview(null)} />}
    </>
  );

  function Review({ cr, onClose }) {
    const req = requirements.find((r) => r.id === cr.requirementId);
    const approvedNow = requirements.filter((r) => r.status === 'approved').length;
    const baseline = derived.sched.rows.length ? derived.sched.finish : charter.deadline;
    const newDeadline = addDays(charter.deadline, cr.scheduleImpact);
    const [note, setNote] = useState('');
    const pend = cr.status === 'pending';
    const Row = ({ l, a, b, bad }) => <><span>{l}</span><span className="num">{a}</span><ArrowRight size={15} className="arrow" /><b className={`num ${bad ? 'up' : ''}`}>{b}</b></>;
    return (
      <Modal title={`${cr.code}: ${cr.title}`} onClose={onClose} wide>
        <p style={{ marginTop: 0 }}>{cr.justification}</p>
        <Alert tone="info" icon={FileDiff}>Linked requirement: <b>{req?.code}</b> {req?.title}. Status now: <b>{req?.status}</b>.</Alert>
        <h4 style={{ margin: '18px 0 8px' }}>{pend ? 'Impact if approved' : 'Impact applied'}</h4>
        <div className="impact">
          <Row l="Approved scope (requirements)" a={approvedNow - (pend ? 0 : 1)} b={approvedNow - (pend ? 0 : 1) + 1} />
          <Row l="Approved budget" a={money(charter.budget - (pend ? 0 : cr.costImpact))} b={money(charter.budget + (pend ? cr.costImpact : 0))} bad />
          <Row l="Deadline" a={fmtDate(addDays(charter.deadline, pend ? 0 : -cr.scheduleImpact))} b={fmtDate(pend ? newDeadline : charter.deadline)} bad />
        </div>
        {pend && <p className="muted small">Approving also adds a work package and an activity ({cr.scheduleImpact} days, {money(cr.costImpact)}) after the current last task. Forecast finish today: {fmtDate(baseline)}.</p>}
        {!pend && cr.decisionNote && <p className="muted">Decision note: {cr.decisionNote}</p>}
        {pend && (
          <>
            <div className="field"><label>Decision note</label><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why was this decided?" /></div>
            <div className="modal-f">
              <button className="btn danger" onClick={async () => { await rejectChange(cr, note); onClose(); }}><X size={15} /> Reject</button>
              <button className="btn primary" onClick={async () => { try { await approveChange(cr, note); onClose(); } catch (e) { /* shown */ } }}><Check size={15} /> Approve change</button>
            </div>
          </>
        )}
      </Modal>
    );
  }
}
