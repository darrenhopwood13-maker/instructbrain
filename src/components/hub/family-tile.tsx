import { Play, Share2 } from "lucide-react";

import type { HubProduct } from "@/lib/hub/products";

/**
 * One product row in the launcher.
 *
 * Two controls, deliberately separate rather than one nested inside the other:
 * the row shares the product, the round control runs the in-person demo. Two
 * buttons cannot be nested, and a play control inside a share button would be
 * unusable by touch anyway.
 *
 * The colours are not here. `data-product` selects the tile's accent pair from
 * `src/styles.css`; this file names no colour at all.
 */
export function FamilyTile({
  product,
  onShare,
  onDemo,
}: {
  product: HubProduct;
  onShare: (product: HubProduct) => void;
  onDemo: (product: HubProduct) => void;
}) {
  const demoLabel =
    product.demo === "reel"
      ? `Play the ${product.label} promo film`
      : `Open the ${product.label} overview`;

  return (
    <div className="hub-tile" data-product={product.id}>
      <button
        type="button"
        onClick={() => onShare(product)}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-lg text-left"
        aria-label={`Share ${product.label} - opens your device's share sheet with a message ready to send`}
      >
        <span className="hub-wordmark hub-wordmark-tile" aria-hidden="true">
          <span className="hub-wordmark-instruct">instruct</span>
          <span className="hub-wordmark-name">{product.name}</span>
        </span>
        <Share2 className="hub-accent-text ml-auto size-4 shrink-0 opacity-70" aria-hidden="true" />
      </button>

      {product.status === "early-access" ? (
        <span className="hub-chip" data-testid="hub-early-access">
          Early access
        </span>
      ) : null}

      <button
        type="button"
        onClick={() => onDemo(product)}
        className="hub-play"
        aria-label={demoLabel}
      >
        <Play className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
