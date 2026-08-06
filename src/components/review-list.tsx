import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { findings as seedFindings, type Finding } from "@/lib/mock-data";
import {
  NOT_ASSESSED_ID,
  resolveStatus,
  reviewShortcuts,
  type StatusDefinition,
  type SurveyTypeSnapshot,
} from "@/lib/survey-types";
import { AlertTriangle, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";

/**
 * Keyboard-first review list. j/k move, per-status shortcut keys set status,
 * Enter confirms. Designed so a 150-item session never needs a mouse.
 *
 * Statuses come entirely from the report's survey type snapshot — no status id
 * is hardcoded here except `not_assessed`, which is an engine-level concept.
 */
export function ReviewList({
  snapshot,
  initialFindings = seedFindings,
}: {
  snapshot: SurveyTypeSnapshot;
  initialFindings?: Finding[];
}) {
  const shortcuts = useMemo(() => reviewShortcuts(snapshot), [snapshot]);
  const keyToStatus = useMemo(() => {
    const map = new Map<string, StatusDefinition>();
    for (const { key, status } of shortcuts) if (key) map.set(key, status);
    return map;
  }, [shortcuts]);

  // Unresolved `not_assessed` items sort to the top of the queue.
  const [items, setItems] = useState<Finding[]>(() =>
    [...initialFindings].sort((a, b) => {
      const aBlocked = resolveStatus(snapshot, a.status).id === NOT_ASSESSED_ID ? 0 : 1;
      const bBlocked = resolveStatus(snapshot, b.status).id === NOT_ASSESSED_ID ? 0 : 1;
      return aBlocked - bBlocked;
    }),
  );
  const [active, setActive] = useState(0);
  const rowRefs = useRef<Array<HTMLLIElement | null>>([]);

  const setStatus = useCallback(
    (index: number, status: StatusDefinition) => {
      setItems((prev) =>
        prev.map((item, i) =>
          i === index
            ? {
                ...item,
                status: status.id,
                confirmed: status.id !== NOT_ASSESSED_ID,
              }
            : item,
        ),
      );
      toast.success(`Marked ${status.label}`, {
        description:
          status.id === NOT_ASSESSED_ID
            ? "This finding still blocks export until it is resolved."
            : "Finding confirmed and added to the report.",
      });
    },
    [],
  );

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
      const current = items[active];
      if (current && resolveStatus(snapshot, current.status).id === NOT_ASSESSED_ID) {
        toast.error("Not assessed items cannot be confirmed", {
          description: "Choose a status from the survey type before confirming.",
        });
        return;
      }
      setItems((prev) =>
        prev.map((item, i) => (i === active ? { ...item, confirmed: true } : item)),
      );
      toast.success("Finding confirmed");
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else {
      const mapped = keyToStatus.get(key);
      if (mapped) {
        event.preventDefault();
        setStatus(active, mapped);
      }
    }
  };

  useEffect(() => {
    rowRefs.current[active]?.focus();
  }, [active]);

  const resolved = items.map((item) => resolveStatus(snapshot, item.status));
  const notAssessedCount = resolved.filter((status) => status.id === NOT_ASSESSED_ID).length;
  const unconfirmed = items.filter(
    (item, i) => !item.confirmed || resolved[i]?.id === NOT_ASSESSED_ID,
  ).length;
  const confirmed = items.length - unconfirmed;

  const firstNotAssessed = resolved.findIndex((status) => status.id === NOT_ASSESSED_ID);

  const confirmAll = () => {
    if (notAssessedCount > 0) {
      toast.error("Resolve not assessed findings first", {
        description: `${notAssessedCount} finding${notAssessedCount === 1 ? "" : "s"} still need a human decision.`,
      });
      setActive(Math.max(firstNotAssessed, 0));
      return;
    }
    setItems((prev) => prev.map((item) => ({ ...item, confirmed: true })));
    toast.success("All findings confirmed");
  };

  return (
    <div>
      {notAssessedCount > 0 ? (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-flag/40 bg-flag-soft px-4 py-3"
        >
          <AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-flag" />
          <p className="min-w-0 text-sm font-semibold text-flag">
            Export blocked — {notAssessedCount} finding{notAssessedCount === 1 ? "" : "s"} not
            assessed
          </p>
          <Button
            size="sm"
            variant="quiet"
            className="ml-auto"
            onClick={() => setActive(Math.max(firstNotAssessed, 0))}
          >
            Go to first unresolved
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-border bg-surface-raised p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {confirmed} of {items.length} findings confirmed
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Review each AI-drafted finding before the report can be issued.
          </p>
        </div>
        <Button variant="brand" className="shrink-0" disabled={unconfirmed === 0} onClick={confirmAll}>
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
        {shortcuts
          .filter((shortcut) => shortcut.key)
          .map((shortcut) => (
            <span key={shortcut.status.id}>
              <span className="kbd-hint">{shortcut.key.toUpperCase()}</span>{" "}
              {shortcut.status.label.toLowerCase()}
            </span>
          ))}
        <span>
          <span className="kbd-hint">↵</span> confirm
        </span>
      </div>

      <ul aria-label="Findings for review" className="mt-4 space-y-2" onKeyDown={onKeyDown}>
        {items.map((item, index) => {
          const status = resolved[index] ?? resolveStatus(snapshot, item.status);
          const blocked = status.id === NOT_ASSESSED_ID;
          return (
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
                  : blocked
                    ? "border-flag/40"
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
                {item.isConfidential ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface-sunken px-2 py-0.5 text-[0.6875rem] font-semibold text-foreground">
                    <Lock aria-hidden="true" className="size-3" />
                    Restricted — supervisor and above
                  </span>
                ) : null}
                <span className="ml-auto">
                  <StatusPill status={status} />
                </span>
              </div>
              <p className="mt-2 font-semibold leading-snug">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {item.location} · {item.trade}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground/80">{item.note}</p>
              {blocked ? (
                <p className="mt-2 text-sm font-semibold text-flag">
                  Not assessed — blocks export until a person sets a status.
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {shortcuts
                  .filter(({ status: option }) => option.id !== NOT_ASSESSED_ID)
                  .map(({ status: option }) => (
                    <Button
                      key={option.id}
                      size="sm"
                      variant="quiet"
                      onClick={() => setStatus(index, option)}
                    >
                      {option.label}
                    </Button>
                  ))}
                <span className="ml-auto text-xs font-medium text-muted-foreground">
                  {item.confirmed && !blocked ? "Confirmed by reviewer" : "Awaiting confirmation"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
