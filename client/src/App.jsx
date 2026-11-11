import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import Assistant from './pages/Assistant.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Dues from './pages/Dues.jsx';
import Reimbursements from './pages/Reimbursements.jsx';
import Settings from './pages/Settings.jsx';

// AG Grid is large, so the ledger loads only when it is opened.
const Ledger = lazy(() => import('./pages/Ledger.jsx'));

const ICONS = {
  dashboard: <path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" />,
  reimbursements: <path d="M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h3" />,
  dues: <path d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM15 9.500C14.500 8.500 13.400 8 12 8c-1.700 0-3 .800-3 2s1.300 1.800 3 2s3 .800 3 2s-1.300 2-3 2c-1.400 0-2.500-.500-3-1.500M12 6v2M12 16v2" />,
  ledger: <path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM3 10h18M3 15h18M9 4v16" />,
  assistant: <path d="M12 3l1.800 4.700L18.500 9.500l-4.700 1.800L12 16l-1.800-4.700L5.500 9.500l4.700-1.800zM19 15l.800 2.200L22 18l-2.200.800L19 21l-.800-2.200L16 18l2.200-.800z" />,
  settings: <path d="M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6zM12 2v3M12 19v3M4.900 4.900L7 7M17 17l2.100 2.100M2 12h3M19 12h3M4.900 19.100L7 17M17 7l2.100-2.100" />,
};

const PAGES = [
  { id: 'dashboard', label: 'Dashboard', Component: Dashboard },
  { id: 'reimbursements', label: 'Reimbursements', Component: Reimbursements },
  { id: 'dues', label: 'Dues', Component: Dues },
  { id: 'ledger', label: 'Ledger', Component: Ledger },
  { id: 'assistant', label: 'Assistant', Component: Assistant },
  { id: 'settings', label: 'Settings', Component: Settings },
];

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [health, setHealth] = useState(null);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [h, o] = await Promise.all([api.get('/health'), api.get('/overview')]);
      setHealth(h);
      setOverview(o);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function sync() {
    setSyncing(true);
    try {
      const { updated } = await api.post('/sync');
      await refresh();
      setSyncNote(updated > 0 ? `Updated ${updated} item${updated === 1 ? '' : 's'}` : 'Already up to date');
      setTimeout(() => setSyncNote(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  const { Component } = PAGES.find((p) => p.id === page);
  const missing = health && [!health.ai && 'GEMINI_API_KEY', !health.paypal && 'PayPal sandbox credentials'].filter(Boolean);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">C</span>
          <div>
            <div className="brand-name">ClubPay</div>
            <div className="brand-sub">{overview?.club.name || ' '}</div>
          </div>
        </div>
        <nav>
          {PAGES.map((p) => (
            <button key={p.id} className={p.id === page ? 'nav active' : 'nav'} onClick={() => setPage(p.id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {ICONS[p.id]}
              </svg>
              <span className="nav-label">{p.label}</span>
              {p.id === 'reimbursements' && overview?.stats.awaitingReview > 0 && (
                <span className="count">{overview.stats.awaitingReview}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          {health?.sandbox && <span className="pill sandbox">PayPal sandbox</span>}
          <button className="btn ghost small" onClick={sync} disabled={syncing || !health?.paypal}>
            {syncing ? 'Syncing…' : 'Sync with PayPal'}
          </button>
          <span className="sync-note" role="status">
            {syncNote && `✓ ${syncNote}`}
          </span>
        </div>
      </aside>

      <main className="main">
        {missing?.length > 0 && (
          <div className="banner warn">
            Missing in <code>.env</code>: {missing.join(' and ')}. Add them and restart the server.
          </div>
        )}
        {error && <div className="banner error">{error}</div>}
        {overview ? (
          <Suspense fallback={<p className="muted">Loading…</p>}>
            <Component overview={overview} health={health} refresh={refresh} />
          </Suspense>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </main>
    </div>
  );
}
