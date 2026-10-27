import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronRight, ExternalLink, Link2, Lock, Send } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState, LoadingState } from "@/components/query-states";
import { EmptyState } from "@/components/empty-state";
import { distributionPlanQuery, type PlanRow } from "@/lib/distribution/distribution-data";
import { sendTradeExtract, retrySend, sendReportShared } from "@/lib/email/email.functions";
import { createShareLink } from "@/lib/report/report-data";
import { ensureTradeLink } from "@/lib/trade-access/trade-access";
import { formatTarget } from "@/lib/findings/due-date";

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * The lens this screen opens on.
 *
 * Subcontractor, not trade, because a firm is what receives an extract: one
 * firm holding three trades should get one document, and a trade held by two
 * firms has to be split. Trade stays available for anyone who thinks in trades,
 * and it is honest about its own limit — where two firms hold one trade it can
 * only show that the item needs a decision.
 */
const GROUPINGS = ["subcontractor", "trade", "severity"] as const;
type GroupingChoice = (typeof GROUPINGS)[number];

const GROUPING_LABEL: Record<GroupingChoice, string> = {
  subcontractor: "By subcontractor",
  trade: "By trade",
  severity: "By severity",
};

const GROUPING_BLURB: Record<string, string> = {
  subcontractor:
    "Grouped by subcontractor, so each firm is sent one extract holding only its own items.",
  trade: "Grouped by responsible trade.",
  severity: "Grouped by severity.",
  area: "Grouped by location.",
};

/**
 * The distribution review screen. NOTHING SENDS AUTOMATICALLY, EVER.
 *
 * Every send on this page is a person pressing a button: there is no send on
 * issue, no scheduled job, and no effect that dispatches. "Send all" iterates
 * the rows the person has left included, one explicit action.
 */
export const Route = createFileRoute("/_authenticated/reports/$id/distribute")({
  // grouping is chosen per visit, not stored: it changes how a person reads the
  // plan, not what the plan is.
  head: () => {
    const title = "Review distribution — instructBrain";
    const description =
      "Check every trade extract, its recipient and its items before anything is sent.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: DistributionReview,
});

function deliveryLabel(row: PlanRow): { text: string; tone: string } {
  const latest = row.latestDelivery;
  if (!latest) return { text: "Not sent", tone: "text-muted-foreground" };
  switch (latest.status) {
    case "delivered":
      return { text: "Delivered", tone: "text-pass" };
    case "sent":
      return { text: latest.openedAt ? "Opened" : "Sent", tone: "text-pass" };
    case "bounced":
      return { text: "Bounced — not received", tone: "text-fail" };
    case "complained":
      return { text: "Marked as spam", tone: "text-fail" };
    case "failed":
      return { text: "Failed to send", tone: "text-fail" };
    case "sending":
      return { text: "Sending…", tone: "text-muted-foreground" };
    default:
      return { text: latest.status, tone: "text-muted-foreground" };
  }
}

function DistributionReview() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const [grouping, setGrouping] = useState<GroupingChoice>("subcontractor");
  const plan = useQuery(distributionPlanQuery(id, grouping));
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  // Only used when the plan has no project directory to source a recipient from.
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");

  const rows = useMemo(() => plan.data?.rows ?? [], [plan.data]);
  const isQuick = plan.data?.isQuick === true;
  const sendable = rows.filter((row) => !excluded[row.key] && !row.blockedReason);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["distribution-plan", id] });

  const sendRow = async (row: PlanRow): Promise<boolean> => {
    const email = isQuick ? manualEmail.trim() : row.recipientEmail;
    const name = isQuick ? manualName.trim() || null : row.recipientName;

    if (isQuick && !isLikelyEmail(manualEmail)) {
      toast.error("Enter a recipient email address first");
      return false;
    }
    if (row.blockedReason || !email) {
      toast.error("That row cannot be sent yet", { description: row.blockedReason ?? "" });
      return false;
    }
    setBusy(row.key);
    try {
      // The whole report goes to a client as the branded link email - the same
      // one the report header sends - and not as a table of findings. This is the
      // single row a quick or custom report has, because there is no project
      // directory to route by. Dal, once the report header had that email:
      // "Needs to operational throughout the app."
      //
      // Only once the report is published. A share link serves the published
      // report, so a draft has no link to give; a draft therefore still leaves as
      // the work pack below, exactly as it did before this change.
      if (isQuick && plan.data?.reportStatus === "issued") {
        const share = await createShareLink({
          reportId: id,
          organisationId: plan.data?.organisationId ?? "",
          days: 30,
        });
        const outcome = await sendReportShared({
          data: { reportId: id, shareId: share.id, email, name },
        });
        if (!outcome.ok) {
          toast.error("The report link was not sent", { description: outcome.error ?? "" });
          return false;
        }
        toast.success(`Sent to ${email}`, {
          description: "The report link is in their inbox. It works for 30 days.",
        });
        return true;
      }
      // A live, trade-scoped link so the recipient can respond without an account.
      if (!row.unassigned && plan.data) {
        await ensureTradeLink({
          reportId: id,
          organisationId: plan.data.organisationId,
          trade: row.key,
          // The firm's name, so the page a crew opens is addressed to a firm
          // rather than to an internal key.
          label: row.label,
        });
      }
      const outcome = await sendTradeExtract({
        data: {
          reportId: id,
          trade: row.unassigned ? null : row.key,
          email,
          name,
          directoryId: row.directoryId,
          // The lens the person was reading. Sending is resolved the same way
          // the row was worked out, so the extract holds the items on screen.
          grouping: plan.data?.grouping ?? null,
        },
      });
      if (!outcome.ok) {
        toast.error(`${row.label} was not sent`, { description: outcome.error ?? "" });
        return false;
      }
      toast.success(`Sent to ${email}`, {
        description: `${row.itemCount} item${row.itemCount === 1 ? "" : "s"} for ${row.label}.`,
      });
      return true;
    } catch (error) {
      toast.error(`${row.label} was not sent`, {
        description: error instanceof Error ? error.message : "Nothing was sent.",
      });
      return false;
    } finally {
      setBusy(null);
      await refresh();
    }
  };

  /** One button press, one pass over the included rows. Nothing implicit. */
  const sendAll = async () => {
    let sent = 0;
    for (const row of sendable) {
      const ok = await sendRow(row);
      if (ok) sent += 1;
    }
    toast.success(`${sent} of ${sendable.length} extracts sent`);
  };

  const retry = async (distributionId: string) => {
    setBusy(distributionId);
    try {
      const outcome = await retrySend({ data: { distributionId } });
      if (outcome.ok) toast.success("Sent again");
      else toast.error("That send failed again", { description: outcome.error ?? "" });
    } catch (error) {
      toast.error("That send failed again", {
        description: error instanceof Error ? error.message : "Nothing was sent.",
      });
    } finally {
      setBusy(null);
      await refresh();
    }
  };

  const copyLink = async (row: PlanRow) => {
    if (!plan.data) return;
    try {
      const link = await ensureTradeLink({
        reportId: id,
        organisationId: plan.data.organisationId,
        trade: row.key,
        label: row.label,
      });
      await navigator.clipboard.writeText(link.url);
      toast.success("Trade link copied", {
        description: `${row.label} can open only their own items with this link.`,
      });
    } catch (error) {
      toast.error("That link could not be created", {
        description: error instanceof Error ? error.message : "Nothing was changed.",
      });
    }
  };

  if (plan.isPending) {
    return (
      <AppShell surface="light">
        <LoadingState label="Working out who receives what…" />
      </AppShell>
    );
  }
  if (plan.isError) {
    return (
      <AppShell surface="light">
        <ErrorState
          title="The distribution could not be prepared"
          error={plan.error}
          onRetry={() => void plan.refetch()}
        />
      </AppShell>
    );
  }

  const data = plan.data;

  return (
    <AppShell surface="light">
      <nav aria-label="Breadcrumb" className="pb-4 text-sm">
        <Link to="/projects" className="font-medium text-muted-foreground hover:text-foreground">
          {data?.projectId ? "Projects" : "Custom reports"}
        </Link>
        <ChevronRight aria-hidden="true" className="mx-1 inline size-3.5 text-muted-foreground" />
        <Link
          to="/reports/$id"
          params={{ id }}
          className="font-medium text-muted-foreground hover:text-foreground"
        >
          {data?.reportReference ?? data?.reportTitle}
        </Link>
        <ChevronRight aria-hidden="true" className="mx-1 inline size-3.5 text-muted-foreground" />
        <span className="text-foreground">Distribution</span>
      </nav>

      <header className="border-b border-border pb-6">
        <p className="eyebrow">Before anything is sent</p>
        <h1 className="editorial-title mt-1.5 text-2xl font-semibold sm:text-3xl">
          Review distribution
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {isQuick
            ? "A custom report has no project directory, so the whole report goes to one recipient you enter below. They receive the branded email with the link to read it and download their own copy."
            : (GROUPING_BLURB[data?.grouping ?? "trade"] ?? "Grouped by responsible trade.")}{" "}
          Nothing leaves instructBrain until you press send.
        </p>
        {!isQuick && data ? (
          <div
            role="radiogroup"
            aria-label="How the extracts are grouped"
            className="mt-4 inline-flex flex-wrap gap-1 rounded-lg border border-border bg-surface-sunken p-1"
          >
            {GROUPINGS.map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                aria-checked={grouping === choice}
                onClick={() => setGrouping(choice)}
                className={
                  grouping === choice
                    ? "rounded-md bg-surface-raised px-3 py-1.5 text-sm font-semibold text-foreground"
                    : "rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                }
              >
                {GROUPING_LABEL[choice]}
              </button>
            ))}
          </div>
        ) : null}
        {data && data.withheldCount > 0 ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border-strong bg-surface-sunken px-3 py-2 text-sm">
            <Lock aria-hidden="true" className="size-4" />
            {data.withheldCount} confidential finding{data.withheldCount === 1 ? " is" : "s are"}{" "}
            withheld from every extract.
          </p>
        ) : null}
      </header>

      {rows.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={Send}
            eyebrow="Nothing to distribute"
            title="No items are ready to send"
            description={
              data && data.withheldCount > 0
                ? "Every item on this report is confidential, and confidential items are never distributed."
                : "Add photographs and confirm findings in the Review tab first — then come back here to send."
            }
          />
          <div className="mt-4 flex justify-center">
            <Button variant="quiet" asChild>
              <Link to="/reports/$id" params={{ id }} search={{ tab: "review" }}>
                Go to Review
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-border bg-surface-raised p-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {sendable.length} of {rows.length} rows included
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Each send is recorded against this report with who sent it and when.
              </p>
            </div>
            <Button
              variant="brand"
              className="shrink-0"
              disabled={
                sendable.length === 0 || busy !== null || (isQuick && !isLikelyEmail(manualEmail))
              }
              onClick={() => void sendAll()}
            >
              <Send aria-hidden="true" className="size-4" />
              Send all included
            </Button>
          </div>

          <ul className="mt-4 space-y-3">
            {rows.map((row) => {
              const delivery = deliveryLabel(row);
              const isExcluded = !!excluded[row.key];
              return (
                <li
                  key={row.key}
                  className={
                    "rounded-xl border p-4 " +
                    (row.unassigned
                      ? "border-warn/50 bg-warn-soft"
                      : isExcluded
                        ? "border-border bg-surface-sunken opacity-70"
                        : "border-border bg-surface-raised")
                  }
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {row.unassigned ? (
                          <AlertTriangle aria-hidden="true" className="size-4 text-warn" />
                        ) : null}
                        <h2 className="editorial-title text-base font-semibold">{row.label}</h2>
                        <span className={"text-xs font-semibold " + delivery.tone}>
                          {delivery.text}
                        </span>
                      </div>
                      {isQuick ? (
                        <div className="mt-2 grid gap-2 sm:max-w-sm sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label htmlFor="quick-recipient-name" className="text-xs">
                              Recipient name
                            </Label>
                            <Input
                              id="quick-recipient-name"
                              value={manualName}
                              onChange={(event) => setManualName(event.target.value)}
                              autoComplete="off"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="quick-recipient-email" className="text-xs">
                              Recipient email
                            </Label>
                            <Input
                              id="quick-recipient-email"
                              type="email"
                              required
                              value={manualEmail}
                              onChange={(event) => setManualEmail(event.target.value)}
                              autoComplete="off"
                              aria-invalid={manualEmail.length > 0 && !isLikelyEmail(manualEmail)}
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="mt-1 break-words text-sm text-muted-foreground">
                          {row.recipientEmail ? (
                            <>
                              {row.recipientName ?? "Recipient"} · {row.recipientEmail}
                              {row.unassigned ? " (fallback recipient)" : ""}
                            </>
                          ) : (
                            <span className="font-semibold text-fail">{row.blockedReason}</span>
                          )}
                        </p>
                      )}
                      <p className="mt-2 text-sm">
                        {row.itemCount} item{row.itemCount === 1 ? "" : "s"}
                        {row.severities.length > 0
                          ? " · " +
                            row.severities
                              .map((severity) => `${severity.count} ${severity.label}`)
                              .join(", ")
                          : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Earliest target: {formatTarget(null, null, row.earliestTarget)}
                      </p>
                      {row.latestDelivery?.error ? (
                        <p className="mt-2 rounded-lg border border-fail/40 bg-fail-soft px-3 py-2 text-sm text-fail">
                          {row.latestDelivery.error}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:w-auto">
                      <Button variant="quiet" className="min-h-11" asChild>
                        <Link
                          to="/reports/$id/extract/$group"
                          params={{ id, group: encodeURIComponent(row.key) }}
                          search={{ auto: undefined }}
                          target="_blank"
                        >
                          <ExternalLink aria-hidden="true" className="size-4" />
                          Preview extract
                        </Link>
                      </Button>
                      {!row.unassigned && !isQuick ? (
                        <Button
                          variant="quiet"
                          className="min-h-11"
                          onClick={() => void copyLink(row)}
                        >
                          <Link2 aria-hidden="true" className="size-4" />
                          Copy trade link
                        </Button>
                      ) : null}
                      <Button
                        variant="brand"
                        className="min-h-11"
                        disabled={
                          busy !== null ||
                          isExcluded ||
                          !!row.blockedReason ||
                          (isQuick && !isLikelyEmail(manualEmail))
                        }
                        onClick={() => void sendRow(row)}
                      >
                        <Send aria-hidden="true" className="size-4" />
                        {row.latestDelivery
                          ? "Send again"
                          : isQuick && plan.data?.reportStatus === "issued"
                            ? "Send the report link"
                            : "Send"}
                      </Button>
                      {row.latestDelivery &&
                      ["bounced", "failed", "complained"].includes(row.latestDelivery.status) ? (
                        <Button
                          variant="quiet"
                          className="min-h-11"
                          disabled={busy !== null}
                          onClick={() => void retry(row.latestDelivery!.distributionId)}
                        >
                          Retry this send
                        </Button>
                      ) : null}
                      <label className="flex min-h-11 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={!isExcluded}
                          onChange={(event) =>
                            setExcluded((prev) => ({ ...prev, [row.key]: !event.target.checked }))
                          }
                        />
                        Include in &ldquo;send all&rdquo;
                      </label>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {data && !isQuick && data.projectId && !data.fallback.email ? (
            <p className="mt-6 rounded-xl border border-warn/50 bg-warn-soft px-4 py-3 text-sm">
              This project has no fallback recipient. Set one on the{" "}
              <Link
                to="/projects/$id/directory"
                params={{ id: data.projectId }}
                className="font-semibold underline"
              >
                project directory
              </Link>{" "}
              so unassigned items have an owner.
            </p>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
