"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/cn";

/** Sample cards for the kinds of organisations the platform is built for. Not real members or customers. */
const CARDS = [
  { org: "SpaceWorks", kind: "Annual membership", name: "Shaan Shoukath", until: "31 Mar 2027", tone: "teal" },
  { org: "Runners' club", kind: "Season pass", name: "Anika Rao", until: "30 Sep 2026", tone: "citron" },
  { org: "Alumni association", kind: "Life member", name: "Joseph Mathew", until: "Lifetime", tone: "ink" },
  { org: "Residents' association", kind: "Household · 2026–27", name: "Flat 4B", until: "31 Mar 2027", tone: "sky" },
  { org: "Chess circle", kind: "Junior membership", name: "Diya Menon", until: "31 Dec 2026", tone: "yellow" },
  { org: "Kayak club", kind: "Monthly", name: "Arjun Pillai", until: "14 Nov 2026", tone: "orange" },
  { org: "Professional body", kind: "Fellow · 2026–27", name: "Dr. Leela Thomas", until: "31 Mar 2027", tone: "cream" },
] as const;

const TONES: Record<(typeof CARDS)[number]["tone"], string> = {
  teal: "bg-sw-teal text-sw-cream",
  citron: "bg-sw-citron text-sw-ink",
  ink: "bg-sw-ink text-sw-cream",
  sky: "bg-sw-sky text-sw-ink",
  yellow: "bg-sw-yellow text-sw-ink",
  orange: "bg-sw-orange text-sw-ink",
  cream: "bg-sw-cream text-sw-ink border border-sw-ink/15",
};

function MiniCard({ card }: { card: (typeof CARDS)[number] }) {
  return (
    <div className={cn("flex h-[132px] w-[220px] shrink-0 flex-col justify-between rounded-2xl p-4", TONES[card.tone])}>
      <div className="flex items-center justify-between gap-2 text-caption">
        <span className="truncate font-semibold">{card.org}</span>
        <span className="shrink-0 opacity-75">Sample</span>
      </div>
      <div>
        <p className="truncate text-label font-semibold">{card.name}</p>
        <p className="truncate text-caption opacity-80">{card.kind}</p>
      </div>
      <p className="text-[11px] tabular-nums opacity-75">{card.until === "Lifetime" ? "Lifetime" : `Valid until ${card.until}`}</p>
    </div>
  );
}

/**
 * A slow conveyor of sample member cards under the hero. It pauses on hover and keyboard focus, has its
 * own pause button (moving content over five seconds must be stoppable), and stands still under reduced motion.
 */
export function CardStrip() {
  const [paused, setPaused] = useState(false);
  return (
    <div className="relative">
      <div className="landing-strip-mask overflow-hidden py-2">
        <div className="landing-strip flex w-max gap-4" data-paused={paused}>
          {CARDS.map((card) => <MiniCard key={card.name} card={card} />)}
          {/* The second set makes the loop seamless; it repeats the first, so assistive tech skips it. */}
          <div aria-hidden className="flex gap-4">
            {CARDS.map((card) => <MiniCard key={`${card.name}-again`} card={card} />)}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 px-4 sm:px-6">
        <p className="text-caption text-ink-muted">Sample cards for the kinds of organisations it is built for.</p>
        <button
          type="button"
          onClick={() => setPaused((value) => !value)}
          aria-pressed={paused}
          className="landing-strip-toggle inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-control px-3 text-caption font-semibold text-ink transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--sw-ui-focus))]"
        >
          {paused ? <Play aria-hidden className="size-3.5" /> : <Pause aria-hidden className="size-3.5" />}
          {paused ? "Play" : "Pause"}
        </button>
      </div>
    </div>
  );
}
