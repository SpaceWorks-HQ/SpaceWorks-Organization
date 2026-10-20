import Link from "next/link";
import type { Metadata } from "next";
import { MoodTile } from "@/components/brand/MoodTile";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main id="main-content" className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <MoodTile mood="thinking" size={64} />
      <h1 className="text-h2 text-ink">We couldn&rsquo;t find that page</h1>
      <p className="text-body text-ink-secondary">The link may be old, or the page may have moved. Check the address, or start again from the home page.</p>
      <Link href="/" className={buttonClasses({ variant: "primary" })}>Go to the home page</Link>
    </main>
  );
}
