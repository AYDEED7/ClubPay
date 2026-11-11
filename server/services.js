// Business logic shared by the HTTP routes and the AI treasurer agent.
import { db, getClub, getReimbursement, listInvoices, logEvent, spentByCategory } from './db.js';
import * as paypal from './paypal.js';

export function budgetOverview() {
  const club = getClub();
  const spent = spentByCategory();
  return Object.entries(club.budgets).map(([category, budget]) => ({
    category,
    budget,
    spent: Number((spent[category] || 0).toFixed(2)),
    remaining: Number((budget - (spent[category] || 0)).toFixed(2)),
  }));
}

/** Map a PayPal payout item status onto ClubPay's reimbursement status. */
export function reimbursementStatusFor(payoutStatus) {
  if (payoutStatus === 'SUCCESS') return 'paid';
  if (['PENDING', 'UNCLAIMED', 'ONHOLD', 'PROCESSING', 'NEW'].includes(payoutStatus)) return 'processing';
  return 'failed';
}

export function applyPayoutStatus(reimbursementId, payoutStatus) {
  db.prepare('UPDATE reimbursements SET payout_status = ?, status = ? WHERE id = ?').run(
    payoutStatus,
    reimbursementStatusFor(payoutStatus),
    reimbursementId,
  );
}

/** A human treasurer approved: send the money through PayPal Payouts. */
export async function approveAndPay(id, amountOverride) {
  const r = getReimbursement(id);
  if (!r) throw Object.assign(new Error('Reimbursement not found'), { status: 404 });
  if (!['needs_review', 'failed'].includes(r.status)) {
    throw Object.assign(new Error(`Already ${r.status}`), { status: 409 });
  }
  const amount = Number(amountOverride ?? r.amount);
  if (!(amount > 0)) throw Object.assign(new Error('Amount must be greater than zero'), { status: 400 });

  const club = getClub();
  const { batchId, batchStatus } = await paypal.sendPayout({
    email: r.member_email,
    amount,
    currency: club.currency,
    note: `${club.name} reimbursement: ${r.vendor || 'receipt'} (#${r.id})`,
    referenceId: r.id,
  });
  db.prepare(
    `UPDATE reimbursements SET amount = ?, status = 'processing', payout_batch_id = ?, payout_status = ?,
     decided_at = datetime('now') WHERE id = ?`,
  ).run(amount, batchId, batchStatus, id);
  logEvent('payout', `Sent ${club.currency} ${amount.toFixed(2)} to ${r.member_name} (batch ${batchId})`);

  // Sandbox payouts usually settle within a second or two; check once so the UI is fresh.
  try {
    applyPayoutStatus(id, await paypal.getPayoutStatus(batchId));
  } catch {
    /* the next sync or webhook will catch up */
  }
  return getReimbursement(id);
}

/** Create and send a PayPal invoice to each member. Returns per-member results. */
export async function sendDues(memberIds, amount, description) {
  const club = getClub();
  const results = [];
  for (const memberId of memberIds) {
    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
    if (!member) {
      results.push({ memberId, ok: false, error: 'Unknown member' });
      continue;
    }
    try {
      const inv = await paypal.createAndSendInvoice({
        email: member.email,
        name: member.name,
        amount,
        currency: club.currency,
        description,
        clubName: club.name,
      });
      db.prepare(
        'INSERT INTO invoices (member_id, paypal_id, description, amount, status, pay_url) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(member.id, inv.id, description, amount, inv.status, inv.payUrl);
      logEvent('invoice', `Invoiced ${member.name} ${club.currency} ${Number(amount).toFixed(2)} for "${description}"`);
      results.push({ memberId, member: member.name, ok: true, invoiceId: inv.id, status: inv.status });
    } catch (err) {
      results.push({ memberId, member: member.name, ok: false, error: err.message });
    }
  }
  return results;
}

export async function remindUnpaid(note) {
  const unpaid = listInvoices().filter((i) => !['PAID', 'CANCELLED', 'REFUNDED'].includes(i.status));
  const results = [];
  for (const inv of unpaid) {
    try {
      await paypal.remindInvoice(inv.paypal_id, note);
      logEvent('reminder', `Reminded ${inv.member_name} about "${inv.description}"`);
      results.push({ member: inv.member_name, ok: true });
    } catch (err) {
      results.push({ member: inv.member_name, ok: false, error: err.message });
    }
  }
  return results;
}

/** Pull the latest payout and invoice statuses from PayPal (used when no webhook URL is reachable). */
export async function syncWithPayPal() {
  let updated = 0;
  let skipped = 0;
  const pending = db
    .prepare("SELECT id, payout_batch_id, payout_status FROM reimbursements WHERE status = 'processing'")
    .all();
  for (const r of pending) {
    try {
      const status = await paypal.getPayoutStatus(r.payout_batch_id);
      if (status !== r.payout_status) {
        applyPayoutStatus(r.id, status);
        updated++;
      }
    } catch {
      skipped++; // e.g. created under different PayPal credentials
    }
  }
  const open = db.prepare("SELECT id, paypal_id, status FROM invoices WHERE status NOT IN ('PAID', 'CANCELLED')").all();
  for (const i of open) {
    try {
      const inv = await paypal.getInvoice(i.paypal_id);
      if (inv.status !== i.status) {
        db.prepare('UPDATE invoices SET status = ?, pay_url = COALESCE(?, pay_url) WHERE id = ?').run(
          inv.status,
          inv.payUrl,
          i.id,
        );
        updated++;
      }
    } catch {
      skipped++;
    }
  }
  return { updated, skipped };
}
