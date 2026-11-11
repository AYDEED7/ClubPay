import { useEffect, useState } from 'react';
import { api, money } from '../api.js';

const STATUS_LABEL = {
  needs_review: 'Needs your review',
  processing: 'Payout in progress',
  paid: 'Paid',
  rejected: 'Rejected',
  failed: 'Payout failed',
};

export default function Reimbursements({ overview, refresh }) {
  const { club, members } = overview;
  const [rows, setRows] = useState([]);
  const [memberId, setMemberId] = useState(members[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.get('/reimbursements').then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, [overview]);

  async function submit(e) {
    e.preventDefault();
    if (!file) return setError('Choose a receipt photo or PDF first.');
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('receipt', file);
      form.append('memberId', memberId);
      form.append('note', note);
      await api.post('/reimbursements', form);
      setNote('');
      setFile(null);
      setFileKey((k) => k + 1);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function act(id, action, body) {
    setBusyId(id);
    setError('');
    try {
      await api.post(`/reimbursements/${id}/${action}`, body);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <h1>Reimbursements</h1>

      <form className="card form-row" onSubmit={submit}>
        <label>
          Member
          <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Receipt (photo or PDF)
          <input
            key={fileKey}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            onChange={(e) => setFile(e.target.files[0] || null)}
          />
        </label>
        <label className="grow">
          What was it for?
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Pizza for Thursday's build night" />
        </label>
        <button className="btn primary" disabled={uploading}>
          {uploading ? 'AI is reading it…' : 'Submit receipt'}
        </button>
      </form>

      {error && <div className="banner error">{error}</div>}

      {rows.length === 0 ? (
        <p className="muted">No receipts yet.</p>
      ) : (
        rows.map((r) => (
          <ReceiptCard key={r.id} r={r} currency={club.currency} busy={busyId === r.id} act={act} />
        ))
      )}
    </>
  );
}

function ReceiptCard({ r, currency, busy, act }) {
  const [amount, setAmount] = useState(r.amount ?? '');
  const isPdf = r.file.endsWith('.pdf');
  const canDecide = r.status === 'needs_review' || r.status === 'failed';

  return (
    <article className="card receipt">
      <a className="thumb" href={`/uploads/${r.file}`} target="_blank" rel="noreferrer">
        {isPdf ? <span className="pdf">PDF</span> : <img src={`/uploads/${r.file}`} alt={`Receipt from ${r.vendor || 'unknown vendor'}`} />}
      </a>

      <div className="receipt-body">
        <div className="receipt-head">
          <div>
            <h3>{r.vendor || 'Unknown vendor'}</h3>
            <div className="muted small">
              {r.member_name} · {r.receipt_date || 'no date'} · <span className="cap">{r.category}</span>
              {r.note && <> · “{r.note}”</>}
            </div>
          </div>
          <div className="amount">{money(r.amount, currency)}</div>
        </div>

        <div className={`verdict ${r.ai_decision}`}>
          <strong>
            AI recommends: {r.ai_decision}
            {r.ai_confidence != null && <span className="muted"> · {Math.round(r.ai_confidence * 100)}% sure of the total</span>}
          </strong>
          <p>{r.ai_reasoning}</p>
          {r.ai_violations.length > 0 && (
            <ul>
              {r.ai_violations.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="receipt-foot">
          <span className={`pill ${r.status}`}>{STATUS_LABEL[r.status] || r.status}</span>
          {r.payout_batch_id && (
            <span className="muted small">
              PayPal batch {r.payout_batch_id} · {r.payout_status}
            </span>
          )}
          {canDecide && (
            <div className="actions">
              <input
                className="amount-input"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label="Amount to pay"
              />
              <button className="btn primary" disabled={busy} onClick={() => act(r.id, 'approve', { amount: Number(amount) })}>
                {busy ? 'Sending…' : r.status === 'failed' ? 'Retry payout' : 'Approve & pay with PayPal'}
              </button>
              {r.status === 'needs_review' && (
                <button className="btn ghost" disabled={busy} onClick={() => act(r.id, 'reject')}>
                  Reject
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
