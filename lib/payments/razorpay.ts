import "server-only";

import { gatewayRequest, hmacHex, num, safeEqualHex, str, type PaymentGateway } from "./gateway";

const API = "https://api.razorpay.com/v1";

function auth(keyId: string | null, secret: string) {
  if (!keyId) throw new Error("Razorpay needs a key id.");
  return `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`;
}

function entity(body: Record<string, unknown>, name: string): Record<string, unknown> {
  const payload = (body.payload ?? {}) as Record<string, { entity?: Record<string, unknown> }>;
  return payload[name]?.entity ?? {};
}

/** Razorpay Orders API with Checkout.js on the pay page. Webhooks are signed with the webhook secret. */
export const razorpay: PaymentGateway = {
  async createCheckout(credentials, request) {
    const order = await gatewayRequest(`${API}/orders`, {
      method: "POST",
      auth: auth(credentials.keyId, credentials.secret),
      body: JSON.stringify({
        amount: request.amountMinor,
        currency: request.currency,
        receipt: request.paymentId.slice(0, 40),
        notes: { paymentId: request.paymentId, organisationId: request.organisationId, termId: request.termId ?? "" },
      }),
    });
    const orderId = str(order.id);
    if (!orderId) throw new Error("Razorpay did not return an order.");
    return { kind: "razorpay", orderId, keyId: credentials.keyId! };
  },

  verifyWebhook(credentials, rawBody, headers) {
    const signature = headers.get("x-razorpay-signature") ?? "";
    if (!credentials.webhookSecret || !signature) return false;
    return safeEqualHex(signature, hmacHex(credentials.webhookSecret, rawBody));
  },

  parseEvent(rawBody, headers) {
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const eventId = headers.get("x-razorpay-event-id") ?? `${str(body.event)}:${str(entity(body, "payment").id) ?? str(entity(body, "refund").id)}:${num(body.created_at)}`;
    switch (body.event) {
      case "payment.captured": {
        const payment = entity(body, "payment");
        const notes = (payment.notes ?? {}) as Record<string, unknown>;
        return { type: "captured", eventId, orderId: str(payment.order_id), paymentId: str(notes.paymentId), gatewayPaymentId: str(payment.id), amountMinor: num(payment.amount), currency: str(payment.currency) ?? "", method: str(payment.method) };
      }
      case "payment.failed": {
        const payment = entity(body, "payment");
        const notes = (payment.notes ?? {}) as Record<string, unknown>;
        return { type: "failed", eventId, orderId: str(payment.order_id), paymentId: str(notes.paymentId), reason: str(payment.error_description) ?? "Payment failed" };
      }
      case "refund.processed": {
        const refund = entity(body, "refund");
        const notes = (refund.notes ?? {}) as Record<string, unknown>;
        return { type: "refund-processed", eventId, gatewayRefundId: str(refund.id) ?? "", refundId: str(notes.refundId), amountMinor: num(refund.amount) };
      }
      case "refund.failed": {
        const refund = entity(body, "refund");
        const notes = (refund.notes ?? {}) as Record<string, unknown>;
        return { type: "refund-failed", eventId, gatewayRefundId: str(refund.id) ?? "", refundId: str(notes.refundId), reason: "The refund failed at Razorpay" };
      }
      default:
        return { type: "ignored", eventId };
    }
  },

  async fetchPayment(credentials, orderId) {
    const result = await gatewayRequest(`${API}/orders/${encodeURIComponent(orderId)}/payments`, { method: "GET", auth: auth(credentials.keyId, credentials.secret) });
    const items = Array.isArray(result.items) ? (result.items as Array<Record<string, unknown>>) : [];
    const captured = items.find((item) => item.status === "captured");
    if (captured) return { status: "paid", gatewayPaymentId: str(captured.id), amountMinor: num(captured.amount), currency: str(captured.currency) ?? "", method: str(captured.method) };
    if (items.length > 0 && items.every((item) => item.status === "failed")) return { status: "failed", reason: "Every attempt failed" };
    return { status: "pending" };
  },

  async refund(credentials, args) {
    const refund = await gatewayRequest(`${API}/payments/${encodeURIComponent(args.gatewayPaymentId)}/refund`, {
      method: "POST",
      auth: auth(credentials.keyId, credentials.secret),
      body: JSON.stringify({ amount: args.amountMinor, notes: { refundId: args.refundId } }),
    });
    const status = refund.status === "processed" ? "processed" : refund.status === "failed" ? "failed" : "pending";
    return { gatewayRefundId: str(refund.id) ?? "", status };
  },

  async testConnection(credentials) {
    try {
      await gatewayRequest(`${API}/orders?count=1`, { method: "GET", auth: auth(credentials.keyId, credentials.secret) });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Razorpay rejected the keys." };
    }
  },
};

/** Checkout.js hands back this signature; it proves the payment belongs to our order. */
export function verifyCheckoutSignature(secret: string, orderId: string, gatewayPaymentId: string, signature: string) {
  return safeEqualHex(signature, hmacHex(secret, `${orderId}|${gatewayPaymentId}`));
}
