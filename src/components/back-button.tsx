import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

/**
 * One small way back, in the header of every signed-in screen.
 *
 * The app used to answer "how do I get out of here" with a full-width destination
 * button at the bottom of the field cockpit, which is a second navigation system
 * dressed as an action and lands on a signpost rather than the place you came
 * from. A back control is the thing a phone user already reaches for, and it
 * belongs in the same corner on every screen so it never has to be hunted for.
 *
 * A phone launched from the home screen can have no history at all, so when
 * there is nothing behind us the button goes to `fallback` instead of doing
 * nothing at all.
 */
export function BackButton({
  fallback = "/reports",
  label = "Go back",
}: {
  fallback?: "/reports" | "/map";
  label?: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        if (router.history.canGoBack()) {
          router.history.back();
          return;
        }
        void router.navigate({ to: fallback });
      }}
      className="flex size-8 shrink-0 items-center justify-center rounded-full sm:size-9 border border-border bg-surface-raised text-foreground transition-colors hover:border-brand-accent hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
    </button>
  );
}
