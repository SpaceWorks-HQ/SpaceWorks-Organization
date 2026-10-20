import { requireAuth } from "@/lib/permissions";
import { loadWallet } from "@/lib/portal/wallet";

/** The account home: every membership the signed-in person holds, across organisations. */
export async function loadAccountWalletView() {
  const session = await requireAuth();
  const wallet = await loadWallet(session.user.id);
  return { wallet: wallet ?? [], emailVerified: wallet !== null };
}
