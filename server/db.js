import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DATA_DIR } from './env.js';

export const db = new DatabaseSync(path.join(DATA_DIR, 'clubpay.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS club (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL,
    currency TEXT NOT NULL,
    policy TEXT NOT NULL,
    budgets TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reimbursements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES members(id),
    file TEXT NOT NULL,
    note TEXT,
    vendor TEXT,
    receipt_date TEXT,
    category TEXT,
    amount REAL,
    items TEXT,
    ai_decision TEXT,
    ai_reasoning TEXT,
    ai_violations TEXT,
    ai_confidence REAL,
    ai_ms INTEGER,
    status TEXT NOT NULL,
    payout_batch_id TEXT,
    payout_status TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    decided_at TEXT
  );
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES members(id),
    paypal_id TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL,
    pay_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    summary TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export const CATEGORIES = ['food', 'supplies', 'travel', 'printing', 'equipment', 'other'];

const DEFAULT_POLICY = `1. Only expenses for official club activities are reimbursed.
2. No alcohol, tobacco, or personal items.
3. A single receipt over 150 must be flagged for the treasurer, even if it is otherwise fine.
4. Receipts must be legible and show the vendor, the date, and the total.
5. Receipts older than 60 days are rejected.
6. Tips above 20% are not reimbursed; flag them.`;

if (!db.prepare('SELECT 1 FROM club').get()) {
  db.prepare('INSERT INTO club (id, name, currency, policy, budgets) VALUES (1, ?, ?, ?, ?)').run(
    'Robotics Club',
    'USD',
    DEFAULT_POLICY,
    JSON.stringify({ food: 400, supplies: 600, travel: 500, printing: 150, equipment: 1000, other: 200 }),
  );
  const add = db.prepare('INSERT INTO members (name, email) VALUES (?, ?)');
  add.run('Priya Shah', 'priya@example.com');
  add.run('Marcus Lee', 'marcus@example.com');
  add.run('Sofia Alvarez', 'sofia@example.com');
}

export function getClub() {
  const row = db.prepare('SELECT * FROM club WHERE id = 1').get();
  return { ...row, budgets: JSON.parse(row.budgets) };
}

export function logEvent(kind, summary) {
  db.prepare('INSERT INTO events (kind, summary) VALUES (?, ?)').run(kind, summary);
}

/** Money committed (processing or paid) per category. */
export function spentByCategory() {
  const rows = db
    .prepare(
      `SELECT category, SUM(amount) AS total FROM reimbursements
       WHERE status IN ('processing', 'paid') GROUP BY category`,
    )
    .all();
  return Object.fromEntries(rows.map((r) => [r.category, r.total]));
}

export function hydrateReimbursement(r) {
  if (!r) return r;
  return {
    ...r,
    items: r.items ? JSON.parse(r.items) : [],
    ai_violations: r.ai_violations ? JSON.parse(r.ai_violations) : [],
  };
}

export function listReimbursements(status) {
  const sql = `SELECT r.*, m.name AS member_name, m.email AS member_email
               FROM reimbursements r JOIN members m ON m.id = r.member_id
               ${status ? 'WHERE r.status = ?' : ''} ORDER BY r.id DESC`;
  const rows = status ? db.prepare(sql).all(status) : db.prepare(sql).all();
  return rows.map(hydrateReimbursement);
}

export function getReimbursement(id) {
  return hydrateReimbursement(
    db
      .prepare(
        `SELECT r.*, m.name AS member_name, m.email AS member_email
         FROM reimbursements r JOIN members m ON m.id = r.member_id WHERE r.id = ?`,
      )
      .get(id),
  );
}

export function listInvoices() {
  return db
    .prepare(
      `SELECT i.*, m.name AS member_name, m.email AS member_email
       FROM invoices i JOIN members m ON m.id = i.member_id ORDER BY i.id DESC`,
    )
    .all();
}
