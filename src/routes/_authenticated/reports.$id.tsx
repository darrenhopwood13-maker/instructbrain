import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, ChevronRight, History } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { ErrorState, LoadingState } from "@/components/query-states";
import { ReportStatusPill } from "@/components/status-pill";
import { ReviewList } from "@/components/review-list";
import { PhotosPanel } from "@/components/photos/photos-panel";
import { AnalysisPanel } from "@/components/ai/analysis-panel";
import { ReportDocumentView } from "@/components/report/report-document-view";
import { ReportActions } from "@/components/report/report-actions";
import { InlineField } from "@/components/report/inline-field";

import { findingsQuery, reportQuery } from "@/lib/data";
import {
  reportDocumentQuery,
  reportVersionsQuery,
  updateFinding,
  updateReportFields,
  type FindingPatch,
  type ReportPatch,
} from "@/lib/report/report-data";
import { formatDocumentDate, type DocFinding } from "@/lib/report/document";
import { definitionLabel } from "@/lib/survey-types";
import { useOrganisations } from "@/lib/use-organisations";

type ReportSearch = { tab?: "photos" | "review" | "output" };

export const Route = createFileRoute("/_authenticated/reports/$id")({
  validateSearch: (search: Record<string, unknown>): ReportSearch => {
    const tab = search["tab"];
    return tab === "review" || tab === "output" || tab === "photos" ? { tab } : {};
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
      ],
    };
  },
  component: ReportWorkspace,
});

function ReportWorkspace() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  const queryClient = useQueryClient();
  const { organisationId } = useOrganisations();
  const query = useQuery(reportQuery(id));
  const findings = useQuery(findingsQuery(id));
  const document = useQuery(reportDocumentQuery(id));
  const versions = useQuery(reportVersionsQuery(id));

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

  if (query.isPending) {
    return (
      <AppShell>
        <LoadingState label="Loading this report…" />
      </AppShell>
    );
  }

  if (query.isError) {
    return (
      <AppShell>
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
      <AppShell>
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

  return (
    <AppShell>
      <nav aria-label="Breadcrumb" className="pb-4 text-sm">
        <Link to="/projects" className="font-medium text-muted-foreground hover:text-foreground">
          Projects
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
        <span className="text-foreground">{report.reference}</span>
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

        {doc ? (
          <div className="mt-4">
            <ReportActions document={doc} organisationId={organisationId} />
          </div>
        ) : null}
      </header>

      <Tabs defaultValue={tab ?? "photos"} className="mt-10">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="review">Review</TabsTrigger>
          <TabsTrigger value="output">Report</TabsTrigger>
        </TabsList>

        <TabsContent value="photos" className="mt-10">
          <PhotosPanel reportId={report.id} snapshot={report.surveyTypeSnapshot} />
        </TabsContent>

        <TabsContent value="review" className="mt-10">
          <div className="mb-5">
            <AnalysisPanel reportId={report.id} snapshot={report.surveyTypeSnapshot} />
          </div>

          {findings.isPending ? (
            <LoadingState label="Loading findings…" />
          ) : findings.isError ? (
            <ErrorState
              title="Findings could not be loaded"
              error={findings.error}
              onRetry={() => void findings.refetch()}
            />
          ) : (findings.data ?? []).length === 0 ? (
            <EmptyState
              icon={FileText}
              eyebrow="Nothing to review"
              title="No findings on this report yet"
              description="Upload photographs on the Photos tab, then draft findings from them here."
            />
          ) : (
            <ReviewList snapshot={report.surveyTypeSnapshot} findings={findings.data ?? []} />
          )}
        </TabsContent>

        <TabsContent value="output" className="mt-10">
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

              <div className="paper paper-sheet px-5 py-8 sm:px-10 sm:py-12">
                <ReportDocumentView
                  document={doc}
                  editable={!locked}
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
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
