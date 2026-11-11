import { money } from '../api.js';

const STAT_ICONS = {
  paid: <path d="M3 7h18v10H3zM12 9.500a2.500 2.500 0 1 0 0 5a2.500 2.500 0 0 0 0-5zM6 10v4M18 10v4" />,
  review: <path d="M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h3" />,
  dues: <path d="M12 3v12M7 10l5 5l5-5M4 20h16" />,
  speed: <path d="M13 2L4 14h7l-1 8l9-12h-7z" />,
};

export default function Dashboard({ overview }) {
  const { club, budgets, stats, events } = overview;
  const fmt = (n) => money(n, club.currency);

  return (
    <>
      <h1>Dashboard</h1>
      <div className="stats">
        <Stat tone="green" icon="paid" label="Reimbursed to members" value={fmt(stats.paidOut)} />
        <Stat tone="amber" icon="review" label="Receipts awaiting your review" value={stats.awaitingReview} />
        <Stat
          tone="sky"
          icon="dues"
          label="Dues collected"
          value={fmt(stats.duesCollected)}
          sub={`${fmt(stats.duesOutstanding)} outstanding`}
        />
        <Stat
          tone="violet"
          icon="speed"
          label="Average AI review time"
          value={stats.avgReviewSeconds == null ? '—' : `${stats.avgReviewSeconds.toFixed(1)}s`}
        />
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>Budget</h2>
          {budgets.map((b) => {
            const pct = b.budget ? Math.min(100, (b.spent / b.budget) * 100) : 0;
            return (
              <div className="budget" key={b.category}>
                <div className="budget-head">
                  <span className="cap">
                    <span className={`swatch ${b.category}`} />
                    {b.category}
                  </span>
                  <span className="muted">
                    {fmt(b.spent)} of {fmt(b.budget)}
                  </span>
                </div>
                <div className="bar">
                  <div className={`bar-fill ${pct > 85 ? 'hot' : b.category}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </section>

        <section className="card">
          <h2>Recent activity</h2>
          {events.length === 0 ? (
            <p className="muted">Nothing yet. Upload a receipt on the Reimbursements page to start.</p>
          ) : (
            <ul className="events">
              {events.map((e) => (
                <li key={e.id}>
                  <span className={`dot ${e.kind}`} />
                  <span>{e.summary}</span>
                  <time>{e.created_at.slice(5, 16)}</time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Stat({ tone, icon, label, value, sub }) {
  return (
    <div className={`card stat ${tone}`}>
      <div className="stat-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {STAT_ICONS[icon]}
        </svg>
      </div>
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {sub && <div className="muted small">{sub}</div>}
      </div>
    </div>
  );
}
