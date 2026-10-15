import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Film, HelpCircle, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HELP_TOPICS, type HelpTopic } from "@/lib/help-content";

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
 *
 * The list draws a still from each clip and the clip loads when it is tapped.
 * Autoplaying thirteen videos inside one dialog is what stopped this working on
 * a phone: a handset decodes a small number of videos at once, so most of them
 * never started, and a tap did nothing because tapping was wired to nothing.
 */
export function HelpSheet() {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [watching, setWatching] = useState<HelpTopic | null>(null);

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

  /** Closing the sheet puts the list back, so it never reopens mid-clip. */
  const onChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setWatching(null);
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

      <Dialog open={open} onOpenChange={onChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{watching ? watching.title : "Help"}</DialogTitle>
            <DialogDescription>
              {watching
                ? watching.caption
                : "Short clips, one per task, each with a voice-over. Tap to watch."}
            </DialogDescription>
          </DialogHeader>

          {watching ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setWatching(null)}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                All clips
              </button>
              <video
                key={watching.id}
                src={watching.clipUrl ?? undefined}
                poster={watching.posterUrl ?? undefined}
                controls
                autoPlay
                playsInline
                preload="auto"
                className="mx-auto block max-h-[58dvh] w-auto max-w-full rounded-xl bg-black"
              />
              <a
                href={watching.clipUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-accent-ink underline"
              >
                Open this clip in a new tab
              </a>
            </div>
          ) : (
            <ul className="space-y-3">
              {HELP_TOPICS.map((topic) => (
                <li key={topic.id}>
                  <button
                    type="button"
                    onClick={() => setWatching(topic)}
                    disabled={!topic.clipUrl}
                    className="flex w-full min-h-11 items-center gap-3 rounded-xl border border-border bg-surface-raised p-3 text-left transition-colors hover:bg-surface-sunken disabled:opacity-70"
                  >
                    <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-sunken">
                      {topic.posterUrl ? (
                        <img
                          src={topic.posterUrl}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      ) : (
                        <Film aria-hidden="true" className="size-6 text-muted-foreground" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{topic.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {topic.clipUrl ? topic.caption : "Clip coming soon"}
                      </span>
                    </span>
                    {topic.clipUrl ? (
                      <span className="shrink-0 text-xs font-semibold text-brand-accent-ink">
                        Play
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
