import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2, Send, Share2, Unlock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { issueBlockers, type ReportDocument } from "@/lib/report/document";
import { issueReport, reopenReport } from "@/lib/report/report-data";
import { synthesiseReport } from "@/lib/ai/synthesis.functions";
import { itemLabels } from "@/lib/item-label";
import { downloadReportPdf } from "@/lib/report/pdf.functions";
import {
  canSharePdf,
  pdfBytesFromBase64,
  savePdfBytes,
  sharePdfBytes,
} from "@/lib/report/save-pdf";
import { ReportLanguageControl } from "@/components/report/report-language";
import type { ResultView } from "@/lib/report/grouping";



/** The report header has one issue action and one device-aware share action. */
export function ReportActions({
  document,
  resultView = "severity",
  prepareSummary = false,
}: {
  document: ReportDocument;
  resultView?: ResultView;
  prepareSummary?: boolean;
}) {
  const queryClient = useQueryClient();
  const [issueOpen, setIssueOpen] = useState(false);
  const [summaryStarted, setSummaryStarted] = useState(false);
  const synthesise = useServerFn(synthesiseReport);
  const buildPdf = useServerFn(downloadReportPdf);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(canSharePdf()), []);

  const blockers = issueBlockers(document);
  const issued = document.report.status === "issued";

  const issue = useMutation({
    mutationFn: () => issueReport(document),
    onSuccess: async (version) => {
      setIssueOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["report-document", document.report.id] });
      await queryClient.invalidateQueries({ queryKey: ["report", document.report.id] });
      await queryClient.invalidateQueries({ queryKey: ["report-versions", document.report.id] });
      toast.success(`Issued as version ${version}`, {
        description: "Earlier versions are kept exactly as they were issued.",
      });
    },
    onError: (error) =>
      toast.error("The report could not be issued", {
        description: error instanceof Error ? error.message : "Unknown error.",
      }),
  });

  const reopen = useMutation({
    mutationFn: () => reopenReport(document.report.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["report-document", document.report.id] });
      await queryClient.invalidateQueries({ queryKey: ["report", document.report.id] });
      toast.success("Reopened for editing", {
        description: "The issued version is unchanged. Re-issuing creates the next version.",
      });
    },
  });

  const summary = useMutation({
    mutationFn: () => synthesise({ data: { reportId: document.report.id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["report-document", document.report.id] });
      toast.success("Report summary drafted", {
        description: "Read and edit it before issuing the report.",
      });
    },
    onError: (error) =>
      toast.error("The report summary could not be drafted", {
        description: error instanceof Error ? error.message : "Unknown error.",
      }),
  });

  useEffect(() => {
    if (
      !prepareSummary ||
      summaryStarted ||
      issued ||
      blockers.blocked ||
      !document.report.draftSummary ||
      Boolean(document.report.executiveSummary?.trim())
    ) {
      return;
    }
    setSummaryStarted(true);
    summary.mutate();
  }, [
    blockers.blocked,
    document.report.draftSummary,
    document.report.executiveSummary,
    issued,
    prepareSummary,
    summary,
    summaryStarted,
  ]);

  const pdf = useMutation({
    mutationFn: async () => {
      const result = await buildPdf({ data: { reportId: document.report.id, view: resultView } });
      const bytes = pdfBytesFromBase64(result.content);
      const outcome = canShare
        ? await sharePdfBytes(bytes, result.filename, document.report.title)
        : await savePdfBytes(bytes, result.filename);
      return { filename: result.filename, outcome };
    },
    onSuccess: (result) => {
      if (result.outcome === "cancelled") return;
      const description =
        result.outcome === "saved"
          ? `Saved as ${result.filename}`
          : result.outcome === "shared"
            ? result.filename
            : `${result.filename} is in your downloads.`;
      toast.success(result.outcome === "shared" ? "Report shared" : "Report saved", { description });
    },
    onError: (error) =>
      toast.error("The report could not be built", {
        description: error instanceof Error ? error.message : "Unknown error.",
      }),
  });

  return (
    <>
      <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
        <ReportLanguageControl
          reportId={document.report.id}
          value={document.report.outputLanguage}
        />
        {issued ? (
          <Button
            type="button"
            variant="quiet"
            className="min-h-11 w-full sm:w-auto"
            disabled={reopen.isPending}
            onClick={() => reopen.mutate()}
          >
            <Unlock aria-hidden="true" className="size-4" />
            Reopen for editing
          </Button>
        ) : (
          <Button
            type="button"
            variant="brand"
            className="min-h-11 w-full sm:w-auto"
            onClick={() => setIssueOpen(true)}
          >
            <Send aria-hidden="true" className="size-4" />
            Issue report
          </Button>
        )}
        <Button
          type="button"
          variant="quiet"
          className="min-h-11 w-full sm:w-auto"
          disabled={pdf.isPending}
          onClick={() => pdf.mutate()}
        >
          {pdf.isPending ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Share2 aria-hidden="true" className="size-4" />
          )}
          Share
        </Button>
      </div>

      <IssueDialog
        open={issueOpen}
        onOpenChange={setIssueOpen}
        document={document}
        blockers={blockers}
        pending={issue.isPending}
        onIssue={() => issue.mutate()}
      />
    </>
  );
}

function IssueDialog({
  open,
  onOpenChange,
  document,
  blockers,
  pending,
  onIssue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: ReportDocument;
  blockers: ReturnType<typeof issueBlockers>;
  pending: boolean;
  onIssue: () => void;
}) {
  const nextVersion = (document.report.currentVersion ?? 0) + 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue as version {nextVersion}</DialogTitle>
          <DialogDescription>
            Issuing freezes a copy of this document. Version {nextVersion} never changes once
            created, and earlier versions are kept exactly as they were issued.
          </DialogDescription>
        </DialogHeader>

        {blockers.blocked ? (
          <div className="space-y-2 rounded-lg border border-flag/40 bg-flag-soft p-3 text-sm">
            <p className="flex items-center gap-2 font-semibold text-flag">
              <AlertTriangle aria-hidden="true" className="size-4" />
              This report cannot be issued yet
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {blockers.notAssessed.length > 0 ? (
                <li>
                  {blockers.notAssessed.length} finding
                  {blockers.notAssessed.length === 1 ? " is" : "s are"} still not assessed:{" "}
                  {itemLabels(blockers.notAssessed.map((finding) => finding.ref))}
                </li>
              ) : null}
              {blockers.tradeMissing.length > 0 ? (
                <li>
                  {blockers.tradeMissing.length} finding
                  {blockers.tradeMissing.length === 1 ? " has" : "s have"} no confirmed responsible
                  trade: {itemLabels(blockers.tradeMissing.map((finding) => finding.ref))}
                </li>
              ) : null}
              {blockers.unconfirmed.length > 0 ? (
                <li>
                  {blockers.unconfirmed.length} finding
                  {blockers.unconfirmed.length === 1 ? " has" : "s have"} not been confirmed by a
                  person: {itemLabels(blockers.unconfirmed.map((finding) => finding.ref))}
                </li>
              ) : null}
            </ul>
            <p className="text-xs text-muted-foreground">
              Resolve them in the schedule below, or in the Review tab.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Every finding is assessed and confirmed. {document.findings.length} finding
            {document.findings.length === 1 ? "" : "s"} will be included.
          </p>
        )}

        <DialogFooter>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="brand" disabled={blockers.blocked || pending} onClick={onIssue}>
            {pending ? <Loader2 aria-hidden="true" className="mr-1.5 size-4 animate-spin" /> : null}
            Issue version {nextVersion}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

