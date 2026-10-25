import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ClipboardCheck, Send } from "lucide-react";
import { PhotosPanel } from "@/components/photos/photos-panel";
import { FieldSyncPill } from "@/components/field/field-sync-pill";
import { SendToDashboardControl } from "@/components/field/send-to-dashboard";
import { Button } from "@/components/ui/button";
import { EMPTY_PHOTO_STATUS, type PhotoStatus } from "@/lib/report/next-action";
import { definitionLabel, isManualOnly, type SurveyTypeSnapshot } from "@/lib/survey-types";

/**
 * The capture cockpit: straight to camera, a truthful sync pill, and two exits in thumb reach.
 *
 * There used to be a second set of location chips up here as well - "Ground floor", "Roof
 * plant", "Stairwell A" - writing to the same field the photograph panel already asks for and
 * beating it when the photo was saved, without ever showing in that field (Dal, 25 Oct 2026:
 * "what are these location labels for because we have a required location field below it").
 * Two controls for one field, and the one you could not see was the one that won. There is now
 * one place to set the location: the template's own field, in Step one, where the report reads
 * it from.
 */
export function FieldCockpitView({
  report,
  snapshot,
  projectName,
}: {
  report: { id: string; title: string };
  snapshot: SurveyTypeSnapshot;
  projectName: string | null;
}) {
  const [status, setStatus] = useState<PhotoStatus>(EMPTY_PHOTO_STATUS);
  const manual = isManualOnly(snapshot);

  const actions = (
    <div className="grid grid-cols-2 gap-2">
      <SendToDashboardControl
        report={report}
        trigger={(open) => (
          <Button
            type="button"
            variant="outline"
            className="min-h-12 w-full gap-1.5 whitespace-nowrap px-2 text-sm font-semibold"
            onClick={open}
          >
            <Send aria-hidden="true" className="size-4 shrink-0" />
            Send to office
          </Button>
        )}
      />
      <Button asChild variant="brand" className="min-h-12 w-full gap-1.5 whitespace-nowrap px-2 text-sm font-semibold">
        <Link to="/reports/$id" params={{ id: report.id }} search={{ tab: "review" }}>
          <ClipboardCheck aria-hidden="true" className="size-4 shrink-0" />
          Review here
        </Link>
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="min-w-0">
        <p className="eyebrow truncate">{projectName ?? "Standalone report"}</p>
        <h1 className="editorial-title truncate text-xl font-semibold">{report.title}</h1>
        <p className="mt-1 text-base text-muted-foreground">
          {status.photoCount} photo{status.photoCount === 1 ? "" : "s"} taken ·{" "}
          {manual
            ? "your descriptions are added on review"
            : `${definitionLabel(snapshot)} — findings are drafted for you to confirm`}
        </p>
      </div>

      <FieldSyncPill uploaded={status.photoCount} pending={status.uploadsActive} />

      <PhotosPanel
        reportId={report.id}
        snapshot={snapshot}
        onStatus={setStatus}
        autoOpenCamera
        bottomFlush
      />

      {/* The two exits sit at the end of the page, not in the pinned bar. That bar is for the
          camera - it has no business spending a fifth of the screen on buttons used once
          (Dal, 25 Oct 2026). */}
      <section aria-label="Finish the report">{actions}</section>
    </div>
  );
}
