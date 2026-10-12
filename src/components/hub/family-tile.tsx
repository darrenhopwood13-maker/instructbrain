import { ArrowUpRight, Play, Share2 } from "lucide-react";

import type { HubProduct } from "@/lib/hub/products";

/**
 * One product tile in the launcher.
 *
 * Three things, kept apart rather than nested inside one another: the row
 * shares the product (the QR code and the ways to send it), the round control
 * plays the product's promo film or opens its overview, and the button beneath
 * opens the product itself.
 *
 * The button is the way IN, and it is a labelled button rather than a glyph:
 * "Open dashboard" says what it does. Until 12 Oct 2026 the row and the round
 * control were the whole tile, so the launcher - the thing that gets installed
 * to a home screen - could send a product to somebody else all day and never get
 * its owner into the app. Dal reported exactly that.
 *
 * The button sits on its own line, not in the row, because the row cannot hold
 * its wordmark plus a second control at 320px without clipping the product name.
 * On its own line it costs no width at all.
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
      <div className="hub-tile-row">
        <button
          type="button"
          onClick={() => onShare(product)}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-lg text-left"
          aria-label={`Send ${product.label} - show a QR code to scan, or share the link`}
        >
          <span className="hub-wordmark hub-wordmark-tile" aria-hidden="true">
            <span className="hub-wordmark-instruct">instruct</span>
            <span className="hub-wordmark-name">{product.name}</span>
          </span>
          <Share2 className="hub-accent-text ml-auto size-4 shrink-0 opacity-70" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => onDemo(product)}
          className="hub-play"
          aria-label={demoLabel}
        >
          <Play className="size-4" aria-hidden="true" />
        </button>
      </div>

      {product.open ? (
        <a
          href={product.open.href}
          className="hub-open-button"
          {...(product.open.external ? { target: "_blank", rel: "noreferrer" } : {})}
        >
          {product.open.label}
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </a>
      ) : null}

      {/* The status chip belongs to the TILE, not to the wordmark row. In the
          row it competed with "instructDABS" for the same width and clipped the
          product name clean off; pinned to the tile's own bottom-left corner it
          has room and the wordmark keeps the full row. */}
      {product.status === "early-access" ? (
        <span className="hub-chip hub-chip-tile" data-testid="hub-early-access">
          Early access
        </span>
      ) : null}
    </div>
  );
}
