import { useState } from 'react';
import { api } from '../api.js';

export default function Settings({ overview, health, refresh }) {
  const [name, setName] = useState(overview.club.name);
  const [policy, setPolicy] = useState(overview.club.policy);
  const [budgets, setBudgets] = useState(overview.club.budgets);
  const [members, setMembers] = useState(overview.members);
  const [newMember, setNewMember] = useState({ name: '', email: '' });
  const [message, setMessage] = useState(null);

  async function run(fn, ok) {
    setMessage(null);
    try {
      await fn();
      await refresh();
      setMessage({ ok });
    } catch (err) {
      setMessage({ error: err.message });
    }
  }

  const saveClub = (e) => {
    e.preventDefault();
    run(() => api.put('/club', { name, policy, budgets }), 'Club settings saved.');
  };

  const saveMember = (m) => run(() => api.put(`/members/${m.id}`, m), `Saved ${m.name}.`);

  const addMember = (e) => {
    e.preventDefault();
    run(async () => {
      const created = await api.post('/members', newMember);
      setMembers((list) => [...list, created]);
      setNewMember({ name: '', email: '' });
    }, 'Member added.');
  };

  const editMember = (id, field, value) =>
    setMembers((list) => list.map((m) => (m.id === id ? { ...m, [field]: value } : m)));

  return (
    <>
      <h1>Settings</h1>
      {message?.ok && <div className="banner ok">{message.ok}</div>}
      {message?.error && <div className="banner error">{message.error}</div>}

      <form className="card" onSubmit={saveClub}>
        <h2>Club</h2>
        <label>
          Club name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Spending policy (the AI checks every receipt against this)
          <textarea rows={7} value={policy} onChange={(e) => setPolicy(e.target.value)} />
        </label>
        <div className="budget-grid">
          {Object.keys(budgets).map((c) => (
            <label key={c}>
              <span className="cap">{c} budget</span>
              <input
                type="number"
                min="0"
                value={budgets[c]}
                onChange={(e) => setBudgets({ ...budgets, [c]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <button className="btn primary">Save club settings</button>
      </form>

      <section className="card">
        <h2>Members</h2>
        <p className="muted small">
          Payouts and invoices go to each member's PayPal email. For testing, use the email of a sandbox personal account.
        </p>
        {members.map((m) => (
          <div className="form-row flat" key={m.id}>
            <input value={m.name} onChange={(e) => editMember(m.id, 'name', e.target.value)} aria-label="Name" />
            <input className="grow" value={m.email} onChange={(e) => editMember(m.id, 'email', e.target.value)} aria-label="PayPal email" />
            <button className="btn ghost small" onClick={() => saveMember(m)}>
              Save
            </button>
          </div>
        ))}
        <form className="form-row flat" onSubmit={addMember}>
          <input placeholder="New member name" value={newMember.name} onChange={(e) => setNewMember({ ...newMember, name: e.target.value })} />
          <input className="grow" placeholder="PayPal email" value={newMember.email} onChange={(e) => setNewMember({ ...newMember, email: e.target.value })} />
          <button className="btn primary small">Add</button>
        </form>
      </section>

      <section className="card">
        <h2>Connections</h2>
        <ul className="plain">
          <li>Gemini: {health.ai ? `connected (${health.model})` : 'API key missing'}</li>
          <li>PayPal: {health.paypal ? (health.sandbox ? 'connected (sandbox)' : 'connected (LIVE)') : 'credentials missing'}</li>
          <li>Webhooks: {health.webhook ? 'verified with your webhook ID' : 'not set up. Use "Sync with PayPal" instead'}</li>
        </ul>
      </section>
    </>
  );
}
