import { useState } from "react";
import { ExternalLink } from "lucide-react";

import { PromoFilm } from "@/components/hub/promo-film";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import type { HubProduct } from "@/lib/hub/products";

/**
 * The recipient's view: what someone sees after a tile was shared with them.
 *
 * One route, two jobs - `/hub` is the launcher and `/hub?product=x` opens this.
 * Everything here is read-only marketing except the instructDABS notify-me
 * address, and even that sends nothing: there is no mail behind it yet, so the
 * copy does not promise one.
 */

/** The table the notify-me address lands in. Created by a migration. */
const EARLY_ACCESS_TABLE = "hub_early_access";

type SaveState = "idle" | "saving" | "saved" | "failed";

function EarlyAccessForm({ product }: { product: HubProduct }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<SaveState>("idle");

  return (
    <form
      className="mt-4 grid gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (state === "saving") return;
        const address = email.trim();
        if (!address) return;
        setState("saving");
        try {
          // `as never` because the generated types predate this table; the shape
          // is asserted here instead of in the call.
          const client = supabase as unknown as {
            from: (table: string) => {
              insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
            };
          };
          const { error } = await client
            .from(EARLY_ACCESS_TABLE)
            .insert({ email: address, product: product.id });
          if (error) {
            setState("failed");
            return;
          }
          setState("saved");
        } catch {
          setState("failed");
        }
      }}
    >
      <label className="text-xs font-semibold" htmlFor="hub-early-access-email">
        Your email address
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="hub-early-access-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.co.uk"
          className="min-h-12 min-w-0 flex-1 rounded-lg border border-border bg-transparent px-3 text-sm"
        />
        <Button type="submit" disabled={state === "saving"} className="min-h-12">
          {state === "saving" ? "Saving..." : "Tell me when it opens"}
        </Button>
      </div>

      {state === "saved" ? (
        <p className="hub-accent-text text-xs" role="status">
          Saved. We will be in touch when instructDABS opens - nothing else will be sent to that
          address in the meantime.
        </p>
      ) : null}
      {state === "failed" ? (
        <p className="text-xs text-destructive" role="alert">
          That address was not saved - something went wrong at our end. Please try again shortly, or
          say hello at instructbrain.com and we will add you by hand.
        </p>
      ) : null}
    </form>
  );
}

/** The recipient showcase, opened by `?product=<id>`. */
export function ProductShowcaseSheet({
  product,
  open,
  onOpenChange,
}: {
  product: HubProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!product) return null;
  const early = product.status === "early-access";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="hub max-h-[90dvh] overflow-y-auto rounded-t-2xl border-t"
        data-product={product.id}
        data-testid="hub-showcase"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="hub-wordmark hub-wordmark-lg">
            <span className="hub-wordmark-instruct">instruct</span>
            <span className="hub-wordmark-name">{product.name}</span>
          </SheetTitle>
          {early ? (
            <span className="hub-chip mt-2 self-start" data-testid="hub-showcase-early-access">
              Early access - launching soon
            </span>
          ) : null}
          <SheetDescription className="text-sm text-foreground/90">{product.tagline}</SheetDescription>
        </SheetHeader>

        <PromoFilm product={product} />

        <ul className="mt-5 grid gap-3">
          {product.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-3 text-sm leading-relaxed">
              <span
                aria-hidden="true"
                className="mt-2 size-1.5 flex-none rounded-full"
                style={{ backgroundColor: "var(--hub-accent)" }}
              />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>

        {product.cta ? (
          <div className="mt-6 grid gap-2">
            <Button asChild size="lg" className="min-h-12">
              <a href={product.cta.href}>{product.cta.label}</a>
            </Button>
            {product.cta.note ? (
              <p className="text-xs text-muted-foreground">{product.cta.note}</p>
            ) : null}
          </div>
        ) : null}

        {early ? <EarlyAccessForm product={product} /> : null}

        {!early ? (
          <div className="mt-6">
            <Button asChild variant="outline" className="min-h-12">
              <a href={product.domain} target="_blank" rel="noreferrer">
                Open {product.domain.replace("https://", "")}
                <ExternalLink className="size-4" aria-hidden="true" />
              </a>
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/** The in-person demo: the real promo film, full attention, portrait. */
export function PromoReelModal({
  product,
  open,
  onOpenChange,
}: {
  product: HubProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="hub w-[calc(100vw-2rem)] max-w-[420px] border-border p-4"
        data-product={product.id}
        data-testid="hub-promo-modal"
      >
        <DialogHeader>
          <DialogTitle className="hub-wordmark hub-wordmark-tile">
            <span className="hub-wordmark-instruct">instruct</span>
            <span className="hub-wordmark-name">{product.name}</span>
            <span className="sr-only">{product.label} promo film</span>
          </DialogTitle>
        </DialogHeader>
        <PromoFilm product={product} autoPlay />
      </DialogContent>
    </Dialog>
  );
}
