"use server";

import { z } from "zod";
import { revalidatePath as nextRevalidatePath } from "next/cache";
import { trackedRevalidation } from "@/lib/frontend/revalidation";
import { prisma } from "@/lib/db";
import { isActionRateLimited } from "@/lib/actionRateLimit";
import { ORG_FOR_PAYMENTS } from "@/lib/payments/charges";
import { confirmRazorpayCheckout, startCheckout } from "@/lib/payments/checkout";
import { claimOfflinePayment } from "@/lib/payments/offline";
import { ownPayment, ownTerm } from "@/lib/payments/memberAccess";
import { paymentFailure } from "@/lib/payments/actionContext";
import type { CheckoutResult } from "@/lib/payments/gateway";
import type { ActionResult } from "./org";

const revalidatePath = trackedRevalidation(nextRevalidatePath);
const id = z.string().trim().min(1).max(64);

/** Start paying a membership online: a Razorpay order for Checkout.js, or a Stripe Checkout redirect. */
export async function startMemberCheckout(input: unknown): Promise<ActionResult<CheckoutResult & { paymentId: string; amountMinor: number; currency: string; name: string; email: string }>> {
  const parsed = z.object({ termId: id }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const own = await ownTerm(parsed.data.termId);
  if (!own) return { ok: false, error: "Membership not found." };
  if (await isActionRateLimited("payment", own.user.id)) return { ok: false, error: "Too many payment attempts. Try again later." };
  try {
    const result = await startCheckout({ organisationId: own.term.organisationId, termId: own.term.id, customer: { name: own.term.member.name, email: own.term.member.email }, returnPath: `/account/pay/${own.term.id}` });
    return { ok: true, data: { ...result, name: own.term.member.name, email: own.term.member.email } };
  } catch (error) {
    return paymentFailure(error);
  }
}

const razorpaySchema = z.object({ paymentId: id, orderId: z.string().trim().min(1).max(64), gatewayPaymentId: z.string().trim().min(1).max(64), signature: z.string().trim().regex(/^[a-f0-9]{64}$/i) });

/** Razorpay Checkout.js succeeded in the browser: verify it and settle straight away. */
export async function confirmMemberRazorpay(input: unknown): Promise<ActionResult<{ status: string }>> {
  const parsed = razorpaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const payment = await ownPayment(parsed.data.paymentId);
  if (!payment) return { ok: false, error: "Payment not found." };
  try {
    const status = await confirmRazorpayCheckout({ organisationId: payment.organisationId, ...parsed.data });
    revalidatePath("/account");
    return { ok: true, data: { status: status ?? "PENDING" } };
  } catch (error) {
    return paymentFailure(error);
  }
}

const claimSchema = z.object({
  termId: id,
  method: z.enum(["upi", "bank_transfer"]),
  utr: z.string().trim().min(6, "Enter the full reference").max(40).regex(/^[A-Za-z0-9-]+$/, "Letters, digits and hyphens only"),
});

/** "I've paid": the member submits their UPI or bank reference for the team to confirm. */
export async function submitPaymentClaim(input: unknown): Promise<ActionResult> {
  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request.", fieldErrors: { utr: [parsed.error.issues[0]?.message ?? "Check the reference"] } };
  const own = await ownTerm(parsed.data.termId);
  if (!own) return { ok: false, error: "Membership not found." };
  // A tight limit: each claim lands in a manager's queue.
  if (await isActionRateLimited("paymentClaim", own.user.id)) return { ok: false, error: "Too many submissions. Try again later." };
  const org = await prisma.organisation.findUniqueOrThrow({ where: { id: own.term.organisationId }, select: ORG_FOR_PAYMENTS });
  try {
    await prisma.$transaction((tx) => claimOfflinePayment(tx, { org, termId: own.term.id, method: parsed.data.method, utr: parsed.data.utr, userId: own.user.id }));
    revalidatePath(`/account/pay/${own.term.id}`);
    revalidatePath(`/dashboard/${org.slug}/payments`);
    return { ok: true };
  } catch (error) {
    return paymentFailure(error);
  }
}
