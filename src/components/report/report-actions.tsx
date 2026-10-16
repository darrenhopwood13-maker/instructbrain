import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Download,
  Eye,
  FolderInput,
  FolderOutput,
  Link2,
  Loader2,
  Mail,
  Send,
  Share2,
  Smartphone,
  Unlock,
  Users,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { issueBlockers, type ReportDocument } from "@/lib/report/document";
import { createShareLink, issueReport, reopenReport } from "@/lib/report/report-data";
import { shareUrlForToken } from "@/lib/report/share-url";
import { synthesiseReport } from "@/lib/ai/synthesis.functions";
import { itemLabel } from "@/lib/item-label";
import { downloadReportPdf } from "@/lib/report/pdf.functions";
import {
  canSharePdf,
  pdfBytesFromBase64,
  savePdfBytes,
  sharePdfBytes,
} from "@/lib/report/save-pdf";
import { ReportLanguageControl } from "@/components/report/report-language";
import { isManualOnly } from "@/lib/survey-types";
import { sendManualReportPdf, sendReportShared } from "@/lib/email/email.functions";
import type { ResultView } from "@/lib/report/grouping";

/** The report header has one issue action and one Share menu holding every way out. */
export function ReportActions({
  document,
  resultView = "severity",
  prepareSummary = false,
  onAddToProject,
  onDetachFromProject,
}: {
  document: ReportDocument;
  resultView?: ResultView;
  prepareSummary?: boolean;
  onAddToProject?: (() => void) | undefined;
  onDetachFromProject?: (() => void) | undefined;
}) {
  const queryClient = useQueryClient();
  const [issueOpen, setIssueOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  /**
   * Which email the one dialog is sending: the report as a PDF attachment, or
   * the link that carries it. One dialog, because the fields and the rule (a
   * person presses send, nothing else does) are identical either way.
   */
  const [emailMode, setEmailMode] = useState<"pdf" | "link">("pdf");
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
      toast.success(`Published as version ${version}`, {
        description: "Earlier versions are kept exactly as they were published.",
      });
    },
    onError: (error) =>
      toast.error("The report could not be published", {
        description: error instanceof Error ? error.message : "Unknown error.",
      }),
  });

  const reopen = useMutation({
    mutationFn: () => reopenReport(document.report.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["report-document", document.report.id] });
      await queryClient.invalidateQueries({ queryKey: ["report", document.report.id] });
      toast.success("Reopened for editing", {
        description:
          "The published version is unchanged. Publishing again creates the next version.",
      });
    },
  });

  const summary = useMutation({
    mutationFn: () => synthesise({ data: { reportId: document.report.id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["report-document", document.report.id] });
      toast.success("Report summary drafted", {
        description: "Read and edit it before publishing the report.",
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
      isManualOnly(document.snapshot) ||
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

  const link = useMutation({
    mutationFn: async () => {
      const share = await createShareLink({
        reportId: document.report.id,
        organisationId: document.organisation?.id ?? "",
        days: 30,
      });
      const url = shareUrlForToken(share.token);
      let copied = false;
      try {
        await navigator.clipboard.writeText(url);
        copied = true;
      } catch {
        copied = false;
      }
      return { url, copied };
    },
    onSuccess: async ({ url, copied }) => {
      await queryClient.invalidateQueries({ queryKey: ["report-shares", document.report.id] });
      toast.success(copied ? "Link copied" : "Link created", {
        description: `${url} — works for 30 days.`,
        duration: 10000,
      });
    },
    onError: (error) =>
      toast.error("The link could not be created", {
        description: error instanceof Error ? error.message : "Unknown error.",
      }),
  });

  const emailPdf = useMutation({
    mutationFn: () =>
      sendManualReportPdf({
        data: {
          reportId: document.report.id,
          email: recipientEmail,
          name: recipientName || null,
        },
      }),
    onSuccess: (outcome) => {
      if (!outcome.ok) {
        toast.error("The PDF was not sent", { description: outcome.error ?? "Please try again." });
        return;
      }
      setEmailOpen(false);
      setRecipientName("");
      setRecipientEmail("");
      toast.success("PDF sent", { description: `Sent to ${recipientEmail}.` });
    },
    onError: (error) =>
      toast.error("The PDF was not sent", {
        description: error instanceof Error ? error.message : "Nothing was sent.",
      }),
  });

  /**
   * Send the link itself, rather than the file.
   *
   * Dal: "when we send a report by link and we select by email, can we make sure
   * it's a branded link with details about viewing and downloading". Until now
   * that was impossible from the app: the menu minted a link and copied it to the
   * clipboard, and the branded email built to carry it had no button anywhere -
   * `sendReportShared` was referenced only by a test. So the only way to send a
   * link was to paste it into the person's own mail client, unbranded and
   * unexplained.
   *
   * The link is minted first because the email needs its id, and it is minted
   * once per send: the email names one link, so what the client holds is what the
   * app can account for.
   */
  const emailLink = useMutation({
    mutationFn: async () => {
      const share = await createShareLink({
        reportId: document.report.id,
        organisationId: document.organisation?.id ?? "",
        days: 30,
      });
      const outcome = await sendReportShared({
        data: {
          reportId: document.report.id,
          shareId: share.id,
          email: recipientEmail.trim(),
          name: recipientName || null,
        },
      });
      return { outcome, email: recipientEmail.trim() };
    },
    onSuccess: async ({ outcome, email }) => {
      if (!outcome.ok) {
        toast.error("The link was not sent", { description: outcome.error ?? "Please try again." });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["report-shares", document.report.id] });
      setEmailOpen(false);
      setRecipientName("");
      setRecipientEmail("");
      toast.success("Link sent", { description: `Sent to ${email}. It works for 30 days.` });
    },
    onError: (error) =>
      toast.error("The link was not sent", {
        description: error instanceof Error ? error.message : "Nothing was sent.",
      }),
  });

  const pdf = useMutation({
    mutationFn: async (mode: "download" | "share") => {
      const result = await buildPdf({ data: { reportId: document.report.id, view: resultView } });
      const bytes = pdfBytesFromBase64(result.content);
      const outcome =
        mode === "share"
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
      toast.success(result.outcome === "shared" ? "Report shared" : "Report saved", {
        description,
      });
    },
    onError: (error) =>
      toast.error("The report could not be built", {
        description: error instanceof Error ? error.message : "Unknown error.",
      }),
  });

  return (
    <>
      <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
        {!isManualOnly(document.snapshot) ? (
          <ReportLanguageControl
            reportId={document.report.id}
            value={document.report.outputLanguage}
          />
        ) : null}
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
            Publish report
          </Button>
        )}
        {/*
          The distribution screen existed with no way in: no button, no menu item,
          no link anywhere in the app pointed at it, so its only door was the URL.
          It sits here, as a button rather than a menu item, because a control
          nobody can find is the same as a control that is not there.
        */}
        <Button variant="quiet" className="min-h-11 w-full sm:w-auto" asChild>
          <Link to="/reports/$id/distribute" params={{ id: document.report.id }}>
            <Users aria-hidden="true" className="size-4" />
            Distribute
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="quiet"
              className="min-h-11 w-full sm:w-auto"
              disabled={
                pdf.isPending || link.isPending || emailPdf.isPending || emailLink.isPending
              }
            >
              {pdf.isPending || link.isPending ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Share2 aria-hidden="true" className="size-4" />
              )}
              Share
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem asChild className="min-h-11">
              <Link
                to="/reports/$id/print"
                params={{ id: document.report.id }}
                search={{ view: resultView }}
              >
                <Eye aria-hidden="true" className="size-4" />
                Open the report PDF
              </Link>
            </DropdownMenuItem>
            {isManualOnly(document.snapshot) ? (
              <>
                <DropdownMenuItem
                  className="min-h-11"
                  disabled={!issued}
                  onSelect={() => link.mutate()}
                >
                  <Link2 aria-hidden="true" className="size-4" />
                  {issued ? "Create PDF link" : "Publish before creating a link"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="min-h-11"
                  disabled={!issued}
                  onSelect={() => {
                    setEmailMode("pdf");
                    setEmailOpen(true);
                  }}
                >
                  <Send aria-hidden="true" className="size-4" />
                  {issued ? "Email PDF" : "Publish before emailing"}
                </DropdownMenuItem>
              </>
            ) : (
              // A client link is a client-facing act: it needs a published
              // report behind it, exactly as the manualOnly path already
              // required. Until then the row says why instead of silently
              // minting a link to a draft.
              <DropdownMenuItem
                className="min-h-11"
                disabled={!issued}
                onSelect={() => link.mutate()}
              >
                <Link2 aria-hidden="true" className="size-4" />
                {issued ? "Create link" : "Publish before creating a link"}
              </DropdownMenuItem>
            )}
            {/*
              Outside the branch on purpose. Sending the link in the branded email
              is not specific to one kind of report: a manual photographic report
              shares as its frozen PDF exactly as any other issued report does, so
              it takes the same email. Dal, wanting the whole app covered:
              "Needs to operational throughout the app."
            */}
            <DropdownMenuItem
              className="min-h-11"
              disabled={!issued}
              onSelect={() => {
                setEmailMode("link");
                setEmailOpen(true);
              }}
            >
              <Mail aria-hidden="true" className="size-4" />
              {issued ? "Send link by email" : "Publish before sending the link"}
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-11" onSelect={() => pdf.mutate("download")}>
              <Download aria-hidden="true" className="size-4" />
              {issued ? "Download report" : "Download draft PDF"}
            </DropdownMenuItem>
            {canShare ? (
              <DropdownMenuItem className="min-h-11" onSelect={() => pdf.mutate("share")}>
                <Smartphone aria-hidden="true" className="size-4" />
                Share via device
              </DropdownMenuItem>
            ) : null}
            {onAddToProject ? (
              <DropdownMenuItem className="min-h-11" onSelect={onAddToProject}>
                <FolderInput aria-hidden="true" className="size-4" />
                Add to project
              </DropdownMenuItem>
            ) : null}
            {onDetachFromProject ? (
              <DropdownMenuItem className="min-h-11" onSelect={onDetachFromProject}>
                <FolderOutput aria-hidden="true" className="size-4" />
                Detach from project
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <IssueDialog
        open={issueOpen}
        onOpenChange={setIssueOpen}
        document={document}
        blockers={blockers}
        pending={issue.isPending}
        onIssue={() => issue.mutate()}
      />
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {emailMode === "link" ? "Send the report link" : "Email published PDF"}
            </DialogTitle>
            <DialogDescription>
              {emailMode === "link"
                ? "The recipient gets a branded email carrying the link, telling them how to view the report and how to download their own copy. The link works for 30 days. Nothing is sent until you press Send link."
                : "The recipient receives the published report as a PDF attachment. Nothing is sent until you press Send PDF."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="manual-pdf-recipient-name">Recipient name</Label>
              <Input
                id="manual-pdf-recipient-name"
                value={recipientName}
                onChange={(event) => setRecipientName(event.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="manual-pdf-recipient-email">Recipient email</Label>
              <Input
                id="manual-pdf-recipient-email"
                type="email"
                required
                value={recipientEmail}
                onChange={(event) => setRecipientEmail(event.target.value)}
                autoComplete="email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="quiet" onClick={() => setEmailOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              disabled={
                (emailMode === "link" ? emailLink.isPending : emailPdf.isPending) ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(recipientEmail.trim())
              }
              onClick={() => (emailMode === "link" ? emailLink.mutate() : emailPdf.mutate())}
            >
              {(emailMode === "link" ? emailLink.isPending : emailPdf.isPending) ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Send aria-hidden="true" className="size-4" />
              )}
              {emailMode === "link" ? "Send link" : "Send PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * The items a blocker names, each one a tap that lands on the finding itself.
 * A list of bare names ("Item 4, Item 3") tells a person what is wrong and gives
 * them no way to act on it, which is the whole complaint this answers.
 */
function BlockerRefs({
  findings,
  onJump,
}: {
  findings: Array<{ ref: string | null }>;
  onJump: (ref: string | null) => void;
}) {
  return (
    <span className="mt-1 flex flex-wrap gap-1.5">
      {findings.map((finding, index) => (
        <button
          key={finding.ref ?? index}
          type="button"
          onClick={() => onJump(finding.ref)}
          className="min-h-9 rounded-md border border-flag/50 bg-surface-raised px-2 py-1 font-semibold text-flag underline decoration-dotted underline-offset-2"
        >
          {itemLabel(finding.ref)}
        </button>
      ))}
    </span>
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

  /**
   * Close first, then scroll: the dialog holds a scroll lock while it is open, so
   * scrolling with it still up does nothing at all. `window.document`, because
   * the report document shadows the global here.
   */
  const jumpTo = (ref: string | null) => {
    onOpenChange(false);
    window.setTimeout(() => {
      if (!ref) return;
      window.document
        .getElementById(`finding-${ref}`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 150);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish as version {nextVersion}</DialogTitle>
          <DialogDescription>
            Publishing freezes a copy of this document. Version {nextVersion} never changes once
            created, and earlier versions are kept exactly as they were published.
          </DialogDescription>
        </DialogHeader>

        {blockers.blocked ? (
          <div className="space-y-2 rounded-lg border border-flag/40 bg-flag-soft p-3 text-sm">
            <p className="flex items-center gap-2 font-semibold text-flag">
              <AlertTriangle aria-hidden="true" className="size-4" />
              This report cannot be published yet
            </p>
            <ul className="space-y-2">
              {blockers.notAssessed.length > 0 ? (
                <li>
                  {blockers.notAssessed.length} finding
                  {blockers.notAssessed.length === 1 ? " is" : "s are"} still not assessed:
                  <BlockerRefs findings={blockers.notAssessed} onJump={jumpTo} />
                </li>
              ) : null}
              {blockers.tradeMissing.length > 0 ? (
                <li>
                  {blockers.tradeMissing.length} finding
                  {blockers.tradeMissing.length === 1 ? " has" : "s have"} no confirmed responsible
                  trade:
                  <BlockerRefs findings={blockers.tradeMissing} onJump={jumpTo} />
                </li>
              ) : null}
              {blockers.unconfirmed.length > 0 ? (
                <li>
                  {blockers.unconfirmed.length} finding
                  {blockers.unconfirmed.length === 1 ? " has" : "s have"} not been confirmed by a
                  person:
                  <BlockerRefs findings={blockers.unconfirmed} onJump={jumpTo} />
                </li>
              ) : null}
            </ul>
            <p className="text-xs text-muted-foreground">
              Tap an item to jump straight to it. It is in the schedule below, and in the Review
              tab.
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
            Publish version {nextVersion}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
