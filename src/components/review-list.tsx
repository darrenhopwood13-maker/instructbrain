import { useCallback, useEffect, useRef, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { findings as seedFindings, statusLabels, type FindingStatus } from "@/lib/mock-data";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

const keyToStatus: Record<string, FindingStatus> = {
  p: "pass",
  f: "fail",
  a: "warn",
  r: "flag",
};

/**
 * Keyboard-first review list. j/k move, 1..n jump, p/f/a/r set status,
 * Enter confirms. Designed so a 150-item session never needs a mouse.
 */
export function ReviewList() {
  const [items, setItems] = useState(seedFindings);
  const [active, setActive] = useState(0);
  const rowRefs = useRef<Array<HTMLLIElement | null>>([]);

  const setStatus = useCallback((index: number, status: FindingStatus) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, status, confirmed: true } : item)),
    );
    toast.success(`Marked ${statusLabels[status]}`, {
      description: "Finding confirmed and added to the report.",
    });
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    const key = event.key.toLowerCase();
    if (key === "j" || event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (key === "k" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (key === "enter") {
      event.preventDefault();
      setItems((prev) =>
        prev.map((item, i) => (i === active ? { ...item, confirmed: true } : item)),
      );
      toast.success("Finding confirmed");
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (keyToStatus[key]) {
      event.preventDefault();
      setStatus(active, keyToStatus[key]);
    }
  };

  useEffect(() => {
    rowRefs.current[active]?.focus();
  }, [active]);

  const confirmed = items.filter((i) => i.confirmed).length;

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-border bg-surface-raised p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {confirmed} of {items.length} findings confirmed
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Review each AI-drafted finding before the report can be issued.
          </p>
        </div>
        <Button variant="brand" className="shrink-0" disabled={confirmed !== items.length}>
          Confirm all
        </Button>
      </div>

      <div
        role="note"
        className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-surface-sunken px-4 py-3 text-xs text-muted-foreground"
      >
        <span className="font-semibold uppercase tracking-[0.12em]">Keyboard</span>
        <span>
          <span className="kbd-hint">J</span> <span className="kbd-hint">K</span> move
        </span>
        <span>
          <span className="kbd-hint">P</span> pass
        </span>
        <span>
          <span className="kbd-hint">F</span> fail
        </span>
        <span>
          <span className="kbd-hint">A</span> advisory
        </span>
        <span>
          <span className="kbd-hint">R</span> flag
        </span>
        <span>
          <span className="kbd-hint">↵</span> confirm
        </span>
      </div>

      <ul
        aria-label="Findings for review"
        className="mt-4 space-y-2"
        onKeyDown={onKeyDown}
      >
        {items.map((item, index) => (
          <li
            key={item.id}
            ref={(el) => {
              rowRefs.current[index] = el;
            }}
            tabIndex={index === active ? 0 : -1}
            aria-current={index === active ? "true" : undefined}
            onFocus={() => setActive(index)}
            className={cn(
              "rounded-xl border bg-surface-raised p-4 outline-none transition-colors",
              index === active
                ? "border-brand-purple ring-2 ring-brand-purple/30"
                : "border-border hover:border-border-strong",
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow">{item.ref}</span>
              {item.aiDrafted ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-brand-purple/25 bg-brand-purple-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-brand-purple-ink">
                  <Sparkles aria-hidden="true" className="size-3" />
                  AI drafted
                </span>
              ) : null}
              <span className="ml-auto">
                <StatusPill status={item.status} />
              </span>
            </div>
            <p className="mt-2 font-semibold leading-snug">{item.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.location} · {item.trade}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">{item.note}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(Object.keys(keyToStatus) as Array<keyof typeof keyToStatus>).map((key) => (
                <Button
                  key={key}
                  size="sm"
                  variant="quiet"
                  onClick={() => setStatus(index, keyToStatus[key])}
                >
                  {statusLabels[keyToStatus[key]]}
                </Button>
              ))}
              <span className="ml-auto text-xs font-medium text-muted-foreground">
                {item.confirmed ? "Confirmed by reviewer" : "Awaiting confirmation"}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
