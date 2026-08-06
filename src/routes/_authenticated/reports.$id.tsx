import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileOutput, FileText, ChevronRight, Download, Send } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { ErrorState, LoadingState } from "@/components/query-states";
import { ReportStatusPill } from "@/components/status-pill";
import { ReviewList } from "@/components/review-list";
import { PhotosPanel } from "@/components/photos/photos-panel";
import { DraftFindingsButton } from "@/components/ai/draft-findings-button";

import { findingsQuery, reportQuery } from "@/lib/data";
import { definitionLabel } from "@/lib/survey-types";

type ReportSearch = { tab?: "photos" | "review" | "output" };

export const Route = createFileRoute("/_authenticated/reports/$id")({
  validateSearch: (search: Record<string, unknown>): ReportSearch => {
    const tab = search["tab"];
    return tab === "review" || tab === "output" || tab === "photos" ? { tab } : {};
  },
  head: () => {
    const title = "Report workspace — Report Ready";
    const description =
      "Photographs, AI-drafted findings review and issued output for this report.";
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
  const query = useQuery(reportQuery(id));
  const findings = useQuery(findingsQuery(id));

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
              <Link to="/">Back to projects</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const { report, project } = query.data;

  return (
    <AppShell>
      <nav aria-label="Breadcrumb" className="pb-4 text-sm">
        <Link to="/" className="font-medium text-muted-foreground hover:text-foreground">
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
        </div>
        <h1 className="editorial-title mt-1.5 text-2xl font-semibold sm:text-3xl">
          {report.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Updated {report.updated}</p>
      </header>

      <Tabs defaultValue={tab ?? "photos"} className="mt-6">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="review">Review</TabsTrigger>
          <TabsTrigger value="output">Output</TabsTrigger>
        </TabsList>

        <TabsContent value="photos" className="mt-6">
          <PhotosPanel reportId={report.id} snapshot={report.surveyTypeSnapshot} />
        </TabsContent>

        <TabsContent value="review" className="mt-6">
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


        <TabsContent value="output" className="mt-6">
          <div className="rounded-xl border border-border bg-surface-raised p-5 shadow-raised">
            <p className="eyebrow">Step three</p>
            <h2 className="editorial-title mt-1 text-lg font-semibold">Issue the report</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Once every finding is confirmed, Report Ready produces the client PDF and a per-trade
              extract for each subcontractor in the project directory.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="brand" disabled>
                <Send aria-hidden="true" />
                Issue to client
              </Button>
              <Button variant="quiet" disabled>
                <Download aria-hidden="true" />
                Download draft PDF
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Disabled until all findings are confirmed in the Review tab.
            </p>
          </div>

          <div className="mt-6">
            <EmptyState
              icon={FileOutput}
              title="No issued versions"
              description="Issued PDFs and trade extracts will be listed here with their issue date, recipient and version number."
            />
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
