import "server-only";

import type { ReportScope } from "./source";

/**
 * B11 card issuance. ─── EXTENSION POINT FOR P6 (ID cards). ───
 *
 * Until the MemberCard table exists this returns null and the Team activity tab hides the card tile.
 * After P6 merges, replace the body with queries over MemberCard scoped exactly like membership reports
 * (`organisationId`, and `member: { is: scopedMemberWhere(scope) }`, plus `planId` when set):
 *   issued     – cards with issuedAt in [from, to)
 *   reissued   – of those, cards for a (member, plan) that already had an earlier card
 *   revoked    – cards with revokedAt in [from, to)
 *   missing    – members ACTIVE now on a plan with no live card for that (member, plan)
 *   byDay      – issued per local day, for the column chart (optional)
 * The tile (components/reports/CardIssuanceTile.tsx) renders whatever non-null value comes back.
 */
export type CardIssuance = { issued: number; reissued: number; revoked: number; missing: number; byDay?: Array<{ label: string; issued: number }> };

export async function loadCardIssuance(scope: ReportScope, window: { from: Date; to: Date }): Promise<CardIssuance | null> {
  void scope;
  void window;
  return null;
}
