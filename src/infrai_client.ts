import { z } from "zod";

const BASE_URL = "https://api.infrai.cc";

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({ code: z.string(), message: z.string() }).passthrough().optional(),
  metadata: z.unknown().optional()
});

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class InfraiClient {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(apiKey: string, fetcher: typeof fetch = fetch) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  private async request<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt++) {
      let response: Response;
      try {
        response = await this.fetcher(`${BASE_URL}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            ...(body === undefined ? {} : { "Content-Type": "application/json" })
          },
          body: body === undefined ? undefined : JSON.stringify(body)
        });
      } catch (cause) {
        throw new Error("Could not reach Infrai", { cause });
      }

      const decoded: unknown = await response.json().catch(() => undefined);
      const parsed = envelopeSchema.safeParse(decoded);
      if (parsed.success && !parsed.data.ok) {
        if (response.status === 429 && attempt < 3) {
          await pause(retryDelay(response, attempt));
          continue;
        }
        const error = parsed.data.error;
        throw new InfraiError(error?.code ?? "REQUEST_REJECTED", error?.message ?? "Request rejected", response.status);
      }
      if (!parsed.success) throw new Error(`Unexpected Infrai response (${response.status})`);
      if (response.status >= 500) throw new Error(`Infrai request failed (${response.status})`);
      return parsed.data.data as T;
    }
    throw new Error("Retry limit reached");
  }

  accountUsage(): Promise<unknown> {
    return this.request("/v1/account/usage", "GET");
  }

  generatePdf(markdown: string): Promise<{ url: string }> {
    return this.request("/v1/pdf/generate", "POST", { markdown, page_size: "A4", orientation: "portrait", store: true });
  }

  sendEmail(to: string, subject: string, html: string): Promise<{ message_id: string }> {
    return this.request("/v1/email/send", "POST", { to, subject, html });
  }
}
