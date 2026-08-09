import { useState } from "react";
import { Film, HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HELP_TOPICS } from "@/lib/help-content";

/**
 * A persistent, thumb-reachable way into short how-to clips — the
 * replacement for explanatory paragraphs elsewhere in the app. Sits above the
 * mobile bottom nav so it never overlaps it, and never sits in a top corner.
 */
export function HelpSheet() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Help"
        className="glass-orange fixed bottom-20 right-4 z-30 flex size-14 items-center justify-center rounded-full shadow-raised sm:bottom-6"
      >
        <HelpCircle aria-hidden="true" className="size-6" />
      </button>

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
