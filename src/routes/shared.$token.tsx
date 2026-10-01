import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Printer } from "lucide-react";
import { BRAND_CREDIT } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/query-states";
import { ReportDocumentView } from "@/components/report/report-document-view";
import { sharedDocument } from "@/lib/report/shared-document";
import { getSharedReportMeta } from "@/lib/report/share-meta.functions";
import { reportPrintPageClass } from "@/lib/report/print-layout";
import { absoluteUrl } from "@/lib/site-url";

/**
 * Public, read-only view of a shared report. No account, no editing, and no
 * confidential finding — the endpoint behind it excludes them.
 */
export const Route = createFileRoute("/shared/$token")({
  loader: ({ params }) => getSharedReportMeta({ data: { token: params.token } }),
  head: ({ params, loaderData }) => {
    // Title, reference and date only. Never any finding text.
    const parts = [
      loaderData?.title,
      loaderData?.reference ? `Ref ${loaderData.reference}` : null,
      loaderData?.issuedAt
        ? `Issued ${new Date(loaderData.issuedAt).toLocaleDateString("en-GB")}`
        : loaderData?.reportDate
          ? new Date(loaderData.reportDate).toLocaleDateString("en-GB")
          : null,
    ].filter(Boolean) as string[];
    const title = parts.length
      ? `${parts.join(" · ")} — instructBrain`
      : "Shared survey report — instructBrain";
    const description = parts.length
      ? `A read-only copy of ${parts.join(" · ")}, shared from instructBrain.`
      : "A read-only copy of a construction survey report shared by its author.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: absoluteUrl(`/shared/${params.token}`) },
        { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: SharedReport,
});

type LinkProblem = { heading: string; body: string };

function problemFor(reason: string | null): LinkProblem {
  if (reason === "revoked") {
    return {
      heading: "Access to this report has been withdrawn",
      body: "The sender has withdrawn this link. If you still need the report, contact whoever sent it to you.",
    };
  }
  if (reason === "expired") {
    return {
      heading: "This link has expired",
      body: "Share links are set to expire on a date chosen by the sender. Ask them for a new link and it will open straight away.",
    };
  }
  return {
    heading: "This link could not be opened",
    body: "The link may be incomplete or no longer in use. Check you copied all of it, or ask the sender for a new one.",
  };
}

function SharedReport() {
  const { token } = Route.useParams();
  const query = useQuery({
    queryKey: ["shared-report", token],
    queryFn: async () => {
      const response = await fetch(`/api/public/shared-report/${token}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(payload?.error ?? "This link could not be opened.") as Error & {
          reason?: string;
        };
        error.reason = payload?.reason ?? null;
        throw error;
      }
      if (payload?.pdfOnly) {
        return { pdfOnly: true as const, ...(payload as PdfOnlyMeta) };
      }
      return { pdfOnly: false as const, document: sharedDocument(payload) };
    },
    retry: false,
  });

  const reason = (query.error as (Error & { reason?: string }) | null)?.reason ?? null;
  const problem = problemFor(reason);

  if (query.data?.pdfOnly) {
    return <PdfLanding token={token} meta={query.data} />;
  }
  if (!query.data && (query.isPending || query.isError)) {
    // Branded wrapper for loading and dead links.
    return (
      <div style={{ backgroundImage: "var(--blueprint-grid)" }} className="flex min-h-dvh items-center justify-center bg-brand-blue px-4 text-white">
        <div className="w-full max-w-xl rounded-xl border border-primary-foreground/20 bg-brand-blue p-8 text-center shadow-lg">
          <Wordmark />
          {query.isPending ? (
            <p className="mt-6 text-sm text-white/80">Opening the shared report…</p>
          ) : (
            <>
              <h1 className="mt-6 text-xl font-semibold">{problem.heading}</h1>
              <p className="mt-2 text-sm text-white/80">{problem.body}</p>
            </>
          )}
          <p className="mt-8 text-[11px] uppercase tracking-[0.18em] text-white/60">{BRAND_CREDIT}</p>
        </div>
      </div>
    );
  }
  const doc = query.data && !query.data.pdfOnly ? query.data.document : null;

  return (
    <div className="min-h-dvh bg-surface">
      <header className="no-print border-b border-border bg-surface-raised">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <p className="editorial-title text-base font-semibold">instructBrain</p>
          {doc ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Save your own copy — this link may be withdrawn.
              </p>
              <Button type="button" variant="brand" onClick={() => window.print()}>
                <Printer aria-hidden="true" className="mr-1.5 size-4" />
                Print or save as PDF
              </Button>
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {doc ? (
          <div className={`paper paper-sheet px-5 py-8 sm:px-10 sm:py-12 ${reportPrintPageClass(doc)}`}>
            <ReportDocumentView document={doc} print />
          </div>
        ) : (
          <LoadingState label="Opening the shared report…" />
        )}
      </main>
    </div>
  );
}

type PdfOnlyMeta = {
  title: string;
  reference: string | null;
  issuedAt: string | null;
  organisationName: string | null;
};

function Wordmark() {
  return (
    <p className="font-[Audiowide] text-2xl" aria-label="instructBrain">
      <span className="text-white">instruct</span>
      <span className="text-brand-accent">Brain</span>
    </p>
  );
}

function PdfLanding({ token, meta }: { token: string; meta: PdfOnlyMeta }) {
  const pdfUrl = `/api/public/shared-report-pdf/${token}`;
  return (
    <div style={{ backgroundImage: "var(--blueprint-grid)" }} className="flex min-h-dvh items-center justify-center bg-brand-blue px-4 py-10 text-white">
      <div className="w-full max-w-xl rounded-xl border border-primary-foreground/20 bg-brand-blue p-8 text-center shadow-lg">
        <Wordmark />
        {meta.organisationName ? (
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">
            {meta.organisationName}
          </p>
        ) : null}
        <h1 className="mt-2 text-2xl font-semibold">{meta.title}</h1>
        <p className="mt-2 text-sm text-white/80">
          {[
            meta.reference ? `Ref ${meta.reference}` : null,
            meta.issuedAt ? `Issued ${new Date(meta.issuedAt).toLocaleDateString("en-GB")}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild variant="brand" size="lg" className="min-h-12">
            <a href={pdfUrl} target="_blank" rel="noopener">
              <FileText aria-hidden="true" className="mr-1.5 size-4" />
              Open PDF
            </a>
          </Button>
          <Button asChild variant="outline" size="lg" className="min-h-12">
            <a href={`${pdfUrl}?download=1`}>
              <Download aria-hidden="true" className="mr-1.5 size-4" />
              Download PDF
            </a>
          </Button>
        </div>
        <p className="mt-6 text-xs text-white/70">
          This is the finished, issued report. Save your own copy — this link may be withdrawn.
        </p>
        <p className="mt-8 text-[11px] uppercase tracking-[0.18em] text-white/60">{BRAND_CREDIT}</p>
      </div>
    </div>
  );
}
