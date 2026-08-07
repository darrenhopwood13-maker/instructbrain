import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ErrorState, LoadingState } from "@/components/query-states";
import { distributionPlanQuery, findPlanRow } from "@/lib/distribution/distribution-data";
import { formatDocumentDate } from "@/lib/report/document";
import { formatTarget } from "@/lib/findings/due-date";

/**
 * A per-trade extract, print-styled exactly like the main report so the two
 * documents read as one family. Self-contained: the recipient sees the project,
 * the report reference and the date, and only their own items.
 *
 * Confidential findings never reach this page — `buildExtractDocument` throws
 * rather than render if one is ever passed in.
 */
export const Route = createFileRoute("/_authenticated/reports/$id/extract/$group")({
  validateSearch: (search: Record<string, unknown>) => ({
    auto: search["auto"] === "1" || search["auto"] === true ? true : undefined,
  }),
  head: () => {
    const title = "Trade extract — instructBrain";
    const description = "Print-ready extract of one trade's items from a survey report.";
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
  component: PrintExtract,
});

function PrintExtract() {
  const { id, group } = Route.useParams();
  const { auto } = Route.useSearch();
  const query = useQuery(distributionPlanQuery(id));
  const row = findPlanRow(query.data, decodeURIComponent(group));

  useEffect(() => {
    if (auto && row) {
      const timer = setTimeout(() => window.print(), 800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [auto, row]);

  if (query.isPending) return <LoadingState label="Assembling the extract…" />;
  if (query.isError) {
    return <ErrorState title="This extract could not be assembled" error={query.error} />;
  }
  if (!row) {
    return (
      <ErrorState
        title="Nothing to extract"
        error="There are no items in that group on this report."
      />
    );
  }

  const doc = row.document;
  const runningLine = [
    doc.reportTitle,
    doc.reportReference ?? "No reference",
    formatDocumentDate(doc.reportDate),
    row.label,
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
          Use your browser&rsquo;s print dialog to save this extract as a PDF.
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
        <header className="rule-bottom pb-6">
          <p className="eyebrow">{doc.organisationName ?? "Survey report extract"}</p>
          <h1 className="editorial-title mt-2 text-3xl font-semibold">{row.label}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {doc.projectName}
            {doc.projectAddress ? ` · ${doc.projectAddress}` : ""}
          </p>
          <dl className="mt-4 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Report</dt>
              <dd className="font-medium">{doc.reportTitle}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Reference</dt>
              <dd className="font-medium">{doc.reportReference ?? "Not referenced"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Date</dt>
              <dd className="font-medium">{formatDocumentDate(doc.reportDate)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Items</dt>
              <dd className="font-medium">{row.itemCount}</dd>
            </div>
          </dl>
        </header>

        <section className="mt-8 space-y-6">
          <h2 className="editorial-title text-xl font-semibold">Items for action</h2>
          {doc.items.map((item) => (
            <article key={item.ref} className="rule-top break-inside-avoid pt-4">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="eyebrow">{item.ref}</span>
                <span className="text-sm font-semibold">
                  {item.severityLabel || "Severity not recorded"}
                </span>
                <span className="ml-auto text-sm text-muted-foreground">
                  Target: {formatTarget(query.data?.snapshot ?? null, null, item.dueDate)}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {item.location || "Location not recorded"}
              </p>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed">
                {item.action || "No action recorded."}
              </p>
            </article>
          ))}
        </section>

        <footer className="rule-top mt-10 pt-4 text-xs text-muted-foreground">
          This extract lists only the items attributed to {row.label} on {doc.reportTitle}. It is
          not the full report.
        </footer>
      </main>
    </div>
  );
}
