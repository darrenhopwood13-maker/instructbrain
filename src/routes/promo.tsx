import { createFileRoute, Link } from "@tanstack/react-router";
import promoAsset from "@/assets/instructbrain-promo.asset.json";

const PROMO_URL = promoAsset.url;

export const Route = createFileRoute("/promo")({
  head: () => ({
    meta: [
      { title: "instructBrain in 30 seconds — watch the promo" },
      {
        name: "description",
        content:
          "Photos in. Client-ready reports out. Watch how instructBrain turns site photographs into issued UK construction reports in 30 seconds.",
      },
      { property: "og:title", content: "instructBrain in 30 seconds" },
      {
        property: "og:description",
        content:
          "Photos in. Client-ready reports out. Condition surveys, snagging, inventories and compliance — issued the same afternoon.",
      },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "player" },
    ],
  }),
  component: PromoPage,
});

function PromoPage() {
  return (
    <div className="console-surface flex min-h-dvh flex-col">
      <header className="border-b border-border bg-surface-raised/95 backdrop-blur">
        <div className="shell-container flex items-center gap-4 py-5">
          <Link to="/" className="mr-auto flex items-center gap-2.5 rounded-md">
            <span className="wordmark block text-lg leading-tight sm:text-xl">
              <span className="wordmark-instruct text-foreground">instruct</span>
              <span className="text-brand-accent">Brain</span>
            </span>
          </Link>
          <Link
            to="/"
            className="console-control inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium text-foreground transition-colors"
          >
            Back to instructBrain
          </Link>
        </div>
      </header>

      <main className="shell-container flex flex-1 flex-col items-center pb-20 pt-10">
        <p className="eyebrow">Watch</p>
        <h1 className="editorial-title mt-1 text-center text-2xl font-semibold sm:text-3xl">
          instructBrain in 30 seconds
        </h1>
        <p className="mt-2 max-w-xl text-center text-sm leading-relaxed text-muted-foreground">
          Photos in. Client-ready reports out — condition surveys, snagging, property inventories,
          manual photographic reports and weekly compliance, issued the same afternoon.
        </p>

        <div className="mt-8 w-full max-w-[420px]">
          <video
            src={PROMO_URL}
            controls
            playsInline
            preload="metadata"
            className="aspect-[9/16] w-full rounded-2xl border border-brand-accent/50 bg-surface-sunken shadow-2xl"
            aria-label="instructBrain 30-second product promo video"
          />
        </div>

        <p className="mt-8 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          instructBrain · An instructSite Company
        </p>
      </main>
    </div>
  );
}
