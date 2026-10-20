"use server";

import { z } from "zod";
import { revalidatePath as nextRevalidatePath } from "next/cache";
import { trackedRevalidation } from "@/lib/frontend/revalidation";
import { prisma } from "@/lib/db";
import { loadGateway } from "@/lib/payments/config";
import { GatewayError } from "@/lib/payments/gateway";
import { attachGatewayRefund, createRefund, failRefund, processRefund } from "@/lib/payments/refunds";
import { paymentAccess, paymentFailure, scopedPayment } from "@/lib/payments/actionContext";
import type { ActionResult } from "./org";

const revalidatePath = trackedRevalidation(nextRevalidatePath);

const refundSchema = z.object({
  organisationSlug: z.string().trim().min(1).max(64),
  paymentId: z.string().trim().min(1).max(64),
  amountMinor: z.number().int().positive(),
  reason: z.string().trim().min(3, "Give a short reason").max(300),
});

/**
 * Refund all or part of a paid payment. Offline refunds are recorded as already handed back. Gateway
 * refunds are sent to the provider after the refund row commits, then tracked to PROCESSED by its answer
 * or its webhook; the credit note is issued when the money has actually gone back.
 */
export async function refundPayment(input: unknown): Promise<ActionResult<{ status: "PENDING" | "PROCESSED" | "FAILED" }>> {
  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  const ctx = await paymentAccess(parsed.data.organisationSlug, "payments.manage");
  if (!ctx.ok) return ctx;
  const payment = await scopedPayment(ctx.scope, parsed.data.paymentId);
  if (!payment) return { ok: false, error: "Payment not found." };
  const refresh = () => {
    revalidatePath(`/dashboard/${ctx.org.slug}/payments/${payment.id}`);
    revalidatePath(`/dashboard/${ctx.org.slug}/payments`);
    revalidatePath(`/dashboard/${ctx.org.slug}/members/${payment.memberId}`);
  };

  let created: Awaited<ReturnType<typeof createRefund>>;
  try {
    created = await prisma.$transaction((tx) => createRefund(tx, { org: ctx.org, paymentId: payment.id, amountMinor: parsed.data.amountMinor, reason: parsed.data.reason, actorUserId: ctx.access.userId }));
  } catch (error) {
    return paymentFailure(error);
  }
  if (!created.gateway) {
    refresh();
    return { ok: true, data: { status: "PROCESSED" } };
  }

  const live = await loadGateway(ctx.org.id);
  const fail = async (reason: string) => {
    await prisma.$transaction((tx) => failRefund(tx, { org: ctx.org, refundId: created.refund.id, reason }));
    refresh();
  };
  if (!live || live.provider !== created.gateway.provider || !created.gateway.gatewayPaymentId) {
    await fail("The original gateway isn't connected any more.");
    return { ok: false, error: "The gateway this was paid through isn't connected any more. Refund it from the provider's dashboard, then record it." };
  }
  // Only the provider call decides "refused"; once it has answered, our own bookkeeping never marks the
  // refund failed, because the money may already be on its way back.
  let result: Awaited<ReturnType<typeof live.gateway.refund>>;
  try {
    result = await live.gateway.refund(live.credentials, { gatewayPaymentId: created.gateway.gatewayPaymentId, amountMinor: created.refund.amountMinor, currency: created.refund.currency, refundId: created.refund.id });
  } catch (error) {
    // A timeout or outage may still have refunded: keep it pending for the webhook to settle.
    if (error instanceof GatewayError && error.retryable) {
      refresh();
      return { ok: true, data: { status: "PENDING" } };
    }
    await fail("The provider refused the refund.");
    return { ok: false, error: "The payment provider refused the refund. Nothing was refunded." };
  }
  try {
    await prisma.$transaction(async (tx) => {
      if (result.gatewayRefundId) await attachGatewayRefund(tx, { org: ctx.org, refundId: created.refund.id, gatewayRefundId: result.gatewayRefundId });
      if (result.status === "processed") await processRefund(tx, { org: ctx.org, refundId: created.refund.id, gatewayRefundId: result.gatewayRefundId || null });
      if (result.status === "failed") await failRefund(tx, { org: ctx.org, refundId: created.refund.id, reason: "The provider declined the refund." });
    });
  } catch {
    // The provider has the refund; it stays PENDING and the provider's webhook completes it.
    console.error("[refunds] recording a gateway refund failed; left pending for the webhook");
    refresh();
    return { ok: true, data: { status: "PENDING" } };
  }
  refresh();
  return { ok: true, data: { status: result.status === "processed" ? "PROCESSED" : result.status === "failed" ? "FAILED" : "PENDING" } };
}
