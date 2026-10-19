import type { OrganisationStatus, TeamMember, TeamRole } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasValidSuperAdminMfaProof, SUPER_ADMIN_MFA_COOKIE } from "@/lib/superAdminMfa";
import type { Session } from "next-auth";


export async function getMembership(
  userId: string,
  organisationId: string,
): Promise<TeamMember | null> {
  return prisma.teamMember.findUnique({
    where: {
      userId_organisationId: { userId, organisationId },
    },
  });
}

/** Read from the database for mutation gates; session JWTs can be stale. */
export async function isUserEmailVerified(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { emailVerified: true } });
  return user?.emailVerified != null;
}

export async function requireAuth(): Promise<Session & { user: { id: string; }; }> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session as Session & { user: { id: string; }; };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** True when SUPER_ADMIN_EMAIL names this verified email (bootstraps the first super-admin). */
export function isBootstrapSuperAdminEmail(email: string | null | undefined): boolean {
  const configured = process.env.SUPER_ADMIN_EMAIL;
  return Boolean(configured && email && normalizeEmail(email) === normalizeEmail(configured));
}

/**
 * Instance-wide super-admin gate: a verified user flagged `isSuperAdmin`, or the verified email in
 * SUPER_ADMIN_EMAIL (which bootstraps the first one). Anyone else gets notFound(), so the panel's
 * existence is never revealed.
 */
export async function requireSuperAdmin(): Promise<
  Session & { user: { id: string; email: string; }; }
> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, emailVerified: true, isSuperAdmin: true },
  });
  const userEmail = user?.email;
  if (!userEmail || !user.emailVerified) notFound();
  if (!user.isSuperAdmin && !isBootstrapSuperAdminEmail(userEmail)) notFound();

  return {
    ...session,
    user: { ...session.user, id: session.user.id, email: userEmail },
  } as Session & { user: { id: string; email: string; }; };
}

/**
 * Require a fresh, separate TOTP challenge for the instance-wide admin panel.
 * The proof is a short-lived, signed HttpOnly cookie bound to the current user
 * and session version, so account/session revocation invalidates it immediately.
 */
export async function requireSuperAdminMfa() {
  const session = await requireSuperAdmin();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mfaEnabledAt: true, sessionVersion: true },
  });
  const proof = (await cookies()).get(SUPER_ADMIN_MFA_COOKIE)?.value;
  if (!user?.mfaEnabledAt || !hasValidSuperAdminMfaProof(proof, session.user.id, user.sessionVersion)) {
    redirect("/super-admin-mfa");
  }
  return session;
}

export type OrgAccessContext = {
  organisation: { id: string; slug: string; name: string; status: OrganisationStatus; };
  membership: TeamMember;
  userId: string;
};

/**
 * Team access to an organisation, whatever its status. Use only for the application page and other
 * screens that must work before approval; everything else goes through requireOrgRole/Capability.
 */
export async function requireOrgTeam(orgSlug: string): Promise<OrgAccessContext> {
  const session = await requireAuth();
  const org = await prisma.organisation.findUnique({ where: { slug: orgSlug }, select: { id: true, slug: true, name: true, status: true } });
  if (!org) redirect("/dashboard");
  const membership = await getMembership(session.user.id, org.id);
  if (!membership) redirect("/dashboard");
  return { organisation: org, membership, userId: session.user.id };
}

/** Team access with a minimum role. Organisations that are not active are sent to their application page. */
export async function requireOrgRole(
  orgSlug: string,
  minRole: TeamRole,
): Promise<OrgAccessContext> {
  const access = await requireOrgTeam(orgSlug);
  if (access.organisation.status !== "ACTIVE") redirect(`/dashboard/${orgSlug}/application`);
  if (!hasRoleAtLeast(access.membership.role, minRole)) redirect(`/dashboard/${orgSlug}`);
  return access;
}

export async function requireOrgMembership(
  orgSlug: string,
): Promise<OrgAccessContext> {
  return requireOrgRole(orgSlug, "VIEWER");
}

/** Any team member may open the organisation dashboard; what they see is gated by capability. */
export async function requireOrgDashboardAccess(orgSlug: string): Promise<OrgAccessContext> {
  return requireOrgMembership(orgSlug);
}

/** Team access for one capability, honouring the organisation's status (suspended keeps finance). */
export async function requireOrgCapability(orgSlug: string, capability: Capability): Promise<OrgAccessContext> {
  const access = await requireOrgTeam(orgSlug);
  if (!organisationAllows(access.organisation.status, capability)) redirect(`/dashboard/${orgSlug}/application`);
  if (!can(access.membership.role, capability)) redirect(`/dashboard/${orgSlug}`);
  return access;
}

export type OrgActionAccess =
  | { ok: true; organisation: OrgAccessContext["organisation"]; membership: TeamMember; userId: string }
  | { ok: false; error: string };

/**
 * The server-action counterpart of requireOrgCapability: returns an error instead of redirecting, so
 * every action applies the same tenant, status and role checks before touching data.
 */
export async function orgActionAccess(orgSlug: unknown, capability: Capability): Promise<OrgActionAccess> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  if (typeof orgSlug !== "string" || !orgSlug) return { ok: false, error: "Organisation not found." };
  const org = await prisma.organisation.findUnique({ where: { slug: orgSlug }, select: { id: true, slug: true, name: true, status: true } });
  if (!org) return { ok: false, error: "Organisation not found." };
  const membership = await getMembership(session.user.id, org.id);
  if (!membership) return { ok: false, error: "Organisation not found." };
  if (!organisationAllows(org.status, capability)) {
    return { ok: false, error: org.status === "SUSPENDED" ? "This organisation is suspended, so this can't be changed right now." : "This organisation isn't approved yet." };
  }
  if (!can(membership.role, capability)) return { ok: false, error: "Your role doesn't allow this." };
  return { ok: true, organisation: org, membership, userId: session.user.id };
}

export { can, hasRoleAtLeast, isOrgAdmin, canManageTeam, canManageTeamMember, canDeleteOrg, organisationAllows } from "@/lib/permissionRoles";

import { can, hasRoleAtLeast, organisationAllows, type Capability } from "./permissionRoles";
