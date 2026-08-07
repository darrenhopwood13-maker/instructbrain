import { createFileRoute, Link } from "@tanstack/react-router";

const TITLE = "Privacy — instructBrain";
const DESCRIPTION =
  "How instructBrain handles site photographs, report content and account data for UK construction reporting.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://instructbrain.lovable.app/privacy" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://instructbrain.lovable.app/privacy" }],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <main className="shell-container py-20">
      <p className="eyebrow">instructBrain</p>
      <h1 className="editorial-title mt-3 text-3xl font-bold sm:text-4xl">Privacy</h1>
      <div className="mt-8 max-w-2xl space-y-5 text-base leading-relaxed text-muted-foreground">
        <p>
          instructBrain stores the site photographs you upload, the findings drafted from them and
          the reports you issue. Photographs are held in private storage and are readable only by
          members of your organisation.
        </p>
        <p>
          Account data is limited to your email address, your organisation membership and your
          role. We do not sell data and we do not share your reports with anyone outside your
          organisation unless you issue or distribute them yourself.
        </p>
        <p>
          Photographs are sent to an AI provider for analysis so findings can be drafted. Findings
          involving a person are marked confidential and are excluded from every subcontractor
          distribution.
        </p>
        <p>
          To request a copy of your data or its deletion, email{" "}
          <a className="font-semibold text-brand-accent-ink" href="mailto:hello@instructsite.ai">
            hello@instructsite.ai
          </a>
          .
        </p>
      </div>
      <p className="mt-10">
        <Link to="/" className="font-semibold text-brand-accent-ink">
          Back to instructBrain
        </Link>
      </p>
    </main>
  );
}
