import { createServer } from "node:http";
import { InfraiClient, InfraiError } from "./infrai_client.js";
import { statementRequestSchema } from "./statement_policy.js";
import { sendUsageStatement } from "./usage_statement_service.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");
const infrai = new InfraiClient(apiKey);
const port = Number(process.env.PORT ?? 3000);

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/statements") {
    response.writeHead(404, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Not found" }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = statementRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await sendUsageStatement(input, infrai);
    response.writeHead(201, { "Content-Type": "application/json" }).end(JSON.stringify(result));
  } catch (error) {
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      response.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify({ error: error.code, message: error.message }));
      return;
    }
    const message = error instanceof Error ? error.message : "Invalid request";
    response.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ error: message }));
  }
});

server.listen(port, () => console.log(`Usage statement service listening on http://localhost:${port}`));
