# ClubPay

**An AI treasurer for student clubs.** A member photographs a receipt, Gemini reads it and checks it against the club's spending rules, the treasurer clicks once, and PayPal pays the member back.

Built for the PayPal AI Hackathon ("Build What's Next with PayPal and AI").

## The problem

Every student club has a volunteer treasurer running money through a group chat and a spreadsheet:

- Members pay out of pocket for pizza, parts or printing, then wait days or weeks to be paid back.
- Collecting dues means chasing people one at a time.
- At the end of the semester someone rebuilds a spending report by hand.
- The treasurer changes every year, and the records leave with them.

## What ClubPay does

| Step | AI (Gemini) | PayPal |
|---|---|---|
| **Reimburse** | Reads the receipt photo or PDF (vendor, date, items, total), checks it against the club's written policy and remaining budget, and recommends approve / flag / reject with reasons. | On the treasurer's click, a **Payout** goes to the member's PayPal account. |
| **Collect dues** | The assistant works out who still owes and writes the reminder. | **Invoicing** bills each member and sends reminders. **Webhooks** mark invoices paid. |
| **Report** | Answers questions like "how much did we spend on food?" and writes the advisor report. | Uses the club's real ledger and **Transaction Search** data. |

The AI recommends; a human always releases reimbursement money. Duplicate receipts are caught by a deterministic check, not left to the model.

## How it's built

```
client/   React + Vite single-page app
server/
  index.js     Express API
  ai.js        Gemini: receipt review (vision + structured output) and the tool-using treasurer agent
  paypal.js    PayPal REST: OAuth, Payouts, Invoicing, Transaction Search, webhook verification
  services.js  Business logic shared by the API routes and the agent's tools
  db.js        SQLite (Node's built-in node:sqlite)
eval/     Script that measures receipt-reading accuracy
```

**Tools used**

- **Google Gemini API** (`@google/genai`, model `gemini-3.5-flash` by default, override with `GEMINI_MODEL`). Vision reads receipts; a JSON schema constrains the review output, which the server validates again before saving; function calling drives the treasurer agent, whose tools call PayPal.
- **PayPal REST API (sandbox)**: OAuth 2.0, Payouts, Invoicing v2, Transaction Search, Webhooks.
- **React 19 + Vite**, **Express 5**, **SQLite**.
- Built with **Claude Code**.

## Run it locally

Requires **Node.js 22.5 or newer**.

1. Get credentials:
   - A PayPal **sandbox** app's Client ID and Secret from [developer.paypal.com](https://developer.paypal.com/dashboard/applications/sandbox). The sandbox business account needs a balance to send payouts (it starts with one).
   - A free Gemini API key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey). No credit card needed.
2. Install and configure:

   ```bash
   npm install
   ```

   ```bash
   cp .env.example .env
   ```

   Fill in `.env`.
3. Start it:

   ```bash
   npm run dev
   ```

   Open http://localhost:5173.
4. In **Settings**, change a member's email to your sandbox **personal** account's email, so payouts and invoices land somewhere you can log in to and check.
5. In **Reimbursements**, upload a receipt, read the AI's review, and click **Approve & pay with PayPal**. Log in to the sandbox personal account to see the money arrive.

To run the production build instead: `npm run build` then `npm start` (serves everything on port 3001).

### Webhooks (optional)

Without a public URL, use the **Sync with PayPal** button to pull the latest payout and invoice statuses. With a public URL (a deploy, or a tunnel such as ngrok), add a webhook in your PayPal app pointing at `https://<host>/api/webhooks/paypal`, subscribe to the Payouts and Invoicing events, and set `PAYPAL_WEBHOOK_ID` in `.env`. Incoming events are verified with PayPal before they change anything.

### Deploy

`render.yaml` is included. Create a Render Blueprint from the repository and set the secret environment variables. The free tier's disk is not persistent, so the demo data resets on redeploy.

## Measuring accuracy

```bash
npm run eval
```

Put receipts in `eval/receipts/`, copy `eval/labels.example.json` to `eval/labels.json` with the true vendor, total and date for each, and run the command. It reports how often the AI extracted each field correctly and writes `eval/results.json`.

<!-- Add your measured results here once you have run the eval on real receipts. -->

## Safety notes

- ClubPay refuses to call PayPal unless `PAYPAL_BASE_URL` is the sandbox. It is a demo, not a production payments system.
- Secrets live only in `.env`, which is git-ignored.
- There is no login yet: anyone who can reach the app acts as the treasurer. Do not expose it publicly with live credentials.

## License

MIT. See [LICENSE](LICENSE).
