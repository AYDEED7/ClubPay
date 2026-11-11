// Drives the real ClubPay app in a browser and saves what is on screen, frame by frame.
// Nothing here is simulated: every review is a real Gemini call and every payment a real PayPal sandbox call.
//
//   node scripts/record.mjs [baseUrl]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] || 'https://clubpay-8q3f.onrender.com';
const FRAMES = path.join(here, '..', '.frames');
const RECEIPTS = path.join(here, '..', 'assets', 'receipts');
fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });

// A visible pointer, because headless browsers do not draw one.
await context.addInitScript(() => {
  window.addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div');
    c.style.cssText =
      'position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;transform:translate(640px,360px);transition:transform 40ms linear';
    c.innerHTML =
      '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 2l15 9-6.500 1.500L9.500 20z" fill="#171a3a" stroke="#fff" stroke-width="1.500" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    window.addEventListener('mousemove', (e) => (c.style.transform = `translate(${e.clientX}px,${e.clientY}px)`), true);
    window.addEventListener(
      'mousedown',
      (e) => {
        const r = document.createElement('div');
        r.style.cssText = `position:fixed;left:${e.clientX - 16}px;top:${e.clientY - 16}px;width:32px;height:32px;border-radius:50%;border:3px solid #8b5cf6;z-index:2147483646;pointer-events:none;opacity:.9;transition:all 350ms ease-out`;
        document.body.appendChild(r);
        requestAnimationFrame(() => ((r.style.transform = 'scale(1.9)'), (r.style.opacity = '0')));
        setTimeout(() => r.remove(), 400);
      },
      true,
    );
  });
});

const page = await context.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForSelector('.stat-value');
await sleep(1500);

// ---- frame capture ----
const frames = [];
const cdp = await context.newCDPSession(page);
cdp.on('Page.screencastFrame', async ({ data, sessionId }) => {
  const t = Date.now();
  const file = `f${String(frames.length).padStart(5, '0')}.jpg`;
  fs.writeFileSync(path.join(FRAMES, file), Buffer.from(data, 'base64'));
  frames.push({ file, t });
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 93, everyNthFrame: 1 });

const segments = [];
let current;
const begin = (name) => (current = { name, start: Date.now(), cuts: [] });
const finish = () => {
  current.end = Date.now();
  segments.push(current);
  console.log(`segment ${current.name}: ${((current.end - current.start) / 1000).toFixed(1)}s, cuts ${current.cuts.length}`);
};
/** Run a slow wait (AI thinking, PayPal settling) and mark it to be trimmed from the final clip. */
async function trimmed(fn, keepBefore = 1200, keepAfter = 400) {
  const from = Date.now() + keepBefore;
  await fn();
  const to = Date.now() - keepAfter;
  if (to > from) current.cuts.push([from, to]);
}

let mouse = { x: 640, y: 360 };
async function moveTo(locator) {
  await locator.scrollIntoViewIfNeeded();
  await sleep(250);
  const box = await locator.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: Math.max(12, Math.round(Math.hypot(x - mouse.x, y - mouse.y) / 18)) });
  mouse = { x, y };
  await sleep(250);
}
async function click(locator) {
  await moveTo(locator);
  await page.mouse.down();
  await page.mouse.up();
  await sleep(350);
}
async function type(locator, text) {
  await click(locator);
  await locator.fill('');
  await page.keyboard.type(text, { delay: 32 });
  await sleep(300);
}
const nav = (label) => page.locator('button.nav', { hasText: label });
const card = (vendor) => page.locator('article.receipt', { hasText: vendor }).first();

async function submitReceipt(file, note, vendorText) {
  await page.locator('input[type=file]').setInputFiles(path.join(RECEIPTS, file));
  await sleep(500);
  await type(page.getByPlaceholder("Pizza for Thursday's build night"), note);
  await click(page.getByRole('button', { name: 'Submit receipt' }));
  await trimmed(() => card(vendorText).waitFor({ timeout: 120000 }));
  await moveTo(card(vendorText).locator('.verdict'));
  await sleep(4200);
}

try {
  // 1. Dashboard
  begin('dashboard');
  await sleep(1200);
  await moveTo(page.locator('.stat').nth(0));
  await sleep(900);
  await moveTo(page.locator('.budget').nth(1));
  await sleep(1400);
  await moveTo(page.locator('.events li').first());
  await sleep(1800);
  finish();

  // 2. Upload a normal receipt: AI review
  begin('upload');
  await click(nav('Reimbursements'));
  await page.locator('select').first().selectOption({ label: 'Jack Rivera' });
  await submitReceipt('pizza.png', "Pizza for Thursday's build night", "TONY'S PIZZERIA");
  finish();

  // 3. Upload a receipt that breaks policy
  begin('reject');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await sleep(700);
  await submitReceipt('liquor.png', 'Drinks for the end of term social', 'CAMPUS LIQUOR');
  finish();

  // 4. Approve and pay
  begin('pay');
  const pizza = card("TONY'S PIZZERIA");
  await moveTo(pizza.locator('.verdict'));
  await sleep(600);
  await click(pizza.getByRole('button', { name: /Approve & pay/ }));
  await trimmed(() => pizza.locator('.pill.processing, .pill.paid').waitFor({ timeout: 60000 }));
  await sleep(1500);
  if (!(await pizza.locator('.pill.paid').count())) {
    // Wait for PayPal's webhook to reach the server, then refresh the page's data.
    await trimmed(async () => {
      for (let i = 0; i < 45; i++) {
        const list = await (await fetch(`${BASE}/api/reimbursements`)).json();
        if (list.some((r) => r.vendor?.includes('TONY') && r.status === 'paid')) break;
        await sleep(2000);
      }
    }, 800, 200);
    await click(page.getByRole('button', { name: 'Sync with PayPal' }));
    await pizza.locator('.pill.paid').waitFor({ timeout: 30000 });
  }
  await moveTo(pizza.locator('.receipt-foot'));
  await sleep(3200);
  finish();

  // 5. Dues through PayPal Invoicing
  begin('dues');
  await click(nav('Dues'));
  await type(page.locator('input[type=number]'), '20');
  await type(page.locator('form .grow input'), 'Fall semester dues');
  await click(page.getByRole('button', { name: /Send \d+ invoice/ }));
  await trimmed(() => page.locator('tbody tr').nth(2).waitFor({ timeout: 90000 }));
  await moveTo(page.locator('tbody tr').first());
  await sleep(2800);
  finish();

  // 6. Assistant
  begin('assistant');
  await click(nav('Assistant'));
  await sleep(600);
  await type(page.getByPlaceholder('Ask the treasurer assistant…'), 'Who still owes dues? Send them a friendly reminder.');
  await click(page.getByRole('button', { name: 'Send', exact: true }));
  await trimmed(() => page.locator('.bubble.assistant:not(.muted)').waitFor({ timeout: 120000 }));
  await sleep(4500);
  finish();

  // 7. Ledger
  begin('ledger');
  await click(nav('Ledger'));
  await page.locator('.ag-row').first().waitFor({ timeout: 30000 });
  await sleep(1500);
  await click(page.locator('.ag-header-cell[col-id="amount"]'));
  await sleep(1200);
  await type(page.getByLabel('Search the ledger'), 'pizza');
  await sleep(1800);
  await page.getByLabel('Search the ledger').fill('');
  await sleep(800);
  await moveTo(page.getByRole('button', { name: 'Export CSV' }));
  await sleep(1800);
  finish();
} catch (err) {
  console.error('RECORDING FAILED in segment', current?.name, '\n', err.message);
  await page.screenshot({ path: path.join(FRAMES, '_failure.png') });
  process.exitCode = 1;
} finally {
  await cdp.send('Page.stopScreencast').catch(() => {});
  await sleep(300);
  fs.writeFileSync(path.join(FRAMES, 'frames.json'), JSON.stringify({ frames, segments }));
  console.log(`saved ${frames.length} frames`);
  await browser.close();
}
