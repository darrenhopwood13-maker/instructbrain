import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";

import { FamilyTile } from "@/components/hub/family-tile";
import { ProductShowcaseSheet, PromoReelModal } from "@/components/hub/product-showcase-sheet";
import { ShareSheetModal } from "@/components/hub/share-sheet-modal";
import {
  HUB_PRODUCT_IDS,
  HUB_PRODUCTS,
  findHubProduct,
  type HubProduct,
  type HubProductId,
} from "@/lib/hub/products";
import { useInstallPrompt } from "@/lib/pwa/install";
import { absoluteUrl } from "@/lib/site-url";
import { HUB_THEME_COLOUR } from "@/lib/hub/theme";

/**
 * The Instruct family launcher.
 *
 * One URL, two jobs:
 *   /hub                     the launcher - four tiles, one screen, no scrolling
 *   /hub?product=<id>        a recipient landed here from a shared link, so the
 *                            showcase for that product opens over the launcher
 *
 * Public by design: a signed-out stranger must be able to open the shared link.
 * Nothing here touches a report, a permission, a distribution or any data -
 * the only write in the whole route is an email address, and only for the
 * product that has not launched.
 */

const HUB_TITLE = "The Instruct family - share any product in one tap";
const HUB_DESCRIPTION =
  "The Instruct family of construction products in one place: instructBrain, instructSite, instructSite Enterprise and instructDABS. Tap a product to send it to someone with a message ready to go.";

export const Route = createFileRoute("/hub")({
  head: ({ match }) => {
    const search = (match.search ?? {}) as { product?: unknown };
    const product = findHubProduct(search.product);
    const title = product ? `${product.label} - ${HUB_TITLE}` : HUB_TITLE;
    const description = product ? `${product.tagline} ${HUB_DESCRIPTION}` : HUB_DESCRIPTION;
    const url = absoluteUrl(product ? `/hub?product=${product.id}` : "/hub");

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary" },
        // Installable-to-a-home-screen metadata. Deliberately declared here
        // rather than in __root.tsx, which every other page shares.
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
        { name: "apple-mobile-web-app-title", content: "Instruct" },
        { name: "theme-color", content: HUB_THEME_COLOUR },
      ],
      links: [
        { rel: "canonical", href: absoluteUrl("/hub") },
        // The launcher's OWN manifest. The app-level one starts at /field, so
        // without this the home-screen icon for this page would open the field
        // camera app instead of the launcher, and be labelled "instructBrain"
        // rather than "Instruct".
        { rel: "manifest", href: "/manifest-hub.webmanifest" },
        // iOS ignores the manifest's icons when an apple-touch-icon is present,
        // and - like the manifest - it uses the FIRST one in the document. The
        // root used to declare the brain icon for every page, so this had to be
        // taken off the root for the launcher to get its own.
        { rel: "apple-touch-icon", href: "/icons/instruct-family-180.png" },
      ],
    };
  },
  validateSearch: (search: Record<string, unknown>): { product?: HubProductId } => {
    const value = search["product"];
    return typeof value === "string" && (HUB_PRODUCT_IDS as readonly string[]).includes(value)
      ? { product: value as HubProductId }
      : {};
  },
  component: InstructFamilyHub,
});

function InstructFamilyHub() {
  const navigate = useNavigate();
  const { product: productParam } = Route.useSearch();
  const openProduct = findHubProduct(productParam) ?? null;

  /** The send panel: that product's QR code, and the ways to send the link. */
  const [sendProduct, setSendProduct] = useState<HubProduct | null>(null);
  /** The in-person demo. */
  const [reelProduct, setReelProduct] = useState<HubProduct | null>(null);
  const [installDismissed, setInstallDismissed] = useState(false);

  const { canPrompt, needsManualSteps, handheld, install } = useInstallPrompt();
  const showInstallOffer = !installDismissed && handheld && (canPrompt || needsManualSteps);

  function showShowcase(id: HubProductId | null) {
    void navigate({ to: "/hub", search: id ? { product: id } : {} });
  }

  /**
   * Tap a tile to send it.
   *
   * Opens the send panel rather than jumping straight to the system share sheet:
   * the panel is where the QR code lives, and in person that is the faster
   * handover by far - the other person just points their camera at it. The
   * native sheet is the first action inside the panel, for sending at a
   * distance.
   */
  function handleShare(product: HubProduct) {
    setSendProduct(product);
  }

  function handleDemo(product: HubProduct) {
    if (product.demo === "reel") {
      setReelProduct(product);
      return;
    }
    showShowcase(product.id);
  }

  return (
    <div className="hub hub-viewport">
      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-2 px-3 py-2">
        <header className="flex items-center justify-between gap-3 px-1">
          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.22em] text-foreground/80">
            The Instruct family
          </p>
          <p className="text-[0.6875rem] text-foreground/60">Tap a product to send it</p>
        </header>

        {showInstallOffer ? (
          <div
            className="flex items-center gap-2 rounded-xl border border-border bg-surface-raised/60 px-3 py-2 text-xs"
            data-testid="hub-install-offer"
          >
            <p className="flex-1">
              {canPrompt
                ? "Add this to your home screen - one tap from your phone."
                : "Add this to your home screen: tap Share, then Add to Home Screen."}
            </p>
            {canPrompt ? (
              <button
                type="button"
                className="hub-chip"
                onClick={() => {
                  void install();
                }}
              >
                Add
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Dismiss the home screen suggestion"
              className="rounded p-1"
              onClick={() => setInstallDismissed(true)}
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <main
          className="grid flex-1 gap-2"
          style={{
            // `minmax(0, 1fr)` on BOTH axes is load-bearing. An implicit `auto`
            // column sizes itself to the widest item's min-content, and a
            // nowrap wordmark in a flex row has a large one - so the tiles grew
            // to 384px inside a 360px screen and the viewport's `overflow:
            // hidden` silently swallowed the overhang instead of scrolling.
            gridTemplateRows: "repeat(4, minmax(0, 1fr))",
            gridTemplateColumns: "minmax(0, 1fr)",
          }}
          data-testid="hub-tiles"
        >
          {HUB_PRODUCTS.map((product) => (
            <FamilyTile
              key={product.id}
              product={product}
              onShare={handleShare}
              onDemo={handleDemo}
            />
          ))}
        </main>
      </div>

      {/* Anyone can open /hub?product=..., including someone who never saw the
          launcher. The showcase is the page they landed on. */}
      <ProductShowcaseSheet
        product={openProduct}
        open={openProduct !== null}
        onOpenChange={(open) => {
          if (!open) showShowcase(null);
        }}
      />

      <ShareSheetModal
        product={sendProduct}
        open={sendProduct !== null}
        onOpenChange={(open) => {
          if (!open) setSendProduct(null);
        }}
      />

      <PromoReelModal
        product={reelProduct}
        open={reelProduct !== null}
        onOpenChange={(open) => {
          if (!open) setReelProduct(null);
        }}
      />
    </div>
  );
}
