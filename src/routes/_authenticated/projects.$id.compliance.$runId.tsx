import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, ChevronRight, Lock, Plus, Wrench } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, LoadingState } from "@/components/query-states";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { projectQuery } from "@/lib/data";
import { useOrganisations } from "@/lib/use-organisations";
import { uploadPhoto, nextSequence } from "@/lib/photos/photo-service";
import {
  checkType,
  complianceStatusLabel,
  derivedDueDate,
  fieldsForUnitType,
  isOverdue,
  type ComplianceStatus,
} from "@/lib/compliance/checks";

import {
  addPointToRun,
  complianceActionsQuery,
  complianceEntriesQuery,
  compliancePointsQuery,
  complianceRunsQuery,
  createPoint,
  lockRun,
  raiseAction,
  runBlockers,
  saveEntry,
  statusForEntry,
  updateAction,
  type ComplianceEntry,
  type CompliancePoint,
} from "@/lib/compliance/compliance-data";

export const Route = createFileRoute("/_authenticated/projects/$id/compliance/$runId")({
  head: () => {
    const title = "Weekly check — instructBrain";
    const description =
      "One week of site checks: every point confirmed, photographed and dated, with an action against anything non-compliant.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: ComplianceRun,
});

const toneClass: Record<ComplianceStatus, string> = {
  compliant: "border-[hsl(var(--status-pass))] text-[hsl(var(--status-pass))]",
  non_compliant: "border-[hsl(var(--status-fail))] text-[hsl(var(--status-fail))]",
  not_applicable: "border-border text-muted-foreground",
};

function StatusTag({ status }: { status: ComplianceStatus }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${toneClass[status]}`}
    >
      {complianceStatusLabel(status)}
    </span>
  );
}

function ComplianceRun() {
  const { id, runId } = Route.useParams();
  const queryClient = useQueryClient();
  const { organisationId } = useOrganisations();

  const project = useQuery(projectQuery(id));
  const runsFire = useQuery(complianceRunsQuery(id, "fire"));
  const run = (runsFire.data ?? []).find((item) => item.id === runId) ?? null;
  const type = run?.checkType ?? "fire";
  const definition = checkType(type);
  const points = useQuery(compliancePointsQuery(id, type));
  const entries = useQuery(complianceEntriesQuery([runId]));
  const actions = useQuery(complianceActionsQuery(id));

  const locked = !!run?.lockedAt;
  const pointById = useMemo(
    () => new Map((points.data ?? []).map((point) => [point.id, point])),
    [points.data],
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["compliance"] });

  const answer = useMutation({
    mutationFn: async (input: {
      entry: ComplianceEntry;
      point: CompliancePoint | undefined;
      fieldId: string;
      value: boolean | string | number | null;
    }) => {
      const answers = { ...input.entry.answers, [input.fieldId]: input.value };
      // A derived due date (scaffold: first use + 7 days) fills itself in as
      // soon as the date it depends on is answered.
      for (const field of definition.fields) {
        if (!field.dueFromField) continue;
        const due = derivedDueDate(field, answers);
        if (due && !answers[field.id]) answers[field.id] = due;
      }
      const next = { ...input.entry, answers };
      await saveEntry(input.entry.id, {
        answers,
        status: statusForEntry(type, input.point, next),
      });
    },
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });


  const confirm = useMutation({
    mutationFn: async (entry: ComplianceEntry) => {
      await saveEntry(entry.id, { confirmed: true });
    },
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  const notApplicable = useMutation({
    mutationFn: async (input: { entry: ComplianceEntry; reason: string }) => {
      await saveEntry(input.entry.id, {
        status: "not_applicable",
        naReason: input.reason,
        confirmed: true,
      });
    },
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  const photo = useMutation({
    mutationFn: async (input: { entry: ComplianceEntry; file: File }) => {
      if (!organisationId || !run?.reportId) {
        throw new Error("This check has no report attached yet.");
      }
      const sequence = await nextSequence(run.reportId);
      const outcome = await uploadPhoto(
        input.file,
        {
          organisationId,
          reportId: run.reportId,
          captureFields: {},
        },
        sequence,
        () => {},
      );
      await saveEntry(input.entry.id, { photoId: outcome.photo.id });
    },
    onSuccess: () => {
      toast.success("Photograph attached.");
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [pointOpen, setPointOpen] = useState(false);
  const [location, setLocation] = useState("");
  const [unitRef, setUnitRef] = useState("");
  const [unitType, setUnitType] = useState(definition.unitTypes[0] ?? "");

  const addPoint = useMutation({
    mutationFn: async () => {
      if (!organisationId) throw new Error("You are not a member of an organisation yet.");
      const point = await createPoint({
        organisationId,
        projectId: id,
        checkType: type,
        location: location.trim(),
        unitRef: unitRef.trim(),
        unitType: unitType || null,
      });
      await addPointToRun({ organisationId, runId, pointId: point.id });
    },
    onSuccess: () => {
      setPointOpen(false);
      setLocation("");
      setUnitRef("");
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [actionFor, setActionFor] = useState<ComplianceEntry | null>(null);
  const [actionText, setActionText] = useState("");
  const [actionOwner, setActionOwner] = useState("");
  const [actionDue, setActionDue] = useState("");

  const newAction = useMutation({
    mutationFn: async () => {
      if (!organisationId || !actionFor) throw new Error("Nothing selected.");
      await raiseAction({
        organisationId,
        projectId: id,
        pointId: actionFor.pointId,
        raisedRunId: runId,
        raisedEntryId: actionFor.id,
        description: actionText.trim(),
        owner: actionOwner.trim() || null,
        targetDate: actionDue || null,
      });
    },
    onSuccess: () => {
      setActionFor(null);
      setActionText("");
      setActionOwner("");
      setActionDue("");
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const closeAction = useMutation({
    mutationFn: async (actionId: string) =>
      updateAction(actionId, {
        status: "closed",
        closedOn: new Date().toISOString().slice(0, 10),
      }),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  const complete = useMutation({
    mutationFn: async () => lockRun(runId, run?.performedByName ?? null),
    onSuccess: () => {
      toast.success("Check completed. It is now read-only.");
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const fileInput = useRef<HTMLInputElement | null>(null);
  const [photoFor, setPhotoFor] = useState<ComplianceEntry | null>(null);

  if (project.isPending || runsFire.isPending || entries.isPending) {
    return <LoadingState label="Loading the check" />;
  }
  if (project.error) return <ErrorState title="Could not load this check" error={project.error} />;
  if (!run) {
    return (
      <AppShell>
        <p className="py-16 text-center text-muted-foreground">This check could not be found.</p>
      </AppShell>
    );
  }

  const runEntries = entries.data ?? [];
  const openActions = (actions.data ?? []).filter((action) => action.status !== "closed");
  const carried = openActions.filter((action) => action.raisedRunId !== runId);
  const blockers = runBlockers({
    type,
    points: points.data ?? [],
    entries: runEntries,
    actions: actions.data ?? [],
    runId,
  });

  return (
    <AppShell>
      <nav aria-label="Breadcrumb" className="pb-4 text-sm">
        <Link
          to="/projects/$id/compliance"
          params={{ id }}
          search={{ type }}
          className="font-medium text-muted-foreground hover:text-foreground"
        >
          Compliance register
        </Link>
        <ChevronRight aria-hidden="true" className="mx-1 inline size-3.5 text-muted-foreground" />
        <span className="text-foreground">{run.checkDate}</span>
      </nav>

      <header className="border-b border-border pb-6">
        <p className="eyebrow">{definition.label} check</p>
        <h1 className="editorial-title mt-1.5 text-2xl font-semibold sm:text-3xl">
          {new Date(run.checkDate).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {project.data?.name} · {run.siteReference || "no site reference"} ·{" "}
          {run.reportNumber ? `Report ${run.reportNumber} · ` : ""}
          Performed by {run.performedByName || "unsigned"}
          {run.competentPerson ? ` · Competent person ${run.competentPerson}` : ""}
        </p>
        {locked ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <Lock aria-hidden="true" className="size-4" />
            Completed and read-only. A correction is recorded as a new entry, never an edit.
          </p>
        ) : null}
      </header>

      {carried.length > 0 ? (
        <section
          aria-labelledby="carried-heading"
          className="mt-6 rounded-lg border border-border bg-card p-4"
        >
          <h2 id="carried-heading" className="text-sm font-semibold">
            {carried.length} item(s) still open from earlier weeks
          </h2>
          <ul className="mt-2 space-y-2 text-sm">
            {carried.map((action) => (
              <li key={action.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {action.description}
                  <span className="text-muted-foreground">
                    {" "}
                    · {action.owner || "unassigned"} · opened {action.openedOn}
                  </span>
                </span>
                {!locked ? (
                  <Button
                    variant="outline"
                    onClick={() => closeAction.mutate(action.id)}
                    disabled={closeAction.isPending}
                  >
                    Close out
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="points-heading" className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="points-heading" className="text-lg font-semibold">
            {definition.unitNoun}s
          </h2>
          {!locked ? (
            <Button variant="outline" onClick={() => setPointOpen(true)}>
              <Plus aria-hidden="true" className="size-4" />
              Add {definition.unitNoun.toLowerCase()}
            </Button>
          ) : null}
        </div>

        {runEntries.length === 0 ? (
          <p className="mt-4 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            No points on this check yet. Add the first {definition.unitNoun.toLowerCase()} — next
            week it carries over automatically.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {runEntries.map((entry) => {
              const point = pointById.get(entry.pointId);
              const status = statusForEntry(type, point, entry);
              const fields = fieldsForUnitType(definition, point?.unitType ?? null);
              const entryActions = openActions.filter(
                (action) => action.pointId === entry.pointId,
              );
              return (
                <li key={entry.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {point?.unitRef || "Unreferenced"}{" "}
                        <span className="font-normal text-muted-foreground">
                          · {point?.location}
                          {point?.unitType ? ` · ${point.unitType}` : ""}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {entry.confirmed ? "Confirmed this week" : "Not yet confirmed"}
                        {entry.photoId ? " · photographed" : " · no photograph"}
                      </p>
                    </div>
                    <StatusTag status={status} />
                  </div>

                  <ul className="mt-3 space-y-2">
                    {fields.map((field) => {
                      const value = entry.answers[field.id];
                      return (
                        <li
                          key={field.id}
                          className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2"
                        >
                          <span className="text-sm">
                            {field.label}
                            {field.hint ? (
                              <span className="block text-xs text-muted-foreground">
                                {field.hint}
                              </span>
                            ) : null}
                          </span>
                          {field.type === "yesno" ? (
                            <span className="flex gap-2">
                              {[true, false].map((option) => (
                                <Button
                                  key={String(option)}
                                  variant={value === option ? "default" : "outline"}
                                  aria-pressed={value === option}
                                  aria-label={`${field.label} ${option ? "Yes" : "No"}`}
                                  disabled={locked || answer.isPending}
                                  onClick={() =>
                                    answer.mutate({
                                      entry,
                                      point,
                                      fieldId: field.id,
                                      value: option,
                                    })
                                  }
                                >
                                  {option ? "Yes" : "No"}
                                </Button>
                              ))}
                            </span>
                          ) : (
                            <Input
                              type={
                                field.type === "date"
                                  ? "date"
                                  : field.type === "number"
                                    ? "number"
                                    : "text"
                              }
                              className="h-11 w-44"
                              aria-label={field.label}
                              disabled={locked || (!!field.dueFromField && answer.isPending)}
                              readOnly={!!field.dueFromField}
                              defaultValue={
                                typeof value === "string" || typeof value === "number"
                                  ? String(value)
                                  : (field.dueFromField
                                      ? (derivedDueDate(field, entry.answers) ?? "")
                                      : "")
                              }
                              onBlur={(event) => {
                                if (field.dueFromField) return;
                                const raw = event.currentTarget.value;
                                const next =
                                  field.type === "number"
                                    ? raw === ""
                                      ? null
                                      : Number(raw)
                                    : raw;
                                if (next === (value ?? (field.type === "number" ? null : ""))) return;
                                answer.mutate({ entry, point, fieldId: field.id, value: next });
                              }}
                            />
                          )}

                        </li>
                      );
                    })}
                  </ul>

                  {entryActions.length > 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Action open: {entryActions.map((action) => action.description).join("; ")}
                    </p>
                  ) : null}

                  {!locked ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setPhotoFor(entry);
                          fileInput.current?.click();
                        }}
                        disabled={photo.isPending}
                      >
                        <Camera aria-hidden="true" className="size-4" />
                        {entry.photoId ? "Replace photograph" : "Add photograph"}
                      </Button>
                      {status === "non_compliant" ? (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setActionFor(entry);
                            setActionText(
                              `${point?.unitRef ?? "Point"} at ${point?.location ?? "site"} — non-compliant`,
                            );
                          }}
                        >
                          <Wrench aria-hidden="true" className="size-4" />
                          Raise action
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        onClick={() =>
                          notApplicable.mutate({
                            entry,
                            reason: "Checked — nothing to see this week.",
                          })
                        }
                      >
                        Record as not applicable
                      </Button>
                      <Button onClick={() => confirm.mutate(entry)} disabled={entry.confirmed}>
                        <Check aria-hidden="true" className="size-4" />
                        {entry.confirmed ? "Confirmed" : "Confirm"}
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Photograph of this point"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file && photoFor) photo.mutate({ entry: photoFor, file });
        }}
      />

      {!locked ? (
        <section className="mt-10 border-t border-border pt-6">
          {blockers.length > 0 ? (
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-semibold">This check cannot be completed yet</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                {blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <Button
            className="mt-4 w-full sm:w-auto"
            onClick={() => complete.mutate()}
            disabled={blockers.length > 0 || complete.isPending}
          >
            <Lock aria-hidden="true" className="size-4" />
            Complete and lock this check
          </Button>
        </section>
      ) : null}

      <Dialog open={pointOpen} onOpenChange={setPointOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {definition.unitNoun.toLowerCase()}</DialogTitle>
            <DialogDescription>
              A point belongs to the site. Once added it appears on every later check until it is
              decommissioned.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="point-location">Location</Label>
              <Input
                id="point-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Level 2 core stair"
              />
            </div>
            <div>
              <Label htmlFor="point-ref">{definition.unitNoun} ID</Label>
              <Input
                id="point-ref"
                value={unitRef}
                onChange={(event) => setUnitRef(event.target.value)}
                placeholder="EXT-014"
              />
            </div>
            {definition.unitTypes.length > 0 ? (
              <div>
                <Label htmlFor="point-type">Type</Label>
                <select
                  id="point-type"
                  value={unitType}
                  onChange={(event) => setUnitType(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  {definition.unitTypes.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPointOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addPoint.mutate()}
              disabled={addPoint.isPending || !location.trim() || !unitRef.trim()}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionFor !== null} onOpenChange={(next) => !next && setActionFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise an action</DialogTitle>
            <DialogDescription>
              The action stays open on this site until someone closes it, whatever happens to this
              week&rsquo;s check.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="action-text">What needs doing</Label>
              <Textarea
                id="action-text"
                value={actionText}
                onChange={(event) => setActionText(event.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="action-owner">Owner</Label>
              <Input
                id="action-owner"
                value={actionOwner}
                onChange={(event) => setActionOwner(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="action-due">Close-out date</Label>
              <Input
                id="action-due"
                type="date"
                value={actionDue}
                onChange={(event) => setActionDue(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionFor(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => newAction.mutate()}
              disabled={newAction.isPending || !actionText.trim()}
            >
              Raise action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
