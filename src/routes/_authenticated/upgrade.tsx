import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Mail } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { PlanUsageMeter } from "@/components/plan-usage-meter";
import { planLimitsQuery, usePlanUsage, type PlanLimit } from "@/lib/plans";
import { useOrganisations } from "@/lib/use-organisations";

export const Route = createFileRoute("/_authenticated/upgrade")({
  head: () => {
    const title = "Plans and allowances — instructBrain";
    const description =
      "See what your plan includes, how many reports you have used this month, and how to move to a larger allowance.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: Upgrade,
});

const highlights: Record<string, string[]> = {
  free: ["Every survey type", "Issued PDF and share link", "No card required"],
  standard: ["Per-trade extracts", "Close-out tracking", "Multiple projects"],
  pro: ["Everything in Standard", "Multiple surveyors", "Organisation branding"],
  custom: ["Volume allowances", "Bespoke survey types", "Onboarding support"],
};

function allowanceLine(limit: PlanLimit): string {
  const reports =
    limit.report_allowance === null ? "Unlimited reports" : `${limit.report_allowance} reports a month`;
  const photos =
    limit.photo_cap_per_report === null
      ? "unlimited photographs per report"
      : `up to ${limit.photo_cap_per_report} photographs per report`;
  return `${reports}, ${photos}.`;
}

function Upgrade() {
  const { organisationId } = useOrganisations();
  const usage = usePlanUsage(organisationId);
  const limits = useQuery(planLimitsQuery());

  const tiers = (limits.data ?? []).filter((limit) =>
    ["free", "standard", "pro", "custom"].includes(limit.plan),
  );

  return (
    <AppShell>
      <header className="border-b border-border pb-6">
        <p className="eyebrow">Plans</p>
        <h1 className="editorial-title mt-1 text-2xl font-semibold sm:text-3xl">
          Your allowance
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          instructBrain is priced in reports, not tokens. A report is one survey, from upload to
          issued PDF.
        </p>
      </header>

      <PlanUsageMeter usage={usage} className="mt-6 max-w-xl" />

      <ul className="mt-8 grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        {tiers.map((tier) => {
          const current = tier.plan === usage.plan;
          return (
            <li
              key={tier.plan}
              className={`flex flex-col rounded-xl border bg-surface-raised p-5 shadow-raised ${
                current ? "border-brand-accent ring-2 ring-brand-accent/30" : "border-border"
              }`}
            >
              <p className="eyebrow">{tier.label}</p>
              <p className="editorial-title mt-1 text-2xl font-semibold">
                {tier.price_gbp === null ? "Talk to us" : `£${tier.price_gbp}`}
                {tier.price_gbp ? (
                  <span className="text-sm font-normal text-muted-foreground">/month</span>
                ) : null}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{allowanceLine(tier)}</p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {(highlights[tier.plan] ?? []).map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-accent" />
                    {point}
                  </li>
                ))}
              </ul>
              <p className="mt-auto pt-5 text-sm font-semibold">
                {current ? "Your current plan" : null}
              </p>
            </li>
          );
        })}
      </ul>

      <section
        aria-labelledby="upgrade-contact"
        className="mt-8 max-w-2xl rounded-xl border border-border bg-surface-raised p-5"
      >
        <h2 id="upgrade-contact" className="editorial-title text-lg font-semibold">
          Moving up a plan
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Card payment is coming shortly. Until then, email us and we will move your organisation
          onto the plan you need, usually the same working day.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="brand" asChild>
            <a href="mailto:hello@instructbrain.com?subject=instructBrain%20plan%20change">
              <Mail aria-hidden="true" />
              Contact us about a plan
            </a>
          </Button>
          <Button variant="quiet" asChild>
            <Link to="/projects">Back to projects</Link>
          </Button>
        </div>
      </section>
    </AppShell>
  );
}
