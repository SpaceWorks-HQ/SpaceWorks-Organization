import { prisma } from "@/lib/db";
import { loadPublicOrganisation } from "@/lib/publicOrganisation";

/** The public page: the organisation's story and the plans people can join. */
export async function loadPublicOrgPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const org = await loadPublicOrganisation(orgSlug);
  const plans = await prisma.membershipPlan.findMany({
    where: { organisationId: org.id, archivedAt: null },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true, name: true, slug: true, description: true, currency: true, durationType: true, durationMonths: true, fixedEndDate: true,
      priceNewMinor: true, priceRenewalMinor: true, joiningFeeMinor: true, joinMode: true, allUnits: true,
      units: { select: { unit: { select: { name: true } } } },
    },
  });
  return { org, plans, takingMembers: org.status === "ACTIVE" };
}
