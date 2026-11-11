import { useEffect, useState } from 'react';
import { api, money } from '../api.js';

export default function Dues({ overview, refresh }) {
  const { club, members } = overview;
  const [invoices, setInvoices] = useState([]);
  const [selected, setSelected] = useState(() => members.map((m) => m.id));
  const [amount, setAmount] = useState('20');
  const [description, setDescription] = useState('Semester dues');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);

  const load = () => api.get('/invoices').then(setInvoices).catch((e) => setMessage({ error: e.message }));
  useEffect(() => {
    load();
  }, [overview]);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function send(e) {
    e.preventDefault();
    setBusy('send');
    setMessage(null);
    try {
      const results = await api.post('/invoices', { memberIds: selected, amount: Number(amount), description });
      const failed = results.filter((r) => !r.ok);
      setMessage(
        failed.length
          ? { error: `${failed.length} of ${results.length} failed: ${failed[0].error}` }
          : { ok: `Sent ${results.length} PayPal invoice${results.length === 1 ? '' : 's'}.` },
      );
      await refresh();
    } catch (err) {
      setMessage({ error: err.message });
    } finally {
      setBusy('');
    }
  }

  async function remind() {
    setBusy('remind');
    setMessage(null);
    try {
      const results = await api.post('/invoices/remind', {});
      const ok = results.filter((r) => r.ok).length;
      setMessage(
        ok === results.length
          ? { ok: `Reminded ${ok} member${ok === 1 ? '' : 's'}.` }
          : { error: `${results.length - ok} of ${results.length} reminders failed: ${results.find((r) => !r.ok).error}` },
      );
      await refresh();
    } catch (err) {
      setMessage({ error: err.message });
    } finally {
      setBusy('');
    }
  }

  const unpaid = invoices.filter((i) => !['PAID', 'CANCELLED', 'REFUNDED'].includes(i.status)).length;

  return (
    <>
      <h1>Dues</h1>

      <form className="card" onSubmit={send}>
        <h2>Bill members through PayPal</h2>
        <div className="chips">
          {members.map((m) => (
            <label key={m.id} className={selected.includes(m.id) ? 'chip on' : 'chip'}>
              <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} />
              {m.name}
            </label>
          ))}
        </div>
        <div className="form-row flat">
          <label>
            Amount each ({club.currency})
            <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="grow">
            What it's for
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <button className="btn primary" disabled={busy === 'send' || selected.length === 0}>
            {busy === 'send' ? 'Sending…' : `Send ${selected.length} invoice${selected.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </form>

      {message?.ok && <div className="banner ok">{message.ok}</div>}
      {message?.error && <div className="banner error">{message.error}</div>}

      <section className="card">
        <div className="card-head">
          <h2>Invoices</h2>
          <button className="btn ghost small" onClick={remind} disabled={busy === 'remind' || unpaid === 0}>
            {busy === 'remind' ? 'Reminding…' : `Remind ${unpaid} unpaid`}
          </button>
        </div>
        {invoices.length === 0 ? (
          <p className="muted">No invoices sent yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>For</th>
                <th className="num">Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td>{i.member_name}</td>
                  <td>{i.description}</td>
                  <td className="num">{money(i.amount, club.currency)}</td>
                  <td>
                    <span className={`pill ${i.status === 'PAID' ? 'paid' : 'processing'}`}>{i.status.toLowerCase()}</span>
                  </td>
                  <td>
                    {i.pay_url && (
                      <a href={i.pay_url} target="_blank" rel="noreferrer">
                        Pay link
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
