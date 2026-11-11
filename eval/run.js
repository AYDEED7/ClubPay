// Measures how accurately the AI reads receipts.
//
//   1. Put receipt images/PDFs in eval/receipts/
//   2. Copy eval/labels.example.json to eval/labels.json and fill in the true values
//   3. npm run eval
//
// Each receipt is one Gemini API call and counts against the free-tier limits.
import '../server/env.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODEL, reviewReceipt } from '../server/ai.js';
import { getClub } from '../server/db.js';
import { budgetOverview } from '../server/services.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const labelsFile = path.join(here, 'labels.json');
if (!fs.existsSync(labelsFile)) {
  console.error('eval/labels.json not found. Copy eval/labels.example.json and fill it in.');
  process.exit(1);
}
const labels = JSON.parse(fs.readFileSync(labelsFile, 'utf8'));

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf' };
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const club = getClub();
const budgets = budgetOverview();
const today = new Date().toISOString().slice(0, 10);
const rows = [];

for (const label of labels) {
  const file = path.join(here, 'receipts', label.file);
  const mimeType = MIME[path.extname(file).toLowerCase()];
  if (!fs.existsSync(file) || !mimeType) {
    console.error(`skip ${label.file}: missing file or unsupported type`);
    continue;
  }
  try {
    const got = await reviewReceipt({ buffer: fs.readFileSync(file), mimeType, note: '', club, budgets, today });
    const row = {
      file: label.file,
      total: got.total != null && Math.abs(got.total - label.total) < 0.005,
      vendor: norm(got.vendor).includes(norm(label.vendor)) || norm(label.vendor).includes(norm(got.vendor) || '~'),
      date: label.date == null ? null : got.date === label.date,
      decision: label.decision == null ? null : got.decision === label.decision,
      ms: got.ms,
      got: { vendor: got.vendor, total: got.total, date: got.date, decision: got.decision },
    };
    rows.push(row);
    console.log(`${row.total ? 'ok  ' : 'MISS'} ${label.file}  total=${got.total} (want ${label.total})  ${got.ms}ms`);
  } catch (err) {
    rows.push({ file: label.file, error: err.message });
    console.log(`ERR  ${label.file}  ${err.message}`);
  }
}

const scored = rows.filter((r) => !r.error);
const rate = (key) => {
  const judged = scored.filter((r) => r[key] != null);
  return judged.length ? { correct: judged.filter((r) => r[key]).length, of: judged.length } : null;
};
const summary = {
  model: MODEL,
  ranAt: new Date().toISOString(),
  receipts: labels.length,
  errors: rows.length - scored.length,
  total: rate('total'),
  vendor: rate('vendor'),
  date: rate('date'),
  decision: rate('decision'),
  avgSeconds: scored.length ? Number((scored.reduce((s, r) => s + r.ms, 0) / scored.length / 1000).toFixed(1)) : null,
};

fs.writeFileSync(path.join(here, 'results.json'), JSON.stringify({ summary, rows }, null, 2));
console.log('\n', summary);
const pct = (r) => (r ? `${r.correct}/${r.of} (${Math.round((r.correct / r.of) * 100)}%)` : 'not labeled');
console.log(`\nTotal: ${pct(summary.total)} | Vendor: ${pct(summary.vendor)} | Date: ${pct(summary.date)} | Decision: ${pct(summary.decision)}`);
console.log('Full results written to eval/results.json');
