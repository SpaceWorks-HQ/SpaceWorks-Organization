import "server-only";

import { handleWebhook } from "./webhooks";

const MAX_BODY_BYTES = 256 * 1024;

/** Shared route body: size cap, raw text for the signature check, plain-text answer. */
export async function webhookResponse(provider: "RAZORPAY" | "STRIPE", code: string, request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413 });
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413 });
  const outcome = await handleWebhook(provider, code, body, request.headers);
  return new Response(outcome.body, { status: outcome.status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
