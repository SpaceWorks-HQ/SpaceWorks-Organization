import "server-only";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** True when SUPER_ADMIN_EMAIL names this verified email (bootstraps the first super-admin). */
export function isBootstrapSuperAdminEmail(email: string | null | undefined): boolean {
  const configured = process.env.SUPER_ADMIN_EMAIL;
  return Boolean(configured && email && normalizeEmail(email) === normalizeEmail(configured));
}
