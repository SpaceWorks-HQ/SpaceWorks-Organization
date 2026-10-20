/**
 * Extension points other phases fill in after their branches merge. Each renders nothing until then, so
 * the portal ships without them and gains them without a layout change.
 */

/**
 * P6 (ID cards): the member's card for this plan, shown inside each wallet entry. Replace the body with
 * the card wallet component (view, download PDF/PNG); keep the props, which are enough to list the
 * member's live MemberCard for the (member, plan) pair.
 */
export function CardSlot(props: { organisationSlug: string; memberId: string; planId: string }) {
  void props;
  return null;
}

/**
 * P7 (payments): the member's payments and downloadable receipts for this organisation, shown on the
 * membership detail page under the history. Replace the body with the receipts list (each receipt links
 * to /api/documents/[id]); `termIds` are the member's terms in this organisation, newest first.
 */
export function ReceiptsSlot(props: { organisationSlug: string; memberId: string; termIds: string[] }) {
  void props;
  return null;
}

/** P7's pay page for an unpaid term (PENDING_PAYMENT). The wallet and detail page link here. */
export function payHref(termId: string) {
  return `/account/pay/${termId}`;
}
