import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { FileOutput, ChevronRight, Download, Send } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { ReportStatusPill } from "@/components/status-pill";
import { ReviewList } from "@/components/review-list";
import { PhotosPanel } from "@/components/photos/photos-panel";
import { getReport, getProject, findingsForSnapshot } from "@/lib/mock-data";
import { definitionLabel } from "@/lib/survey-types";


export const Route = createFileRoute("/reports/$id")({
  loader: ({ params }) => {
    const report = getReport(params.id);
    if (!report) throw notFound();
    return { report, project: getProject(report.projectId) };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.report.title} — Report Ready` : "Report — Report Ready";
    const description = loaderData
      ? `${definitionLabel(loaderData.report.surveyTypeSnapshot)} report workspace: photographs, AI-drafted findings review and issued output.`
      : "Report workspace.";
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
  const { report, project } = Route.useLoaderData();

  return (
    <AppShell>
      <nav aria-label="Breadcrumb" className="pb-4 text-sm">
        <Link to="/" className="font-medium text-muted-foreground hover:text-foreground">
          Projects
        </Link>
        <ChevronRight aria-hidden="true" className="mx-1 inline size-3.5 text-muted-foreground" />
        {project ? (
          <Link
            to="/projects/$id"
            params={{ id: project.id }}
            className="font-medium text-muted-foreground hover:text-foreground"
          >
            {project.reference}
          </Link>
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
        <p className="mt-2 text-sm text-muted-foreground">
          {report.author} · Updated {report.updated}
        </p>
      </header>

      <Tabs defaultValue="photos" className="mt-6">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="review">Review</TabsTrigger>
          <TabsTrigger value="output">Output</TabsTrigger>
        </TabsList>

        <TabsContent value="photos" className="mt-6">
          <PhotosPanel reportId={report.id} snapshot={report.surveyTypeSnapshot} />
        </TabsContent>


        <TabsContent value="review" className="mt-6">
          <ReviewList
            snapshot={report.surveyTypeSnapshot}
            initialFindings={findingsForSnapshot(report.surveyTypeSnapshot)}
          />
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
