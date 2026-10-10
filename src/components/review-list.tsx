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
  reportLayoutOf,
  resolveCategory,
  resolveSeverity,
  resolveStatus,
  requiresTradeAssignment,
  requiresConditionGrade,
  reviewShortcuts,
  aiCaptureFieldsOf,
  type StatusDefinition,
  type SurveyTypeSnapshot,
} from "@/lib/survey-types";
import {
  TradeAssignmentCard,
  type TradeAssignment,
} from "@/components/review/trade-assignment-card";
import { ConditionGradeCard } from "@/components/review/condition-grade-card";
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
import { acceptPlan, type AttentionItem } from "@/lib/review/bulk-accept";
import { BULK_TRADE_CONFIRM_THRESHOLD } from "@/lib/ai/config";

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

/**
 * The card's heading — or null when there is nothing to add.
 *
 * The observation is rendered once, under Description. A heading that merely
 * restates it printed the same sentence twice, which is exactly what a short
 * finding looked like on screen: a one-line observation bounded to 60
 * characters has a heading identical to its own body. Saying it once is the
 * whole point, so when the two would match, the heading gives way.
 */
function cardHeading(item: Finding): string | null {
  const label = item.captureFields?.["item"]?.trim() || item.title.trim();
  if (!label) return null;
  const body = (item.description ?? item.note ?? "").replace(/\s+/g, " ").trim();
  return label === body ? null : label;
}

export function ReviewList({
  snapshot,
  findings,
  reportId,
  onConfirm,
  onConfirmMany,
  tradeOptions = [],
  onAssignTrade,
  tradeEnabled = true,
  onAddTradeToDirectory,
  onEditText,
  onAssignGrade,
}: {
  snapshot: SurveyTypeSnapshot;
  findings: Finding[];
  /** Enables the photograph shown above the finding being reviewed. */
  reportId?: string;
  /** Persists one confirmation action. Rejects if the write failed. */
  onConfirm?: (findingId: string, patch: ConfirmPatch) => Promise<void>;
  /** Persists the same patch across many findings in one batch. */
  onConfirmMany?: (findingIds: string[], patch: ConfirmPatch) => Promise<void>;
  /** Account switch: false hides the whole trade layer for this report. */
  tradeEnabled?: boolean;
  /** Trades from this project's directory plus the definition's defaults. */
  tradeOptions?: string[];
  /** Persists a human's trade decision and its derived target date. */
  onAssignTrade?: (findingId: string, assignment: TradeAssignment) => Promise<void>;
  onAddTradeToDirectory?: (trade: string) => void;
  /** Persists a person's correction of the description and, where declared, the item label. */
  onEditText?: (
    findingId: string,
    edit: { findingText: string; captureFields?: Record<string, string> },
  ) => Promise<void>;
  /** Persists a person's condition-grade decision. Null clears it. */
  onAssignGrade?: (findingId: string, grade: string | null) => Promise<void>;
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
  const [bulkBusy, setBulkBusy] = useState(false);
  const [unresolvedOnly, setUnresolvedOnly] = useState(false);
  const [tradesOnly, setTradesOnly] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftItem, setDraftItem] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
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
  const showTrade = tradeEnabled && requiresTradeAssignment(snapshot) && !!onAssignTrade;
  const showGrade = requiresConditionGrade(snapshot) && !!onAssignGrade;
  const usesRoomSchedule = reportLayoutOf(snapshot)?.kind === "inventory_room_schedule";
  // A minimal record template carries no repairs, so no remedial box is shown.
  const showRemedial =
    !usesRoomSchedule && !isMinimalBriefTemplate((snapshot as { id?: string }).id);
  // Only templates that declare an `item` capture field get an editable item name.
  const itemField = useMemo(
    () => aiCaptureFieldsOf(snapshot).find((field) => field.id === "item") ?? null,
    [snapshot],
  );
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
      if (unresolvedOnly) goToFinding(nextUnresolved(active, 1));
      else setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (key === "k" || event.key === "ArrowUp") {
      event.preventDefault();
      if (unresolvedOnly) goToFinding(nextUnresolved(active, -1));
      else setActive((i) => Math.max(i - 1, 0));
    } else if (key === "n") {
      event.preventDefault();
      goToFinding(nextUnresolved(active, 1));
    } else if (key === "e" && onEditText) {
      event.preventDefault();
      const current = items[active];
      if (current) startEdit(current);
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

  // The trades the report is still waiting on. Named here rather than left to be
  // found by scrolling: on a phone, a 30-finding schedule hides five outstanding
  // trades completely, and the issue gate then reads as a wall.
  const missingTrade = showTrade
    ? items.filter((item) => (item.assignedTrade ?? "").trim() === "").length
    : 0;
  const firstMissingTrade = showTrade
    ? items.findIndex((item) => (item.assignedTrade ?? "").trim() === "")
    : -1;

  const firstNotAssessed = resolved.findIndex((status) => status.id === NOT_ASSESSED_ID);

  /** Next (or previous) not-assessed finding from `from`, wrapping; stays put if none. */
  function nextUnresolved(from: number, direction: 1 | -1): number {
    const total = items.length;
    for (let step = 1; step <= total; step++) {
      const index = (((from + direction * step) % total) + total) % total;
      if (resolved[index]?.id === NOT_ASSESSED_ID) return index;
    }
    return from;
  }

  useEffect(() => {
    if (notAssessedCount === 0 && unresolvedOnly) setUnresolvedOnly(false);
  }, [notAssessedCount, unresolvedOnly]);

  useEffect(() => {
    if (missingTrade === 0 && tradesOnly) setTradesOnly(false);
  }, [missingTrade, tradesOnly]);

  function startEdit(item: Finding) {
    setEditingId(item.id);
    setDraftText(item.description ?? "");
    setDraftItem(item.captureFields?.["item"] ?? "");
  }

  async function saveEdit(item: Finding, index: number, andNext: boolean) {
    if (!onEditText) return;
    const findingText = draftText.trim();
    const label = draftItem.trim();
    setSavingEdit(true);
    try {
      await onEditText(item.id, {
        findingText,
        ...(itemField ? { captureFields: { item: label } } : {}),
      });
      applyOverride(item.id, {
        description: findingText,
        title: findingText.split("\n")[0]?.trim() || item.title,
        aiDrafted: false,
        captureFields: { ...(item.captureFields ?? {}), ...(itemField ? { item: label } : {}) },
      });
      setEditingId(null);
      toast.success("Wording saved", {
        description:
          resolved[index]?.id === NOT_ASSESSED_ID
            ? "Now choose a status below to resolve this item."
            : "Marked as edited by you.",
      });
      if (andNext) goToFinding(nextUnresolved(index, 1));
    } catch (error) {
      toast.error("That change could not be saved", {
        description: error instanceof Error ? error.message : "Nothing was written to the report.",
      });
    } finally {
      setSavingEdit(false);
    }
  }

  /**
   * What one press will accept, and what it will leave to a person. Built from the
   * same rows the list shows, so the numbers on the button cannot drift from it.
   */
  const acceptPlanResult = useMemo(
    () =>
      acceptPlan(
        items.map((item, index) => ({
          id: item.id,
          ref: item.ref,
          statusId: resolved[index]?.id ?? item.status,
          confirmed: item.confirmed,
          assignedTrade: item.assignedTrade ?? null,
          aiSuggestedTrade: item.aiSuggestedTrade ?? null,
          aiTradeConfidence: item.aiTradeConfidence ?? null,
          conditionGrade: item.conditionGrade ?? null,
          aiSuggestedGrade: item.aiSuggestedGrade ?? null,
          aiGradeConfidence: item.aiGradeConfidence ?? null,
        })),
        {
          notAssessedId: NOT_ASSESSED_ID,
          tradeRequired: showTrade,
          gradeRequired: showGrade,
        },
      ),
    [items, resolved, showTrade, showGrade],
  );

  const planTradeNote = showTrade
    ? " Suggestions it was not sure about are listed rather than accepted."
    : "";

  /**
   * The single press. It settles wording, status, trade and grade for every item
   * the AI was confident about, in one go, and then reports the real count — the
   * same number this card shows before the press and the same number the publish
   * gate reads afterwards. Items that need a person are listed, never swept in.
   */
  const acceptEverything = async () => {
    const plan = acceptPlanResult;
    if (plan.accept.length === 0) {
      if (plan.attention.length > 0) {
        toast.info("Nothing here can be accepted in one press", {
          description: `${plan.attention.length} item${plan.attention.length === 1 ? "" : "s"} still need your decision — they are listed below.`,
        });
      }
      return;
    }

    const ids = plan.accept.map((item) => item.id);
    const confirmedAt = new Date().toISOString();
    const snapshotOverrides = overrides;
    setBulkBusy(true);

    let trades = 0;
    let grades = 0;
    for (const item of plan.accept) {
      try {
        if (item.trade && onAssignTrade) {
          await onAssignTrade(item.id, {
            trade: item.trade,
            dueDate: null,
            dueDateOverridden: false,
          });
          trades += 1;
        }
        if (item.grade && onAssignGrade) {
          await onAssignGrade(item.id, item.grade);
          grades += 1;
        }
      } catch {
        // A single failure must not stop the rest; the toast says what landed.
      }
    }

    setOverrides((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = { ...(next[id] ?? {}), confirmed: true };
      return next;
    });

    try {
      if (onConfirmMany) await onConfirmMany(ids, { confirmed_at: confirmedAt });
      else if (onConfirm) await Promise.all(ids.map((id) => onConfirm(id, { confirmed_at: confirmedAt })));
      const extras = [
        trades > 0 ? `${trades} trade${trades === 1 ? "" : "s"}` : null,
        grades > 0 ? `${grades} grade${grades === 1 ? "" : "s"}` : null,
      ].filter(Boolean);
      toast.success(`${ids.length} accepted`, {
        description:
          (extras.length > 0 ? `${extras.join(" and ")} settled in the same press. ` : "") +
          (plan.attention.length > 0
            ? `${plan.attention.length} still need you.`
            : "Everything is accepted and the report is ready to publish."),
      });
    } catch (error) {
      setOverrides(snapshotOverrides);
      toast.error("Those acceptances could not be saved", {
        description: error instanceof Error ? error.message : "Nothing was written to the report.",
      });
    } finally {
      setBulkBusy(false);
    }
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
          <Button
            size="sm"
            variant={unresolvedOnly ? "brand" : "quiet"}
            aria-pressed={unresolvedOnly}
            className="min-h-11"
            onClick={() => {
              const turningOn = !unresolvedOnly;
              setUnresolvedOnly(turningOn);
              if (turningOn && resolved[active]?.id !== NOT_ASSESSED_ID) {
                goToFinding(Math.max(firstNotAssessed, 0));
              }
            }}
          >
            Unidentified only · {notAssessedCount} left
          </Button>
        </div>
      ) : null}

      <div className="min-w-0 rounded-xl border border-border bg-surface-raised p-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-sm font-semibold">
            {items.length} finding{items.length === 1 ? "" : "s"} drafted
          </p>
          <p className="text-sm text-muted-foreground">
            {confirmed} accepted
            {acceptPlanResult.attention.length > 0 ? (
              <>
                {" · "}
                <span className="font-semibold text-foreground">
                  {acceptPlanResult.attention.length} need you
                </span>
              </>
            ) : (
              " · nothing needs you"
            )}
          </p>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant="brand"
            className="min-h-12 w-full sm:min-h-11 sm:w-auto sm:shrink-0"
            disabled={acceptPlanResult.accept.length === 0 || bulkBusy}
            onClick={() => void acceptEverything()}
          >
            {bulkBusy ? "Accepting…" : `Accept all ${acceptPlanResult.accept.length}`}
          </Button>
          <p className="text-xs text-muted-foreground">
            Settles the wording, the status{showTrade ? ", the trade" : ""}
            {showGrade ? " and the grade" : ""} for everything the AI was confident about.
            {planTradeNote}
          </p>
        </div>

        {acceptPlanResult.attention.length > 0 ? (
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Needs you · {acceptPlanResult.attention.length}
            </p>
            <ul className="mt-2 space-y-1">
              {acceptPlanResult.attention.slice(0, 12).map((entry: AttentionItem) => {
                const index = items.findIndex((item) => item.id === entry.id);
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-sunken"
                      onClick={() => {
                        setUnresolvedOnly(false);
                        goToFinding(Math.max(index, 0));
                      }}
                    >
                      <span className="font-semibold">{entry.ref}</span>{" "}
                      <span className="text-muted-foreground">{entry.detail}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {acceptPlanResult.attention.length > 12 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                and {acceptPlanResult.attention.length - 12} more.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {missingTrade > 0 ? (
        <div className="mt-3">
          <Button
            type="button"
            variant={tradesOnly ? "brand" : "outline"}
            aria-pressed={tradesOnly}
            className="min-h-11 w-full sm:w-auto"
            onClick={() => {
              const turningOn = !tradesOnly;
              setTradesOnly(turningOn);
              if (turningOn && firstMissingTrade >= 0) goToFinding(firstMissingTrade);
            }}
          >
            {tradesOnly ? "Showing" : "Show"} trades to confirm · {missingTrade} left
          </Button>
        </div>
      ) : null}



      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>
              Review a whole list without the mouse. Shortcuts apply while a finding is
              focused.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <span className="kbd-hint">J</span> <span className="kbd-hint">K</span> move between
              findings
            </li>
            {shortcuts
              .filter((shortcut) => shortcut.key)
              .map((shortcut) => (
                <li key={shortcut.status.id}>
                  <span className="kbd-hint">{shortcut.key.toUpperCase()}</span> mark{" "}
                  {shortcut.status.label.toLowerCase()}
                </li>
              ))}
            <li>
              <span className="kbd-hint">↵</span> confirm the focused finding
            </li>
            <li>
              <span className="kbd-hint">N</span> next unidentified item
            </li>
            {onEditText ? (
              <li>
                <span className="kbd-hint">E</span> edit the wording
              </li>
            ) : null}
          </ul>
        </DialogContent>
      </Dialog>

      <ul
        aria-label="Findings for review"
        className="mt-4 space-y-2"
        onKeyDown={onKeyDown}
      >
        {items.map((item, index) => {
          const status = resolved[index] ?? resolveStatus(snapshot, item.status);
          const blocked = status.id === NOT_ASSESSED_ID;
          const thumb = photoUrl.get(item.photoIds?.[0] ?? "") ?? null;
          if (index !== active) {
            if (unresolvedOnly && !blocked) return null;
            if (tradesOnly && (item.assignedTrade ?? "").trim() !== "") return null;
            const done = item.confirmed && !blocked;
            return (
              <li
                key={item.id}
                ref={(el) => {
                  rowRefs.current[index] = el;
                }}
                tabIndex={-1}
                className={cn(
                  "flex min-w-0 items-center gap-3 rounded-xl border bg-surface-raised p-2 outline-none",
                  blocked ? "border-flag/40" : "border-border",
                )}
              >
                <button
                  type="button"
                  onClick={() => setActive(index)}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-brand-accent"
                  aria-label={`Open ${itemLabel(item.ref)}: ${item.title || "Untitled finding"}`}
                >
                  {thumb ? (
                    <img src={thumb} alt="" loading="lazy" className="size-14 shrink-0 rounded-md bg-surface object-cover" />
                  ) : (
                    <span aria-hidden="true" className="size-14 shrink-0 rounded-md bg-surface-sunken" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-muted-foreground">{itemLabel(item.ref)}</span>
                    <span className="block truncate text-sm font-semibold">
                      {item.captureFields?.["item"]?.trim() || item.title || "Untitled finding"}
                    </span>
                    <span className="mt-0.5 block">
                      <StatusPill status={status} />
                    </span>
                  </span>
                </button>
                {done ? (
                  <span className="shrink-0 px-2 text-xs font-semibold text-muted-foreground">Accepted</span>
                ) : blocked ? null : (
                  <Button
                    variant="quiet"
                    className="min-h-12 shrink-0 px-3 sm:min-h-11"
                    onClick={() =>
                      void persist(item.id, { confirmed: true }, { confirmed_at: new Date().toISOString() })
                    }
                  >
                    Accept
                  </Button>
                )}
              </li>
            );
          }
          const heading = cardHeading(item);
          const editing = editingId === item.id;
          /**
           * The wording editor, built once. It is the pop-out for the ordinary
           * card — so a finding has ONE description control that reads and edits
           * — and it stays inline on a room-schedule report, which has no pop-out.
           */
          const descriptionEditor = (
            <div className="space-y-3 rounded-xl border border-border bg-surface-sunken p-3">
              {itemField ? (
                <div>
                  <label htmlFor={`item-${item.id}`} className="eyebrow block text-muted-foreground">
                    {itemField.label}
                  </label>
                  <input
                    id={`item-${item.id}`}
                    value={draftItem}
                    maxLength={60}
                    placeholder="e.g. Radiator valve"
                    onChange={(event) => setDraftItem(event.target.value)}
                    className="mt-2 h-11 w-full rounded-md border border-input bg-surface-raised px-3 text-base"
                  />
                </div>
              ) : null}
              <div>
                <label htmlFor={`desc-${item.id}`} className="eyebrow block text-muted-foreground">
                  Description
                </label>
                <textarea
                  id={`desc-${item.id}`}
                  value={draftText}
                  rows={5}
                  onChange={(event) => setDraftText(event.target.value)}
                  className="mt-2 w-full rounded-md border border-input bg-surface-raised p-3 text-base leading-relaxed"
                />
              </div>
              <div className="grid gap-2 sm:flex sm:flex-wrap">
                <Button
                  variant="brand"
                  className="min-h-11"
                  disabled={savingEdit}
                  onClick={() => void saveEdit(item, index, notAssessedCount > 1)}
                >
                  {notAssessedCount > 1 ? "Save and next" : "Save"}
                </Button>
                <Button
                  variant="quiet"
                  className="min-h-11"
                  disabled={savingEdit}
                  onClick={() => setEditingId(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          );
          return (
            <li
              key={item.id}
              ref={(el) => {
                rowRefs.current[index] = el;
              }}
              tabIndex={0}
              aria-current="true"
              className="rounded-xl border border-brand-accent bg-surface-raised p-4 outline-none ring-2 ring-brand-accent/30"
            >
              {thumb ? (
                <img src={thumb} alt={`Photograph for ${itemLabel(item.ref)}`} className="mb-3 max-h-[40vh] w-full rounded-lg bg-surface object-contain" />
              ) : null}
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
              {heading ? (
                <p className="mt-2 break-words font-semibold leading-snug">{heading}</p>
              ) : null}
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
                {/* One description control. The card clamps the preview to two
                    lines, and the SAME control opens the whole text and the
                    editor — rather than offering "open" and "edit" as two
                    buttons that do one person's job between them. */}
                <FieldCard
                  label="Description"
                  popOutDescription={
                    onEditText
                      ? "Read the whole description, change the wording, and save it here."
                      : "What the assessment observed in the photograph."
                  }
                  previewLines={2}
                  expandable={!usesRoomSchedule}
                  {...(onEditText ? { actionLabel: "Open and edit description" } : {})}
                  {...(onEditText
                    ? {
                        open: editing,
                        onOpenChange: (next: boolean) =>
                          next ? startEdit(item) : setEditingId(null),
                        popOut: descriptionEditor,
                      }
                    : {})}
                >
                  <p className="whitespace-pre-wrap">
                    {item.description || item.note || (
                      <span className="text-muted-foreground">No description recorded.</span>
                    )}
                  </p>
                </FieldCard>

                {/* A room-schedule report has no pop-out, so its one edit control
                    has nowhere else to live. */}
                {usesRoomSchedule && onEditText ? (
                  editing ? (
                    descriptionEditor
                  ) : (
                    <Button
                      variant="quiet"
                      className="min-h-11 w-full sm:w-auto"
                      onClick={() => startEdit(item)}
                    >
                      {itemField ? "Edit item name and description" : "Edit description"}
                    </Button>
                  )
                ) : null}

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

                {showGrade ? (
                  <ConditionGradeCard
                    finding={item}
                    threshold={BULK_TRADE_CONFIRM_THRESHOLD}
                    onGrade={async (grade) => {
                      try {
                        await onAssignGrade!(item.id, grade);
                        applyOverride(item.id, { conditionGrade: grade });
                        toast.success(grade ? `Graded ${grade}` : "Grade cleared", {
                          description: grade
                            ? "A person's decision. The assessment's own suggestion is kept beside it."
                            : "This element is back to to be confirmed.",
                        });
                      } catch (error) {
                        toast.error("That grade could not be saved", {
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
                    previewLines={2}
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
