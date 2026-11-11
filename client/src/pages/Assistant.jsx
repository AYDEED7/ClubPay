import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

const STARTERS = [
  'How much have we spent on food so far?',
  'Who still owes dues? Send them a friendly reminder.',
  'Write a short spending report for our faculty advisor.',
];

export default function Assistant({ refresh }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  async function send(text) {
    const content = text.trim();
    if (!content || busy) return;
    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setError('');
    try {
      const reply = await api.post('/agent', { messages: next.map(({ role, content }) => ({ role, content })) });
      setMessages([...next, { role: 'assistant', content: reply.text, actions: reply.actions }]);
      if (reply.actions.length) refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Assistant</h1>
      <section className="card chat">
        <div className="chat-log">
          {messages.length === 0 && (
            <div className="starters">
              <p className="muted">
                Ask about your club's money. The assistant reads your real ledger and PayPal data, and can send invoices
                and reminders. Payouts always need your own click.
              </p>
              {STARTERS.map((s) => (
                <button key={s} className="btn ghost" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>
              {m.actions?.map((a, j) => (
                <div key={j} className="action">
                  ✓ {a.label}: {a.detail}
                </div>
              ))}
              {m.content}
            </div>
          ))}
          {busy && <div className="bubble assistant muted">Working…</div>}
          <div ref={endRef} />
        </div>
        {error && <div className="banner error">{error}</div>}
        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the treasurer assistant…" />
          <button className="btn primary" disabled={busy || !input.trim()}>
            Send
          </button>
        </form>
      </section>
    </>
  );
}
