import { prisma } from "@/lib/db";
import { can, requireOrgCapability } from "@/lib/permissions";

/** The organisation's home: status, team size and the first steps still to do. */
export async function loadOrgOverviewView({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const { organisation, membership } = await requireOrgCapability(orgSlug, "org.view");
  const now = new Date();
  const [details, teamCount, openInvites] = await Promise.all([
    prisma.organisation.findUniqueOrThrow({
      where: { id: organisation.id },
      select: { name: true, slug: true, status: true, logoUrl: true, kind: true, description: true, contactEmail: true },
    }),
    prisma.teamMember.count({ where: { organisationId: organisation.id } }),
    prisma.teamInvite.count({ where: { organisationId: organisation.id, usedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
  ]);
  const manager = can(membership.role, "org.settings");
  const steps = [
    { id: "logo", label: "Add your logo", description: "It appears on your public page, receipts and member cards.", done: Boolean(details.logoUrl), href: `/dashboard/${details.slug}/settings`, visible: manager },
    { id: "team", label: "Invite your team", description: "Add treasurers and admins who help run memberships.", done: teamCount > 1, href: `/dashboard/${details.slug}/team`, visible: can(membership.role, "team.manage") },
  ].filter((step) => step.visible);
  return { organisation: details, role: membership.role, teamCount, openInvites, steps };
}
