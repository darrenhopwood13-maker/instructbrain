import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ClipboardCheck, MapPin, Send } from "lucide-react";
import { PhotosPanel } from "@/components/photos/photos-panel";
import { FieldSyncPill } from "@/components/field/field-sync-pill";
import { SendToDashboardControl } from "@/components/field/send-to-dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EMPTY_PHOTO_STATUS, type PhotoStatus } from "@/lib/report/next-action";
import {
  captureFieldsOf,
  definitionLabel,
  isManualOnly,
  photoWorkflowOf,
  type SurveyTypeSnapshot,
} from "@/lib/survey-types";

/** Generic location presets, used only when the template offers no list of its own. */
const LOCATION_PRESETS = ["Ground floor", "Roof plant", "Stairwell A"];

/**
 * The capture cockpit: straight to camera, a location tag that stamps every
 * following photograph until changed, a truthful sync pill, and two exits in
 * thumb reach. It renders the existing photo panel and hand-off — it does not
 * own the upload queue, the hand-off or any report logic.
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
  const inventory = photoWorkflowOf(snapshot)?.kind === "inventory_room_schedule";

  // The location tag writes into the template's own first capture field, so
  // no discipline term is named here. Inventory rooms are set in its organiser.
  const zoneField = useMemo(() => {
    if (inventory) return null;
    return (
      captureFieldsOf(snapshot).find((field) => field.type === "text" || field.type === "select") ??
      null
    );
  }, [snapshot, inventory]);
  const chips = zoneField?.type === "select" && zoneField.options?.length
    ? zoneField.options.slice(0, 6)
    : LOCATION_PRESETS;

  const [zone, setZone] = useState("");
  const [custom, setCustom] = useState("");
  const pinned = useMemo(
    () => (zoneField && zone ? { [zoneField.id]: zone } : undefined),
    [zoneField, zone],
  );

  const actions = (
    <div className="grid grid-cols-2 gap-2">
      <SendToDashboardControl
        report={report}
        trigger={(open) => (
          <Button
            type="button"
            variant="outline"
            className="min-h-12 w-full text-base"
            onClick={open}
          >
            <Send aria-hidden="true" className="size-5" />
            Send to office
          </Button>
        )}
      />
      <Button asChild variant="brand" className="min-h-12 w-full text-base">
        <Link to="/reports/$id" params={{ id: report.id }} search={{ tab: "review" } as never}>
          <ClipboardCheck aria-hidden="true" className="size-5" />
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

      {zoneField ? (
        <section aria-labelledby="zone-heading" className="space-y-2">
          <h2 id="zone-heading" className="flex items-center gap-1.5 text-base font-semibold">
            <MapPin aria-hidden="true" className="size-4 shrink-0" />
            {zoneField.label}
            <span className="font-normal text-muted-foreground">
              — {zone ? `stamping “${zone}”` : "none set"}
            </span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                aria-pressed={zone === chip}
                onClick={() => setZone(zone === chip ? "" : chip)}
                className="min-h-12 rounded-full border border-border bg-surface-raised px-4 text-base font-medium aria-pressed:border-brand-accent aria-pressed:bg-brand-accent/10"
              >
                {chip}
              </button>
            ))}
          </div>
          {zoneField.type === "text" ? (
            <form
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (custom.trim()) setZone(custom.trim());
                setCustom("");
              }}
            >
              <Input
                aria-label={`Other ${zoneField.label.toLowerCase()}`}
                placeholder="Other…"
                value={custom}
                onChange={(event) => setCustom(event.target.value)}
                className="h-12 text-base"
              />
              <Button type="submit" variant="outline" className="min-h-12">
                Set
              </Button>
            </form>
          ) : null}
        </section>
      ) : null}

      <PhotosPanel
        reportId={report.id}
        snapshot={snapshot}
        pinnedFields={pinned}
        onStatus={setStatus}
        nextAction={actions}
        autoOpenCamera
        bottomFlush
      />
    </div>
  );
}
