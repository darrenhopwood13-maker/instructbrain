import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ErrorState, LoadingState } from "@/components/query-states";
import { ReportDocumentView } from "@/components/report/report-document-view";
import { reportDocumentQuery } from "@/lib/report/report-data";
import { formatDocumentDate } from "@/lib/report/document";

/**
 * The print surface. The browser's own print engine paginates and writes the
 * PDF, so a 150-photograph report is never rasterised in JavaScript.
 *
 * Every continuation page carries the running header: title, reference, issue
 * date and page number.
 */
export const Route = createFileRoute("/_authenticated/reports/$id/print")({
  validateSearch: (search: Record<string, unknown>) => ({
    auto: search["auto"] === "1" || search["auto"] === true ? true : undefined,
  }),
  head: () => {
    const title = "Report document — instructBrain";
    const description = "Print-ready view of the assembled survey report.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: PrintReport,
});

function PrintReport() {
  const { id } = Route.useParams();
  const { auto } = Route.useSearch();
  const query = useQuery(reportDocumentQuery(id));
  const document = query.data ?? null;

  useEffect(() => {
    if (auto && document) {
      const timer = setTimeout(() => window.print(), 800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [auto, document]);

  if (query.isPending) return <LoadingState label="Assembling the document…" />;
  if (query.isError) {
    return <ErrorState title="This report could not be assembled" error={query.error} />;
  }
  if (!document) {
    return <ErrorState title="Report not found" error="No report with that address." />;
  }

  const runningLine = [
    document.report.title,
    document.report.reference ?? "No reference",
    document.report.status === "issued"
      ? `Issued ${formatDocumentDate(document.report.issuedAt)}`
      : `Draft — ${formatDocumentDate(document.report.reportDate)}`,
  ].join(" · ");

  return (
    <div className="paper print-surface min-h-dvh">
      <div className="print-running-header" aria-hidden="true">
        <span>
          <span className="font-semibold">instructBrain</span>
          {" · "}
          {runningLine}
        </span>
        <span className="print-page-number" />
      </div>


      <div className="no-print mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 pt-6">
        <p className="text-sm text-muted-foreground">
          Use your browser&rsquo;s print dialog to save this as a PDF. Turn on
          &ldquo;Headers and footers&rdquo; to number the pages.
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-brand-accent px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Print or save as PDF
        </button>
      </div>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <ReportDocumentView document={document} print />
      </main>
    </div>

  );
}
