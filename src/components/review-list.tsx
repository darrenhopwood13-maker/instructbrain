import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import { FieldCard } from "@/components/field-card";

import { Button } from "@/components/ui/button";
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
import { AlertTriangle, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { itemLabel } from "@/lib/item-label";

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
  onConfirm,
  onConfirmMany,
  tradeOptions = [],
  onAssignTrade,
  onAddTradeToDirectory,
}: {
  snapshot: SurveyTypeSnapshot;
  findings: Finding[];
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

  const derivedFields = useMemo(() => derivedFieldsOf(snapshot), [snapshot]);
  const showCause = definesField(snapshot, "likely_cause");
  const showReference = definesField(snapshot, "regulatory_reference");
  const references = useMemo(() => regulatoryReferencesOf(snapshot), [snapshot]);
  const showTrade = requiresTradeAssignment(snapshot) && !!onAssignTrade;
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
        description: "Choose a status from the survey type before confirming.",
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

                {showReference ? (
                  <FieldCard
                    label="Regulatory reference"
                    popOutDescription="Chosen from the references this survey type defines. Nothing outside that list can be recorded."
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
                        <select
                          id={`ref-${item.id}`}
                          value={item.regulatoryReference ?? ""}
                          onChange={(event) =>
                            updateItem(index, {
                              regulatoryReference:
                                event.target.value === "" ? null : event.target.value,
                              regulatoryReferenceConfirmed: false,
                            })
                          }
                          className="mt-2 min-h-11 w-full rounded-md border border-input bg-surface-raised p-2 text-base"
                        >
                          <option value="">No reference</option>
                          {references.map((reference) => (
                            <option key={reference.id} value={reference.id}>
                              {reference.label}
                            </option>
                          ))}
                        </select>
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
