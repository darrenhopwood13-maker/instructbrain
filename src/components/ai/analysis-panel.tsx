import { useState } from "react";
import { CheckCircle2, CircleDashed, Loader2, RotateCcw, Sparkles, TriangleAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAnalysisRun, type PhotoRun } from "@/lib/ai/use-analysis-run";
import { definitionLabel, type SurveyTypeSnapshot } from "@/lib/survey-types";

/**
 * The only entry point to AI analysis in the UI. Nothing here confirms a
 * finding, assigns a trade or sends anything to anyone.
 */

const STATE_LABEL: Record<PhotoRun["state"], string> = {
  pending: "Not analysed",
  running: "Analysing",
  done: "Analysed",
  failed: "Failed",
  skipped: "Cancelled",
};

function StateIcon({ state }: { state: PhotoRun["state"] }) {
  const className = "size-4 shrink-0";
  if (state === "running") return <Loader2 aria-hidden="true" className={`${className} animate-spin text-accent`} />;
  if (state === "done") return <CheckCircle2 aria-hidden="true" className={`${className} text-accent`} />;
  if (state === "failed") return <TriangleAlert aria-hidden="true" className={`${className} text-destructive`} />;
  if (state === "skipped") return <XCircle aria-hidden="true" className={`${className} text-muted-foreground`} />;
  return <CircleDashed aria-hidden="true" className={`${className} text-muted-foreground`} />;
}

export function AnalysisPanel({
  reportId,
  snapshot,
}: {
  reportId: string;
  snapshot: SurveyTypeSnapshot;
}) {
  const run = useAnalysisRun(reportId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Standard keeps the second opinion. Fast is a single pass, chosen per run.
  const [speed, setSpeed] = useState<"standard" | "fast">("standard");
  const fast = speed === "fast";
  // Once a run is done the list collapses to what still needs a person —
  // failures, cancellations and photographs with Not assessed findings.
  const [showAll, setShowAll] = useState(false);

  const progress = run.totals.total > 0 ? (run.totals.completed / run.totals.total) * 100 : 0;

  const needsAttention = (photo: PhotoRun) =>
    photo.state === "failed" ||
    photo.state === "skipped" ||
    (photo.message?.includes("not assessed") ?? false);

  const collapsed = !showAll && !run.running;
  const visiblePhotos = collapsed ? run.photos.filter(needsAttention) : run.photos;
  const attentionCount = run.photos.filter(needsAttention).length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface-raised p-4 shadow-raised">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Step two</p>
            <h2 className="editorial-title mt-1 text-base font-semibold">
              Analyse photographs, then review every finding
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Each photograph is assessed at full resolution against the{" "}
              {definitionLabel(snapshot)} report template. Anything uncertain is re-checked by a
              stronger model, and anything still uncertain is marked{" "}
              <strong>Not assessed</strong> for a person to resolve.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[13rem]">
              <Label htmlFor="analysis-speed" className="text-xs text-muted-foreground">
                Speed
              </Label>
              <Select
                value={speed}
                onValueChange={(value) => setSpeed(value === "fast" ? "fast" : "standard")}
                disabled={run.running}
              >
                <SelectTrigger id="analysis-speed" className="mt-1">
                  <SelectValue placeholder="Standard" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard — second opinion on</SelectItem>
                  <SelectItem value="fast">Fast — single pass</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {run.running ? (
              <Button type="button" variant="quiet" onClick={run.cancel}>
                Cancel run
              </Button>
            ) : null}
            <Button
              type="button"
              disabled={run.running || run.loading || run.pendingCount === 0}
              onClick={() => setConfirmOpen(true)}
            >
              {run.running ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="mr-2 size-4" aria-hidden="true" />
              )}
              {run.running
                ? "Analysing…"
                : run.pendingCount === 0
                  ? "All photographs analysed"
                  : `Analyse ${run.pendingCount} photograph${run.pendingCount === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>

        {run.totals.total > 0 ? (
          <div className="mt-4">
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={run.totals.total}
              aria-valuenow={run.totals.completed}
              aria-label="Photographs analysed in this run"
            >
              <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
              {run.totals.completed} of {run.totals.total} photographs · {run.totals.findings}{" "}
              draft findings · {run.totals.notAssessed} not assessed
              {run.totals.failed > 0 ? ` · ${run.totals.failed} failed` : ""} · $
              {run.totals.costUsd.toFixed(3)} this run
            </p>
          </div>
        ) : null}

        {run.fatalError ? (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          >
            {run.fatalError}
          </p>
        ) : null}

        {run.loadError ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {run.loadError}
          </p>
        ) : null}
      </div>

      <AiUsageMeter organisationId={organisationId} />

      {run.photos.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-surface-raised shadow-raised">
          <h3 className="border-b border-border px-4 py-3 text-sm font-semibold">
            Photographs on this report
          </h3>
          <ul className="divide-y divide-border">
            {run.photos.map((photo) => (
              <li
                key={photo.photoId}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <StateIcon state={photo.state} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {photo.filename ?? `Photograph ${photo.sequence ?? ""}`}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {STATE_LABEL[photo.state]}
                      {photo.message ? ` — ${photo.message}` : ""}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="quiet"
                  size="sm"
                  disabled={run.running}
                  onClick={() => void run.reanalyse(photo.photoId, fast)}
                >
                  <RotateCcw className="mr-1.5 size-3.5" aria-hidden="true" />
                  Re-analyse
                  <span className="sr-only">
                    {" "}
                    {photo.filename ?? `photograph ${photo.sequence ?? ""}`}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Analyse {run.pendingCount} photograph{run.pendingCount === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Everything produced is a draft: nothing is confirmed, no trade is assigned, and
              nothing is sent to anyone. You can cancel part-way through and whatever has already
              been drafted is kept. Usage counts against this organisation&rsquo;s monthly AI cap.
              {fast
                ? " Fast is a single pass: no second opinion. Anything uncertain is still marked Not assessed."
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                void run.analyseAll(fast);
              }}
            >
              Analyse photographs
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
