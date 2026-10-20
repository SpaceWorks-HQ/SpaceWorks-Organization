import "server-only";

/**
 * ─── FINANCE DATA SOURCE: the one place P7 wires the payment tables in. ────────────────────────────────
 *
 * Every finance report reads its rows through these loaders and nothing else. Until P7 merges they return
 * empty arrays (unpaid terms already work, since MembershipTerm exists), and the finance tabs show their
 * empty states. To wire P7:
 *   1. Replace each `return []` below with the Prisma query sketched in its comment.
 *   2. Keep the scoping exactly as written: organisation always, unit subtree through the member, plan
 *      through the term. Never widen it.
 *   3. Map rows to the types in ./types.ts (rename nothing there; the pure reports depend on them).
 *   4. Set FINANCE_TABLES_READY to true so the finance tabs stop showing "Payments arrive with P7".
 * Contract and signatures: docs/REPORTS.md "Finance data contract".
 */
import { prisma } from "@/lib/db";
import type { ReportScope } from "../source";
import { scopedMemberWhere } from "../source";
import type { FinancePayment, FinancePaymentLine, FinancePlan, FinanceRefund, FinanceRows, FinanceTaxDocument, UnpaidTerm } from "./types";

/** Flip to true once the P7 tables are wired below. */
export const FINANCE_TABLES_READY = false;

/** Payments in scope. P7: prisma.payment.findMany({ where: { organisationId, member: { is: scopedMemberWhere(scope) }, ...(planId ? { term: { is: { planId } } } : {}) } }). */
export async function loadPayments(scope: ReportScope): Promise<FinancePayment[]> {
  void scope;
  return [];
}

/** Lines of the payments in scope. P7: prisma.paymentLine.findMany({ where: { payment: { is: <the payment where above> } } }). */
export async function loadPaymentLines(scope: ReportScope): Promise<FinancePaymentLine[]> {
  void scope;
  return [];
}

/** Refunds of the payments in scope. P7: prisma.refund.findMany({ where: { payment: { is: <the payment where above> } } }). */
export async function loadRefunds(scope: ReportScope): Promise<FinanceRefund[]> {
  void scope;
  return [];
}

/**
 * Tax documents in scope. P7: prisma.taxDocument.findMany({ where: { organisationId, OR: [{ payment: { is: <payment where> } }, { refund: { is: { payment: { is: <payment where> } } } }] } }).
 * The B6 continuity check needs every document of a series, so call it with an unscoped organisation
 * scope (unitPath and planId null) for that table; lib/views/*reports__tax* already does.
 */
export async function loadTaxDocuments(scope: ReportScope): Promise<FinanceTaxDocument[]> {
  void scope;
  return [];
}

/** PENDING_PAYMENT terms that no Payment row covers yet. P7 adds `payments: { none: {} }` to the where. */
export async function loadUnpaidTerms(scope: ReportScope): Promise<UnpaidTerm[]> {
  const terms = await prisma.membershipTerm.findMany({
    where: { organisationId: scope.organisationId, status: "PENDING_PAYMENT", member: { is: scopedMemberWhere(scope) }, ...(scope.planId ? { planId: scope.planId } : {}) },
    select: { id: true, memberId: true, planId: true, currency: true, priceMinor: true, joiningFeeMinor: true, createdAt: true, paymentDueBy: true, member: { select: { unitId: true } } },
  });
  return terms.map((term) => ({ termId: term.id, memberId: term.memberId, planId: term.planId, unitId: term.member.unitId, currency: term.currency, amountMinor: term.priceMinor + term.joiningFeeMinor, createdAt: term.createdAt, paymentDueBy: term.paymentDueBy }));
}

/** All finance rows for one scope. */
export async function loadFinanceRows(scope: ReportScope): Promise<FinanceRows> {
  const [payments, lines, refunds, documents, unpaidTerms] = await Promise.all([loadPayments(scope), loadPaymentLines(scope), loadRefunds(scope), loadTaxDocuments(scope), loadUnpaidTerms(scope)]);
  return { payments, lines, refunds, documents, unpaidTerms };
}

/** Plan renewal prices for the forecast. */
export async function loadFinancePlans(organisationId: string): Promise<FinancePlan[]> {
  return prisma.membershipPlan.findMany({ where: { organisationId }, select: { id: true, name: true, currency: true, priceRenewalMinor: true } });
}

/** A4: paid payments across every organisation. P7: prisma.payment.findMany({ where: { status: "PAID", paidAt: { gte: from, lt: to } } }). */
export async function loadPlatformPayments(window: { from: Date; to: Date }): Promise<Array<FinancePayment & { organisationId: string }>> {
  void window;
  return [];
}
