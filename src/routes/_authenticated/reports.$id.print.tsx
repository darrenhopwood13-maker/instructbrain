import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ErrorState, LoadingState } from "@/components/query-states";
import { downloadReportPdf } from "@/lib/report/pdf.functions";
import { pdfBytesFromBase64 } from "@/lib/report/save-pdf";
import { safeResultView } from "@/lib/report/grouping";

/**
 * The report as a file, at the address the Print button has always used.
 *
 * This route used to render the document and ask the browser to print it, which made a
 * different and worse document from the same report: photographs below the fold missing
 * from five of seven plate pages, "Page 0 of 0" where the page number should be, and
 * every marked item on a photograph boxed onto the one picture.
 *
 * The app already builds the right file — one picture per item, real page numbers — and
 * it is the same file the emails carry. So this hands that over instead. One button,
 * one document, nothing for anyone to choose between.
 */
export const Route = createFileRoute("/_authenticated/reports/$id/print")({
  validateSearch: (search: Record<string, unknown>) => ({
    view: safeResultView(search["view"]),
  }),
  head: () => {
    const title = "Report PDF — instructBrain";
    const description = "The report as the PDF it is sent as.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: OpenReportPdf,
});

function OpenReportPdf() {
  const { id } = Route.useParams();
  const { view } = Route.useSearch();
  const build = useServerFn(downloadReportPdf);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await build({ data: { reportId: id, view } });
        if (cancelled) return;
        const bytes = pdfBytesFromBase64(result.content);
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        // Handed to the browser's own PDF viewer, which prints, saves and numbers the
        // pages correctly. The blob URL is deliberately not revoked: revoking it as
        // this screen unmounts can pull the file out from under the viewer.
        window.location.replace(url);
      } catch (caught) {
        if (!cancelled) setError(caught);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, view, build]);

  if (error) {
    return <ErrorState title="That PDF could not be built" error={error} />;
  }
  return <LoadingState label="Building the PDF…" />;
}
