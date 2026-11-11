// Thin wrapper over the PayPal REST API: OAuth, Payouts, Invoicing, Transaction Search, Webhooks.
import crypto from 'node:crypto';

const base = () => process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';

export const isSandbox = () => base().includes('sandbox');
export const isConfigured = () => Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);

export class PayPalError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

let cachedToken = null;

async function accessToken() {
  if (!isConfigured()) throw new PayPalError('PayPal credentials are not set in .env', 503);
  // ClubPay is a sandbox demo. Refuse to move real money unless explicitly enabled.
  if (!isSandbox() && process.env.ALLOW_LIVE_PAYPAL !== 'true') {
    throw new PayPalError('PAYPAL_BASE_URL is not the sandbox. Refusing to call live PayPal.', 503);
  }
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${base()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new PayPalError(`PayPal auth failed: ${body.error_description || res.status}`, res.status, body);
  cachedToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };
  return cachedToken.value;
}

async function call(method, path, body, extraHeaders = {}) {
  const token = await accessToken();
  const res = await fetch(`${base()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const detail = json.details?.[0]?.description || json.details?.[0]?.issue || json.message || res.status;
    throw new PayPalError(`PayPal ${method} ${path.split('?')[0]} failed: ${detail}`, res.status, json);
  }
  return json;
}

const money = (n) => Number(n).toFixed(2);

// ---------- Payouts ----------

export async function sendPayout({ email, amount, currency, note, referenceId }) {
  const res = await call('POST', '/v1/payments/payouts', {
    sender_batch_header: {
      sender_batch_id: `clubpay-${referenceId}-${crypto.randomUUID().slice(0, 8)}`,
      email_subject: 'Your club reimbursement has been sent',
      email_message: note,
    },
    items: [
      {
        recipient_type: 'EMAIL',
        receiver: email,
        amount: { value: money(amount), currency },
        note,
        sender_item_id: String(referenceId),
      },
    ],
  });
  return { batchId: res.batch_header.payout_batch_id, batchStatus: res.batch_header.batch_status };
}

/** Returns the PayPal status of the single item in a payout batch (SUCCESS, PENDING, UNCLAIMED, FAILED, ...). */
export async function getPayoutStatus(batchId) {
  const res = await call('GET', `/v1/payments/payouts/${batchId}`);
  return res.items?.[0]?.transaction_status || res.batch_header?.batch_status || 'PENDING';
}

// ---------- Invoicing ----------

export async function createAndSendInvoice({ email, name, amount, currency, description, clubName }) {
  const [given, ...rest] = name.split(' ');
  const invoice = await call(
    'POST',
    '/v2/invoicing/invoices',
    {
      detail: { currency_code: currency, note: `${clubName}: ${description}`, payment_term: { term_type: 'NET_10' } },
      primary_recipients: [
        { billing_info: { name: { given_name: given, surname: rest.join(' ') || '-' }, email_address: email } },
      ],
      items: [{ name: description, quantity: '1', unit_amount: { currency_code: currency, value: money(amount) } }],
    },
    { Prefer: 'return=representation' },
  );
  await call('POST', `/v2/invoicing/invoices/${invoice.id}/send`, { send_to_recipient: true });
  return getInvoice(invoice.id);
}

export async function getInvoice(id) {
  const inv = await call('GET', `/v2/invoicing/invoices/${id}`);
  return { id: inv.id, status: inv.status, payUrl: inv.detail?.metadata?.recipient_view_url || null };
}

export async function remindInvoice(id, note) {
  await call('POST', `/v2/invoicing/invoices/${id}/remind`, { subject: 'Reminder: club payment due', note });
}

// ---------- Transaction Search ----------

export async function listTransactions(days = 30) {
  const end = new Date();
  const start = new Date(end.getTime() - Math.min(days, 31) * 86400000);
  const qs = new URLSearchParams({
    start_date: start.toISOString(),
    end_date: end.toISOString(),
    fields: 'transaction_info,payer_info',
    page_size: '100',
  });
  const res = await call('GET', `/v1/reporting/transactions?${qs}`);
  return (res.transaction_details || []).map((t) => ({
    id: t.transaction_info.transaction_id,
    date: t.transaction_info.transaction_initiation_date,
    amount: Number(t.transaction_info.transaction_amount?.value),
    currency: t.transaction_info.transaction_amount?.currency_code,
    status: t.transaction_info.transaction_status,
    subject: t.transaction_info.transaction_subject || t.transaction_info.transaction_note || null,
    counterparty: t.payer_info?.email_address || null,
  }));
}

// ---------- Webhooks ----------

export async function verifyWebhook(headers, event) {
  if (!process.env.PAYPAL_WEBHOOK_ID) return false;
  const res = await call('POST', '/v1/notifications/verify-webhook-signature', {
    auth_algo: headers['paypal-auth-algo'],
    cert_url: headers['paypal-cert-url'],
    transmission_id: headers['paypal-transmission-id'],
    transmission_sig: headers['paypal-transmission-sig'],
    transmission_time: headers['paypal-transmission-time'],
    webhook_id: process.env.PAYPAL_WEBHOOK_ID,
    webhook_event: event,
  });
  return res.verification_status === 'SUCCESS';
}
