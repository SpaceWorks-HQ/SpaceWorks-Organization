import Link from "next/link";
import QRCode from "qrcode";
import { ArrowUpRight, Check } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { CardStrip } from "@/components/marketing/CardStrip";
import { CopyCommand } from "@/components/marketing/CopyCommand";
import { MemberCardDeck } from "@/components/marketing/MemberCardDeck";
import { SAMPLE } from "@/components/marketing/sample";
import { ROLE_LABELS } from "@/lib/permissionRoles";
import { cn } from "@/lib/cn";
import "@/components/marketing/landing.css";

const GITHUB = "https://github.com/SpaceWorks-HQ/SpaceWorks-Organization";
const INSTALL = "curl -fsSL https://raw.githubusercontent.com/SpaceWorks-HQ/SpaceWorks-Organization/main/install.sh | bash";
const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

/** One sample membership year, April to March, in the order it happens. */
const YEAR: Array<{ when: string; title: string; body: string; proof: React.ReactNode }> = [
  {
    when: "1 Apr",
    title: "Shaan applies to join",
    body: "The SpaceWorks join form asks for the plan, the chapter, a photo and consent. An email link signs them in, so there is no account to set up first.",
    proof: <Proof tone="panel">Annual membership · Kochi chapter · photo added</Proof>,
  },
  {
    when: "2 Apr",
    title: "Abhiram approves",
    body: "Applications wait in one queue with everything the form asked. Plans that need no vetting take members straight in.",
    proof: <Proof tone="citron">Approved by Abhiram NJ, admin</Proof>,
  },
  {
    when: "2 Apr",
    title: "Pays ₹1,200 by UPI",
    body: "Online through Razorpay or Stripe, or UPI and cash recorded by hand. Offline money counts only after a second treasurer, here Abdul Samad, confirms it.",
    proof: <Proof tone="panel"><span className="tabular-nums">₹1,200.00 · UPI · UTR 6128 4093 7712</span></Proof>,
  },
  {
    when: "2 Apr",
    title: `Receipt ${SAMPLE.receipt}`,
    body: "A GST tax invoice, numbered without gaps for the financial year and emailed with the card.",
    proof: <Proof tone="yellow"><span className="tabular-nums">{SAMPLE.receipt}</span> · next is 0002, never 0003</Proof>,
  },
  {
    when: "2 Apr",
    title: "The card is issued",
    body: "On the day the membership starts. Shaan downloads it, keeps it on their phone or has it printed.",
    proof: <Proof tone="teal"><span className="tabular-nums">{SAMPLE.cardNumber}</span> · valid until {SAMPLE.validUntil}</Proof>,
  },
  {
    when: "Jun–Feb",
    title: "Shows the card at the door",
    body: "Whoever checks it scans the QR and sees the live status. Phone numbers and addresses never appear.",
    proof: <Proof tone="citron">Valid · {SAMPLE.organisation} · {SAMPLE.plan}</Proof>,
  },
  {
    when: "1 Mar",
    title: "Reminded to renew",
    body: "Thirty days before, a week before, on the day and once after it ends. Each reminder goes out once, never twice.",
    proof: <Proof tone="sky">Your membership ends on 31 March</Proof>,
  },
  {
    when: "18 Mar",
    title: "Renews for 2027–28",
    body: "Paid early, so the new year waits to begin on 1 April. Same card, same QR. Had it lapsed, grace days and the churn report would have caught it.",
    proof: <Proof tone="panel">Upcoming · 1 Apr 2027 to 31 Mar 2028</Proof>,
  },
];

const RECEIPT_LINES = [
  { label: "Annual membership 2026–27", value: "1,016.95" },
  { label: "CGST 9%", value: "91.53" },
  { label: "SGST 9%", value: "91.52" },
];

const UNITS = [
  { name: "Kerala", depth: 0, members: 214 },
  { name: "Kochi chapter", depth: 1, members: 128 },
  { name: "Kozhikode chapter", depth: 1, members: 86 },
  { name: "Karnataka", depth: 0, members: 54 },
  { name: "Bengaluru chapter", depth: 1, members: 54 },
];

/** The SpaceWorks team as the sample committee: their organisation role, and the access it gives them. */
const TEAM = [
  { name: "Shaan Shoukath", role: "Systems Engineer", access: "OWNER" },
  { name: "Abhiram NJ", role: "Cloud Specialist", access: "ADMIN" },
  { name: "Abdul Samad MJ", role: "Full Stack Developer", access: "TREASURER" },
  { name: "Midlaj C", role: "Backend Engineer", access: "ADMIN" },
  { name: "Ajzal P", role: "Marketing Specialist", access: "VIEWER" },
  { name: "Anin Arafath", role: "App Developer", access: "VIEWER" },
] as const;

/** Sample active members per month for the report preview. */
const ACTIVE = [180, 204, 221, 229, 236, 240, 247, 251, 258, 263, 266, 268];

const FAQ = [
  {
    q: "What does it cost?",
    a: "The software is free and open source under the AGPL. If you host it yourself, you pay only for your server. Payment providers charge their usual fees on online payments.",
  },
  {
    q: "Do members need to create an account?",
    a: "No. They join with their email address and a sign-in link. They can add a password later to see their cards, receipts and renewals in one place.",
  },
  {
    q: "Which payments work?",
    a: "Razorpay and Stripe online, plus UPI, bank transfer and cash recorded by your treasurer. Each organisation picks the one online provider it uses.",
  },
  {
    q: "Are the receipts right for GST?",
    a: "Receipts follow GST rules for place of supply and rounding, with gapless numbers per financial year. Registered or not, check your setup with your chartered accountant.",
  },
  {
    q: "We already have a member list. Can we bring it?",
    a: "Yes. Import a spreadsheet, match its columns to your fields, and start renewals from where each member is.",
  },
  {
    q: "Who decides whether our organisation can join this platform?",
    a: "The people who run this instance review every application before it opens, and email you their decision. If you host it yourself, that is you.",
  },
];

function Proof({ tone, children }: { tone: "panel" | "citron" | "sky" | "yellow" | "teal"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-block max-w-full rounded-xl px-3.5 py-1.5 text-caption font-semibold sm:rounded-full",
        tone === "panel" && "border border-line bg-panel text-ink",
        tone === "citron" && "bg-sw-citron text-sw-ink",
        tone === "sky" && "bg-sw-sky text-sw-ink",
        tone === "yellow" && "bg-sw-yellow text-sw-ink",
        tone === "teal" && "bg-sw-teal text-sw-cream",
      )}
    >
      {children}
    </span>
  );
}

function SectionHeading({ id, title, children, inverse = false }: { id: string; title: React.ReactNode; children?: React.ReactNode; inverse?: boolean }) {
  return (
    <div className="flex max-w-[620px] flex-col gap-4">
      <h2 id={id} className={cn("text-display-m text-balance", inverse ? "text-sw-cream" : "text-ink")}>{title}</h2>
      {children ? <p className={cn("text-body-l", inverse ? "text-sw-cream/80" : "text-ink-secondary")}>{children}</p> : null}
    </div>
  );
}

export default async function HomePage() {
  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
  const qrSvg = await QRCode.toString(`${base || "https://spaceworks.example"}/#how-it-works`, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#142C2A", light: "#00000000" },
  });

  return (
    <div className="flex flex-col">
      {/* Hero: the offer on the left, the year's first objects dealt on the right. */}
      <section aria-labelledby="hero-title" className="landing-boxes landing-hero flex flex-col overflow-hidden border-b border-line">
        <div className="mx-auto grid w-full max-w-[1160px] flex-1 items-center gap-12 px-4 pb-10 pt-12 sm:px-6 md:pt-16 lg:grid-cols-[minmax(0,1fr)_500px] lg:gap-10 lg:pt-10">
          <div className="flex max-w-[600px] flex-col gap-6">
            <h1 id="hero-title" className="text-display-l text-ink">
              <span className="landing-line"><span>Your members.</span></span>
              <span className="landing-line"><span style={{ ["--rise-delay" as string]: "120ms" }}>In good standing.</span></span>
            </h1>
            <p className="landing-fade text-body-l text-ink-secondary" style={{ ["--rise-delay" as string]: "300ms" }}>
              Plans, join forms, renewals, payments, GST receipts and member cards for clubs, associations and alumni bodies.
              Apply to run your organisation here, or host it yourself.
            </p>
            <div className="landing-fade flex flex-wrap items-center gap-x-6 gap-y-3" style={{ ["--rise-delay" as string]: "420ms" }}>
              <Link href="/start" className={buttonClasses({ variant: "highlight", size: "lg" })}>
                Apply for your organisation
                <ArrowUpRight aria-hidden className="size-4" />
              </Link>
              <Link href="#self-host" className="inline-flex min-h-11 items-center gap-1.5 rounded-control text-label font-semibold text-ink underline-offset-4 hover:underline">
                Run it yourself
                <ArrowUpRight aria-hidden className="size-4" />
              </Link>
            </div>
            <p className="landing-fade text-caption text-ink-muted" style={{ ["--rise-delay" as string]: "520ms" }}>Free and open source. Self-hosted. In active development.</p>
          </div>
          <MemberCardDeck qrSvg={qrSvg} />
        </div>
        <div className="pb-6">
          <CardStrip />
        </div>
      </section>

      {/* The year: every capability where it happens. */}
      <section aria-labelledby="how-it-works" className="landing-year scroll-mt-20 bg-canvas">
        <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-12 px-4 py-20 sm:px-6 lg:py-28">
          <SectionHeading id="how-it-works" title={<>Twelve months. <span className="font-accent" style={{ fontWeight: 700 }}>One card.</span></>}>
            Follow one sample member, {SAMPLE.name} of {SAMPLE.organisation}, through a membership year. Every step is something the committee no longer does by hand.
          </SectionHeading>

          <div aria-hidden className="flex flex-col gap-2">
            <div className="relative h-3">
              <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-emphasis">
                <div className="landing-ruler-fill absolute inset-0 rounded-full bg-primary" />
              </div>
              {/* The months where the timeline below has stops. */}
              {[0, 11].map((index) => (
                <span key={index} className="absolute top-0 size-3 -translate-x-1/2 rounded-full border-2 border-primary bg-canvas" style={{ left: `${((index + 0.5) / 12) * 100}%` }} />
              ))}
              <span className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full border-2 border-primary bg-canvas" style={{ left: `${(2 / 12) * 100}%`, width: `${(9 / 12) * 100}%` }} />
            </div>
            <div className="grid grid-cols-12 text-caption tabular-nums text-ink-muted">
              {MONTHS.map((month, index) => (
                <span key={month} className={cn(index === 0 && "font-semibold text-ink")}>
                  <span className="sm:hidden">{month[0]}</span>
                  <span className="max-sm:hidden">{month}</span>
                </span>
              ))}
            </div>
          </div>

          <ol className="relative flex flex-col">
            <span aria-hidden className="absolute bottom-6 left-[5.5rem] top-6 w-px bg-line max-sm:left-[0.4375rem]" />
            {YEAR.map((stop) => (
              <li key={`${stop.when}-${stop.title}`} className="relative grid gap-x-8 gap-y-2 py-6 max-sm:pl-8 sm:grid-cols-[4.5rem_minmax(0,1fr)] lg:grid-cols-[4.5rem_minmax(0,0.9fr)_minmax(0,1fr)]">
                <span aria-hidden className="absolute left-[5.25rem] top-[1.95rem] size-2.5 rounded-full border-2 border-primary bg-canvas max-sm:left-[0.1875rem]" />
                <p className="pt-0.5 text-label font-semibold tabular-nums text-ink-muted">{stop.when}</p>
                <div className="flex flex-col gap-1.5 sm:pl-6">
                  <h3 className="text-h3 text-ink">{stop.title}</h3>
                  <p className="max-w-[46ch] text-body-ui text-ink-secondary">{stop.body}</p>
                </div>
                <div className="sm:col-start-2 sm:pl-6 lg:col-start-3 lg:pl-0 lg:pt-1">{stop.proof}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Money: the receipt is the proof. */}
      <section aria-labelledby="money" className="bg-sw-ink text-sw-cream dark:border-y dark:border-line dark:bg-[color-mix(in_srgb,var(--sw-ink)_55%,black)]">
        <div className="mx-auto grid w-full max-w-[1160px] items-center gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:py-28">
          <div className="flex flex-col gap-8">
            <SectionHeading id="money" inverse title={<>Every rupee.<br />Accounted for.</>}>
              Receipts your treasurer can hand to an auditor. The tax is worked out for you, the paise add up, and nothing paid is ever quietly changed.
            </SectionHeading>
            <ul className="flex flex-col gap-4">
              {[
                "Razorpay, Stripe, or UPI and cash confirmed by a second treasurer.",
                "Receipt numbers never skip within a financial year, April to March.",
                "A mistake is reversed with a credit note, never edited away.",
              ].map((point) => (
                <li key={point} className="flex gap-3 text-body-ui text-sw-cream/85">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-sw-citron text-sw-ink">
                    <Check aria-hidden className="size-3.5" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <figure className="landing-print rounded-[20px] bg-sw-cream p-6 text-sw-ink shadow-[0_30px_70px_-30px_rgb(0_0_0/0.6)] sm:p-7">
            <div className="flex items-start justify-between gap-4 border-b border-dashed border-sw-ink/25 pb-4">
              <div>
                <p className="text-h4">{SAMPLE.organisation}</p>
                <p className="text-caption text-sw-ink/70">Kochi, Kerala · GSTIN 32ABCDE1234F1Z5</p>
              </div>
              <div className="text-right">
                <p className="text-caption font-semibold">Tax invoice</p>
                <p className="text-caption tabular-nums text-sw-ink/70">{SAMPLE.receipt}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 border-b border-dashed border-sw-ink/25 py-4 text-caption">
              <div>
                <p className="text-sw-ink/60">Billed to</p>
                <p className="font-semibold">{SAMPLE.name}</p>
              </div>
              <div>
                <p className="text-sw-ink/60">Place of supply</p>
                <p className="font-semibold">Kerala (32)</p>
              </div>
            </div>
            <dl className="flex flex-col gap-2 py-4 text-body-ui">
              {RECEIPT_LINES.map((line) => (
                <div key={line.label} className="flex items-baseline justify-between gap-4">
                  <dt>{line.label}</dt>
                  <dd className="tabular-nums">₹{line.value}</dd>
                </div>
              ))}
              <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-sw-ink/25 pt-3">
                <dt className="text-label font-semibold">Total paid</dt>
                <dd className="text-h3 tabular-nums">₹1,200.00</dd>
              </div>
            </dl>
            <figcaption className="flex flex-wrap items-center justify-between gap-2 text-caption text-sw-ink/70">
              <span>UPI · 2 Apr 2026</span>
              <span className="rounded-full bg-sw-yellow px-2.5 py-0.5 font-semibold text-sw-ink">Sample receipt</span>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Scale: units, team roles and reports. */}
      <section aria-labelledby="scale" className="bg-canvas">
        <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-12 px-4 py-20 sm:px-6 lg:py-28">
          <SectionHeading id="scale" title={<>One head office.<br />Every chapter.</>}>
            Run a single club, or a state body with district units and city chapters. Each committee sees its own members and numbers; the head office sees them all.
          </SectionHeading>

          <div className="grid gap-6 lg:grid-cols-3">
            <figure className="flex flex-col gap-4 rounded-[20px] border border-line bg-panel p-6">
              <figcaption className="text-label font-semibold text-ink">Units</figcaption>
              <ul className="flex flex-col">
                <li className="flex items-center justify-between py-2 text-label font-semibold text-ink">
                  <span>{SAMPLE.organisation}</span>
                  <span className="tabular-nums text-ink-muted">268</span>
                </li>
                {UNITS.map((unit) => (
                  <li key={unit.name} className="flex items-center justify-between border-t border-line py-2 text-body-ui text-ink" style={{ paddingLeft: `${(unit.depth + 1) * 1}rem` }}>
                    <span className={cn(unit.name === "Kochi chapter" && "font-semibold")}>
                      {unit.name}
                      {unit.name === "Kochi chapter" ? <span className="ml-2 rounded-full bg-sw-citron px-2 py-0.5 text-caption text-sw-ink">Shaan</span> : null}
                    </span>
                    <span className="tabular-nums text-ink-muted">{unit.members}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-auto text-caption text-ink-muted">Sample members per unit</p>
            </figure>

            <figure className="flex flex-col gap-4 rounded-[20px] border border-line bg-panel p-6">
              <figcaption className="text-label font-semibold text-ink">The SpaceWorks team</figcaption>
              <ul className="flex flex-col">
                {TEAM.map((person) => (
                  <li key={person.name} className="flex flex-col gap-0.5 border-t border-line py-2.5 first:border-t-0 first:pt-0">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-label font-semibold text-ink">{person.name}</span>
                      <span className="text-caption text-ink-muted">{ROLE_LABELS[person.access]}</span>
                    </span>
                    <span className="text-caption text-ink-secondary">{person.role}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-auto text-caption text-ink-muted">Sample team. Each role sets what that person can see and do.</p>
            </figure>

            <figure className="flex flex-col gap-4 rounded-[20px] border border-line bg-panel p-6">
              <figcaption className="flex items-baseline justify-between gap-3">
                <span className="text-label font-semibold text-ink">Active members, 2026–27</span>
                <span className="text-h3 tabular-nums text-ink">268</span>
              </figcaption>
              <div className="flex h-36 items-end gap-1.5" role="img" aria-label="Sample chart: active members rise from 180 in April to 268 in March.">
                {ACTIVE.map((value, index) => (
                  <span key={MONTHS[index]} className={cn("flex-1 rounded-t-md", index === ACTIVE.length - 1 ? "bg-primary" : "bg-emphasis")} style={{ height: `${(value / 280) * 100}%` }} />
                ))}
              </div>
              <div aria-hidden className="flex gap-1.5 text-center text-[11px] tabular-nums text-ink-muted">
                {MONTHS.map((month) => <span key={month} className="flex-1">{month[0]}</span>)}
              </div>
              <p className="mt-auto text-caption text-ink-muted">Sample report. Renewals, lapses, money collected and dues are reported the same way.</p>
            </figure>
          </div>
        </div>
      </section>

      {/* Self-hosting. */}
      <section aria-labelledby="self-host" className="scroll-mt-20 bg-sw-teal text-sw-cream">
        <div className="mx-auto grid w-full max-w-[1160px] items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:py-28">
          <div className="flex flex-col gap-8">
            <SectionHeading id="self-host" inverse title={<>Your server.<br />Your members.</>}>
              The whole platform is open source. Run it for one organisation, or for every organisation in your federation.
            </SectionHeading>
            <dl className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <dt className="text-label font-semibold">On a VPS</dt>
                <dd className="text-body-ui text-sw-cream/80">One installer sets up the database, cache, file storage and HTTPS, and keeps backups.</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-label font-semibold">In the cloud</dt>
                <dd className="text-body-ui text-sw-cream/80">Point it at managed Postgres, Redis, S3-compatible storage and an email service.</dd>
              </div>
            </dl>
            <a href={GITHUB} className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-control text-label font-semibold underline-offset-4 hover:underline">
              View on GitHub
              <ArrowUpRight aria-hidden className="size-4" />
            </a>
          </div>

          <figure className="overflow-hidden rounded-[20px] bg-sw-ink text-sw-cream shadow-[0_30px_70px_-30px_rgb(0_0_0/0.6)]">
            <div className="flex items-center justify-between gap-3 border-b border-sw-cream/10 px-5 py-3">
              <figcaption className="text-caption text-sw-cream/70">Terminal preview</figcaption>
              <CopyCommand command={INSTALL} />
            </div>
            <pre className="overflow-x-auto px-5 py-5 font-mono text-[13px] leading-relaxed text-sw-cream/90">
              <code>
                <span className="text-sw-citron">$</span>{" curl -fsSL \\\n  https://raw.githubusercontent.com/\\\nSpaceWorks-HQ/SpaceWorks-Organization/\\\nmain/install.sh | bash\n\n"}
                <span className="text-sw-cream/60">{"Deployment summary\n"}</span>
                {"  Mode:            bundled (VPS)\n  Database:        PostgreSQL 16\n  Storage:         Silo (S3)\n  HTTPS:           automatic\n  Payments:        Razorpay\n  Backups:         nightly, encrypted\n\n"}
                <span className="landing-caret inline-block h-4 w-2 translate-y-0.5 bg-sw-citron" />
              </code>
            </pre>
            <p className="border-t border-sw-cream/10 px-5 py-3 text-caption text-sw-cream/70">
              On a Linux server, as a user with sudo. The installer asks every question first and changes nothing until you confirm.
            </p>
          </figure>
        </div>
      </section>

      {/* Questions. */}
      <section aria-labelledby="questions" className="bg-canvas">
        <div className="mx-auto grid w-full max-w-[1160px] gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:py-28">
          <SectionHeading id="questions" title={<>Questions<br />committees ask.</>} />
          <div className="flex flex-col border-t border-line">
            {FAQ.map((item) => (
              <details key={item.q} className="group border-b border-line">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-h4 text-ink marker:hidden [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span aria-hidden className="relative size-4 shrink-0">
                    <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-ink" />
                    <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-ink transition-transform duration-200 ease-sw group-open:scale-y-0" />
                  </span>
                </summary>
                <p className="max-w-[60ch] pb-5 text-body-ui text-ink-secondary">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Close. */}
      <section aria-labelledby="close" className="landing-boxes overflow-hidden border-t border-line">
        <div className="mx-auto flex w-full max-w-[1160px] flex-col items-start gap-6 px-4 py-20 sm:px-6 lg:py-28">
          <h2 id="close" className="text-display-l text-balance text-ink">
            Start next year
            <br />
            with a clean register.
          </h2>
          <p className="max-w-[56ch] text-body-l text-ink-secondary">
            Tell us about your organisation. Once it is approved, add your plans and share your join link before renewals come round.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/start" className={buttonClasses({ variant: "highlight", size: "lg" })}>
              Apply for your organisation
              <ArrowUpRight aria-hidden className="size-4" />
            </Link>
            <Link href="/login" className="inline-flex min-h-11 items-center rounded-control text-label font-semibold text-ink underline-offset-4 hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
