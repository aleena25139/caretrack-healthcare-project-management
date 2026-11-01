import { useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CheckCircle2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { Alert, Badge, Card, Empty, FormModal, PageHead, Progress, confirmDel, money, moneyShort } from '../components/ui';
import { fmtDate, today } from '../lib/calc';

function Index({ label, value, threshold }) {
  const tone = value >= threshold ? 'green' : value >= threshold - 0.1 ? 'amber' : 'red';
  return (
    <Card>
      <div className="muted small">{label}</div>
      <b style={{ font: '800 34px var(--display)', color: `var(--${tone})` }}>{value.toFixed(2)}</b>
      <div className="gauge" style={{ margin: '10px 0 6px' }}><Progress value={Math.min(value, 1.5) / 1.5 * 100} tone={tone} /><span className="mark" style={{ left: `${threshold / 1.5 * 100}%` }} title="Threshold" /></div>
      <div className="small muted">Warning below {threshold.toFixed(2)} · {value >= 1 ? 'better than plan' : value >= threshold ? 'slightly behind plan' : 'outside tolerance'}</div>
    </Card>
  );
}

export default function Cost() {
  const { derived, charter, expenses, add, edit, del, statusDate } = useStore();
  const { evm, sched } = derived;
  const [m, setM] = useState(null);
  const byAct = sched.rows.map((r) => {
    const ac = expenses.filter((e) => e.activityId === r.id && e.date <= statusDate).reduce((s, e) => s + e.amount, 0);
    const ev = r.cost * r.pct;
    return { ...r, ac, ev, cv: ev - ac };
  });
  const fields = [
    { k: 'activityId', label: 'Activity', type: 'select', options: sched.rows.map((r) => ({ value: r.id, label: r.name })), required: true, full: true },
    { k: 'date', label: 'Date', type: 'date', required: true }, { k: 'amount', label: 'Amount (PKR)', type: 'number', min: 1, required: true },
    { k: 'category', label: 'Category', type: 'select', options: ['Labour', 'Tools', 'Infrastructure', 'Training', 'Other'], required: true, placeholder: false }, { k: 'note', label: 'Note' },
  ];
  const nameOf = (id) => sched.rows.find((r) => r.id === id)?.name || 'Unknown activity';
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  return (
    <>
      <PageHead title="Cost and earned value" text={`Earned value analysis as of ${fmtDate(statusDate)}. Change the status date in the sidebar to see another point in time.`} />
      <div className="stack" style={{ marginBottom: 18 }}>
        {evm.warnings.length === 0 ? <Alert tone="ok" icon={CheckCircle2}>Cost and schedule are within thresholds.</Alert> : evm.warnings.map((w, i) => <Alert key={i} tone={w.level} icon={AlertTriangle}>{w.text}</Alert>)}
      </div>
      <div className="grid g4" style={{ marginBottom: 18 }}>
        {[['Planned value (PV)', evm.PV, 'Work scheduled so far'], ['Earned value (EV)', evm.EV, 'Work actually completed'], ['Actual cost (AC)', evm.AC, 'Spent to date'], ['Budget at completion', evm.BAC, `${(evm.BAC / charter.budget * 100).toFixed(0)}% of approved budget`]].map(([l, v, s]) => (
          <div className="kpi teal" key={l}><small>{l}</small><strong>{moneyShort(v)}</strong><span>{s}</span></div>
        ))}
      </div>
      <div className="grid g3" style={{ marginBottom: 18 }}>
        <Index label="Cost performance index (CPI = EV ÷ AC)" value={evm.CPI} threshold={evm.thresholds.cpi} />
        <Index label="Schedule performance index (SPI = EV ÷ PV)" value={evm.SPI} threshold={evm.thresholds.spi} />
        <Card title="Forecast">
          <dl className="kv" style={{ gridTemplateColumns: '130px 1fr' }}>
            <dt>Cost variance</dt><dd className="num" style={{ color: evm.CV < 0 ? 'var(--red)' : 'var(--green)' }}>{money(evm.CV)}</dd>
            <dt>Schedule variance</dt><dd className="num" style={{ color: evm.SV < 0 ? 'var(--red)' : 'var(--green)' }}>{money(evm.SV)}</dd>
            <dt>Estimate at completion</dt><dd className="num"><b>{money(evm.EAC)}</b></dd>
            <dt>Estimate to complete</dt><dd className="num">{money(evm.ETC)}</dd>
            <dt>Variance at completion</dt><dd className="num" style={{ color: evm.VAC < 0 ? 'var(--red)' : 'var(--green)' }}>{money(evm.VAC)}</dd>
          </dl>
        </Card>
      </div>
      <Card title="S-curve: planned value over time">
        <div style={{ height: 300 }}><ResponsiveContainer>
          <LineChart data={evm.curve} margin={{ left: 4, right: 14, top: 10 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d).slice(0, 6)} tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={44} />
            <Tooltip formatter={(v) => money(v)} labelFormatter={fmtDate} contentStyle={{ borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)' }} />
            <Legend />
            <ReferenceLine y={charter.budget} stroke="#2f6bff" strokeDasharray="5 5" label={{ value: 'Approved budget', fill: '#2f6bff', fontSize: 12, position: 'insideTopLeft' }} />
            <ReferenceLine x={statusDate} stroke="var(--muted)" strokeDasharray="3 3" />
            <Line name="Planned value" dataKey="pv" stroke="#8a9ac0" strokeWidth={3} dot={false} />
            <Line name="Earned value" dataKey="ev" stroke="#0ea5a0" dot={{ r: 7 }} activeDot={{ r: 9 }} strokeWidth={0} />
            <Line name="Actual cost" dataKey="ac" stroke="#dc3f45" dot={{ r: 7 }} activeDot={{ r: 9 }} strokeWidth={0} />
          </LineChart>
        </ResponsiveContainer></div>
      </Card>
      <div className="grid g-main" style={{ marginTop: 18 }}>
        <Card title="Cost by activity" flush>
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Activity</th><th className="right">Planned</th><th className="right">Earned</th><th className="right">Actual</th><th className="right">Variance</th></tr></thead><tbody>
            {byAct.map((r) => <tr key={r.id}><td>{r.name}</td><td className="right num">{moneyShort(r.cost)}</td><td className="right num">{moneyShort(r.ev)}</td><td className="right num">{moneyShort(r.ac)}</td><td className="right num" style={{ color: r.cv < 0 ? 'var(--red)' : r.cv > 0 ? 'var(--green)' : undefined }}>{r.cv === 0 ? '—' : moneyShort(r.cv)}</td></tr>)}
            <tr><td><b>Total</b></td><td className="right num"><b>{moneyShort(evm.BAC)}</b></td><td className="right num"><b>{moneyShort(evm.EV)}</b></td><td className="right num"><b>{moneyShort(evm.AC)}</b></td><td className="right num"><b>{moneyShort(evm.CV)}</b></td></tr>
          </tbody></table></div>
        </Card>
        <Card title="Expenditure log" flush action={<button className="btn primary sm" onClick={() => setM({ activityId: '', date: today(), amount: '', category: 'Labour', note: '' })}><Plus size={14} /> Record expense</button>}>
          {expenses.length === 0 ? <Empty title="No expenses yet" text="Record spending against an activity to track actual cost." /> : (
            <div className="tbl-wrap" style={{ maxHeight: 380, overflow: 'auto' }}><table className="tbl"><tbody>
              {[...expenses].sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
                <tr key={e.id}><td><b className="num">{money(e.amount)}</b><div className="small muted">{nameOf(e.activityId)}</div><div className="small muted">{fmtDate(e.date)} · {e.category}{e.note ? ` · ${e.note}` : ''}</div></td>
                  <td><div className="actions"><button className="btn sm" onClick={() => setM(e)}><Pencil size={13} /></button><button className="btn sm danger" onClick={() => confirmDel('this expense') && del('expenses', e.id, 'Expense deleted')}><Trash2 size={13} /></button></div></td></tr>
              ))}</tbody></table></div>
          )}
          <div style={{ padding: '10px 20px 14px' }} className="small muted">Total recorded: <b>{money(spent)}</b> of {money(charter.budget)} approved</div>
        </Card>
      </div>
      {m && <FormModal title={m.id ? 'Edit expense' : 'Record expense'} fields={fields} initial={m} onClose={() => setM(null)}
        validate={(v) => (v.date < charter.startDate ? { date: 'Date is before the project start' } : v.date > today() ? { date: 'Expenses cannot be dated in the future' } : {})}
        onSave={(v) => (m.id ? edit('expenses', m.id, v, 'Expense saved') : add('expenses', v, 'Expense recorded'))} />}
    </>
  );
}
