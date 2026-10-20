/** Tabs under the Account header. Add an entry here to add a tab. */
export type AccountTab = { href: string; label: string };

export const ACCOUNT_ROOT_HREF = "/account";

export const ACCOUNT_TABS: ReadonlyArray<AccountTab> = [
  { href: ACCOUNT_ROOT_HREF, label: "Memberships" },
  { href: "/account/profile", label: "Profile" },
  { href: "/account/privacy", label: "Privacy" },
  { href: "/account/organisations", label: "Teams" },
  { href: "/account/security", label: "Security" },
];

/**
 * The root tab (the membership wallet) matches /account itself and each membership's page under
 * /account/memberships; every other tab also matches its nested paths (/account/security/anything).
 */
export function isAccountTabActive(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (href === ACCOUNT_ROOT_HREF) return path === ACCOUNT_ROOT_HREF || path.startsWith(`${ACCOUNT_ROOT_HREF}/memberships/`);
  return path === href || path.startsWith(`${href}/`);
}
