import Link from "next/link";
import { ArrowUpRight, Globe, Mail, MapPin, Phone } from "lucide-react";
import { loadPublicOrgPage } from "@/lib/views/app__o__orgSlug__page";
import { describeDuration, describePrice, JOIN_MODE_LABELS } from "@/lib/membership/describe";
import { indianStateName } from "@/lib/indianStates";
import { buttonClasses } from "@/components/ui/button";
import { Callout, Chip, EmptyState, OrgLogo } from "@/components/ui/display";

export default async function PublicOrganisationPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { org, plans, takingMembers } = await loadPublicOrgPage({ params });
  const place = [org.city, indianStateName(org.stateCode)].filter(Boolean).join(", ");
  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-12 px-4 py-10 sm:px-6 lg:py-16">
      <section aria-labelledby="org-name" className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex max-w-[720px] flex-col gap-5">
          <OrgLogo name={org.name} src={org.logoUrl} size="xl" />
          <div className="flex flex-col gap-2">
            {org.kind ? <Chip tone="outline" className="w-fit">{org.kind}</Chip> : null}
            <h1 id="org-name" className="text-display-m text-balance text-ink">{org.name}</h1>
          </div>
          {org.description ? <p className="whitespace-pre-wrap text-body-l text-ink-secondary">{org.description}</p> : null}
        </div>
        <dl className="flex shrink-0 flex-col gap-3 rounded-2xl border border-line bg-panel p-5 text-body-ui lg:w-[300px]">
          {place ? <div className="flex items-center gap-2.5"><dt><MapPin aria-label="Location" className="size-4 text-ink-muted" /></dt><dd>{place}</dd></div> : null}
          {org.contactEmail ? <div className="flex items-center gap-2.5"><dt><Mail aria-label="Email" className="size-4 text-ink-muted" /></dt><dd className="min-w-0 truncate"><a className="underline-offset-4 hover:underline" href={`mailto:${org.contactEmail}`}>{org.contactEmail}</a></dd></div> : null}
          {org.contactPhone ? <div className="flex items-center gap-2.5"><dt><Phone aria-label="Phone" className="size-4 text-ink-muted" /></dt><dd><a className="underline-offset-4 hover:underline" href={`tel:${org.contactPhone.replace(/\s/g, "")}`}>{org.contactPhone}</a></dd></div> : null}
          {org.website ? <div className="flex items-center gap-2.5"><dt><Globe aria-label="Website" className="size-4 text-ink-muted" /></dt><dd className="min-w-0 truncate"><a className="underline-offset-4 hover:underline" href={org.website} rel="noopener noreferrer" target="_blank">{org.website.replace(/^https?:\/\//, "")}</a></dd></div> : null}
        </dl>
      </section>

      <section aria-labelledby="plans" className="flex flex-col gap-6">
        <h2 id="plans" className="text-h1 text-ink">Membership</h2>
        {!takingMembers ? <Callout tone="info">{org.name} isn&apos;t taking new members right now. Existing members can still sign in to see their membership.</Callout> : null}
        {plans.length === 0 ? <EmptyState mood="sleepy">No membership plans are open yet.</EmptyState> : (
          <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => {
              const { price, extras } = describePrice(plan, org.locale);
              const joinable = takingMembers && plan.joinMode !== "CLOSED" && plan.joinMode !== "INVITE_ONLY";
              return (
                <li key={plan.id} className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-6">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-h3 text-ink">{plan.name}</h3>
                    <p className="text-caption text-ink-muted">{describeDuration(plan, org.financialYearStartMonth)}</p>
                  </div>
                  <div>
                    <p className="text-h2 tabular-nums text-ink">{price}</p>
                    {extras.length ? <p className="text-caption text-ink-secondary">{extras.join(" · ")}</p> : null}
                  </div>
                  {plan.description ? <p className="whitespace-pre-wrap text-body-ui text-ink-secondary">{plan.description}</p> : null}
                  {!plan.allUnits ? <p className="text-caption text-ink-muted">For {plan.units.map((entry) => entry.unit.name).join(", ")}</p> : null}
                  <div className="mt-auto flex flex-col gap-2 pt-2">
                    {joinable ? (
                      <Link href={`/o/${org.slug}/join/${plan.slug}`} className={buttonClasses({ variant: "accent", fullWidth: true })}>
                        {plan.joinMode === "APPROVAL" ? "Apply to join" : "Join"}
                        <ArrowUpRight aria-hidden className="size-4" />
                      </Link>
                    ) : (
                      <span className="text-center text-caption text-ink-muted">{JOIN_MODE_LABELS[plan.joinMode].label}</span>
                    )}
                    {plan.joinMode === "APPROVAL" && joinable ? <p className="text-center text-caption text-ink-muted">The team reviews each application.</p> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
