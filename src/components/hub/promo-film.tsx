import { useState } from "react";

import type { HubProduct } from "@/lib/hub/products";

/**
 * A product's own promo film, wherever that product keeps it.
 *
 * Each film belongs to the product it is about, so the URL comes from the
 * product's own data rather than a single constant: the launcher shows four
 * products and two of them now have a film, and a shared link must play the
 * film for the product the recipient actually opened.
 *
 * instructSite's film is served cross-origin from instructsite.ai, so it is the
 * one asset on this screen that can fail for a reason that is not a bug in the
 * hub. If it will not load, say where it does play rather than leaving a dead
 * player in front of a client.
 */
export function PromoFilm({
  product,
  autoPlay = false,
}: {
  product: HubProduct;
  autoPlay?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const film = product.film;

  // No film, no player. A product without one opens the showcase instead.
  if (!film) return null;

  if (failed) {
    return (
      <p
        className="mt-5 rounded-xl border border-border bg-surface-raised/60 p-3 text-xs text-muted-foreground"
        role="status"
        data-testid="hub-film-fallback"
      >
        {`The ${product.label} film would not load just now. It plays on ${film.source} - open ${product.domain.replace("https://", "")} to watch it there.`}
      </p>
    );
  }

  return (
    <div className="mt-5 w-full max-w-[380px]">
      <video
        src={film.url}
        controls
        autoPlay={autoPlay}
        playsInline
        preload="metadata"
        onError={() => setFailed(true)}
        className="aspect-[9/16] w-full rounded-2xl border bg-surface-sunken"
        aria-label={`${product.label} promo film, ${film.seconds} seconds`}
        data-testid="hub-film"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        {`${film.seconds} seconds, with sound. This is the same film as ${product.label}'s own promo page.`}
      </p>
    </div>
  );
}
