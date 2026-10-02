import assert from "node:assert/strict";
import test from "node:test";
import { statementRequestSchema, summarizeStatement } from "../src/statement_policy.js";

test("counts only the requested month and rounds each build up to a billable minute", () => {
  const input = statementRequestSchema.parse({
    customer: { name: "Build Team", email: "billing@example.com", accountReference: "acct-17" },
    month: "2026-08",
    events: [
      { kind: "build", occurredAt: "2026-08-01T00:00:00.000Z", durationSeconds: 61 },
      { kind: "build", occurredAt: "2026-08-02T00:00:00.000Z", durationSeconds: 60 },
      { kind: "release", occurredAt: "2026-08-03T00:00:00.000Z", environment: "production" },
      { kind: "diagnostic", occurredAt: "2026-08-04T00:00:00.000Z", severity: "error" },
      { kind: "build", occurredAt: "2026-09-01T00:00:00.000Z", durationSeconds: 600 }
    ]
  });

  assert.deepEqual(summarizeStatement(input), {
    builds: 2,
    buildMinutes: 3,
    previewReleases: 0,
    productionReleases: 1,
    diagnostics: { info: 0, warning: 0, error: 1 }
  });
});
