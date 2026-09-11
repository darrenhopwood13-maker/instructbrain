import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import { FieldCard } from "@/components/field-card";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Finding } from "@/lib/types";
import {
  NOT_ASSESSED_ID,
  definesField,
  derivedFieldsOf,
  regulatoryReferencesOf,
  resolveCategory,
  resolveSeverity,
  resolveStatus,
  requiresTradeAssignment,
  reviewShortcuts,
  type StatusDefinition,
  type SurveyTypeSnapshot,
} from "@/lib/survey-types";
import {
  TradeAssignmentCard,
  type TradeAssignment,
} from "@/components/review/trade-assignment-card";
import { AlertTriangle, Keyboard, Lock, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { itemLabel } from "@/lib/item-label";
import { isMinimalBriefTemplate } from "@/lib/report/brief";
import { listPhotos, signedThumbnailUrls } from "@/lib/photos/photo-service";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Keyboard-first review list. j/k move, per-status shortcut keys set status,
 * Enter confirms. Designed so a 150-item session never needs a mouse.
 *
 * Statuses come entirely from the report's survey type snapshot — no status id
 * is hardcoded here except `not_assessed`, which is an engine-level concept.
 */
export type ConfirmPatch = {
  status?: string;
  confirmed_at?: string | null;
  confirmed_by?: string | null;
};

export function ReviewList({
  snapshot,
  findings,
  reportId,
  onConfirm,
  onConfirmMany,
  tradeOptions = [],
  onAssignTrade,
  onAddTradeToDirectory,
}: {
  snapshot: SurveyTypeSnapshot;
  findings: Finding[];
  /** Enables the photograph shown above the finding being reviewed. */
  reportId?: string;
  /** Persists one confirmation action. Rejects if the write failed. */
  onConfirm?: (findingId: string, patch: ConfirmPatch) => Promise<void>;
  /** Persists the same patch across many findings in one batch. */
  onConfirmMany?: (findingIds: string[], patch: ConfirmPatch) => Promise<void>;
  /** Trades from this project's directory plus the definition's defaults. */
  tradeOptions?: string[];
  /** Persists a human's trade decision and its derived target date. */
  onAssignTrade?: (findingId: string, assignment: TradeAssignment) => Promise<void>;
  onAddTradeToDirectory?: (trade: string) => void;
}) {
  const shortcuts = useMemo(() => reviewShortcuts(snapshot), [snapshot]);
  const keyToStatus = useMemo(() => {
    const map = new Map<string, StatusDefinition>();
    for (const { key, status } of shortcuts) if (key) map.set(key, status);
    return map;
  }, [shortcuts]);

  /**
   * Local state holds only optimistic overlays and locally edited draft text.
   * Everything the counters read comes from `findings`, which is the saved
   * database state — a confirmation that failed to persist rolls its overlay
   * back and can never be counted as confirmed.
   */
  const [overrides, setOverrides] = useState<Record<string, Partial<Finding>>>({});
  const [active, setActive] = useState(0);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const rowRefs = useRef<Array<HTMLLIElement | null>>([]);
  // Stable review order: unresolved `not_assessed` items sort to the top when
  // first seen, and nothing reorders underneath the reviewer afterwards.
  const orderRef = useRef<string[]>([]);

  const items = useMemo(() => {
    const merged = findings.map((finding) => ({ ...finding, ...(overrides[finding.id] ?? {}) }));
    const known = new Set(orderRef.current);
    const newcomers = merged
      .filter((item) => !known.has(item.id))
      .sort((a, b) => {
        const aBlocked = resolveStatus(snapshot, a.status).id === NOT_ASSESSED_ID ? 0 : 1;
        const bBlocked = resolveStatus(snapshot, b.status).id === NOT_ASSESSED_ID ? 0 : 1;
        return aBlocked - bBlocked;
      });
    if (newcomers.length > 0) {
      orderRef.current = [...orderRef.current, ...newcomers.map((item) => item.id)];
    }
    const position = new Map(orderRef.current.map((id, index) => [id, index]));
    return [...merged].sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
  }, [findings, overrides, snapshot]);

  /**
   * One photograph at a time. The reviewer sees the picture, clears the
   * findings on it, and moves on — rather than scrolling a wall of cards.
   */
  const [photoUrl, setPhotoUrl] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!reportId) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listPhotos(reportId);
        const urls = await signedThumbnailUrls(rows);
        if (!cancelled) setPhotoUrl(new Map(Object.entries(urls)));
      } catch {
        // A missing photograph must never block the review itself.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  /** Review order grouped by photograph, keeping the stable finding order. */
  const groups = useMemo(() => {
    const order: string[] = [];
    const byPhoto = new Map<string, string[]>();
    for (const item of items) {
      const key = item.photoIds?.[0] ?? "none";
      if (!byPhoto.has(key)) {
        byPhoto.set(key, []);
        order.push(key);
      }
      byPhoto.get(key)!.push(item.id);
    }
    return order.map((key) => ({ photoId: key, findingIds: byPhoto.get(key) ?? [] }));
  }, [items]);

  const position = useMemo(() => {
    const activeItem = items[active];
    if (!activeItem) return null;
    const groupIndex = groups.findIndex((group) => group.findingIds.includes(activeItem.id));
    const group = groups[groupIndex];
    if (!group) return null;
    return {
      photoId: group.photoId,
      photoIndex: groupIndex + 1,
      photoTotal: groups.length,
      findingIndex: group.findingIds.indexOf(activeItem.id) + 1,
      findingTotal: group.findingIds.length,
    };
  }, [items, active, groups]);

  const touchStart = useRef<number | null>(null);

  const derivedFields = useMemo(() => derivedFieldsOf(snapshot), [snapshot]);
  const showCause = definesField(snapshot, "likely_cause");
  const showReference = definesField(snapshot, "regulatory_reference");
  const references = useMemo(() => regulatoryReferencesOf(snapshot), [snapshot]);
  const showTrade = requiresTradeAssignment(snapshot) && !!onAssignTrade;
  // A minimal record template carries no repairs, so no remedial box is shown.
  const showRemedial = !isMinimalBriefTemplate((snapshot as { id?: string }).id);
  const causeGuidance =
    derivedFields.find((field) => field.id === "likely_cause")?.guidance ?? null;

  const applyOverride = useCallback((id: string, patch: Partial<Finding>) => {
    setOverrides((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } }));
  }, []);

  const updateItem = useCallback(
    (index: number, patch: Partial<Finding>) => {
      const item = items[index];
      if (item) applyOverride(item.id, patch);
    },
    [items, applyOverride],
  );

  /** Optimistic overlay, real write, rollback and a visible error on failure. */
  const persist = useCallback(
    async (id: string, optimistic: Partial<Finding>, patch: ConfirmPatch): Promise<boolean> => {
      const previous = overrides[id];
      applyOverride(id, optimistic);
      if (!onConfirm) return true;
      try {
        await onConfirm(id, patch);
        return true;
      } catch (error) {
        setOverrides((prev) => {
          const next = { ...prev };
          if (previous) next[id] = previous;
          else delete next[id];
          return next;
        });
        toast.error("That change could not be saved", {
          description: error instanceof Error ? error.message : "Nothing was written to the report.",
        });
        return false;
      }
    },
    [applyOverride, onConfirm, overrides],
  );

  const setStatus = useCallback(
    (index: number, status: StatusDefinition) => {
      const item = items[index];
      if (!item) return;
      const blocked = status.id === NOT_ASSESSED_ID;
      const confirmedAt = blocked ? null : new Date().toISOString();
      void persist(
        item.id,
        { status: status.id, confirmed: !blocked },
        { status: status.id, confirmed_at: confirmedAt },
      ).then((ok) => {
        if (!ok) return;
        toast.success(`Marked ${status.label}`, {
          description: blocked
            ? "This finding still blocks export until it is resolved."
            : "Finding confirmed and added to the report.",
        });
      });
    },
    [items, persist],
  );

  const confirmActive = useCallback(() => {
    const current = items[active];
    if (!current) return;
    if (resolveStatus(snapshot, current.status).id === NOT_ASSESSED_ID) {
      toast.error("Not assessed items cannot be confirmed", {
        description: "Choose a status from the report template before confirming.",
      });
      return;
    }
    void persist(
      current.id,
      { confirmed: true },
      { confirmed_at: new Date().toISOString() },
    ).then((ok) => {
      if (ok) toast.success("Finding confirmed");
    });
    setActive((i) => Math.min(i + 1, items.length - 1));
  }, [active, items, persist, snapshot]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    // Never steal a keystroke from a field, and never fire while a pop-out
    // dialog owns the screen — on a phone the on-screen keyboard is a field.
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName))
    ) {
      return;
    }
    if (typeof window !== "undefined" && window.document.querySelector("[data-radix-focus-guard]")) {
      return;
    }
    const key = event.key.toLowerCase();

    if (key === "j" || event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (key === "k" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (key === "enter") {
      event.preventDefault();
      confirmActive();
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

  /**
   * Jump to a finding even when it is already the active one: the reviewer may
   * have scrolled away, so always bring the card (and its photograph) back
   * into view and hand it keyboard focus.
   */
  const goToFinding = useCallback((index: number) => {
    setActive(index);
    requestAnimationFrame(() => {
      const row = rowRefs.current[index];
      if (!row) return;
      row.focus({ preventScroll: true });
      row.scrollIntoView?.({ block: "center", behavior: "smooth" });
    });
  }, []);

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
        action: {
          label: "Go to first unresolved",
          onClick: () => goToFinding(Math.max(firstNotAssessed, 0)),
        },
      });
      goToFinding(Math.max(firstNotAssessed, 0));
      return;
    }
    const pending = items.filter(
      (item, i) => !item.confirmed && resolved[i]?.id !== NOT_ASSESSED_ID,
    );
    if (pending.length === 0) return;

    const confirmedAt = new Date().toISOString();
    const snapshotOverrides = overrides;
    setOverrides((prev) => {
      const next = { ...prev };
      for (const item of pending) next[item.id] = { ...(next[item.id] ?? {}), confirmed: true };
      return next;
    });

    const ids = pending.map((item) => item.id);
    const write = onConfirmMany
      ? onConfirmMany(ids, { confirmed_at: confirmedAt })
      : onConfirm
        ? Promise.all(ids.map((id) => onConfirm(id, { confirmed_at: confirmedAt }))).then(() => {})
        : Promise.resolve();

    void write.then(
      () => toast.success("All findings confirmed"),
      (error: unknown) => {
        setOverrides(snapshotOverrides);
        toast.error("Those confirmations could not be saved", {
          description:
            error instanceof Error ? error.message : "Nothing was written to the report.",
        });
      },
    );
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
            onClick={() => goToFinding(Math.max(firstNotAssessed, 0))}
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

      {position ? (
        <div className="mt-4 rounded-xl border border-border bg-surface-raised p-3">
          {photoUrl.get(position.photoId) ? (
            <img
              src={photoUrl.get(position.photoId) ?? ""}
              alt={`Photograph ${position.photoIndex} of ${position.photoTotal} under review`}
              className="mx-auto max-h-[42vh] w-auto rounded-lg object-contain"
            />
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No photograph is attached to this finding.
            </p>
          )}
          <p className="mt-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Finding {position.findingIndex} of {position.findingTotal} · Photo{" "}
            {position.photoIndex} of {position.photoTotal}
          </p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="quiet"
          className="min-h-11"
          disabled={active === 0}
          onClick={() => setActive((i) => Math.max(i - 1, 0))}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Previous
        </Button>
        <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1">
          <label htmlFor="go-to-finding" className="sr-only">
            Go to finding
          </label>
          <Select
            value={items[active]?.id ?? ""}
            onValueChange={(id) => {
              const next = items.findIndex((item) => item.id === id);
              if (next >= 0) setActive(next);
            }}
          >
            <SelectTrigger
              id="go-to-finding"
              aria-label="Go to finding"
              className="h-11 w-full bg-surface-raised text-sm sm:mx-auto sm:max-w-sm"
            >
              <SelectValue placeholder="Go to finding…" />
            </SelectTrigger>
            <SelectContent>
              {items.map((item, i) => (
                <SelectItem key={item.id} value={item.id}>
                  {itemLabel(item.ref)} — {item.title || "Untitled finding"} ·{" "}
                  {resolved[i]?.label ?? ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="quiet"
          className="min-h-11"
          disabled={active >= items.length - 1}
          onClick={() => setActive((i) => Math.min(i + 1, items.length - 1))}
        >
          Next
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </div>


      <ul
        aria-label="Findings for review"
        className="mt-4 space-y-2"
        onKeyDown={onKeyDown}
        onTouchStart={(event) => {
          touchStart.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          const end = event.changedTouches[0]?.clientX ?? null;
          touchStart.current = null;
          if (start === null || end === null) return;
          const delta = end - start;
          if (Math.abs(delta) < 60) return;
          setActive((i) =>
            delta < 0 ? Math.min(i + 1, items.length - 1) : Math.max(i - 1, 0),
          );
        }}
      >
        {items.map((item, index) => {
          if (index !== active) return null;
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
                  ? "border-brand-accent ring-2 ring-brand-accent/30"
                  : blocked
                    ? "border-flag/40"
                    : "border-border hover:border-border-strong",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow">{itemLabel(item.ref)}</span>
                {item.aiDrafted ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-brand-accent/25 bg-brand-accent-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-brand-accent-ink">
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
              <p className="mt-2 break-words font-semibold leading-snug">{item.title}</p>
              <p className="mt-1 break-words text-sm text-muted-foreground">
                {item.location} · {item.trade}
              </p>
              {(() => {
                const severity = resolveSeverity(snapshot, item.severity);
                const category = resolveCategory(snapshot, item.category);
                if (!severity && !category) return null;
                return (
                  <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {category ? <span>{category.label}</span> : null}
                    {severity ? (
                      <span title={severity.guidance ?? undefined}>
                        Severity: <span className="font-semibold">{severity.label}</span>
                      </span>
                    ) : null}
                  </p>
                );
              })()}

              <div className="mt-3 space-y-3">
                <FieldCard
                  label="Description"
                  popOutDescription="What the assessment observed in the photograph."
                >
                  <p className="whitespace-pre-wrap">
                    {item.description || item.note || (
                      <span className="text-muted-foreground">No description recorded.</span>
                    )}
                  </p>
                </FieldCard>

                {showCause ? (
                  <FieldCard
                    label="Likely cause"
                    popOutDescription={
                      causeGuidance ?? "An assessment of cause, not a finding of fact."
                    }
                    badge={
                      item.likelyCauseConfirmed ? (
                        <span className="text-[0.6875rem] font-semibold text-muted-foreground">
                          Confirmed by reviewer
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-brand-accent/25 bg-brand-accent-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-brand-accent-ink">
                          <Sparkles aria-hidden="true" className="size-3" />
                          AI suggestion — unconfirmed
                        </span>
                      )
                    }
                    popOut={
                      <div>
                        <label
                          htmlFor={`cause-${item.id}`}
                          className="eyebrow block text-muted-foreground"
                        >
                          Likely cause
                        </label>
                        <textarea
                          id={`cause-${item.id}`}
                          value={item.likelyCause ?? ""}
                          placeholder="No cause could be inferred from the photograph."
                          aria-describedby={causeGuidance ? `cause-help-${item.id}` : undefined}
                          onChange={(event) =>
                            updateItem(index, {
                              likelyCause: event.target.value,
                              likelyCauseConfirmed: false,
                            })
                          }
                          className="mt-2 w-full rounded-md border border-input bg-surface-raised p-3 text-base leading-relaxed"
                          rows={7}
                        />
                        {causeGuidance ? (
                          <p
                            id={`cause-help-${item.id}`}
                            className="mt-1 text-xs text-muted-foreground"
                          >
                            {causeGuidance}
                          </p>
                        ) : null}
                        {!item.likelyCauseConfirmed ? (
                          <Button
                            variant="brand"
                            className="mt-3 min-h-11 w-full sm:w-auto"
                            onClick={() => updateItem(index, { likelyCauseConfirmed: true })}
                          >
                            Confirm cause
                          </Button>
                        ) : null}
                      </div>
                    }
                  >
                    <p className="whitespace-pre-wrap">
                      {item.likelyCause || (
                        <span className="text-muted-foreground">
                          No cause could be inferred from the photograph.
                        </span>
                      )}
                    </p>
                  </FieldCard>
                ) : null}

                {showTrade ? (
                  <TradeAssignmentCard
                    finding={item}
                    snapshot={snapshot}
                    tradeOptions={tradeOptions}
                    {...(onAddTradeToDirectory ? { onAddTradeToDirectory } : {})}
                    onAssign={async (assignment) => {
                      try {
                        await onAssignTrade!(item.id, assignment);
                        applyOverride(item.id, {
                          assignedTrade: assignment.trade,
                          trade: assignment.trade ?? item.aiSuggestedTrade ?? "Trade not assigned",
                          dueDate: assignment.dueDate,
                          dueDateOverridden: assignment.dueDateOverridden,
                        });
                        toast.success(
                          assignment.trade
                            ? `Assigned to ${assignment.trade}`
                            : "Trade assignment cleared",
                          {
                            description: assignment.trade
                              ? "Nothing is sent until you review and send the distribution."
                              : "This item will go to the project's fallback recipient.",
                          },
                        );
                      } catch (error) {
                        toast.error("That assignment could not be saved", {
                          description:
                            error instanceof Error
                              ? error.message
                              : "Nothing was written to the report.",
                        });
                      }
                    }}
                  />
                ) : null}

                {showRemedial ? (
                  <FieldCard
                    label="Remedial action"
                    popOutDescription="The recommended action recorded against this finding."
                  >
                    <p className="whitespace-pre-wrap">
                      {item.remedial || (
                        <span className="text-muted-foreground">
                          No remedial action recorded yet.
                        </span>
                      )}
                    </p>
                  </FieldCard>
                ) : null}

                {showReference ? (
                  <FieldCard
                    label="Regulatory reference"
                    popOutDescription="Chosen from the references this report template defines. Nothing outside that list can be recorded."
                    badge={
                      item.regulatoryReferenceConfirmed ? (
                        <span className="text-[0.6875rem] font-semibold text-muted-foreground">
                          Confirmed by reviewer
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-brand-accent/25 bg-brand-accent-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-brand-accent-ink">
                          <Sparkles aria-hidden="true" className="size-3" />
                          AI suggestion — unconfirmed
                        </span>
                      )
                    }
                    popOut={
                      <div>
                        <label
                          htmlFor={`ref-${item.id}`}
                          className="eyebrow block text-muted-foreground"
                        >
                          Regulatory reference
                        </label>
                        <Select
                          value={item.regulatoryReference ?? "__none__"}
                          onValueChange={(value) =>
                            updateItem(index, {
                              regulatoryReference: value === "__none__" ? null : value,
                              regulatoryReferenceConfirmed: false,
                            })
                          }
                        >
                          <SelectTrigger
                            id={`ref-${item.id}`}
                            aria-label="Regulatory reference"
                            className="mt-2 h-11 w-full bg-surface-raised text-base"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">No reference</SelectItem>
                            {references.map((reference) => (
                              <SelectItem key={reference.id} value={reference.id}>
                                {reference.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!item.regulatoryReferenceConfirmed ? (
                          <Button
                            variant="brand"
                            className="mt-3 min-h-11 w-full sm:w-auto"
                            onClick={() =>
                              updateItem(index, { regulatoryReferenceConfirmed: true })
                            }
                          >
                            Confirm reference
                          </Button>
                        ) : null}
                      </div>
                    }
                  >
                    <p className="break-words">
                      {references.find((reference) => reference.id === item.regulatoryReference)
                        ?.label ??
                        item.regulatoryReference ?? (
                          <span className="text-muted-foreground">No reference selected.</span>
                        )}
                    </p>
                  </FieldCard>
                ) : null}
              </div>

              {blocked ? (
                <p className="mt-3 text-sm font-semibold text-flag">
                  Not assessed — blocks export until a person sets a status.
                </p>
              ) : null}

              <div className="mt-4 rule-top pt-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {item.confirmed && !blocked ? "Confirmed by reviewer" : "Awaiting confirmation"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {shortcuts
                    .filter(({ status: option }) => option.id !== NOT_ASSESSED_ID)
                    .map(({ status: option }) => (
                      <Button
                        key={option.id}
                        variant="quiet"
                        className="h-auto min-h-11 w-full whitespace-normal px-3 py-2 text-center sm:w-auto"
                        onClick={() => setStatus(index, option)}
                      >
                        {option.label}
                      </Button>
                    ))}
                </div>

              </div>

            </li>
          );
        })}
      </ul>
    </div>
  );
}
