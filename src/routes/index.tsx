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

// Redeploy trigger (no-op): Lovable rebuilds with Supabase envs on push.
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
        <StatsStrip />
        <FireRegister />
        <RoiSection />
        <UseCases />
        <TrustStrip />
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
            className="ib-btn-minline"
          >
            Sign in
          </Link>
          <Link
            to="/auth/sign-up"
            className="ib-btn-3d sm"
          >
            <span className="sm:hidden">Start</span>
            <span className="hidden sm:inline">Start free</span>
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="shell-container hero-blueprint hero-topo pb-12 pt-8 lg:pb-20 lg:pt-12">
      <style>{`
        /* Split Action button — primary CTA */
        .ib-btn-split { display:inline-flex; align-items:stretch; border-radius:10px; overflow:hidden; background:#fff; border:1.5px solid #1a1a2e; box-shadow:0 3px 0 rgba(26,26,46,.18); text-decoration:none; }
        .ib-btn-split .txt { padding:13px 18px 13px 22px; display:inline-flex; align-items:center; gap:9px; color:#1a1a2e; font-weight:600; font-size:15px; }
        .ib-btn-split .arrow { background:#ff7b00; color:#fff; padding:0 18px; display:flex; align-items:center; transition:background .15s; }
        .ib-btn-split:hover .arrow { background:#e56f00; }
        .ib-btn-split:hover { box-shadow:0 4px 0 rgba(26,26,46,.22); }
        /* Minimal Line button — secondary */
        .ib-btn-minline { display:inline-flex; align-items:center; gap:9px; padding:12px 20px; border-radius:9px; border:1.5px solid rgba(26,26,46,.45); background:transparent; color:#1a1a2e; font-weight:600; font-size:15px; text-decoration:none; transition:background .15s; }
        .ib-btn-minline.orange { color:#d16600; border-color:rgba(255,123,0,.55); }
        .ib-btn-minline:hover { background:rgba(26,26,46,.05); }
        /* Blueprint grid backdrop */
        .hero-blueprint { position:relative; }
        .hero-blueprint::before { content:""; position:absolute; inset:0; background-image: linear-gradient(rgba(43,75,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(43,75,255,.06) 1px, transparent 1px); background-size:38px 38px; pointer-events:none; }
        /* 3D Element buttons live in styles.css (.ib-btn-3d) — shared with the
           dashboard's three feature buttons so both get the same treatment. */
        .cta-deck { background: rgba(43,75,255,.07); border:1px solid rgba(43,75,255,.22); border-radius:22px; padding:30px 26px 26px; box-shadow:0 10px 34px rgba(43,75,255,.12); }
        /* hero z-order so the 3D objects sit above the deck edge */
        .cta-deck > * { position:relative; z-index:1; }
        .cta-deck::before { content:""; position:absolute; inset:0; border-radius:22px; background:radial-gradient(500px 160px at 85% 0%, rgba(255,123,0,.12), transparent 60%); pointer-events:none; }
        .hero-topo::after { content:""; position:absolute; right:-70px; top:-70px; width:380px; height:380px; background: radial-gradient(circle at 30% 30%, rgba(43,75,255,.12), transparent 60%), radial-gradient(circle at 70% 70%, rgba(255,123,0,.08), transparent 55%), repeating-radial-gradient(circle at 30% 30%, transparent 0 30px, rgba(43,75,255,.05) 30px 32px); border-radius:50%; pointer-events:none; }
        .hero-topo > * { position:relative; z-index:1; }
      `}</style>
      <div className="land-hero-grid">
        <div>
          <p className="wordmark whitespace-nowrap text-[clamp(2rem,6.5vw,5rem)] leading-none">
            <span className="text-brand-accent">instruct</span>
            <span className="text-foreground">Brain</span>
          </p>
          <p className="mt-3 text-lg font-light leading-snug text-foreground/90 sm:text-xl">
            Photos in. Client-ready reports out.
          </p>
          <h1 className="editorial-title mt-4 text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
            Walk the site. Issue the same afternoon.
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/85 sm:text-lg">
            Point, shoot, done. instructBrain turns your site photos into a referenced
            construction report — with the proof and the dates regulators ask for.
          </p>
        </div>
        <ConsoleMock />
      </div>

      <div className="rule-top mt-10 max-w-4xl pt-8">
        <span className="eyebrow">Pick what you're making</span>

        <div className="cta-deck mt-10 max-w-4xl">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Link to="/auth/sign-up" className="ib-btn-3d">
              <ClipboardList aria-hidden="true" />
              Create custom report
              <span className="obj">
                <ArrowRight aria-hidden="true" />
                <img src="/3d/hard-hat-t.png" alt="3D hard hat" />
              </span>
            </Link>
            <Link to="/auth/sign-up" className="ib-btn-3d orange">
              <FileText aria-hidden="true" />
              Create project report
              <span className="obj">
                <ArrowRight aria-hidden="true" />
                <img src="/3d/blueprints-t.png" alt="3D blueprints" />
              </span>
            </Link>
            <Link to="/auth/sign-up" className="ib-btn-3d">
              <ShieldCheck aria-hidden="true" />
              Create compliance register
              <span className="obj">
                <ArrowRight aria-hidden="true" />
                <img src="/3d/clipboard-t.png" alt="3D clipboard" />
              </span>
            </Link>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Free for your first 3 reports. No card required.
          </p>
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
      className="relative mt-5 h-12 text-sm font-medium text-brand-accent-ink sm:h-5"
    >
      {SLOGANS.map((text, index) => (
        <span
          key={text}
          className="ib-slogan absolute left-0 top-0 block w-full opacity-0"
          style={{
            animation: "ib-slogan 16s linear infinite",
            animationDelay: `${index * 4}s`,
            animationFillMode: "forwards",
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
    <section className="py-12 lg:py-16" aria-labelledby="roi-heading">
      <div className="shell-container">
        <Reveal>
          <p className="eyebrow">What it gives you back</p>
          <h2 id="roi-heading" className="editorial-title mt-3 text-3xl font-bold sm:text-4xl">
            The write-up gap, in numbers.
          </h2>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground">
            The write-up is the expensive part of a survey, a snagging list or a compliance register,
            and it happens after hours. This is what it costs you now, and what it costs with
            instructBrain.
          </p>
        </Reveal>
        <div className="glass-panel mt-8 rounded-2xl p-6 sm:p-8">
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
    line: "One-off inspections, specialist audits, batch photo reviews — issued from a template, not a blank page.",
  },
  {
    icon: FileText,
    title: "Project Reports",
    line: "Site walks, snagging, weatherproofing — referenced findings, suggested trades, per-trade extracts.",
  },
  {
    icon: ClipboardCheck,
    title: "Weekly Compliance Registers",
    line: "Six checks, prepopulated, locked when complete, six-week history at a glance.",
  },
  {
    icon: Languages,
    title: "Issue in another language",
    line: "Issue the PDF and shared links in the client's language while English stays the record copy.",
  },
];

function UseCases() {
  return (
    <section className="shell-container py-12 lg:py-16" aria-labelledby="cases-heading">
      <Reveal>
        <p className="eyebrow">Where it earns its keep</p>
        <h2 id="cases-heading" className="editorial-title mt-3 text-3xl font-bold sm:text-4xl">
          Built for what you actually do on site
        </h2>
      </Reveal>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {useCases.map((item, index) => (
          <Reveal
            key={item.title}
            as="li"
            delayMs={index * 80}
            className="glass-panel flex h-full flex-col rounded-2xl p-5"
          >
            <item.icon aria-hidden="true" className="size-6 text-brand-accent-ink" />
            <h3 className="editorial-title mt-4 text-lg font-semibold leading-snug">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.line}</p>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

function ConsoleMock() {
  return (
    <div className="land-console">
      <div className="topbar">
        <span className="wordmark">
          <span className="i">instruct</span>
          <span className="b">Brain</span>
        </span>
        <span>Site walk · ALM-2026-0142</span>
      </div>
      <div className="photostrip">
        <img src="/demo/photo-1.jpg" alt="" />
        <img src="/demo/photo-2.jpg" alt="" />
        <img src="/demo/photo-5.jpg" alt="" />
      </div>
      <div className="panel">
        <div className="rhead">
          <strong>Findings</strong>
          <span>3 flagged</span>
        </div>
        <div className="f">
          <span className="chip pass">Pass</span>
          <span className="f-text">F-001 Sealant — perimeter</span>
        </div>
        <div className="f">
          <span className="chip warn">Warn</span>
          <span className="f-text">F-002 Ponding — valley gutter</span>
        </div>
        <div className="f">
          <span className="chip na">Not assessed</span>
          <span className="f-text">F-003 Cavity tray — human review</span>
        </div>
      </div>
      <div className="dock">
        <span className="mini-btn solid">Issue report</span>
        <span className="mini-btn">Preview</span>
        <span className="mini-btn">Share</span>
      </div>
    </div>
  );
}

const STATS = [
  { num: "150", suffix: "+", label: "inspections issued" },
  { num: "2", suffix: " min", label: "to first AI draft" },
  { num: "17", suffix: "", label: "trades covered" },
  { num: "25", suffix: " min", label: "report turnaround" },
];

function StatsStrip() {
  return (
    <section className="py-12 lg:py-16" aria-label="instructBrain by the numbers">
      <div className="shell-container">
        <div className="land-stats">
          {STATS.map((s) => (
            <div key={s.label} className="land-stat">
              <div className="num">
                {s.num}
                <em>{s.suffix}</em>
              </div>
              <div className="lab">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const QUOTES = [
  {
    img: "/demo/photo-4.jpg",
    text: "\u201CWeek 3 flagged a point missing two extinguishers. Week 4, replaced — photographed, dated, done.\u201D",
    who: "Fire register · 6-week cycle",
  },
  {
    img: "/demo/photo-5.jpg",
    text: "\u201CThe AI never guesses. If it can't tell, it says so — and the report blocks until a human looks.\u201D",
    who: "Not-assessed invariant · every report",
  },
  {
    img: "/demo/photo-2.jpg",
    text: "\u201COne walk, four reports, issued before lunch. That's the whole pitch.\u201D",
    who: "Site walk → custom report",
  },
];

function TrustStrip() {
  return (
    <section className="py-14 lg:py-20" aria-labelledby="trust-heading">
      <div className="shell-container">
        <p className="eyebrow">From the field</p>
        <h2 id="trust-heading" className="editorial-title mt-3 text-3xl font-bold sm:text-4xl">
          Real sites. Real photos. Real proof.
        </h2>
        <figure className="glass-panel mt-8 rounded-2xl p-6 sm:p-10">
          <blockquote className="text-lg leading-relaxed text-foreground/90 sm:text-xl">
            &ldquo;Honestly, I used to dread the monthly condition and weatherproofing reports —
            they&rsquo;d take me 2 or 3 days, and they have to be bang on, because they go to the
            client team and the insurers. With instructBrain, I snap the photos, review the AI
            findings, and issue. That&rsquo;s literally it. A client-ready report in minutes.&rdquo;
          </blockquote>
          <figcaption className="mt-5">
            <span className="eyebrow">Senior Site Manager · Tier 1 contractor · London</span>
          </figcaption>
        </figure>
        <div className="land-trust mt-8">
          {QUOTES.map((q) => (
            <figure key={q.who} className="land-quote">
              <img src={q.img} alt="" />
              <figcaption className="body">
                <p>{q.text}</p>
                <div className="who">{q.who}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
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
      className="py-12 lg:py-16"
      aria-labelledby="how-heading"
    >
      <div className="shell-container">
        <Reveal>
          <p className="eyebrow">How it works</p>
          <h2 id="how-heading" className="editorial-title mt-3 text-3xl font-bold sm:text-4xl">
            Three steps, start to issued
          </h2>
        </Reveal>
        <ol className="mt-8 grid gap-6 lg:grid-cols-3">
          {steps.map((step, index) => (
            <Reveal
              key={step.title}
              as="li"
              delayMs={index * 100}
              className="glass-panel rounded-2xl p-6 sm:p-7"
            >
              <span className="eyebrow">Step {index + 1}</span>
              <div className="mt-4 flex items-center gap-3">
                <step.icon aria-hidden="true" className="size-5 text-brand-accent-ink" />
                <h3 className="editorial-title text-xl font-semibold">{step.title}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** The six-check fire register — the product's recurring-revenue proof,
 * placed low on the page so the compliance band leads. */
function FireRegister() {
  return (
    <section className="shell-container py-12 lg:py-16" aria-labelledby="fire-register-heading">
      <Reveal>
        <p className="eyebrow">The weekly register</p>
        <h2 id="fire-register-heading" className="editorial-title mt-3 text-3xl font-bold sm:text-4xl">
          Six checks, every week
        </h2>
      </Reveal>
      <div className="mt-8 max-w-3xl">
        <ComplianceTicker />
      </div>
    </section>
  );
}

function PlainEnglish() {
  return (
    <section className="shell-container py-12 lg:py-16" aria-labelledby="ai-heading">
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
      className="py-12 lg:py-16"
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

        <ul className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {tiers.map((tier, index) => (
            <Reveal
              key={tier.name}
              as="li"
              delayMs={index * 80}
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
