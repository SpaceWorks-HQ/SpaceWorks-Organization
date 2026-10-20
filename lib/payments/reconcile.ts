import "server-only";

import { prisma } from "@/lib/db";
import { refreshGatewayPayment } from "./checkout";

const MINUTE = 60_000;
/** Give webhooks a head start before polling, and keep asking for a week (late captures still settle). */
const POLL_AFTER_MS = 5 * MINUTE;
const POLL_FOR_MS = 7 * 24 * 60 * MINUTE;
const RUN_EVERY_MS = 5 * MINUTE;
const BATCH = 50;

function state() {
  return globalThis as typeof globalThis & { __sworgReconcileAt?: number };
}

/**
 * Poll open gateway attempts so a missed webhook never leaves a paid member waiting. Settling is
 * idempotent, so overlapping runs on several replicas are harmless. Attempts still open after a week are
 * closed as FAILED; a capture that arrives even later is still receipted and flagged by the webhook path.
 */
export async function reconcileGatewayPayments(now = new Date(), force = false) {
  const runtime = state();
  if (!force && runtime.__sworgReconcileAt && now.getTime() - runtime.__sworgReconcileAt < RUN_EVERY_MS) return { checked: 0, skipped: true };
  runtime.__sworgReconcileAt = now.getTime();

  const open = await prisma.payment.findMany({
    where: {
      status: "PENDING",
      provider: { in: ["RAZORPAY", "STRIPE"] },
      gatewayOrderId: { not: null },
      createdAt: { lte: new Date(now.getTime() - POLL_AFTER_MS) },
    },
    orderBy: { createdAt: "asc" },
    take: BATCH,
    select: { id: true, organisationId: true, createdAt: true },
  });
  let settled = 0;
  for (const payment of open) {
    try {
      const status = await refreshGatewayPayment(payment.organisationId, payment.id);
      if (status === "PAID") settled += 1;
      else if (status === "PENDING" && now.getTime() - payment.createdAt.getTime() > POLL_FOR_MS) {
        await prisma.payment.updateMany({ where: { id: payment.id, status: "PENDING" }, data: { status: "FAILED", note: "Closed: no payment arrived within a week." } });
      }
    } catch {
      // One organisation's bad keys or a provider outage must not stop the others.
      console.error("[payments reconcile] one payment could not be checked");
    }
  }
  return { checked: open.length, settled, skipped: false };
}
