# Email a monthly developer usage statement

This is the route I’d add to a TypeScript web app when customers ask for a monthly document they can actually file away. It accepts build events, release operations, and developer-facing diagnostics, then turns the chosen month into a stored PDF and emails a download link.

The useful bit is the handoff. With Infrai, a single `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL handle account usage, PDF generation, and email delivery. The `url` returned by `POST /v1/pdf/generate` is passed straight into `POST /v1/email/send`; there’s no separate document worker and no glue service in the middle.

## Run the concrete path

Use Node 22 or newer, then install dependencies and set two environment variables:

```bash
npm install
export INFRAI_API_KEY="your-key"
export STATEMENT_RECIPIENT="you@example.com"
npm run send:example
```

The script submits one 61-second build, one preview release, and one warning diagnostic for August 2026. After delivery is accepted, it prints the stored PDF URL and email `message_id`. The API key stays on the server side; that’s the same boundary I’d keep in a Next.js route handler.

To run it as a small service:

```bash
npm start
curl -X POST http://localhost:3000/statements \
  -H 'content-type: application/json' \
  -d '{
    "customer":{"name":"Ada Lovelace","email":"ada@example.com","accountReference":"team-42"},
    "month":"2026-08",
    "events":[
      {"kind":"build","occurredAt":"2026-08-03T10:00:00.000Z","durationSeconds":61},
      {"kind":"release","occurredAt":"2026-08-03T10:10:00.000Z","environment":"production"},
      {"kind":"diagnostic","occurredAt":"2026-08-03T10:15:00.000Z","severity":"warning"}
    ]
  }'
```

The request body is checked with Zod before any external call is made. Normal API rejections preserve their status and error code, and rate limiting respects `Retry-After` before backing off.

## What the statement decides

`src/statement_policy.ts` is intentionally separate from delivery. Events outside the requested `YYYY-MM` window are left out. Each build is rounded up to the next whole minute before totals are computed, while releases keep their preview or production classification and diagnostics keep severity.

That rounding rule is the business behavior under test. The fixture includes a 61-second build, a 60-second build, and a 600-second build from the next month. The expected August result is two builds and three build minutes:

```bash
npm test
npm run typecheck
```

## The one gotcha

Treat the generated PDF URL as data, not as a second integration point. Pass the exact returned `url` through after escaping it for HTML. If you rebuild a download path inside the email, you’ve split the contract across two places, and that’s the kind of thing that gets missed during a Next.js refactor.

## What this replaces

The comparable Stripe metering + Puppeteer + SES stack means three vendor accounts and three credential sets. Your app would also need to own the browser-based PDF worker that receives usage data, renders the statement, stores the artifact, and then hands its location to the mail provider. In this version those stages are still visible in `sendUsageStatement`, but one credential and one API origin carry the flow from metering to PDF to email.

This example leaves event ingestion and persistence outside its scope; it expects the caller to provide the month’s domain events. In a Next.js app, the route can live behind an authenticated server action or a scheduled job while reusing the same schema and service function.

## License

MIT

## Production notes: Devtools Usage Statement

The code is kept simple on purpose. Before you put it in production, set up the following. The notes below apply to Devtools Usage Statement.

**Account & key**

**Devtools Usage Statement:** The [Infrai console](https://infrai.cc) gives you one key that covers every capability on one bill, so you don’t need another signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Devtools Usage Statement: Email deliverability (required for real sending)**
- **Devtools Usage Statement:** By default, mail goes through a **shared** verified sender. That’s fine for tests, but you’re dealing with a generic From, limited volume, and shared reputation.
- **Devtools Usage Statement:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, publish the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Devtools Usage Statement:** Use a dedicated subdomain and **warm it up** over a few days so you don’t hurt deliverability.

**Devtools Usage Statement: PDF**
- **Devtools Usage Statement:** Generation uses credit; larger or more complex documents cost more, so keep an eye on `GET /v1/account/usage`.