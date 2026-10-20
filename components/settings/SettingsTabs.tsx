"use client";

import { usePathname } from "next/navigation";
import { NavTabs } from "@/components/ui/tabs";

/** Settings sections: the organisation's profile, its structure, and its money and calendar. */
export function SettingsTabs({ slug }: { slug: string }) {
  const pathname = usePathname() ?? "";
  const base = `/dashboard/${slug}/settings`;
  const items = [
    { href: base, label: "Profile" },
    { href: `${base}/structure`, label: "Units and roles" },
    { href: `${base}/money`, label: "Money and year" },
    { href: `${base}/payments`, label: "Payments and tax" },
    { href: `${base}/cards`, label: "Cards" },
  ];
  return <NavTabs label="Settings sections" items={items.map((item) => ({ ...item, active: item.href === base ? pathname === base : pathname.startsWith(item.href) }))} />;
}
