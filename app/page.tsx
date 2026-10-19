import Link from "next/link";
import { SpaceWorksProductLogo } from "@/components/brand/SpaceWorksLogo";
import { ColorModeToggle } from "@/components/chrome/ColorModeToggle";
import { buttonClasses } from "@/components/ui/button";
import { Card, Chip } from "@/components/ui/display";

const FEATURES = [
  { title: "Membership plans", body: "Rolling, yearly or lifetime plans with joining fees, grace periods and reminders." },
  { title: "Members and renewals", body: "Approvals, a searchable directory, and renewals that never slip through." },
  { title: "Payments and receipts", body: "Razorpay, Stripe or offline, with gapless GST receipts." },
  { title: "ID cards", body: "Design cards once, issue them on approval, and verify them with a QR code." },
];

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-4 px-4 py-4 md:px-6">
        <Link href="/" aria-label="Space Works Organization home">
          <SpaceWorksProductLogo height={32} label={null} />
        </Link>
        <ColorModeToggle />
      </header>

      <main id="main-content" className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-10 px-4 py-10 md:px-6 md:py-16">
        <section className="flex max-w-3xl flex-col gap-5">
          <Chip tone="success" className="self-start">Coming soon</Chip>
          <h1 className="text-display-m text-ink">
            Memberships, <span className="font-accent">sorted.</span>
          </h1>
          <p className="text-body-l text-ink-secondary">
            Plans, join forms, renewals, payments, receipts and ID cards for your organisation, in one calm place you can host yourself.
          </p>
          <div className="flex flex-wrap gap-3">
            <span className={buttonClasses({ variant: "primary", size: "lg" })} aria-disabled="true">Start your organisation</span>
            <span className={buttonClasses({ variant: "secondary", size: "lg" })} aria-disabled="true">Sign in</span>
          </div>
        </section>

        <section aria-label="What it does" className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <h2 className="text-title text-ink">{feature.title}</h2>
              <p className="mt-1 text-body-ui text-ink-muted">{feature.body}</p>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
}
