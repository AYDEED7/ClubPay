import { DATA_DIR, ROOT, UPLOAD_DIR } from './env.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ApiError } from '@google/genai';
import express from 'express';
import multer from 'multer';
import * as ai from './ai.js';
import { CATEGORIES, db, getClub, getReimbursement, listInvoices, listReimbursements, logEvent } from './db.js';
import * as paypal from './paypal.js';
import {
  applyPayoutStatus,
  approveAndPay,
  budgetOverview,
  remindUnpaid,
  sendDues,
  syncWithPayPal,
} from './services.js';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
};

const fail = (status, message) => Object.assign(new Error(message), { status });

// ---------- Status ----------

app.get('/api/health', (_req, res) => {
  res.json({
    ai: ai.isConfigured(),
    model: ai.MODEL,
    paypal: paypal.isConfigured(),
    sandbox: paypal.isSandbox(),
    webhook: Boolean(process.env.PAYPAL_WEBHOOK_ID),
  });
});

app.get('/api/overview', (_req, res) => {
  const club = getClub();
  const all = listReimbursements();
  const reviewed = all.filter((r) => r.ai_ms);
  res.json({
    club,
    budgets: budgetOverview(),
    members: db.prepare('SELECT * FROM members ORDER BY name').all(),
    stats: {
      paidOut: all.filter((r) => r.status === 'paid').reduce((s, r) => s + r.amount, 0),
      awaitingReview: all.filter((r) => r.status === 'needs_review').length,
      duesCollected: listInvoices()
        .filter((i) => i.status === 'PAID')
        .reduce((s, i) => s + i.amount, 0),
      duesOutstanding: listInvoices()
        .filter((i) => !['PAID', 'CANCELLED', 'REFUNDED'].includes(i.status))
        .reduce((s, i) => s + i.amount, 0),
      avgReviewSeconds: reviewed.length ? reviewed.reduce((s, r) => s + r.ai_ms, 0) / reviewed.length / 1000 : null,
    },
    events: db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT 12').all(),
  });
});

// ---------- Club settings and members ----------

app.put('/api/club', (req, res) => {
  const { name, policy, budgets } = req.body;
  if (!name?.trim() || !policy?.trim()) throw fail(400, 'Name and policy are required');
  const clean = {};
  for (const c of CATEGORIES) clean[c] = Math.max(0, Number(budgets?.[c]) || 0);
  db.prepare('UPDATE club SET name = ?, policy = ?, budgets = ? WHERE id = 1').run(
    name.trim(),
    policy.trim(),
    JSON.stringify(clean),
  );
  res.json(getClub());
});

app.post('/api/members', (req, res) => {
  const { name, email } = req.body;
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '')) throw fail(400, 'A name and a valid email are required');
  const info = db.prepare('INSERT INTO members (name, email) VALUES (?, ?)').run(name.trim(), email.trim());
  res.status(201).json({ id: Number(info.lastInsertRowid), name: name.trim(), email: email.trim() });
});

app.put('/api/members/:id', (req, res) => {
  const { name, email } = req.body;
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '')) throw fail(400, 'A name and a valid email are required');
  db.prepare('UPDATE members SET name = ?, email = ? WHERE id = ?').run(name.trim(), email.trim(), req.params.id);
  res.json({ ok: true });
});

// ---------- Reimbursements ----------

app.get('/api/reimbursements', (_req, res) => res.json(listReimbursements()));

app.post('/api/reimbursements', upload.single('receipt'), async (req, res) => {
  if (!req.file) throw fail(400, 'Attach a receipt photo or PDF');
  if (!EXT[req.file.mimetype]) throw fail(400, 'Upload a JPEG, PNG, WebP, GIF or PDF receipt');
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.body.memberId);
  if (!member) throw fail(400, 'Choose a member');
  if (!ai.isConfigured()) throw fail(503, 'GEMINI_API_KEY is not set in .env');

  const club = getClub();
  const review = await ai.reviewReceipt({
    buffer: req.file.buffer,
    mimeType: req.file.mimetype,
    note: req.body.note,
    club,
    budgets: budgetOverview(),
    today: new Date().toISOString().slice(0, 10),
  });

  // Duplicate check is deterministic, not left to the model.
  let { decision } = review;
  const violations = [...review.violations];
  if (review.vendor && review.total != null) {
    const dup = db
      .prepare(
        `SELECT id FROM reimbursements WHERE lower(vendor) = lower(?) AND amount = ?
         AND COALESCE(receipt_date, '') = COALESCE(?, '') AND status != 'rejected'`,
      )
      .get(review.vendor, review.total, review.date);
    if (dup) {
      violations.push(`Possible duplicate of reimbursement #${dup.id} (same vendor, date and total)`);
      if (decision === 'approve') decision = 'flag';
    }
  }

  const file = crypto.randomUUID() + EXT[req.file.mimetype];
  fs.writeFileSync(path.join(UPLOAD_DIR, file), req.file.buffer);

  const info = db
    .prepare(
      `INSERT INTO reimbursements
       (member_id, file, note, vendor, receipt_date, category, amount, items,
        ai_decision, ai_reasoning, ai_violations, ai_confidence, ai_ms, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'needs_review')`,
    )
    .run(
      member.id,
      file,
      req.body.note?.trim() || null,
      review.vendor,
      review.date,
      review.category,
      review.total,
      JSON.stringify(review.items),
      decision,
      review.reasoning,
      JSON.stringify(violations),
      review.confidence,
      review.ms,
    );
  logEvent('review', `AI reviewed ${member.name}'s receipt from ${review.vendor || 'unknown vendor'}: ${decision}`);
  res.status(201).json(getReimbursement(Number(info.lastInsertRowid)));
});

app.post('/api/reimbursements/:id/approve', async (req, res) => {
  res.json(await approveAndPay(Number(req.params.id), req.body?.amount));
});

app.post('/api/reimbursements/:id/reject', (req, res) => {
  const r = getReimbursement(Number(req.params.id));
  if (!r) throw fail(404, 'Reimbursement not found');
  if (r.status !== 'needs_review') throw fail(409, `Already ${r.status}`);
  db.prepare("UPDATE reimbursements SET status = 'rejected', decided_at = datetime('now') WHERE id = ?").run(r.id);
  logEvent('reject', `Rejected ${r.member_name}'s receipt from ${r.vendor || 'unknown vendor'}`);
  res.json(getReimbursement(r.id));
});

// ---------- Dues ----------

app.get('/api/invoices', (_req, res) => res.json(listInvoices()));

app.post('/api/invoices', async (req, res) => {
  const { memberIds, amount, description } = req.body;
  if (!Array.isArray(memberIds) || memberIds.length === 0) throw fail(400, 'Choose at least one member');
  if (!(Number(amount) > 0) || !description?.trim()) throw fail(400, 'Enter an amount and a description');
  res.json(await sendDues(memberIds.map(Number), Number(amount), description.trim()));
});

app.post('/api/invoices/remind', async (req, res) => {
  res.json(await remindUnpaid(req.body?.note?.trim() || 'Friendly reminder that this club payment is still open.'));
});

// ---------- PayPal sync and webhooks ----------

app.post('/api/sync', async (_req, res) => res.json(await syncWithPayPal()));

app.post('/api/webhooks/paypal', async (req, res) => {
  const event = req.body;
  if (!(await paypal.verifyWebhook(req.headers, event))) throw fail(400, 'Webhook signature could not be verified');

  const type = event.event_type || '';
  const resource = event.resource || {};
  if (type.startsWith('PAYMENT.PAYOUTS-ITEM.')) {
    const row = db.prepare('SELECT id FROM reimbursements WHERE payout_batch_id = ?').get(resource.payout_batch_id);
    if (row) applyPayoutStatus(row.id, resource.transaction_status);
  } else if (type.startsWith('INVOICING.INVOICE.')) {
    const invoice = resource.invoice || resource;
    if (invoice.id && invoice.status) {
      db.prepare('UPDATE invoices SET status = ? WHERE paypal_id = ?').run(invoice.status, invoice.id);
    }
  }
  logEvent('webhook', type);
  res.sendStatus(200);
});

// ---------- Treasurer agent ----------

app.post('/api/agent', async (req, res) => {
  if (!ai.isConfigured()) throw fail(503, 'GEMINI_API_KEY is not set in .env');
  const messages = (req.body?.messages || [])
    .filter((m) => ['user', 'assistant'].includes(m.role) && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }));
  if (messages.at(-1)?.role !== 'user') throw fail(400, 'Send a message');
  res.json(await ai.runAgent(messages));
});

// ---------- Static client (production build) ----------

const dist = path.join(ROOT, 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// ---------- Errors ----------

app.use((err, _req, res, _next) => {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong';
  if (err instanceof ApiError) {
    if (err.status === 429) {
      status = 429;
      message = 'The Gemini free tier limit was reached. Wait a minute and try again.';
    } else if ([400, 401, 403].includes(err.status) && /api key/i.test(err.message)) {
      status = 503;
      message = 'The Gemini API key was rejected. Check GEMINI_API_KEY in .env.';
    } else {
      status = 502;
      message = err.status === 504 || err.status === 503 ? 'Gemini is busy right now. Try again in a moment.' : `Gemini API error (${err.status}). Check GEMINI_MODEL and try again.`;
      console.error(err.message);
    }
  } else if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'That file is over 8 MB' : err.message;
  } else if (err instanceof paypal.PayPalError) {
    status = err.status >= 500 || err.status === 503 ? err.status : 502;
  }
  if (status >= 500 && status !== 503) console.error(err);
  res.status(status).json({ error: message });
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`ClubPay server on http://localhost:${port}  (data in ${DATA_DIR})`);
  if (!ai.isConfigured()) console.log('  ! GEMINI_API_KEY missing: receipt review and the assistant are off');
  if (!paypal.isConfigured()) console.log('  ! PayPal credentials missing: payouts and invoices are off');
});
