import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Bug, CheckCircle2, CircleAlert, Clock, FileDiff, Printer, Wallet, XCircle } from 'lucide-react';
import { useStore } from '../store';
import { Alert, Badge, Card, Empty, Kpi, PageHead, Progress, moneyShort, money } from '../components/ui';
import { diffDays, fmtDate, riskLevel } from '../lib/calc';

const HEALTH = {
  good: { c: '#35d08a', t: 'On course', d: 'Cost and schedule are inside your thresholds.' },
  watch: { c: '#f2b632', t: 'Needs attention', d: 'One or more indicators have crossed a warning threshold.' },
  bad: { c: '#ff5b62', t: 'In trouble', d: 'Cost, schedule or quality is outside tolerance. Act this week.' },
};

export default function Dashboard() {
  const { charter, derived, statusDate, defects, changes, milestones } = useStore();
  const { evm, sched, openCritical, pendingCR, checks, risks } = derived;
  const delayed = sched.rows.filter((r) => r.status === 'delayed');
  const impacted = sched.rows.filter((r) => r.status === 'impacted');
  const danger = evm.warnings.some((w) => w.level === 'danger') || openCritical.length > 1;
  const health = HEALTH[danger ? 'bad' : evm.warnings.length || openCritical.length ? 'watch' : 'good'];
  const slack = sched.finish ? diffDays(sched.finish, charter.deadline) : 0;
  const done = Math.round(evm.percent * 100);
  const bars = [{ n: 'Planned (PV)', v: evm.PV, c: '#9fb0d6' }, { n: 'Earned (EV)', v: evm.EV, c: '#0ea5a0' }, { n: 'Actual (AC)', v: evm.AC, c: '#dc3f45' }, { n: 'Budget (BAC)', v: evm.BAC, c: '#2f6bff' }];
  const sev = ['critical', 'major', 'minor'].map((s) => ({ name: s, value: defects.filter((d) => d.severity === s && !['resolved', 'closed'].includes(d.status)).length }));
  const sevColor = { critical: '#dc3f45', major: '#c98a00', minor: '#9fb0d6' };
  const failing = checks.filter((c) => !c.pass);
  const nextMs = milestones.filter((m) => m.status !== 'achieved').sort((a, b) => a.date.localeCompare(b.date))[0];

  return (
    <>
      <PageHead title="Project dashboard" text={`${charter.name}. Report as of ${fmtDate(statusDate)}.`} action={<button className="btn" onClick={() => window.print()}><Printer size={16} /> Print report</button>} />

      <section className="pulse" style={{ '--c': health.c }}>
        <div>
          <span className="tag"><i className="dot" /> Project health</span>
          <h2>{health.t}</h2>
          <p>{health.d}</p>
          <div className="pulse-stats">
            <div><b>{done}%</b><span>work earned</span></div>
            <div><b>{evm.CPI.toFixed(2)}</b><span>cost index</span></div>
            <div><b>{evm.SPI.toFixed(2)}</b><span>schedule index</span></div>
          </div>
        </div>
        <svg className="ecg" viewBox="0 0 600 110" preserveAspectRatio="none" aria-hidden="true">
          <path className="base" d="M0 60H110l12-8 12 8h56l10 8 14-56 16 84 10-36h44q18-18 36 0H600" />
          <path className="sweep" pathLength="100" d="M0 60H110l12-8 12 8h56l10 8 14-56 16 84 10-36h44q18-18 36 0H600" />
        </svg>
      </section>

      {evm.warnings.length > 0 && (
        <div className="stack" style={{ marginBottom: 18 }}>
          {evm.warnings.slice(0, 3).map((w, i) => <Alert key={i} tone={w.level} icon={AlertTriangle}>{w.text}</Alert>)}
          {evm.warnings.length > 3 && <Link to="/cost" className="small">See all {evm.warnings.length} warnings</Link>}
        </div>
      )}

      <div className="grid g4" style={{ marginBottom: 18 }}>
        <Kpi label="Budget status" icon={Wallet} value={moneyShort(evm.AC)} sub={`of ${moneyShort(charter.budget)} approved · forecast ${moneyShort(evm.EAC)}`} tone={evm.EAC > charter.budget ? 'red' : 'green'} />
        <Kpi label="Delayed activities" icon={Clock} value={delayed.length} sub={`${impacted.length} more affected downstream`} tone={delayed.length ? 'amber' : 'green'} />
        <Kpi label="Pending change requests" icon={FileDiff} value={pendingCR.length} sub={pendingCR.length ? `${money(pendingCR.reduce((s, c) => s + c.costImpact, 0))} · +${pendingCR.reduce((s, c) => s + c.scheduleImpact, 0)} days if approved` : 'Nothing waiting for a decision'} tone={pendingCR.length ? 'amber' : 'green'} />
        <Kpi label="Open critical defects" icon={Bug} value={openCritical.length} sub={openCritical.length ? 'Blocks release until resolved' : 'Release is not blocked'} tone={openCritical.length ? 'red' : 'green'} />
      </div>

      <div className="grid g-main">
        <div className="stack">
          <Card title="Planned vs earned vs actual cost">
            <div style={{ height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={bars} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="n" tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip formatter={(v) => money(v)} cursor={{ fill: 'var(--surface-2)' }} contentStyle={{ borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)' }} />
                  <Bar dataKey="v" radius={[8, 8, 0, 0]}>{bars.map((b) => <Cell key={b.n} fill={b.c} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Schedule status" action={<Link to="/schedule" className="small">Open Gantt chart</Link>}>
            <dl className="kv">
              <dt>Approved deadline</dt><dd>{fmtDate(charter.deadline)}</dd>
              <dt>Forecast finish</dt><dd>{fmtDate(sched.finish)} <Badge tone={slack < 0 ? 'red' : 'green'}>{slack < 0 ? `${-slack} days late` : `${slack} days spare`}</Badge></dd>
              <dt>Next milestone</dt><dd>{nextMs ? `${nextMs.name} · ${fmtDate(nextMs.date)}` : 'All milestones achieved'}</dd>
              <dt>Overall progress</dt><dd><Progress value={done} /></dd>
            </dl>
            <div style={{ marginTop: 14 }}>
              {delayed.length === 0 ? <span className="muted">No delayed activities.</span> : delayed.map((r) => (
                <div key={r.id} className="check-row"><Clock size={16} color="var(--amber)" /><div><b>{r.name}</b><div className="muted small">{r.ownSlip} days behind · pushes {r.downstream.length} dependent {r.downstream.length === 1 ? 'task' : 'tasks'} · {r.assignee}</div></div></div>
              ))}
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card title="Unresolved defects">
            {sev.every((s) => !s.value) ? <Empty title="No open defects" text="Nice. Everything logged is resolved." /> : (
              <div style={{ height: 190 }}>
                <ResponsiveContainer>
                  <PieChart><Pie data={sev} dataKey="value" nameKey="name" innerRadius={46} outerRadius={78} paddingAngle={3} stroke="none">{sev.map((s) => <Cell key={s.name} fill={sevColor[s.name]} />)}</Pie><Tooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)' }} /></PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="legend" style={{ justifyContent: 'center' }}>{sev.map((s) => <span key={s.name}><i style={{ background: sevColor[s.name] }} />{s.value} {s.name}</span>)}</div>
          </Card>

          <Card title="Top risks" action={<Link to="/quality" className="small">Risk matrix</Link>}>
            {risks.slice(0, 4).map((r) => (
              <div key={r.id} className="check-row"><Badge tone={{ critical: 'red', high: 'amber', medium: 'blue', low: 'green' }[riskLevel(r.score)]}>{r.score}</Badge><div>{r.title}<div className="muted small">{r.owner}</div></div></div>
            ))}
          </Card>

          <Card title="Consistency checks" action={<Badge tone={failing.length ? 'red' : 'green'}>{failing.length ? `${failing.length} to fix` : 'All passing'}</Badge>}>
            {checks.map((c, i) => (
              <div key={i} className="check-row">{c.pass ? <CheckCircle2 size={17} color="var(--green)" /> : <XCircle size={17} color="var(--red)" />}<div>{c.text}{!c.pass && c.detail && <div className="small" style={{ color: 'var(--red)' }}>{c.detail}</div>}</div></div>
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}
