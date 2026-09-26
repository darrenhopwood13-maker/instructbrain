import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, ChevronRight, History, FolderInput } from "lucide-react";
import { AttachToProjectDialog } from "@/components/attach-to-project-dialog";
import { ReportStepper, defaultStep, readyToIssue, type ReportStep } from "@/components/report/report-stepper";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { ErrorState, LoadingState } from "@/components/query-states";
import { ReportStatusPill } from "@/components/status-pill";
import { ReviewList, type ConfirmPatch } from "@/components/review-list";
import { PhotosPanel } from "@/components/photos/photos-panel";
import { AnalysisPanel } from "@/components/ai/analysis-panel";
import { ReportDocumentView } from "@/components/report/report-document-view";
import { useReportTranslation } from "@/lib/i18n/use-report-translation";
import { languageLabel } from "@/i18n/languages";
import { ReportActions } from "@/components/report/report-actions";
import { InlineField } from "@/components/report/inline-field";

import { supabase } from "@/integrations/supabase/client";
import { findingsQuery, reportQuery } from "@/lib/data";
import {
  reportDocumentQuery,
  reportVersionsQuery,
  updateFinding,
  updateReportFields,
  type FindingPatch,
  type ReportPatch,
} from "@/lib/report/report-data";
import { formatDocumentDate, issueBlockers, type DocFinding } from "@/lib/report/document";
import { definitionLabel, tradesOf } from "@/lib/survey-types";
import { projectDirectoryQuery } from "@/lib/directory/directory-data";
import { deriveDueDate } from "@/lib/findings/due-date";
import { stateAfterAssignment } from "@/lib/lifecycle";
import type { TradeAssignment } from "@/components/review/trade-assignment-card";
import { safeResultView, type ResultView } from "@/lib/report/grouping";

type ReportSearch = { tab?: "photos" | "review" | "output"; view?: ResultView };

export const Route = createFileRoute("/_authenticated/reports/$id/")({
  validateSearch: (search: Record<string, unknown>): ReportSearch => {
    const tab = search["tab"];
    const view = safeResultView(search["view"]);
    return tab === "review" || tab === "output" || tab === "photos" ? { tab, view } : { view };
  },
  head: () => {
    const title = "Report workspace — instructBrain";
    const description =
      "Photographs, AI-drafted findings review and the issued document for this report.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: ReportWorkspace,
});

function ReportWorkspace() {
  const [attaching, setAttaching] = useState(false);
  const { id } = Route.useParams();
  const { tab, view } = Route.useSearch();
  const navigate = Route.useNavigate();
  const resultView = safeResultView(view);
  const queryClient = useQueryClient();
  const query = useQuery(reportQuery(id));
  const findings = useQuery(findingsQuery(id));
  const document = useQuery(reportDocumentQuery(id));
  const versions = useQuery(reportVersionsQuery(id));
  const translation = useReportTranslation(id, document.data ?? null);
  const projectId = query.data?.project?.id ?? null;
  const directory = useQuery(projectDirectoryQuery(projectId));

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["report-document", id] });
    await queryClient.invalidateQueries({ queryKey: ["findings", id] });
  };

  const onReportPatch = async (patch: ReportPatch, before: Record<string, unknown>) => {
    await updateReportFields(id, patch, before);
    await refresh();
  };

  const onFindingPatch = async (
    finding: DocFinding,
    patch: FindingPatch,
    before: Record<string, unknown>,
  ) => {
    await updateFinding(id, finding.id, patch, before);
    await refresh();
  };

  /** Review-tab confirmations, persisted through the same audited path. */
  const writeConfirmations = async (findingIds: string[], patch: ConfirmPatch) => {
    const { data: user } = await supabase.auth.getUser();
    const actor = user.user?.id ?? null;
    const full: FindingPatch = {
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.confirmed_at !== undefined
        ? { confirmed_at: patch.confirmed_at, confirmed_by: patch.confirmed_at ? actor : null }
        : {}),
    };
    await Promise.all(
      findingIds.map((findingId) => {
        const before = (findings.data ?? []).find((item) => item.id === findingId);
        return updateFinding(id, findingId, full, {
          status: before?.status ?? null,
          confirmed: before?.confirmed ?? false,
        });
      }),
    );
    await refresh();
  };

  const onConfirm = (findingId: string, patch: ConfirmPatch) =>
    writeConfirmations([findingId], patch);

  /** A person's correction of the AI wording. The AI's raw output is untouched. */
  const onEditText = async (
    findingId: string,
    edit: { findingText: string; captureFields?: Record<string, string> },
  ) => {
    const before = (findings.data ?? []).find((item) => item.id === findingId);
    const patch: FindingPatch = { finding_text: edit.findingText };
    if (edit.captureFields) {
      patch.capture_fields = { ...(before?.captureFields ?? {}), ...edit.captureFields };
    }
    await updateFinding(id, findingId, patch, {
      finding_text: before?.description ?? null,
      capture_fields: before?.captureFields ?? null,
    });
    await refresh();
  };

  /**
   * A human's trade decision. The AI suggestion is never overwritten, and the
   * target date derives from the severity's target window in the snapshot.
   */
  const onAssignTrade = async (findingId: string, assignment: TradeAssignment) => {
    const before = (findings.data ?? []).find((item) => item.id === findingId);
    const { data: user } = await supabase.auth.getUser();
    const confirmedAt = new Date();
    const snapshot = query.data?.report.surveyTypeSnapshot ?? null;
    const derived = deriveDueDate(snapshot, before?.severity ?? null, confirmedAt);
    const dueDate = assignment.dueDateOverridden ? assignment.dueDate : derived.dueDate;

    await updateFinding(
      id,
      findingId,
      {
        assigned_trade: assignment.trade,
        due_date: dueDate,
        due_date_overridden:
          assignment.dueDateOverridden && dueDate !== derived.dueDate,
        confirmed_at: confirmedAt.toISOString(),
        confirmed_by: user.user?.id ?? null,
        lifecycle_state: assignment.trade
          ? stateAfterAssignment(before?.lifecycleState)
          : "open",
      },
      {
        assigned_trade: before?.assignedTrade ?? null,
        ai_suggested_trade: before?.aiSuggestedTrade ?? null,
        due_date: before?.dueDate ?? null,
      },
    );
    await refresh();
  };

  const tradeOptions = Array.from(
    new Set([
      ...(directory.data ?? []).filter((entry) => entry.isActive).map((entry) => entry.trade),
      ...tradesOf(query.data?.report.surveyTypeSnapshot ?? null),
    ]),
  ).sort((a, b) => a.localeCompare(b));

  const findingsAll = findings.data ?? [];
  const docEarly = document.data ?? null;
  const stepState = {
    hasFindings: findingsAll.length > 0,
    unresolved: docEarly
      ? issueBlockers(docEarly).notAssessed.length + issueBlockers(docEarly).unconfirmed.length
      : findingsAll.filter((f) => !f.confirmed).length,
    issued: docEarly?.report.status === "issued",
  };
  const loadedEnough = !findings.isPending && !document.isPending;
  const step: ReportStep = tab ?? (loadedEnough ? defaultStep(stepState) : "photos");
  const ready = readyToIssue(stepState);

  const goTo = useCallback(
    (next: ReportStep) => {
      setAutoAdvance(false);
      void navigate({ search: (current) => ({ ...current, tab: next }) });
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [navigate],
  );

  const onRunComplete = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["findings", id] }).then(() => goTo("review"));
  }, [queryClient, id, goTo]);

  const startAnalysis = () => {
    const button = window.document.getElementById("analyse-photos-button") as HTMLButtonElement | null;
    if (!button) return;
    button.scrollIntoView({ behavior: "smooth", block: "center" });
    if (!button.disabled) button.click();
  };
  const pendingNote = Number(
    (typeof window !== "undefined" &&
      window.document.getElementById("analyse-photos-button")?.getAttribute("data-pending")) ||
      0,
  );

  // Once everything on the review step becomes resolved, offer to move on and
  // go there after a short moment unless the person chooses to stay.
  const [autoAdvance, setAutoAdvance] = useState(false);
  const wasReady = useRef<boolean | null>(null);
  useEffect(() => {
    if (!loadedEnough) return;
    if (wasReady.current === false && ready && step === "review") setAutoAdvance(true);
    wasReady.current = ready;
  }, [ready, step, loadedEnough]);
  useEffect(() => {
    if (!autoAdvance) return;
    const timer = window.setTimeout(() => goTo("output"), 3000);
    return () => window.clearTimeout(timer);
  }, [autoAdvance, goTo]);

  if (query.isPending) {
    return (
      <AppShell surface="light">
        <LoadingState label="Loading this report…" />
      </AppShell>
    );
  }

  if (query.isError) {
    return (
      <AppShell surface="light">
        <ErrorState
          title="This report could not be loaded"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      </AppShell>
    );
  }

  if (!query.data) {
    return (
      <AppShell surface="light">
        <EmptyState
          icon={FileText}
          eyebrow="Not found"
          title="No report with that address"
          description="It may have been removed, or it belongs to an organisation you are not a member of."
          action={
            <Button variant="quiet" asChild>
              <Link to="/projects">Back to projects</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const { report, project } = query.data;
  const doc = document.data ?? null;
  const locked = doc?.report.status === "issued";

  // What is still outstanding, in plain words, so nothing is discovered only
  // when the report will not issue.
  const findingList = findings.data ?? [];
  const toConfirm = findingList.filter((finding) => !finding.confirmed).length;
  const blockers = doc ? issueBlockers(doc) : null;
  const stepNote = locked
    ? "Issued. Reopen it to make changes."
    : findingList.length === 0
      ? "Add photographs, then draft the findings."
      : blockers?.blocked
        ? `Not ready to issue yet: ${[
            blockers.notAssessed.length > 0
              ? `${blockers.notAssessed.length} still not assessed`
              : null,
            blockers.tradeMissing.length > 0
              ? `${blockers.tradeMissing.length} with no responsible trade`
              : null,
            blockers.unconfirmed.length > 0
              ? `${blockers.unconfirmed.length} not confirmed by a person`
              : null,
          ]
            .filter(Boolean)
            .join(", ")}.`
        : "Everything is assessed and confirmed — ready to issue.";

  return (
    <AppShell surface="light">
      <nav aria-label="Breadcrumb" className="pb-4 text-sm">
        <Link to="/projects" className="font-medium text-muted-foreground hover:text-foreground">
          {project ? "Projects" : "Custom reports"}
        </Link>
        {project ? (
          <>
            <ChevronRight
              aria-hidden="true"
              className="mx-1 inline size-3.5 text-muted-foreground"
            />
            <Link
              to="/projects/$id"
              params={{ id: project.id }}
              className="font-medium text-muted-foreground hover:text-foreground"
            >
              {project.reference}
            </Link>
          </>
        ) : null}
        <ChevronRight aria-hidden="true" className="mx-1 inline size-3.5 text-muted-foreground" />
        <span className="text-foreground">{report.reference || report.title}</span>
      </nav>


      <header className="border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <p className="eyebrow">{definitionLabel(report.surveyTypeSnapshot)}</p>
          <ReportStatusPill status={report.status} />
          {doc && doc.report.currentVersion > 0 ? (
            <span className="text-xs text-muted-foreground">
              Version {doc.report.currentVersion} · issued{" "}
              {formatDocumentDate(doc.report.issuedAt)}
            </span>
          ) : null}
        </div>
        <h1 className="editorial-title mt-1.5 text-2xl font-semibold sm:text-3xl">
          {report.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Updated {report.updated}</p>


        <AttachToProjectDialog open={attaching} onOpenChange={setAttaching} reportId={report.id} />
      </header>

      <div className="mt-8">
        <ReportStepper current={step} onSelect={goTo} reviewCount={toConfirm} />
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {stepNote}
        </p>
      </div>

      {step === "photos" ? (
        <div className="mt-8 space-y-8">
          <PhotosPanel reportId={report.id} snapshot={report.surveyTypeSnapshot} />
          <AnalysisPanel
            reportId={report.id}
            snapshot={report.surveyTypeSnapshot}
            onRunComplete={onRunComplete}
          />
        </div>
      ) : null}

      {step === "review" ? (
        <div className="mt-8">
          {findings.isPending ? (
            <LoadingState label="Loading findings…" />
          ) : findings.isError ? (
            <ErrorState
              title="Findings could not be loaded"
              error={findings.error}
              onRetry={() => void findings.refetch()}
            />
          ) : findingList.length === 0 ? (
            <EmptyState
              icon={FileText}
              eyebrow="Nothing to review"
              title="No findings on this report yet"
              description="Add photographs and analyse them first."
              action={
                <Button type="button" onClick={() => goTo("photos")}>
                  Back to photos
                </Button>
              }
            />
          ) : (
            <ReviewList
              snapshot={report.surveyTypeSnapshot}
              reportId={report.id}
              findings={findingList}
              onConfirm={onConfirm}
              onConfirmMany={writeConfirmations}
              onEditText={onEditText}
              tradeOptions={tradeOptions}
              onAssignTrade={onAssignTrade}
            />
          )}
        </div>
      ) : null}

      {step === "output" ? (
        <div className="mt-8">
          {document.isPending ? (
            <LoadingState label="Assembling the document…" />
          ) : document.isError ? (
            <ErrorState
              title="The document could not be assembled"
              error={document.error}
              onRetry={() => void document.refetch()}
            />
          ) : doc ? (
            <>
              <div className="mb-6 grid gap-2 sm:flex sm:flex-wrap sm:items-center">
                <ReportActions
                  document={doc}
                  resultView={resultView}
                  prepareSummary
                  onAddToProject={!project ? () => setAttaching(true) : undefined}
                />
              </div>
              {locked ? (
                <p className="mb-5 rounded-lg border border-brand-blue/30 bg-brand-blue-soft px-4 py-3 text-sm text-brand-blue-ink">
                  This report has been issued as version {doc.report.currentVersion} and is locked.
                  Reopen it to make changes; the issued version is kept exactly as it was issued.
                </p>
              ) : null}

              <section className="mb-8 grid gap-4 rounded-xl border border-border bg-surface-raised p-4 shadow-raised sm:grid-cols-2">
                <InlineField
                  label="Report title"
                  value={doc.report.title}
                  readOnly={locked}
                  onSave={(next) => onReportPatch({ title: next }, { title: doc.report.title })}
                />
                <InlineField
                  label="Subtitle"
                  value={doc.report.subtitle ?? ""}
                  readOnly={locked}
                  onSave={(next) =>
                    onReportPatch({ subtitle: next || null }, { subtitle: doc.report.subtitle })
                  }
                />
                <InlineField
                  label="Reference"
                  value={doc.report.reference ?? ""}
                  readOnly={locked}
                  onSave={(next) =>
                    onReportPatch({ reference: next || null }, { reference: doc.report.reference })
                  }
                />
                <InlineField
                  label="Report date"
                  type="date"
                  value={doc.report.reportDate}
                  readOnly={locked}
                  onSave={(next) =>
                    onReportPatch(
                      { report_date: next || doc.report.reportDate },
                      { report_date: doc.report.reportDate },
                    )
                  }
                />
              </section>

              {translation.loading ? (
                <p role="status" aria-live="polite" className="mt-4 text-sm text-muted-foreground">
                  Translating this report…
                </p>
              ) : null}
              {translation.error ? (
                <p role="alert" className="mt-4 text-sm text-fail">
                  This report could not be translated: {translation.error.message} The English
                  version is shown.
                </p>
              ) : null}
              {translation.isTranslatedView ? (
                <p className="mt-4 rounded-xl border border-border bg-surface-sunken px-4 py-3 text-sm text-muted-foreground">
                  This report will be issued in {languageLabel(translation.language)}. English
                  remains the record copy, so editing is off until you set the report language back
                  to English.
                </p>
              ) : null}

              <div className="paper paper-sheet px-5 py-8 sm:px-10 sm:py-12">
                <ReportDocumentView
                  document={translation.document ?? doc}
                  editable={!locked && !translation.isTranslatedView}
                  view={resultView}
                  onViewChange={(next) =>
                    navigate({ search: (prev: ReportSearch) => ({ ...prev, view: next }), replace: true })
                  }
                  onReportPatch={onReportPatch}
                  onFindingPatch={onFindingPatch}
                />
              </div>


              <section className="mt-10 rounded-xl border border-border bg-surface-raised p-4">
                <h2 className="editorial-title flex items-center gap-2 text-base font-semibold">
                  <History aria-hidden="true" className="size-4" />
                  Issued versions
                </h2>
                {(versions.data ?? []).length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Nothing issued yet. Issuing freezes a copy of this document as version 1.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {(versions.data ?? []).map((version) => (
                      <li key={version.id}>
                        Version {version.version} — issued {formatDocumentDate(version.issued_at)}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Thumb-zone bar: the one next thing to do on this step. */}
      {!locked && (step === "photos" || step === "review") ? (
        <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 mt-8 rounded-xl border border-border bg-surface-raised p-3 shadow-raised sm:bottom-4">
          {step === "photos" ? (
            findingList.length > 0 && pendingNote === 0 ? (
              <Button type="button" className="min-h-12 w-full" onClick={() => goTo("review")}>
                Continue to review
              </Button>
            ) : (
              <Button type="button" className="min-h-12 w-full" onClick={startAnalysis}>
                Analyse photos
              </Button>
            )
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {findingList.length - toConfirm} of {findingList.length} confirmed
              </p>
              <Button
                type="button"
                className="min-h-11"
                variant={ready ? "default" : "quiet"}
                onClick={() => goTo("output")}
              >
                Continue to issue
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {autoAdvance ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-[calc(10rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-xl border border-border bg-surface-raised p-4 shadow-raised sm:bottom-24"
        >
          <p className="font-semibold">All findings confirmed</p>
          <p className="mt-1 text-sm text-muted-foreground">Taking you to Issue…</p>
          <div className="mt-3 flex gap-2">
            <Button type="button" className="min-h-11 flex-1" onClick={() => goTo("output")}>
              Continue to issue
            </Button>
            <Button
              type="button"
              variant="quiet"
              className="min-h-11"
              onClick={() => setAutoAdvance(false)}
            >
              Stay here
            </Button>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
