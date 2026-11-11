import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import Assistant from './pages/Assistant.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Dues from './pages/Dues.jsx';
import Reimbursements from './pages/Reimbursements.jsx';
import Settings from './pages/Settings.jsx';

const PAGES = [
  { id: 'dashboard', label: 'Dashboard', Component: Dashboard },
  { id: 'reimbursements', label: 'Reimbursements', Component: Reimbursements },
  { id: 'dues', label: 'Dues', Component: Dues },
  { id: 'assistant', label: 'Assistant', Component: Assistant },
  { id: 'settings', label: 'Settings', Component: Settings },
];

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [health, setHealth] = useState(null);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);

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
      await api.post('/sync');
      await refresh();
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
              {p.label}
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
        </div>
      </aside>

      <main className="main">
        {missing?.length > 0 && (
          <div className="banner warn">
            Missing in <code>.env</code>: {missing.join(' and ')}. Add them and restart the server.
          </div>
        )}
        {error && <div className="banner error">{error}</div>}
        {overview ? <Component overview={overview} health={health} refresh={refresh} /> : <p className="muted">Loading…</p>}
      </main>
    </div>
  );
}
