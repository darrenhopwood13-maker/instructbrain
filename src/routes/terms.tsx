import { createFileRoute, Link } from "@tanstack/react-router";

const TITLE = "Terms — instructBrain";
const DESCRIPTION =
  "The terms of use for instructBrain, including what a report is, professional responsibility and account use.";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://instructbrain.lovable.app/terms" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://instructbrain.lovable.app/terms" }],
  }),
  component: Terms,
});

function Terms() {
  return (
    <main className="shell-container py-20">
      <p className="eyebrow">instructBrain</p>
      <h1 className="editorial-title mt-3 text-3xl font-bold sm:text-4xl">Terms</h1>
      <div className="mt-8 max-w-2xl space-y-5 text-base leading-relaxed text-muted-foreground">
        <p>
          A report is one survey, from upload to issued PDF. Plan allowances are counted in
          reports; photographs beyond the allowance are charged as overage.
        </p>
        <p>
          instructBrain drafts findings for review. It does not certify, sign off or take
          professional responsibility for any assessment. The competent person issuing the document
          remains responsible for its content, and every finding must be reviewed before issue.
        </p>
        <p>
          Where the evidence does not support a judgement, a finding is marked not assessed and
          must be resolved by a person before the report can be issued. Trade attribution is a
          suggestion and is never sent to anyone without human confirmation.
        </p>
        <p>
          Accounts are for the named organisation. Do not upload material you are not entitled to
          share. We may suspend an account for misuse.
        </p>
        <p>
          Questions:{" "}
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
