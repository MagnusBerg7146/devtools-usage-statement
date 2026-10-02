import { InfraiClient } from "./infrai_client.js";
import { summarizeStatement, type StatementRequest } from "./statement_policy.js";

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;"
  })[character] ?? character);
}

function statementMarkdown(input: StatementRequest, platformUsage: unknown): string {
  const usage = summarizeStatement(input);
  return `# Monthly usage statement

**Customer:** ${input.customer.name}  
**Account:** ${input.customer.accountReference}  
**Period:** ${input.month}

| Developer activity | Usage |
| --- | ---: |
| Builds | ${usage.builds} |
| Rounded build minutes | ${usage.buildMinutes} |
| Preview releases | ${usage.previewReleases} |
| Production releases | ${usage.productionReleases} |
| Info diagnostics | ${usage.diagnostics.info} |
| Warning diagnostics | ${usage.diagnostics.warning} |
| Error diagnostics | ${usage.diagnostics.error} |

## Infrai account usage

\`\`\`json
${JSON.stringify(platformUsage, null, 2)}
\`\`\`
`;
}

export async function sendUsageStatement(input: StatementRequest, infrai: InfraiClient) {
  const platformUsage = await infrai.accountUsage();
  const pdf = await infrai.generatePdf(statementMarkdown(input, platformUsage));
  const safeName = escapeHtml(input.customer.name);
  const safeUrl = escapeHtml(pdf.url);
  const email = await infrai.sendEmail(
    input.customer.email,
    `${input.month} usage statement`,
    `<p>Hi ${safeName},</p><p>Your ${input.month} usage statement is ready.</p><p><a href="${safeUrl}">Download the PDF statement</a></p>`
  );

  return { pdfUrl: pdf.url, messageId: email.message_id };
}
