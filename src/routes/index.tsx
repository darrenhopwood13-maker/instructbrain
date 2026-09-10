import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Languages,
  ScanLine,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoiRace } from "@/components/landing/roi-race";
import { ComplianceTicker, PhotoToReport } from "@/components/landing/photo-to-report";
import { Reveal } from "@/components/landing/reveal";
import { useSession } from "@/lib/auth";
import { absoluteUrl } from "@/lib/site-url";

const TITLE = "instructBrain — construction reports from site photographs";
const DESCRIPTION =
  "instructBrain turns site photographs into client-ready construction reports: Custom Reports, Project Reports and Weekly Compliance Registers. AI drafts referenced findings; you review, confirm and issue. Free for your first 3 reports.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absoluteUrl("/") },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/") }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "instructBrain",
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
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
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
      <span className="block text-[0.6875rem] font-bold uppercase tracking-[0.22em] text-brand-accent-ink">
        An instructSite company
      </span>
      <span className="wordmark block truncate text-lg leading-tight">
        <span className="text-brand-accent">instruct</span>
        <span className="text-foreground">Brain</span>
      </span>
    </span>
  );
}

function LandingHeader() {
  return (
    <header className="glass-panel sticky top-0 z-30 border-x-0 border-t-0">
      <div className="shell-container grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4">
        <Link to="/" className="flex min-w-0 items-center gap-3 rounded-md">
          <Wordmark />
        </Link>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Link
            to="/auth/sign-in"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-sunken"
          >
            Sign in
          </Link>
          <Button variant="brand" asChild>
            <Link to="/auth/sign-up">
              <span className="sm:hidden">Start</span>
              <span className="hidden sm:inline">Start free</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="shell-container pb-12 pt-8 lg:pb-20 lg:pt-12">
      <p className="wordmark whitespace-nowrap text-[clamp(2rem,8.5vw,7.5rem)] leading-none">
        <span className="text-brand-accent">instruct</span>
        <span className="text-foreground">Brain</span>
      </p>
      <p className="mt-3 text-lg font-light leading-snug text-foreground/90 sm:text-xl">
        Photos in. Client-ready reports out.
      </p>
      <p className="mt-6 text-sm text-muted-foreground">
        Free for your first 3 reports. No card required.
      </p>

      <div className="rule-top mt-8 max-w-4xl pt-8">
        <h1 className="editorial-title text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
          Walk the site. Issue the same afternoon.
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Custom Reports, Project Reports and Weekly Compliance Registers — all from the photographs
          you already take. AI drafts referenced findings against the right construction template;
          you confirm, sign off and issue a PDF with per-trade extracts.{" "}
          <a
            href="#how-it-works"
            className="font-semibold text-brand-accent-ink underline underline-offset-4"
          >
            See how it works
          </a>
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button variant="glass-orange" size="xl" asChild>
            <Link to="/auth/sign-up">
              <ClipboardList aria-hidden="true" />
              Create custom report
            </Link>
          </Button>
          <Button variant="outline" size="xl" asChild>
            <Link to="/auth/sign-up">
              <FileText aria-hidden="true" />
              Create project report
            </Link>
          </Button>
        </div>

        <RotatingSlogans />
      </div>

      <div className="mt-10 max-w-4xl">
        <PhotoToReport />
      </div>
    </section>
  );
}

const SLOGANS = [
  "AI drafts the findings. You confirm and issue.",
  "Full-resolution image analysis. Structured output. Human sign-off.",
  "Per-trade extracts, close-out tracking and shared links — in English or issued in another language.",
  "When it can't tell, it says so. No guesswork becomes a pass.",
];

function RotatingSlogans() {
  return (
    <p
      aria-live="polite"
      className="mt-5 text-sm font-medium text-brand-accent-ink"
      // The slogans cycle via CSS only, so the live region is polite and non-intrusive.
      style={{
        // Use a CSS animation to swap opacity on the four slogans.
        // We render all four spans stacked and fade them in sequence.
      }}
    >
      {SLOGANS.map((text, index) => (
        <span
          key={text}
          className="ib-slogan block sm:inline"
          style={{
            animation: "ib-slogan 16s linear infinite",
            animationDelay: `${index * 4}s`,
          }}
        >
          {text}
        </span>
      ))}
    </p>
  );
}

function RoiSection() {
  return (
    <section className="py-20 lg:py-28" aria-labelledby="roi-heading">
      <div className="shell-container">
        <Reveal>
          <p className="eyebrow">What it gives you back</p>
          <h2 id="roi-heading" className="editorial-title mt-3 text-3xl font-bold sm:text-4xl">
            Move the sliders. Watch the gap.
          </h2>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground">
            The write-up is the expensive part of a survey, a snagging list or a compliance register,
            and it happens after hours. This is what it costs you now, and what it costs with
            instructBrain.
          </p>
        </Reveal>
        <div className="glass-panel mt-12 rounded-2xl p-6 sm:p-8">
          <RoiRace />
        </div>
      </div>
    </section>
  );
}

const useCases = [
  {
    icon: ShieldCheck,
    title: "Custom Reports",
    who: "Surveyor, clerk of works or project manager",
    when: "One-off inspections, specialist audits, batch photo reviews",
    now: "Start from a blank page every time, or wrestle with a Word template that never matches the job.",
    then: "Pick a construction template, set tone and report type, add special instructions, and let the AI analyse the photos against fixed core parameters.",
  },
  {
    icon: FileText,
    title: "Project Reports",
    who: "Site manager, building surveyor or clerk of works",
    when: "Site walks, snagging, weatherproofing and condition surveys",
    now: "Hours writing up observations, splitting them by trade, then chasing ownership.",
    then: "Referenced findings with stable IDs, suggested trades, close-out tracking and per-trade extracts — all from one upload.",
  },
  {
    icon: ClipboardCheck,
    title: "Weekly Compliance Registers",
    who: "Site manager or safety officer",
    when: "Every week, for every active project",
    now: "Six separate checks, six clipboards, then re-keying it all into a spreadsheet.",
    then: "Fire, Excavation, Scaffold, Welfare, Lifting and plant, Housekeeping — prepopulated from the previous run, locked when complete, six-week history at a glance.",
  },
  {
    icon: Languages,
    title: "Issue in another language",
    who: "Teams with international clients or multilingual sites",
    when: "At issue, for any report",
    now: "Translate the PDF manually, or send English to a client who needs another language.",
    then: "Issue the report in the chosen language. Shared links and trade-access pages render in that language while English stays the record copy.",
  },
];

function UseCases() {
  return (
    <section className="shell-container py-20 lg:py-28" aria-labelledby="cases-heading">
      <Reveal>
        <p className="eyebrow">Where it earns its keep</p>
        <h2 id="cases-heading" className="editorial-title mt-3 text-3xl font-bold sm:text-4xl">
          Built for what you actually do on site
        </h2>
      </Reveal>
      <ul className="mt-12 grid gap-6 lg:grid-cols-2">
        {useCases.map((item, index) => (
          <Reveal key={item.title} as="li" delayMs={index * 80}>
            <li className="glass-panel flex h-full flex-col rounded-2xl p-6 sm:p-7">
              <div className="flex items-center gap-3">
                <item.icon aria-hidden="true" className="size-6 text-brand-accent-ink" />
                <h3 className="editorial-title text-xl font-semibold leading-snug">
                  {item.title}
                </h3>
              </div>
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
                  <dt className="eyebrow">With instructBrain</dt>
                  <dd className="mt-1 font-semibold text-foreground">{item.then}</dd>
                </div>
              </dl>
            </li>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

const steps = [
  {
    icon: Upload,
    title: "Upload photos",
    body: "Straight off the phone or the camera. HEIC and JPEG, capture time and location kept intact. Full-resolution originals go to the AI; thumbnails and display copies are handled separately.",
  },
  {
    icon: ScanLine,
    title: "AI drafts findings",
    body: "Every photograph is read against the report template with structured output, confidence scoring and trade suggestions. When it is uncertain — bad light, awkward angle — it routes to Not assessed, never to a passing status.",
  },
  {
    icon: CheckCircle2,
    title: "Review and issue",
    body: "Confirm or correct on the keyboard. Then issue a PDF with a contents page, per-trade extracts, close-out tracking where required, and a share link in the issue language.",
  },
];

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-20 lg:py-28"
      aria-labelledby="how-heading"
    >
      <div className="shell-container">
        <Reveal>
          <p className="eyebrow">How it works</p>
          <h2 id="how-heading" className="editorial-title mt-3 text-3xl font-bold sm:text-4xl">
            Three steps, start to issued
          </h2>
        </Reveal>
        <ol className="mt-12 grid gap-6 lg:grid-cols-3">
          {steps.map((step, index) => (
            <Reveal key={step.title} as="li" delayMs={index * 100}>
              <li className="glass-panel rounded-2xl p-6 sm:p-7">
                <span className="eyebrow">Step {index + 1}</span>
                <div className="mt-4 flex items-center gap-3">
                  <step.icon aria-hidden="true" className="size-5 text-brand-accent-ink" />
                  <h3 className="editorial-title text-xl font-semibold">{step.title}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            </Reveal>
          ))}
        </ol>

        <div className="mt-12 max-w-3xl">
          <ComplianceTicker />
        </div>
      </div>
    </section>
  );
}

function PlainEnglish() {
  return (
    <section className="shell-container py-20 lg:py-28" aria-labelledby="ai-heading">
      <div className="max-w-3xl">
        <Reveal>
          <p className="eyebrow">What the AI actually does</p>
          <h2 id="ai-heading" className="editorial-title mt-3 text-3xl font-bold sm:text-4xl">
            In plain English
          </h2>
        </Reveal>
        <Reveal delayMs={100}>
          <p className="mt-8 text-lg leading-relaxed text-muted-foreground">
            You photograph the site as you always have. instructBrain looks at every photo,
            describes what it sees in the language you'd use, decides how serious it is, and says
            what to do about it. It only describes conditions and hazards — never people.
          </p>
        </Reveal>
        <Reveal delayMs={200}>
          <p className="glass-panel editorial-title mt-8 rounded-2xl p-7 text-xl font-semibold leading-relaxed sm:text-2xl">
            When it can't tell — bad light, awkward angle — it says so rather than guessing. You
            review, correct anything wrong, and issue.
          </p>
        </Reveal>
        <Reveal delayMs={300}>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            <li className="glass-panel rounded-xl p-5">
              <p className="eyebrow">Trade attribution</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Suggested trades are suggestions, not assertions. A human confirms every assignment
                before anything is distributed.
              </p>
            </li>
            <li className="glass-panel rounded-xl p-5">
              <p className="eyebrow">Confidential findings</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Findings involving people are restricted to supervisors and above, and excluded
                from every subcontractor distribution at the database level.
              </p>
            </li>
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

const tiers = [
  {
    name: "Free",
    price: "£0",
    cadence: "",
    summary: "3 reports across Custom Reports, Project Reports and Compliance Registers. Up to 30 photos each.",
    points: ["No card required", "Every report template", "Issued PDF and share link"],
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
    points: ["Volume pricing", "Bespoke report templates", "Onboarding support"],
    cta: "Contact us",
    featured: false,
  },
];

function Pricing() {
  return (
    <section
      id="pricing"
      className="py-20 lg:py-28"
      aria-labelledby="pricing-heading"
    >
      <div className="shell-container">
        <Reveal>
          <p className="eyebrow">Pricing</p>
          <h2 id="pricing-heading" className="editorial-title mt-3 text-3xl font-bold sm:text-4xl">
            Priced in reports, not tokens
          </h2>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground">
            A report is one job, from upload to issued PDF — whether it is a Custom Report, a
            Project Report or a Weekly Compliance Register. Go over your photo allowance and you can
            buy overage per photo — no tier jump required.
          </p>
        </Reveal>

        <ul className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {tiers.map((tier, index) => (
            <Reveal key={tier.name} as="li" delayMs={index * 80}>
              <li
                className={
                  tier.featured
                    ? "glass-panel flex h-full flex-col rounded-2xl border-2 border-brand-accent p-6"
                    : "glass-panel flex h-full flex-col rounded-2xl p-6"
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
                      variant={tier.featured ? "glass-orange" : "outline"}
                      className="w-full"
                      asChild
                    >
                      <Link to="/auth/sign-up">{tier.cta}</Link>
                    </Button>
                  )}
                </div>
              </li>
            </Reveal>
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
      <Reveal>
        <div className="glass-panel rounded-2xl p-8 sm:p-12">
          <div className="max-w-2xl">
            <h2
              id="closing-heading"
              className="editorial-title text-3xl font-bold sm:text-4xl"
            >
              Your next report can be off your desk before the drive home.
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Three reports free. No card required. Custom Reports, Project Reports and Compliance
              Registers — bring the photographs you already have.
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
            <p className="mt-6 text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                to="/auth/sign-in"
                className="inline-flex min-h-11 items-center font-semibold text-brand-accent-ink underline underline-offset-4"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="glass-panel mt-8 border-x-0 border-b-0 py-12">
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
        © {new Date().getFullYear()} instructBrain. An instructSite company.
      </p>
    </footer>
  );
}
