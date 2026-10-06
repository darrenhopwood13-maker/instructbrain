import { useState } from "react";
import { Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt, useStandalone } from "@/lib/pwa/install";

/**
 * A quiet, dismissible offer to put the field app on a phone or tablet's home
 * screen. Never shown once the app is already running from the home screen, and
 * never shown on a desktop, which has no home screen to add it to.
 */
export function InstallBar() {
  const standalone = useStandalone();
  const { canPrompt, needsManualSteps, platform, handheld, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  /**
   * `handheld` decides this, not the viewport width.
   *
   * The bar used to carry `sm:hidden`, which read as "phones only" but actually
   * meant "under 640px" - so a tablet on site, which has a perfectly good home
   * screen, was never offered it. Do not put a width cap back here: width is not
   * the question and a tablet at any size should get the offer.
   */
  if (standalone || dismissed || !handheld || (!canPrompt && !needsManualSteps)) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-raised p-3 text-sm">
      <Smartphone aria-hidden="true" className="size-5 shrink-0 text-brand-accent-ink" />
      <p className="min-w-0 flex-1">
        {canPrompt
          ? "Add instructBrain to your home screen so it opens like an app."
          : platform === "android"
            ? "Add to your home screen: open your browser menu and choose “Add to Home screen”."
            : "Add to your home screen: tap Share, then “Add to Home Screen”."}
      </p>
      {canPrompt ? (
        <Button type="button" variant="brand" size="sm" className="min-h-11" onClick={() => void install()}>
          Add to home screen
        </Button>
      ) : null}
      <button
        type="button"
        aria-label="Dismiss"
        className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground"
        onClick={() => setDismissed(true)}
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
