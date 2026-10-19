import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Space Works Organization",
    template: "%s · Space Works Organization",
  },
  description: "Run your organisation's memberships: plans, members, renewals, payments and ID cards.",
  applicationName: "Space Works Organization",
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
