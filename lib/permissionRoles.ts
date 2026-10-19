import type { TeamMember, TeamRole } from "@prisma/client";

/**
 * What each organisation role may do. OWNER and ADMIN run the organisation; TREASURER runs money and
 * reads members; VIEWER reads, with contact details masked. Unknown capabilities grant nothing.
 */
export const CAPABILITIES = {
  "org.view": ["OWNER", "ADMIN", "TREASURER", "VIEWER"],
  "org.settings": ["OWNER", "ADMIN"],
  "org.delete": ["OWNER"],
  "team.manage": ["OWNER", "ADMIN"],
  "plans.manage": ["OWNER", "ADMIN"],
  "members.view": ["OWNER", "ADMIN", "TREASURER", "VIEWER"],
  "members.contact": ["OWNER", "ADMIN", "TREASURER"],
  "members.manage": ["OWNER", "ADMIN"],
  "members.export": ["OWNER", "ADMIN", "TREASURER"],
  "cards.manage": ["OWNER", "ADMIN"],
  "payments.view": ["OWNER", "ADMIN", "TREASURER"],
  "payments.manage": ["OWNER", "ADMIN", "TREASURER"],
  "payments.settings": ["OWNER", "ADMIN"],
  "reports.membership": ["OWNER", "ADMIN", "TREASURER", "VIEWER"],
  "reports.finance": ["OWNER", "ADMIN", "TREASURER"],
  "audit.view": ["OWNER", "ADMIN"],
} as const satisfies Record<string, readonly TeamRole[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: TeamRole | null | undefined, capability: Capability): boolean {
  return role != null && (CAPABILITIES[capability] as readonly TeamRole[]).includes(role);
}

/** Seniority, only for "at least" gates and for who may change whose role. */
const roleRank: Record<TeamRole, number> = { VIEWER: 0, TREASURER: 1, ADMIN: 2, OWNER: 3 };

export function hasRoleAtLeast(role: TeamRole, min: TeamRole): boolean {
  return roleRank[role] >= roleRank[min];
}

export function isOrgAdmin(role: TeamRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/** Owners manage everyone; admins manage treasurers and viewers. Nobody manages a more senior role. */
export function canManageTeamMember(actor: TeamRole, target: TeamRole): boolean {
  if (actor === "OWNER") return true;
  return actor === "ADMIN" && roleRank[target] < roleRank.ADMIN;
}

export function canManageTeam(m: TeamMember | null): boolean {
  return m != null && can(m.role, "team.manage");
}

export function canDeleteOrg(m: TeamMember | null): boolean {
  return m != null && can(m.role, "org.delete");
}

export const ROLE_LABELS: Record<TeamRole, string> = { OWNER: "Owner", ADMIN: "Admin", TREASURER: "Treasurer", VIEWER: "Viewer" };

export const ROLE_DESCRIPTIONS: Record<TeamRole, string> = {
  OWNER: "Everything, including the team and deleting the organisation.",
  ADMIN: "Plans, members, approvals, cards, payments and settings.",
  TREASURER: "Payments, receipts and finance reports. Reads members.",
  VIEWER: "Reads members and membership reports. Contact details are hidden.",
};

export function roleLabel(role: TeamRole) {
  return ROLE_LABELS[role];
}
