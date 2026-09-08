import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Eye,
  Link2,
  Loader2,
  Lock,
  Printer,
  Send,
  Share2,
  Sparkles,
  Unlock,
} from "lucide-react";

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
import {
  createShareLink,
  issueReport,
  logShareSent,
  reopenReport,
  reportSharesQuery,
  revokeShareLink,
} from "@/lib/report/report-data";
import { isShareLinkLive, shareLinkState, shareUrlForToken } from "@/lib/report/share-url";
import { synthesiseReport } from "@/lib/ai/synthesis.functions";
import { itemLabels } from "@/lib/item-label";
import { downloadReportPdf } from "@/lib/report/pdf.functions";
import type { ResultView } from "@/lib/report/grouping";


/**
 * The output actions live in the report header, visible, never behind a menu:
 * preview, print/PDF, share, and the issue gate itself.
 */
export function ReportActions({
  document,
  organisationId,
  resultView = "severity",
}: {
  document: ReportDocument;
  organisationId: string | null;
  resultView?: ResultView;
}) {
  const queryClient = useQueryClient();
  const [issueOpen, setIssueOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const synthesise = useServerFn(synthesiseReport);
  const buildPdf = useServerFn(downloadReportPdf);


  const printUrl = `/reports/${document.report.id}/print?view=${resultView}`;
  const blockers = issueBlockers(document);
  const issued = document.report.status === "issued";
  // The report itself is the authority on which organisation owns it.
  const orgId = document.organisation?.id ?? organisationId ?? null;

  const openPrint = (auto: boolean) => {
    const url = auto ? `${printUrl}&auto=1` : printUrl;
    const opened = window.open(url, "_blank", "noopener");
    if (!opened) {
      // Popup blocked, or a mobile browser refused the new tab: go there in
      // this tab rather than appearing to do nothing.
      toast.info("Opening the print view in this tab", {
        description: "Your browser blocked the new tab. Use Back to return to the report.",
      });
      window.location.href = url;
    }
  };

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
      toast.success("Summary drafted", {
        description: "AI-generated. Read it and edit it before the report is issued.",
      });
    },
    onError: (error) =>
      toast.error("The summary could not be drafted", {
        description: error instanceof Error ? error.message : "Unknown error.",
      }),
  });

  /** The same file the emails carry, saved straight to the device. */
  const pdf = useMutation({
    mutationFn: () => buildPdf({ data: { reportId: document.report.id, view: resultView } }),
    onSuccess: (result) => {
      const binary = atob(result.content);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = result.filename;
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded", { description: result.filename });
    },
    onError: (error) =>
      toast.error("The PDF could not be built", {
        description: error instanceof Error ? error.message : "Unknown error.",
      }),
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="quiet" size="sm" onClick={() => openPrint(false)}>
          <Eye aria-hidden="true" className="mr-1.5 size-4" />
          Preview
        </Button>
        <Button
          type="button"
          variant="quiet"
          size="sm"
          disabled={pdf.isPending}
          onClick={() => pdf.mutate()}
        >
          {pdf.isPending ? (
            <Loader2 aria-hidden="true" className="mr-1.5 size-4 animate-spin" />
          ) : (
            <Download aria-hidden="true" className="mr-1.5 size-4" />
          )}
          Download PDF
        </Button>
        <Button type="button" variant="quiet" size="sm" onClick={() => openPrint(true)}>
          <Printer aria-hidden="true" className="mr-1.5 size-4" />
          Print

        </Button>
        <Button type="button" variant="quiet" size="sm" onClick={() => setShareOpen(true)}>
          <Share2 aria-hidden="true" className="mr-1.5 size-4" />
          Share
        </Button>
        <Button
          type="button"
          variant="quiet"
          size="sm"
          disabled={summary.isPending || issued}
          onClick={() => summary.mutate()}
        >
          {summary.isPending ? (
            <Loader2 aria-hidden="true" className="mr-1.5 size-4 animate-spin" />
          ) : (
            <Sparkles aria-hidden="true" className="mr-1.5 size-4" />
          )}
          Draft summary
        </Button>

        {issued ? (
          <Button
            type="button"
            variant="quiet"
            size="sm"
            disabled={reopen.isPending}
            onClick={() => reopen.mutate()}
          >
            <Unlock aria-hidden="true" className="mr-1.5 size-4" />
            Reopen for editing
          </Button>
        ) : (
          <Button type="button" variant="brand" size="sm" onClick={() => setIssueOpen(true)}>
            <Send aria-hidden="true" className="mr-1.5 size-4" />
            Issue report
          </Button>
        )}
      </div>

      <IssueDialog
        open={issueOpen}
        onOpenChange={setIssueOpen}
        document={document}
        blockers={blockers}
        pending={issue.isPending}
        onIssue={() => issue.mutate()}
      />

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        reportId={document.report.id}
        reportTitle={document.report.title}
        organisationId={orgId}
        issued={issued}
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

function ShareDialog({
  open,
  onOpenChange,
  reportId,
  reportTitle,
  organisationId,
  issued,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string;
  reportTitle: string;
  organisationId: string | null;
  issued: boolean;
}) {
  const queryClient = useQueryClient();
  const shares = useQuery({ ...reportSharesQuery(reportId), enabled: open });
  // "never" is only offered once the report is issued: an unfinished document
  // should never be permanently public.
  const [expiry, setExpiry] = useState<string>("14");
  const days = expiry === "never" ? null : Number(expiry);
  const [copied, setCopied] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => {
      if (!organisationId) {
        throw new Error(
          "This report is not linked to an organisation, so a share link cannot be created.",
        );
      }
      return createShareLink({ reportId, organisationId, days });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["report-shares", reportId] });
      toast.success("Share link created", {
        description:
          days === null
            ? "The link stays live until you revoke it. Nothing is sent."
            : "Anyone with the link can read the report until it expires. Nothing is sent.",
      });
    },
    onError: (error) =>
      toast.error("The link could not be created", {
        description: error instanceof Error ? error.message : "Unknown error.",
      }),
  });

  const revoke = useMutation({
    mutationFn: (shareId: string) => revokeShareLink(reportId, shareId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["report-shares", reportId] });
      toast.success("Link revoked");
    },
  });

  const urlFor = shareUrlForToken;
  const live = (shares.data ?? []).filter(isShareLinkLive);

  const sendNative = async (share: { id: string; token: string }) => {
    const url = urlFor(share.token);
    // Sending is a human act, and it is recorded.
    void logShareSent(reportId, share.id);
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: reportTitle, url });
        return;
      } catch {
        /* the user dismissed the share sheet */
        return;
      }
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copied", { description: "Paste it into your email or message." });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share a read-only link</DialogTitle>
          <DialogDescription>
            The link opens the report without an account. Confidential findings are never included.
            Nothing is emailed by creating a link.
          </DialogDescription>
        </DialogHeader>

        {!organisationId ? (
          <div className="rounded-lg border border-flag/40 bg-flag-soft p-3 text-sm">
            <p className="flex items-center gap-2 font-semibold text-flag">
              <AlertTriangle aria-hidden="true" className="size-4" />
              No organisation for this report
            </p>
            <p className="mt-1 text-muted-foreground">
              A share link belongs to the organisation that owns the report, and this one could not
              be resolved. Reload the page, and if it persists check the report is still listed
              under your organisation in Settings.
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-3">
            <label className="eyebrow block">
              Expires after
              <select
                className="mt-1 h-10 rounded-md border border-border bg-surface-raised px-2 text-sm"
                value={expiry}
                onChange={(event) => setExpiry(event.target.value)}
              >
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="never" disabled={!issued}>
                  Never expires{issued ? "" : " (issue the report first)"}
                </option>
              </select>
            </label>
            <Button
              variant="brand"
              size="sm"
              disabled={!organisationId || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? (
                <Loader2 aria-hidden="true" className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Link2 aria-hidden="true" className="mr-1.5 size-4" />
              )}
              Create link
            </Button>
            <Button
              variant="quiet"
              size="sm"
              disabled={live.length === 0}
              onClick={() => {
                const first = live[0];
                if (first) void sendNative(first);
              }}
            >
              <Share2 aria-hidden="true" className="mr-1.5 size-4" />
              Send link
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            {days === null
              ? "The link stays live until you revoke it. Anyone who has it can open the report."
              : "The recipient loses access on this date. If this report is the deliverable, choose no expiry or tell them to save a copy."}
          </p>
          {!issued ? (
            <p className="text-xs text-muted-foreground">
              A link with no expiry becomes available once the report is issued.
            </p>
          ) : null}
        </div>

        {live.length === 0 && organisationId ? (
          <p className="text-sm text-muted-foreground">
            There is no active link yet. Create one before sharing — the report cannot be opened
            without it.
          </p>
        ) : null}

        <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">
          {(shares.data ?? []).map((share) => {
            const state = shareLinkState(share);
            const dead = state.kind === "expired" || state.kind === "revoked";
            return (
              <li
                key={share.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs">{urlFor(share.token)}</p>
                  <p className="text-xs text-muted-foreground">{state.label}</p>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="quiet"
                    size="sm"
                    disabled={dead}
                    onClick={async () => {
                      await navigator.clipboard.writeText(urlFor(share.token));
                      setCopied(share.id);
                      toast.success("Link copied");
                    }}
                  >
                    {copied === share.id ? (
                      <Check aria-hidden="true" className="size-4" />
                    ) : (
                      <Copy aria-hidden="true" className="size-4" />
                    )}
                    <span className="sr-only">Copy link</span>
                  </Button>
                  <Button
                    variant="quiet"
                    size="sm"
                    disabled={dead}
                    onClick={() => void sendNative(share)}
                  >
                    <Share2 aria-hidden="true" className="size-4" />
                    <span className="sr-only">Send link</span>
                  </Button>
                  <Button
                    variant="quiet"
                    size="sm"
                    disabled={dead || revoke.isPending}
                    onClick={() => revoke.mutate(share.id)}
                  >
                    <Lock aria-hidden="true" className="size-4" />
                    <span className="sr-only">Revoke link</span>
                  </Button>
                </div>
              </li>
            );
          })}

          {shares.data && shares.data.length === 0 ? (
            <li className="text-sm text-muted-foreground">No links have been created yet.</li>
          ) : null}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

