import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Camera, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { PhotosPanel } from "@/components/photos/photos-panel";
import { PlanUsageMeter } from "@/components/plan-usage-meter";
import { createReport } from "@/lib/data";
import { usePlanUsage } from "@/lib/plans";
import { useOrganisations } from "@/lib/use-organisations";
import { snapshotOf, systemDefinitions } from "@/lib/survey-definitions";
import { definitionLabel, type SurveyTypeSnapshot } from "@/lib/survey-types";

type QuickReportSearch = { type?: string | undefined };

export const Route = createFileRoute("/_authenticated/reports/quick")({
  validateSearch: (search: Record<string, unknown>): QuickReportSearch => ({
    type: typeof search["type"] === "string" ? search["type"] : undefined,
  }),
  head: () => {
    const title = "Quick report — instructBrain";
    const description =
      "Pick a survey type and start shooting. Photographs upload as you take them, AI drafts the findings, and the link goes to any email address.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: QuickReport,
});

function todayLabel(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function QuickReport() {
  const { type: typeParam } = Route.useSearch();
  const queryClient = useQueryClient();
  const { organisationId, userId } = useOrganisations();
  const usage = usePlanUsage(organisationId);

  const [selectedId, setSelectedId] = useState<string>(
    systemDefinitions.some((definition) => definition.id === typeParam)
      ? (typeParam as string)
      : (systemDefinitions[0]?.id ?? ""),
  );
  const [reportId, setReportId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SurveyTypeSnapshot | null>(null);
  const [initialFiles, setInitialFiles] = useState<File[]>([]);

  const cameraRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  const selected = systemDefinitions.find((definition) => definition.id === selectedId);

  // The report row is created on the first photograph, never on arrival, so an
  // abandoned visit costs nothing against the monthly allowance.
  const start = useMutation({
    mutationFn: async (files: File[]) => {
      if (!selected) throw new Error("Choose a survey type first.");
      if (!organisationId) throw new Error("You are not a member of an organisation yet.");
      const frozen = snapshotOf(selected);
      const id = await createReport({
        organisationId,
        projectId: null,
        isQuick: true,
        title: `${definitionLabel(frozen)} — ${todayLabel()}`,
        reference: "",
        definition: frozen,
        authorId: userId,
      });
      return { id, frozen, files };
    },
    onSuccess: async ({ id, frozen, files }) => {
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      setSnapshot(frozen);
      setInitialFiles(files);
      setReportId(id);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const receive = (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (files.length === 0) return;
    if (reportId) return;
    start.mutate(files);
  };

  const capturing = reportId !== null && snapshot !== null;

  return (
    <AppShell>
      <nav aria-label="Breadcrumb" className="pb-4 text-sm">
        <Link to="/projects" className="font-medium text-muted-foreground hover:text-foreground">
          Quick reports
        </Link>
      </nav>

      <header className="border-b border-border pb-5">
        <p className="eyebrow">Quick report</p>
        <h1 className="editorial-title mt-1.5 text-2xl font-semibold sm:text-3xl">
          Pick a type, then shoot
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          No project, no client details. The report starts itself with your first photograph.
        </p>
      </header>

      {organisationId ? <PlanUsageMeter usage={usage} className="mt-5" /> : null}

      <section aria-labelledby="type-heading" className="mt-6">
        <h2 id="type-heading" className="text-sm font-semibold">
          Survey type
        </h2>
        {capturing ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Locked — start a new quick report to change it.
          </p>
        ) : null}

        <fieldset className="mt-3" disabled={capturing || start.isPending}>
          <legend className="sr-only">Choose a survey type</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {systemDefinitions.map((definition) => {
              const active = definition.id === selectedId;
              return (
                <label
                  key={definition.id}
                  className={`flex min-h-14 cursor-pointer items-center gap-2 rounded-xl border p-3 shadow-raised transition-colors ${
                    active
                      ? "border-brand-accent bg-surface-raised"
                      : "border-border bg-surface-raised hover:bg-surface-sunken"
                  } ${capturing && !active ? "opacity-50" : ""}`}
                >
                  <input
                    type="radio"
                    name="survey-type"
                    value={definition.id}
                    checked={active}
                    onChange={() => setSelectedId(definition.id)}
                    className="size-4 shrink-0 accent-[var(--brand-accent)]"
                  />
                  <span className="text-sm font-semibold leading-tight">
                    {definitionLabel(snapshotOf(definition))}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </section>

      {capturing ? (
        <>
          <section className="mt-8">
            <PhotosPanel reportId={reportId} snapshot={snapshot} initialFiles={initialFiles} />
          </section>

          <div className="sticky bottom-20 z-20 mt-8 sm:bottom-4">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/reports/$id" params={{ id: reportId }} search={{ tab: "review" }}>
                Draft the findings
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </div>
        </>
      ) : (
        <section aria-labelledby="capture-heading" className="mt-6">
          <h2 id="capture-heading" className="sr-only">
            Capture photographs
          </h2>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="sr-only"
            onChange={(event) => {
              receive(event.target.files);
              event.target.value = "";
            }}
          />
          <input
            ref={pickerRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(event) => {
              receive(event.target.files);
              event.target.value = "";
            }}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              size="lg"
              className="min-h-14 w-full"
              disabled={start.isPending || !organisationId}
              onClick={() => cameraRef.current?.click()}
            >
              {start.isPending ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Camera aria-hidden="true" className="size-4" />
              )}
              Take photo
            </Button>
            <Button
              type="button"
              size="lg"
              variant="secondary"
              className="min-h-14 w-full"
              disabled={start.isPending || !organisationId}
              onClick={() => pickerRef.current?.click()}
            >
              <ImagePlus aria-hidden="true" className="size-4" />
              Add photos
            </Button>
          </div>
        </section>
      )}
    </AppShell>
  );
}
