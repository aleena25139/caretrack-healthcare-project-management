import { useState } from 'react';
import { X, Inbox } from 'lucide-react';

export const money = (n) => `PKR ${Math.round(+n || 0).toLocaleString('en-PK')}`;
export const moneyShort = (n) => { const v = +n || 0; const a = Math.abs(v); return a >= 1e6 ? `PKR ${(v / 1e6).toFixed(2)}M` : a >= 1e3 ? `PKR ${Math.round(v / 1e3)}K` : `PKR ${Math.round(v)}`; };

export const Card = ({ title, action, children, flush, className = '' }) => (
  <section className={`card ${className}`}>
    {(title || action) && <div className="card-h"><h3>{title}</h3>{action}</div>}
    <div className={`card-b ${flush ? 'flush' : ''}`}>{children}</div>
  </section>
);
export const Badge = ({ tone = '', children }) => <span className={`badge ${tone}`}>{children}</span>;
export const Kpi = ({ label, value, sub, tone = '', icon: Icon }) => (
  <div className={`kpi ${tone}`}><div className="kpi-top"><small>{label}</small>{Icon && <span className="ico"><Icon size={18} /></span>}</div><strong>{value}</strong><span>{sub}</span></div>
);
export const Progress = ({ value, tone = '' }) => <div className={`progress ${tone}`}><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
export const Empty = ({ title, text, action }) => <div className="empty"><Inbox size={28} /><b>{title}</b><div>{text}</div>{action && <div style={{ marginTop: 14 }}>{action}</div>}</div>;
export const PageHead = ({ title, text, action }) => <div className="page-head"><div><h1>{title}</h1>{text && <p>{text}</p>}</div>{action}</div>;
export const Tabs = ({ tabs, value, onChange }) => (
  <div className="tabs" role="tablist">{tabs.map((t) => (
    <button key={t.id} role="tab" aria-selected={value === t.id} className={value === t.id ? 'on' : ''} onClick={() => onChange(t.id)}>{t.icon && <t.icon size={16} />}{t.label}</button>
  ))}</div>
);
export const Alert = ({ tone = 'info', icon: Icon, children }) => <div className={`alert ${tone}`}>{Icon && <Icon size={18} />}<div>{children}</div></div>;

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-h"><h3>{title}</h3><button className="btn icon" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <div className="modal-b">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, error, hint, children, full }) {
  return <div className={`field ${error ? 'err' : ''} ${full ? 'full' : ''}`}><label>{label}</label>{children}{hint && !error && <span className="h">{hint}</span>}{error && <span className="e">{error}</span>}</div>;
}

// Generic validated form in a modal. fields: [{k,label,type,options,required,min,max,hint,full}]
export function FormModal({ title, fields, initial, onSave, onClose, validate, submitLabel = 'Save', wide }) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k, val) => setV((p) => ({ ...p, [k]: val }));
  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    fields.forEach((f) => {
      const val = v[f.k];
      if (f.required && (val === undefined || val === null || String(val).trim() === '')) er[f.k] = `${f.label} is required`;
      else if (f.type === 'number' && val !== '' && val !== undefined) {
        if (Number.isNaN(+val)) er[f.k] = 'Enter a number';
        else if (f.min !== undefined && +val < f.min) er[f.k] = `Must be at least ${f.min}`;
        else if (f.max !== undefined && +val > f.max) er[f.k] = `Must be at most ${f.max}`;
      }
    });
    Object.assign(er, Object.keys(er).length ? {} : validate ? validate(v) : {});
    setErrors(er);
    if (Object.keys(er).length) return;
    const out = { ...v };
    fields.forEach((f) => { if (f.type === 'number' && out[f.k] !== '' && out[f.k] !== undefined) out[f.k] = +out[f.k]; });
    setBusy(true);
    try { await onSave(out); onClose(); } catch { /* toast already shown */ } finally { setBusy(false); }
  };
  const input = (f) => {
    const val = v[f.k] ?? '';
    if (f.type === 'textarea') return <textarea value={val} onChange={(e) => set(f.k, e.target.value)} />;
    if (f.type === 'select') return <select value={val} onChange={(e) => set(f.k, e.target.value)}>{f.placeholder !== false && <option value="">{f.placeholder || 'Select…'}</option>}{f.options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}</select>;
    if (f.type === 'multi') return (
      <div className="checks">{f.options.length ? f.options.map((o) => (
        <label key={o.value}><input type="checkbox" checked={(v[f.k] || []).includes(o.value)} onChange={(e) => set(f.k, e.target.checked ? [...(v[f.k] || []), o.value] : (v[f.k] || []).filter((x) => x !== o.value))} />{o.label}</label>
      )) : <span className="muted small">Nothing to choose from yet</span>}</div>
    );
    return <input type={f.type || 'text'} value={val} step={f.type === 'number' ? 'any' : undefined} onChange={(e) => set(f.k, e.target.value)} />;
  };
  return (
    <Modal title={title} onClose={onClose} wide={wide}>
      <form onSubmit={submit} noValidate>
        <div className="fgrid">{fields.map((f) => <Field key={f.k} label={f.label + (f.required ? ' *' : '')} error={errors[f.k]} hint={f.hint} full={f.full || f.type === 'textarea' || f.type === 'multi'}>{input(f)}</Field>)}</div>
        <div className="modal-f"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{submitLabel}</button></div>
      </form>
    </Modal>
  );
}

export const confirmDel = (what) => window.confirm(`Delete ${what}? This can't be undone.`);
export const statusTone = { achieved: 'green', pending: '', 'at-risk': 'red', approved: 'green', proposed: 'amber', rejected: 'red', open: 'red', 'in-progress': 'amber', resolved: 'blue', closed: 'green', critical: 'red', major: 'amber', minor: '' };
