import { useCallback, useEffect, useState } from "react";
import { Film, HelpCircle, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HELP_TOPICS } from "@/lib/help-content";

/**
 * localStorage flag remembering that the user dismissed the floating help
 * button. Opening Help from the Account menu clears it again.
 */
const HELP_HIDDEN_KEY = "instructbrain.help.hidden";

/** Window event used by the Account menu to open Help without the button. */
export const OPEN_HELP_EVENT = "instructbrain:open-help";

/**
 * Thumb-reachable way into short how-to clips — the replacement for
 * explanatory paragraphs elsewhere in the app. Sits above the mobile bottom
 * nav so it never overlaps it, and never sits in a top corner.
 *
 * The button itself can be dismissed; the preference persists, and Help
 * remains reachable from the Account menu, which also restores the button.
 */
export function HelpSheet() {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setHidden(window.localStorage.getItem(HELP_HIDDEN_KEY) === "1");
    const onOpen = () => {
      window.localStorage.removeItem(HELP_HIDDEN_KEY);
      setHidden(false);
      setOpen(true);
    };
    window.addEventListener(OPEN_HELP_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_HELP_EVENT, onOpen);
  }, []);

  const dismiss = useCallback(() => {
    window.localStorage.setItem(HELP_HIDDEN_KEY, "1");
    setHidden(true);
  }, []);

  return (
    <>
      {hidden ? null : (
        <div className="fixed bottom-20 right-4 z-30 sm:bottom-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Help"
            className="glass-orange flex size-14 items-center justify-center rounded-full shadow-raised"
          >
            <HelpCircle aria-hidden="true" className="size-6" />
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Hide help button"
            className="absolute -right-1 -top-1 grid size-11 place-items-center rounded-full"
          >
            <span className="grid size-6 place-items-center rounded-full border border-border bg-surface-raised text-muted-foreground shadow-sm">
              <X aria-hidden="true" className="size-3.5" />
            </span>
          </button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Help</DialogTitle>
            <DialogDescription>Short, silent clips. One per task.</DialogDescription>
          </DialogHeader>

          <ul className="space-y-3">
            {HELP_TOPICS.map((topic) => (
              <li
                key={topic.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised p-3"
              >
                <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-sunken">
                  {topic.clipUrl ? (
                    <video
                      src={topic.clipUrl}
                      className="size-full object-cover"
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                  ) : (
                    <Film aria-hidden="true" className="size-6 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{topic.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {topic.clipUrl ? topic.caption : "Clip coming soon"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
