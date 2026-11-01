import { NavLink, Route, Routes } from 'react-router-dom';
import { LayoutDashboard, FileSignature, ListTree, CalendarRange, Wallet, ShieldCheck, Moon, Sun, RotateCcw } from 'lucide-react';
import { useStore } from './store';
import Dashboard from './pages/Dashboard';
import Initiation from './pages/Initiation';
import Scope from './pages/Scope';
import Schedule from './pages/Schedule';
import Cost from './pages/Cost';
import Quality from './pages/Quality';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/initiation', label: 'Initiation and Plan', icon: FileSignature },
  { to: '/scope', label: 'Scope and WBS', icon: ListTree },
  { to: '/schedule', label: 'Schedule', icon: CalendarRange },
  { to: '/cost', label: 'Cost and EVM', icon: Wallet },
  { to: '/quality', label: 'Quality and Risk', icon: ShieldCheck },
];

export default function App() {
  const { statusDate, setStatusDate, theme, setTheme, reset, toasts, demo } = useStore();
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <div className="brand-mark"><svg width="20" height="20" viewBox="0 0 24 24"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="#fff" /></svg></div>
          <div><b>CareTrack</b><span>Healthcare PM suite</span></div>
        </div>
        <nav className="nav">{NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.to === '/'}><n.icon size={19} />{n.label}</NavLink>)}</nav>
        <div className="side-foot">
          <label>Status date<input type="date" value={statusDate} onChange={(e) => e.target.value && setStatusDate(e.target.value)} /></label>
          <div className="small">All schedule and EVM figures are calculated as of this date.</div>
          <div className="row">
            <button className="ghost-w" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</button>
            <button className="ghost-w" onClick={() => window.confirm('Replace all data with the sample case-study data?') && reset()}><RotateCcw size={14} /> Reset</button>
          </div>
          <div className="small">{demo ? 'Demo mode: saved in this browser' : 'Connected to API'}</div>
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/initiation" element={<Initiation />} />
          <Route path="/scope" element={<Scope />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/cost" element={<Cost />} />
          <Route path="/quality" element={<Quality />} />
        </Routes>
      </main>
      <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className={`toast ${t.tone}`}>{t.text}</div>)}</div>
    </div>
  );
}
