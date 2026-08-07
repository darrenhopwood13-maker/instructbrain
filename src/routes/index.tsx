import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardList,
  FileText,
  HardHat,
  ScanLine,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoiRace } from "@/components/landing/roi-race";
import { useSession } from "@/lib/auth";

const TITLE = "Report Ready — three days of writing up becomes minutes";
const DESCRIPTION =
  "Photos in, client-ready report out. Report Ready drafts, reviews and issues UK construction condition surveys, site walks and snagging schedules. Free for your first 3 reports.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://instructbrain.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://instructbrain.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Report Ready",
          applicationCategory: "BusinessApplication",
          description: DESCRIPTION,
          offers: [
            { "@type": "Offer", name: "Free", price: "0", priceCurrency: "GBP" },
            { "@type": "Offer", name: "Standard", price: "49", priceCurrency: "GBP" },
            { "@type": "Offer", name: "Practice", price: "99", priceCurrency: "GBP" },
          ],
        }),
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const { user, loading } = useSession();

  // A signed-in visitor never needs the sales page.
  useEffect(() => {
    if (!loading && user) navigate({ to: "/projects", replace: true });
  }, [loading, user, navigate]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <LandingHeader />

      <main id="main" className="flex-1">
        <Hero />
        <RoiSection />
        <UseCases />
        <HowItWorks />
        <PlainEnglish />
        <Pricing />
        <ClosingCta />
      </main>

      <LandingFooter />
    </div>
  );
}

function Wordmark() {
  return (
    <span className="block min-w-0">
      <span className="block text-[0.5625rem] font-bold uppercase tracking-[0.24em] text-muted-foreground">
        An instructSite company
      </span>
      <span className="wordmark block truncate text-lg leading-tight">
        <span className="text-brand-accent-light">Report</span>{" "}
        <span className="text-foreground">Ready</span>
      </span>
    </span>
  );
}

function LandingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <div className="shell-container grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4">
        <Link to="/" className="flex min-w-0 items-center gap-3 rounded-md">
          <span
            aria-hidden="true"
            className="gloss hidden size-9 shrink-0 place-items-center rounded-md sm:grid"
          >
            <FileText className="size-4" />
          </span>
          <Wordmark />
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/auth/sign-in"
            className="hidden rounded-md px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-sunken sm:inline-flex"
          >
            Sign in
          </Link>
          <Button variant="brand" asChild>
            <Link to="/auth/sign-up">Start free</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="shell-container py-20 lg:py-28">
      <div className="max-w-3xl">
        <p className="eyebrow">UK construction reporting</p>
        <h1 className="editorial-title mt-4 text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
          Three days of writing up becomes minutes.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Photos in, client-ready report out. Walk the site as you always have, then issue the
          document the same afternoon.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button variant="brand" size="lg" asChild>
            <Link to="/auth/sign-up">
              Start free — 3 reports
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <a href="#how-it-works">See how it works</a>
          </Button>
        </div>
        <p className="mt-5 text-sm text-muted-foreground">No card required.</p>
      </div>
    </section>
  );
}

function RoiSection() {
  return (
    <section className="paper border-y border-border py-20 lg:py-28" aria-labelledby="roi-heading">
      <div className="shell-container">
        <p className="eyebrow">What it gives you back</p>
        <h2 id="roi-heading" className="editorial-title mt-3 text-3xl font-bold sm:text-4xl">
          Move the sliders. Watch the gap.
        </h2>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground">
          The write-up is the expensive part of a survey, and it happens after hours. This is what
          it costs you now, and what it costs with Report Ready.
        </p>
        <div className="mt-12">
          <RoiRace />
        </div>
      </div>
    </section>
  );
}

const useCases = [
  {
    icon: ShieldCheck,
    title: "Weatherproofing / condition survey",
    who: "Site manager or building surveyor",
    when: "Before handover, or when a leak is reported",
    now: "150 photographs, then three days of desk work writing it up.",
    then: "Minutes.",
  },
  {
    icon: HardHat,
    title: "Site walk",
    who: "Site manager",
    when: "Daily or weekly",
    now: "An hour walking the site, then an evening splitting observations by trade and writing eight separate emails.",
    then: "Photos in, per-trade extracts out.",
  },
  {
    icon: ClipboardList,
    title: "Snagging",
    who: "Clerk of works or project manager",
    when: "Before handover",
    now: "Days spent listing defects and chasing which trade owns what.",
    then: "Identified, described, with likely cause, severity, the standard it touches, and the fix.",
  },
];

function UseCases() {
  return (
    <section className="shell-container py-20 lg:py-28" aria-labelledby="cases-heading">
      <p className="eyebrow">Where it earns its keep</p>
      <h2 id="cases-heading" className="editorial-title mt-3 text-3xl font-bold sm:text-4xl">
        Three jobs it does today
      </h2>
      <ul className="mt-12 grid gap-6 lg:grid-cols-3">
        {useCases.map((item) => (
          <li
            key={item.title}
            className="console-panel flex flex-col rounded-xl p-6 sm:p-7"
          >
            <span aria-hidden="true" className="gloss grid size-10 place-items-center rounded-md">
              <item.icon className="size-5" />
            </span>
            <h3 className="editorial-title mt-5 text-xl font-semibold leading-snug">
              {item.title}
            </h3>
            <dl className="mt-5 space-y-3 text-sm">
              <div>
                <dt className="eyebrow">Who</dt>
                <dd className="mt-1 text-muted-foreground">{item.who}</dd>
              </div>
              <div>
                <dt className="eyebrow">How often</dt>
                <dd className="mt-1 text-muted-foreground">{item.when}</dd>
              </div>
              <div>
                <dt className="eyebrow">Today</dt>
                <dd className="mt-1 text-muted-foreground">{item.now}</dd>
              </div>
              <div className="rule-top pt-3">
                <dt className="eyebrow">With Report Ready</dt>
                <dd className="mt-1 font-semibold text-foreground">{item.then}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}

const steps = [
  {
    icon: Upload,
    title: "Upload photos",
    body: "Straight off the phone or the camera. HEIC and JPEG, capture time and location kept intact.",
  },
  {
    icon: ScanLine,
    title: "AI drafts findings",
    body: "Every photograph read against your survey type, with severity, likely cause and the suggested trade.",
  },
  {
    icon: CheckCircle2,
    title: "Review and issue",
    body: "Confirm or correct on the keyboard, then issue the PDF and send per-trade extracts.",
  },
];

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="paper border-y border-border py-20 lg:py-28"
      aria-labelledby="how-heading"
    >
      <div className="shell-container">
        <p className="eyebrow">How it works</p>
        <h2 id="how-heading" className="editorial-title mt-3 text-3xl font-bold sm:text-4xl">
          Three steps, start to issued
        </h2>
        <ol className="mt-12 grid gap-6 lg:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-xl border border-border bg-surface-raised p-6 shadow-raised sm:p-7"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="gloss grid size-9 place-items-center rounded-md"
                >
                  <step.icon className="size-4" />
                </span>
                <span className="eyebrow">Step {index + 1}</span>
              </div>
              <h3 className="editorial-title mt-4 text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function PlainEnglish() {
  return (
    <section className="shell-container py-20 lg:py-28" aria-labelledby="ai-heading">
      <div className="max-w-3xl">
        <p className="eyebrow">What the AI actually does</p>
        <h2 id="ai-heading" className="editorial-title mt-3 text-3xl font-bold sm:text-4xl">
          In plain English
        </h2>
        <p className="mt-8 text-lg leading-relaxed text-muted-foreground">
          You photograph the site as you always have. Report Ready looks at every photo, describes
          what it sees in the language you'd use, decides how serious it is, and says what to do
          about it.
        </p>
        <p className="console-panel editorial-title mt-8 rounded-xl p-7 text-xl font-semibold leading-relaxed sm:text-2xl">
          When it can't tell — bad light, awkward angle — it says so rather than guessing. You
          review, correct anything wrong, and issue.
        </p>
      </div>
    </section>
  );
}

const tiers = [
  {
    name: "Free",
    price: "£0",
    cadence: "",
    summary: "3 reports. Up to 30 photos each.",
    points: ["No card required", "Every survey type", "Issued PDF and share link"],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Standard",
    price: "£49",
    cadence: "/month",
    summary: "10 reports a month, roughly 500 photos.",
    points: ["Per-trade extracts", "Close-out tracking", "Overage available per photo"],
    cta: "Start free, upgrade later",
    featured: true,
  },
  {
    name: "Practice",
    price: "£99",
    cadence: "/month",
    summary: "30 reports a month, roughly 1,500 photos.",
    points: ["Everything in Standard", "Multiple surveyors", "Organisation branding"],
    cta: "Start free, upgrade later",
    featured: false,
  },
  {
    name: "Custom",
    price: "Talk to us",
    cadence: "",
    summary: "Teams and enterprise.",
    points: ["Volume pricing", "Bespoke survey types", "Onboarding support"],
    cta: "Contact us",
    featured: false,
  },
];

function Pricing() {
  return (
    <section
      id="pricing"
      className="paper border-y border-border py-20 lg:py-28"
      aria-labelledby="pricing-heading"
    >
      <div className="shell-container">
        <p className="eyebrow">Pricing</p>
        <h2 id="pricing-heading" className="editorial-title mt-3 text-3xl font-bold sm:text-4xl">
          Priced in reports, not tokens
        </h2>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground">
          A report is one survey, from upload to issued PDF. Go over your photo allowance and you
          can buy overage per photo — no tier jump required.
        </p>

        <ul className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {tiers.map((tier) => (
            <li
              key={tier.name}
              className={
                tier.featured
                  ? "flex flex-col rounded-xl border-2 border-brand-accent bg-surface-raised p-6 shadow-raised"
                  : "flex flex-col rounded-xl border border-border bg-surface-raised p-6 shadow-raised"
              }
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="editorial-title text-lg font-semibold">{tier.name}</h3>
                {tier.featured ? (
                  <span className="rounded-full bg-brand-accent-soft px-2.5 py-0.5 text-xs font-bold text-brand-accent-ink">
                    Most popular
                  </span>
                ) : null}
              </div>
              <p className="editorial-title mt-4 text-3xl font-bold">
                {tier.price}
                <span className="text-base font-medium text-muted-foreground">{tier.cadence}</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{tier.summary}</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {tier.points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-brand-accent-ink"
                    />
                    <span className="text-muted-foreground">{point}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {tier.name === "Custom" ? (
                  <Button variant="outline" className="w-full" asChild>
                    <a href="mailto:hello@instructsite.ai?subject=Report%20Ready%20for%20teams">
                      {tier.cta}
                    </a>
                  </Button>
                ) : (
                  <Button
                    variant={tier.featured ? "brand" : "outline"}
                    className="w-full"
                    asChild
                  >
                    <Link to="/auth/sign-up">{tier.cta}</Link>
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-8 max-w-2xl text-sm text-muted-foreground">
          Billing is coming shortly. The free tier works today — create an account and issue your
          first three reports now.
        </p>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="shell-container py-24 lg:py-32" aria-labelledby="closing-heading">
      <div className="console-panel rounded-2xl p-8 sm:p-12">
        <div className="max-w-2xl">
          <span aria-hidden="true" className="gloss grid size-11 place-items-center rounded-md">
            <Camera className="size-5" />
          </span>
          <h2
            id="closing-heading"
            className="editorial-title mt-6 text-3xl font-bold sm:text-4xl"
          >
            Your next survey could be issued the same day.
          </h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Three reports free. No card required. Bring the photos you already have.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button variant="brand" size="lg" asChild>
              <Link to="/auth/sign-up">
                Start free — 3 reports
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/auth/sign-in">Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-border py-12">
      <div className="shell-container flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <Wordmark />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <a
            href="mailto:hello@instructsite.ai"
            className="font-medium text-muted-foreground hover:text-foreground"
          >
            Contact
          </a>
          <Link
            to="/privacy"
            className="font-medium text-muted-foreground hover:text-foreground"
          >
            Privacy
          </Link>
          <Link to="/terms" className="font-medium text-muted-foreground hover:text-foreground">
            Terms
          </Link>
        </nav>
      </div>
      <p className="shell-container mt-6 text-xs text-muted-foreground">
        © {new Date().getFullYear()} Report Ready. An instructSite company.
      </p>
    </footer>
  );
}
