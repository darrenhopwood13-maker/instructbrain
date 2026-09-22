import { useState } from "react";
import { Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt, useStandalone } from "@/lib/pwa/install";

/**
 * A quiet, dismissible offer to put the field app on the phone's home screen.
 * Never shown once the app is already running from the home screen.
 */
export function InstallBar() {
  const standalone = useStandalone();
  const { canPrompt, needsManualSteps, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  if (standalone || dismissed || (!canPrompt && !needsManualSteps)) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-raised p-3 text-sm sm:hidden">
      <Smartphone aria-hidden="true" className="size-5 shrink-0 text-brand-accent-ink" />
      <p className="min-w-0 flex-1">
        {canPrompt
          ? "Add instructBrain to your home screen so it opens like an app."
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
