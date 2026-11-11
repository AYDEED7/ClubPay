import { money } from '../api.js';

export default function Dashboard({ overview }) {
  const { club, budgets, stats, events } = overview;
  const fmt = (n) => money(n, club.currency);

  return (
    <>
      <h1>Dashboard</h1>
      <div className="stats">
        <Stat label="Reimbursed to members" value={fmt(stats.paidOut)} />
        <Stat label="Receipts awaiting your review" value={stats.awaitingReview} />
        <Stat label="Dues collected" value={fmt(stats.duesCollected)} sub={`${fmt(stats.duesOutstanding)} outstanding`} />
        <Stat
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
                  <span className="cap">{b.category}</span>
                  <span className="muted">
                    {fmt(b.spent)} of {fmt(b.budget)}
                  </span>
                </div>
                <div className="bar">
                  <div className={pct > 85 ? 'bar-fill hot' : 'bar-fill'} style={{ width: `${pct}%` }} />
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

function Stat({ label, value, sub }) {
  return (
    <div className="card stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="muted small">{sub}</div>}
    </div>
  );
}
