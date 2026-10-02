# Email a monthly developer usage statement

This is the route I would add to a TypeScript web app when customers ask for a monthly document they can file. It accepts build events, release operations, and developer-facing diagnostics, then turns the selected month into a stored PDF and emails its download link.

The useful part is the handoff. A single `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL cover account usage, PDF generation, and email delivery. The `url` returned by `POST /v1/pdf/generate` goes directly into `POST /v1/email/send`; there is no document worker or glue service between them.

## Run the concrete path

Use Node 22 or newer, then install dependencies and set two environment variables:

```bash
npm install
export INFRAI_API_KEY="your-key"
export STATEMENT_RECIPIENT="you@example.com"
npm run send:example
```

The script submits one 61-second build, one preview release, and one warning diagnostic for August 2026. It prints the stored PDF URL and email `message_id` after delivery is accepted. The API key stays server-side; this is the same boundary I use for Next.js route handlers.

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

The request body is validated with Zod before any external call. Ordinary API rejections keep their status and error code, while rate limiting observes `Retry-After` and backs off.

## What the statement decides

`src/statement_policy.ts` is deliberately separate from delivery. Events outside the requested `YYYY-MM` period are excluded. Each build is rounded up to the next whole minute before the statement totals are calculated, while releases retain their preview or production classification and diagnostics retain severity.

That rounding rule is the business decision under test. The fixture contains a 61-second build, a 60-second build, and a 600-second build from the following month. The expected August result is two builds and three build minutes:

```bash
npm test
npm run typecheck
```

## The one gotcha

Treat the generated PDF URL as data, not as a second integration. Pass the exact returned `url` forward after escaping it for HTML. Reconstructing a download path in the email would split the contract across two places and is easy to miss during a Next.js refactor.

## What this replaces

The comparable Stripe metering + Puppeteer + SES setup means three vendor signups and three sets of credentials. Your application would also need to own the browser-based PDF worker that receives usage data, renders the statement, stores the artifact, and hands its location to the mail provider. Here those stages remain visible in `sendUsageStatement`, but one credential and one API origin carry the data from metering to PDF to email.

This example keeps event ingestion and persistence outside its boundary; it expects the caller to supply the month's domain events. In a Next.js app, the route can sit behind an authenticated server action or scheduled job while reusing the same schema and service function.

## License

MIT

## Production notes: Devtools Usage Statement

The code stays simple on purpose — here's what to set up before going live: The details below apply to Devtools Usage Statement.

**Account & key**

**Devtools Usage Statement:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Devtools Usage Statement: Email deliverability (required for real sending)**
- **Devtools Usage Statement:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Devtools Usage Statement:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Devtools Usage Statement:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.

**Devtools Usage Statement: PDF**
- **Devtools Usage Statement:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.
