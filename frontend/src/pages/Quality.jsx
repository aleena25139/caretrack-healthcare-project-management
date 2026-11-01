import { useState } from 'react';
import { ArrowRight, Bug, ClipboardCheck, Grid3x3, Network, Pencil, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { Alert, Badge, Card, Empty, FormModal, PageHead, Progress, Tabs, confirmDel, statusTone } from '../components/ui';
import { fmtDate, riskLevel, today } from '../lib/calc';
import { TEAM } from '../lib/seed';

export default function Quality() {
  const [tab, setTab] = useState('def');
  return (
    <>
      <PageHead title="Quality and risk" text="Track defects, inspect deliverables against checklists, and rank the risks that could hurt the project." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'def', label: 'Defects', icon: Bug }, { id: 'chk', label: 'Quality checklists', icon: ClipboardCheck }, { id: 'mx', label: 'Prioritization matrix', icon: Grid3x3 }, { id: 'pdpc', label: 'PDPC', icon: Network }]} />
      {tab === 'def' && <Defects />}
      {tab === 'chk' && <Checklists />}
      {tab === 'mx' && <Matrix />}
      {tab === 'pdpc' && <Pdpc />}
    </>
  );
}

const FLOW = { open: 'in-progress', 'in-progress': 'resolved', resolved: 'closed' };
function Defects() {
  const { defects, activities, add, edit, del } = useStore();
  const [f, setF] = useState('unresolved'); const [m, setM] = useState(null);
  const unresolved = (d) => !['resolved', 'closed'].includes(d.status);
  const list = defects.filter((d) => (f === 'all' ? true : f === 'unresolved' ? unresolved(d) : d.severity === f));
  const crit = defects.filter((d) => d.severity === 'critical' && unresolved(d));
  const fields = [
    { k: 'title', label: 'Defect', required: true, full: true },
    { k: 'severity', label: 'Severity', type: 'select', options: ['critical', 'major', 'minor'], required: true, placeholder: false },
    { k: 'status', label: 'Status', type: 'select', options: ['open', 'in-progress', 'resolved', 'closed'], required: true, placeholder: false },
    { k: 'assignee', label: 'Assigned to', type: 'select', options: TEAM.map((t) => t.name), required: true },
    { k: 'activityId', label: 'Related activity', type: 'select', options: activities.map((a) => ({ value: a.id, label: a.name })), placeholder: 'None' },
  ];
  return (
    <div className="stack">
      {crit.length > 0 && <Alert tone="danger" icon={Bug}><b>{crit.length} critical {crit.length === 1 ? 'defect is' : 'defects are'} unresolved.</b> {crit.map((d) => d.code).join(', ')}. Release is blocked until they are fixed.</Alert>}
      <Card title="Defect log" flush action={<button className="btn primary sm" onClick={() => setM({ title: '', severity: 'major', status: 'open', assignee: '', activityId: '' })}><Plus size={14} /> Log defect</button>}>
        <div className="chips" style={{ padding: '0 20px' }}>{[['unresolved', 'Unresolved'], ['all', 'All'], ['critical', 'Critical'], ['major', 'Major'], ['minor', 'Minor']].map(([k, l]) => <button key={k} className={`chip ${f === k ? 'on' : ''}`} onClick={() => setF(k)}>{l}</button>)}</div>
        {list.length === 0 ? <Empty title="No defects here" text="Nothing matches this filter." /> : (
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>ID</th><th>Defect</th><th>Severity</th><th>Assigned</th><th>Found</th><th>Status</th><th /></tr></thead><tbody>
            {list.map((d) => (
              <tr key={d.id}><td><b>{d.code}</b></td><td>{d.title}</td><td><Badge tone={statusTone[d.severity]}>{d.severity}</Badge></td><td>{d.assignee}</td><td className="small">{fmtDate(d.found)}</td><td><Badge tone={statusTone[d.status]}>{d.status}</Badge></td>
                <td><div className="actions">
                  {FLOW[d.status] && <button className="btn sm" onClick={() => edit('defects', d.id, { status: FLOW[d.status] }, `${d.code} marked ${FLOW[d.status]}`)}><ArrowRight size={13} /> {FLOW[d.status]}</button>}
                  <button className="btn sm" onClick={() => setM(d)}><Pencil size={13} /></button><button className="btn sm danger" onClick={() => confirmDel(d.code) && del('defects', d.id, 'Defect deleted')}><Trash2 size={13} /></button></div></td></tr>
            ))}</tbody></table></div>
        )}
      </Card>
      {m && <FormModal title={m.id ? `Edit ${m.code}` : 'Log defect'} fields={fields} initial={m} onClose={() => setM(null)}
        validate={(v) => (v.title.trim().length < 10 ? { title: 'Describe what goes wrong in at least 10 characters' } : {})}
        onSave={(v) => (m.id ? edit('defects', m.id, v, 'Defect updated') : add('defects', { ...v, code: `DEF-${String(defects.length + 1).padStart(3, '0')}`, found: today() }, 'Defect logged'))} />}
    </div>
  );
}

function Checklists() {
  const { checklists, add, edit, del, toast } = useStore();
  const [m, setM] = useState(null); const [item, setItem] = useState(null);
  const set = (c, id, patch) => edit('checklists', c.id, { items: c.items.map((i) => (i.id === id ? { ...i, ...patch, date: today() } : i)) });
  return (
    <div className="stack">
      <div><button className="btn primary" onClick={() => setM({ deliverable: '' })}><Plus size={15} /> New checklist</button></div>
      {checklists.length === 0 && <Card><Empty title="No checklists" text="Create one per deliverable, then record inspection results." /></Card>}
      <div className="grid g2">
        {checklists.map((c) => {
          const done = c.items.filter((i) => i.result !== 'pending').length;
          const pass = c.items.filter((i) => i.result === 'pass').length;
          const fail = c.items.filter((i) => i.result === 'fail').length;
          return (
            <Card key={c.id} title={c.deliverable} action={<div className="actions"><Badge tone={fail ? 'red' : done === c.items.length && c.items.length ? 'green' : ''}>{fail ? `${fail} failed` : `${pass}/${c.items.length} passed`}</Badge>
              <button className="btn sm danger" onClick={() => confirmDel(c.deliverable) && del('checklists', c.id, 'Checklist deleted')}><Trash2 size={13} /></button></div>}>
              <Progress value={c.items.length ? (pass / c.items.length) * 100 : 0} tone={fail ? 'red' : 'green'} />
              <div style={{ marginTop: 8 }}>
                {c.items.map((i) => (
                  <div className="checklist-item" key={i.id}>
                    <div style={{ flex: 1 }}>{i.text}{i.inspector && <div className="small muted">{i.inspector} · {fmtDate(i.date)}</div>}</div>
                    <div className="seg">{['pass', 'fail', 'pending'].map((r) => <button key={r} className={`${i.result === r ? 'on' : ''} ${r}`} onClick={() => i.result !== r && (r === 'pending' ? set(c, i.id, { result: r, inspector: '' }) : setItem({ c, i, result: r, inspector: i.inspector || '' }))}>{r === 'pending' ? 'Todo' : r}</button>)}</div>
                    <button className="btn sm danger icon" aria-label="Remove item" onClick={() => edit('checklists', c.id, { items: c.items.filter((x) => x.id !== i.id) })}><Trash2 size={12} /></button>
                  </div>
                ))}
                <button className="btn sm" style={{ marginTop: 10 }} onClick={() => setItem({ c, add: true, text: '' })}><Plus size={13} /> Add check</button>
              </div>
            </Card>
          );
        })}
      </div>
      {m && <FormModal title="New checklist" fields={[{ k: 'deliverable', label: 'Deliverable', required: true, full: true }]} initial={m} onClose={() => setM(null)} onSave={(v) => add('checklists', { ...v, items: [] }, 'Checklist created')} />}
      {item?.add && <FormModal title="Add check" fields={[{ k: 'text', label: 'What must be true?', required: true, full: true }]} initial={item} onClose={() => setItem(null)} onSave={(v) => edit('checklists', item.c.id, { items: [...item.c.items, { id: Math.random().toString(36).slice(2, 8), text: v.text, result: 'pending', inspector: '', date: '' }] }, 'Check added')} />}
      {item && !item.add && <FormModal title={`Record result: ${item.result}`} fields={[{ k: 'inspector', label: 'Inspected by', type: 'select', options: TEAM.map((t) => t.name), required: true, full: true }]} initial={item} onClose={() => setItem(null)} submitLabel="Save result"
        onSave={async (v) => { await set(item.c, item.i.id, { result: item.result, inspector: v.inspector }); if (item.result === 'fail') toast('Failed inspection. Log a defect so it gets fixed.', 'bad'); }} />}
    </div>
  );
}

function RiskForm({ m, setM }) {
  const { add, edit } = useStore();
  const fields = [
    { k: 'title', label: 'Risk', required: true, full: true },
    { k: 'category', label: 'Category', type: 'select', options: ['Scope', 'Cost', 'Schedule', 'Quality', 'Resource', 'Technical', 'Stakeholder'], required: true },
    { k: 'owner', label: 'Owner', required: true },
    { k: 'likelihood', label: 'Likelihood (1–5)', type: 'number', min: 1, max: 5, required: true }, { k: 'impact', label: 'Impact (1–5)', type: 'number', min: 1, max: 5, required: true },
    { k: 'problem', label: 'What could go wrong', type: 'textarea', required: true }, { k: 'preventive', label: 'Preventive action', type: 'textarea', required: true }, { k: 'corrective', label: 'Corrective action if it happens', type: 'textarea', required: true },
    { k: 'status', label: 'Status', type: 'select', options: ['open', 'mitigated', 'closed'], placeholder: false },
  ];
  return <FormModal wide title={m.id ? 'Edit risk' : 'Add risk'} fields={fields} initial={m} onClose={() => setM(null)} validate={(v) => ((+v.likelihood % 1) || (+v.impact % 1) ? { likelihood: 'Use whole numbers from 1 to 5' } : {})} onSave={(v) => (m.id ? edit('risks', m.id, v, 'Risk updated') : add('risks', v, 'Risk added'))} />;
}
const blank = { title: '', category: '', owner: '', likelihood: 3, impact: 3, problem: '', preventive: '', corrective: '', status: 'open' };
const RTONE = { critical: 'red', high: 'amber', medium: 'blue', low: 'green' };

function Matrix() {
  const { derived, del } = useStore();
  const [m, setM] = useState(null);
  const risks = derived.risks.filter((r) => r.status !== 'closed');
  return (
    <div className="grid g-main">
      <Card title="Likelihood × impact">
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="mlab" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Likelihood</div>
          <div style={{ flex: 1 }}>
            <div className="matrix" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gridTemplateRows: 'repeat(5, 74px) 26px' }}>
              {[5, 4, 3, 2, 1].flatMap((l) => [1, 2, 3, 4, 5].map((i) => (
                <div key={`${l}${i}`} className={`mcell lv-${riskLevel(l * i)}`}>{risks.filter((r) => +r.likelihood === l && +r.impact === i).map((r) => <span key={r.id} className="pin" title={`${r.title} (${r.score})`}>{r.score}</span>)}</div>
              )))}
              {[1, 2, 3, 4, 5].map((i) => <div key={i} className="mlab">{i}</div>)}
            </div>
            <div className="mlab" style={{ marginTop: 4 }}>Impact</div>
          </div>
        </div>
        <div className="legend" style={{ marginTop: 12 }}>{[['low', '#d5efe0'], ['medium', '#fbefc2'], ['high', '#fbd6b5'], ['critical', '#f6b5b8']].map(([l, c]) => <span key={l}><i style={{ background: c }} />{l}</span>)}</div>
      </Card>
      <Card title="Ranked risks" flush action={<button className="btn primary sm" onClick={() => setM(blank)}><Plus size={14} /> Add risk</button>}>
        {risks.length === 0 ? <Empty title="No open risks" text="Add the risks you can think of. Rank them by likelihood and impact." /> : risks.map((r, i) => (
          <div key={r.id} className="wbs-row"><b className="num muted" style={{ width: 20 }}>{i + 1}</b><div style={{ flex: 1, minWidth: 0 }}><b>{r.title}</b><div className="small muted">{r.category} · {r.owner} · L{r.likelihood} × I{r.impact}</div></div><Badge tone={RTONE[riskLevel(r.score)]}>{r.score}</Badge>
            <button className="btn sm icon" onClick={() => setM(r)}><Pencil size={13} /></button><button className="btn sm danger icon" onClick={() => confirmDel(r.title) && del('risks', r.id, 'Risk deleted')}><Trash2 size={13} /></button></div>
        ))}
      </Card>
      {m && <RiskForm m={m} setM={setM} />}
    </div>
  );
}

function Pdpc() {
  const { derived, charter } = useStore();
  const risks = derived.risks.filter((r) => r.status !== 'closed');
  return (
    <Card title="Process decision program chart">
      <p className="muted" style={{ marginTop: 0 }}>Read left to right: for each risk, the problem that could stop the goal, what to do now to prevent it, and what to do if it happens anyway. Highest score first.</p>
      {risks.length === 0 ? <Empty title="No open risks" text="Add risks on the matrix tab to build the chart." /> : (
        <div className="pdpc">
          <div className="pdpc-goal">Goal: go live at five hospitals by {fmtDate(charter.deadline)}</div>
          {risks.map((r) => (
            <div className="pdpc-branch" key={r.id}>
              <div className={`pdpc-node risk lv-${riskLevel(r.score)}`}><b>Risk · score {r.score}</b>{r.title}</div>
              <div className="pdpc-arrow"><ArrowRight size={16} /></div>
              <div className="pdpc-node prob"><b>Problem</b>{r.problem}</div>
              <div className="pdpc-arrow"><ArrowRight size={16} /></div>
              <div className="pdpc-acts"><div className="pdpc-node prev"><b>Prevent</b>{r.preventive}</div><div className="pdpc-node corr"><b>Correct</b>{r.corrective}</div></div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
