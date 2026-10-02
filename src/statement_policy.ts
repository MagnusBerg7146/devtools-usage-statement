import { z } from "zod";

export const statementRequestSchema = z.object({
  customer: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    accountReference: z.string().min(1)
  }),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  events: z.array(z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("build"), occurredAt: z.string().datetime(), durationSeconds: z.number().int().nonnegative() }),
    z.object({ kind: z.literal("release"), occurredAt: z.string().datetime(), environment: z.enum(["preview", "production"]) }),
    z.object({ kind: z.literal("diagnostic"), occurredAt: z.string().datetime(), severity: z.enum(["info", "warning", "error"]) })
  ])).min(1)
});

export type StatementRequest = z.infer<typeof statementRequestSchema>;

export type StatementSummary = {
  builds: number;
  buildMinutes: number;
  previewReleases: number;
  productionReleases: number;
  diagnostics: { info: number; warning: number; error: number };
};

export function summarizeStatement(input: StatementRequest): StatementSummary {
  const summary: StatementSummary = {
    builds: 0,
    buildMinutes: 0,
    previewReleases: 0,
    productionReleases: 0,
    diagnostics: { info: 0, warning: 0, error: 0 }
  };

  for (const event of input.events) {
    if (!event.occurredAt.startsWith(`${input.month}-`)) continue;
    if (event.kind === "build") {
      summary.builds += 1;
      summary.buildMinutes += Math.ceil(event.durationSeconds / 60);
    } else if (event.kind === "release") {
      event.environment === "production" ? summary.productionReleases++ : summary.previewReleases++;
    } else {
      summary.diagnostics[event.severity]++;
    }
  }

  return summary;
}
