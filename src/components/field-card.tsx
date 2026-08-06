import { useId, useState, type ReactNode } from "react";
import { Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * A single result field as its own raised console panel: an uppercase
 * letterspaced accent micro-label, then the content. Nothing here scrolls —
 * the preview clamps and the whole field pops out into a real dialog.
 *
 * Layout and presentation only; the caller owns the data and the editing.
 */
export function FieldCard({
  label,
  badge,
  previewLines = 4,
  children,
  popOut,
  popOutDescription,
  className,
  emphasis = "default",
}: {
  label: string;
  badge?: ReactNode;
  /** Lines shown inline before the field clamps. */
  previewLines?: number;
  /** The inline preview content. */
  children: ReactNode;
  /** Full content for the overlay. Falls back to the inline content. */
  popOut?: ReactNode;
  popOutDescription?: string;
  className?: string;
  emphasis?: "default" | "flag";
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "rounded-xl border bg-surface-sunken p-4 shadow-raised sm:p-5",
        emphasis === "flag" ? "border-flag/40" : "border-border",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h4 id={titleId} className="eyebrow">
          {label}
        </h4>
        {badge}
      </div>

      <div
        className="mt-2.5 overflow-hidden break-words text-sm leading-relaxed"
        style={{
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: previewLines,
        }}
      >
        {children}
      </div>

      <Button
        type="button"
        variant="quiet"
        className="mt-3 w-full min-h-11 justify-center sm:w-auto"
        onClick={() => setOpen(true)}
      >
        <Maximize2 aria-hidden="true" className="mr-1.5 size-4" />
        Open {label.toLowerCase()}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto rounded-t-2xl">
          <DialogHeader>
            <DialogTitle className="editorial-title">{label}</DialogTitle>
            <DialogDescription>
              {popOutDescription ?? "The complete text, at a comfortable reading size."}
            </DialogDescription>
          </DialogHeader>
          <div className="max-w-prose break-words text-base leading-relaxed">
            {popOut ?? children}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
