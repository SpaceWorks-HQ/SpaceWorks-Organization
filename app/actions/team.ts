"use server";

import { revalidatePath as nextRevalidatePath } from "next/cache";
import { trackedRevalidation } from "@/lib/frontend/revalidation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  canDeleteOrg,
  canManageTeam,
  canManageTeamMember,
  getMembership,
} from "@/lib/permissions";
import {
  deleteOrganisationSchema,
  removeTeamMemberSchema,
  updateTeamRoleSchema,
} from "@/lib/validators";
import type { ActionResult } from "./org";
import { flattenZodErrors } from "./utils";
import { recordAuditEvent } from "@/lib/audit";
import { hasRecentAuthentication } from "@/lib/reauth";

const revalidatePath = trackedRevalidation(nextRevalidatePath);

export async function updateTeamRole(
  input: unknown,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = updateTeamRoleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid input.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const { organisationSlug, targetUserId, role } = parsed.data;
  const org = await prisma.organisation.findUnique({
    where: { slug: organisationSlug },
  });
  if (!org) return { ok: false, error: "Organisation not found." };

  const actor = await getMembership(session.user.id, org.id);
  if (!actor || !canManageTeam(actor)) {
    return { ok: false, error: "Only owners and admins can change team roles." };
  }
  if (!(await hasRecentAuthentication())) {
    return { ok: false, error: "For security, sign in again before changing team roles." };
  }

  const target = await getMembership(targetUserId, org.id);
  if (!target) return { ok: false, error: "Team member not found." };
  if (target.role === "OWNER") {
    return { ok: false, error: "The owner role cannot be changed here." };
  }
  // Admins manage treasurers and viewers only, and cannot promote anyone to admin.
  if (!canManageTeamMember(actor.role, target.role) || !canManageTeamMember(actor.role, role)) {
    return { ok: false, error: "Admins can only change treasurer and viewer roles." };
  }

  await prisma.teamMember.update({
    where: { id: target.id },
    data: { role },
  });
  await recordAuditEvent({
    action: "TEAM_ROLE_CHANGED",
    actorUserId: session.user.id,
    organisationId: org.id,
    targetType: "teamMember",
    targetId: target.id,
    metadata: { role },
  });

  revalidatePath(`/dashboard/${org.slug}/team`);
  revalidatePath(`/dashboard/${org.slug}`);
  return { ok: true };
}

export async function removeTeamMember(input: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = removeTeamMemberSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid input.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const { organisationSlug, targetUserId } = parsed.data;
  if (targetUserId === session.user.id) {
    return { ok: false, error: "You cannot remove yourself this way." };
  }

  const org = await prisma.organisation.findUnique({
    where: { slug: organisationSlug },
  });
  if (!org) return { ok: false, error: "Organisation not found." };

  const actor = await getMembership(session.user.id, org.id);
  if (!actor || !canManageTeam(actor)) {
    return { ok: false, error: "You do not have permission to remove people from the team." };
  }

  const target = await getMembership(targetUserId, org.id);
  if (!target) return { ok: false, error: "Team member not found." };
  if (target.role === "OWNER") {
    return { ok: false, error: "Cannot remove the organisation owner." };
  }
  if (!canManageTeamMember(actor.role, target.role)) {
    return { ok: false, error: "Admins can only remove treasurers and viewers." };
  }

  await prisma.teamMember.delete({ where: { id: target.id } });
  await recordAuditEvent({
    action: "TEAM_MEMBER_REMOVED",
    actorUserId: session.user.id,
    organisationId: org.id,
    targetType: "teamMember",
    targetId: target.id,
  });

  revalidatePath(`/dashboard/${org.slug}/team`);
  revalidatePath(`/dashboard/${org.slug}`);
  return { ok: true };
}

export async function deleteOrganisation(input: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = deleteOrganisationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid input.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const org = await prisma.organisation.findUnique({
    where: { slug: parsed.data.organisationSlug },
  });
  if (!org) return { ok: false, error: "Organisation not found." };

  const membership = await getMembership(session.user.id, org.id);
  if (!canDeleteOrg(membership)) {
    return { ok: false, error: "Only the organisation owner can delete it." };
  }
  if (!(await hasRecentAuthentication())) {
    return { ok: false, error: "For security, sign in again before deleting an organisation." };
  }

  const slug = org.slug;
  // Deliberately omit organisationId: deleting the organisation cascades its
  // scoped records, while this audit record must survive at the instance level.
  await recordAuditEvent({
    action: "ORGANISATION_DELETED",
    actorUserId: session.user.id,
    targetType: "organisation",
    targetId: org.id,
  });
  await prisma.organisation.delete({ where: { id: org.id } });

  revalidatePath("/dashboard");
  revalidatePath(`/o/${slug}`);
  return { ok: true };
}
