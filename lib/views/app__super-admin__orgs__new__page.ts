import { requireSuperAdminMfa } from "@/lib/permissions";

/** Gate for the direct-create form; it needs no data. */
export async function loadSuperAdminNewOrgView() {
  await requireSuperAdminMfa();
  return {};
}
