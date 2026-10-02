import { InfraiClient } from "../src/infrai_client.js";
import { statementRequestSchema } from "../src/statement_policy.js";
import { sendUsageStatement } from "../src/usage_statement_service.js";

const apiKey = process.env.INFRAI_API_KEY;
const recipient = process.env.STATEMENT_RECIPIENT;
if (!apiKey || !recipient) throw new Error("Set INFRAI_API_KEY and STATEMENT_RECIPIENT");

const input = statementRequestSchema.parse({
  customer: { name: "Ada Lovelace", email: recipient, accountReference: "devtools-demo" },
  month: "2026-08",
  events: [
    { kind: "build", occurredAt: "2026-08-03T10:00:00.000Z", durationSeconds: 61 },
    { kind: "release", occurredAt: "2026-08-03T10:10:00.000Z", environment: "preview" },
    { kind: "diagnostic", occurredAt: "2026-08-03T10:15:00.000Z", severity: "warning" }
  ]
});

console.log(await sendUsageStatement(input, new InfraiClient(apiKey)));
