import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/query-states";
import { ReportDocumentView } from "@/components/report/report-document-view";
import { sharedDocument } from "@/lib/report/shared-document";

/**
 * Public, read-only view of a shared report. No account, no editing, and no
 * confidential finding — the endpoint behind it excludes them.
 */
export const Route = createFileRoute("/shared/$token")({
  head: () => {
    const title = "Shared survey report — Report Ready";
    const description = "A read-only copy of a construction survey report shared by its author.";
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
  component: SharedReport,
});

function SharedReport() {
  const { token } = Route.useParams();
  const query = useQuery({
    queryKey: ["shared-report", token],
    queryFn: async () => {
      const response = await fetch(`/api/public/shared-report/${token}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "This link could not be opened.");
      return sharedDocument(payload);
    },
    retry: false,
  });

  return (
    <div className="min-h-dvh bg-surface">
      <header className="no-print border-b border-border bg-surface-raised">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <p className="editorial-title text-base font-semibold">Report Ready</p>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium"
          >
            <Printer aria-hidden="true" className="size-4" />
            Print or save as PDF
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {query.isPending ? (
          <LoadingState label="Opening the shared report…" />
        ) : query.isError ? (
          <ErrorState title="This link could not be opened" error={query.error} />
        ) : query.data ? (
          <div className="paper paper-sheet px-5 py-8 sm:px-10 sm:py-12">
            <ReportDocumentView document={query.data} print />
          </div>
        ) : null}
      </main>

    </div>
  );
}
