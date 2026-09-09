import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Camera, ImagePlus, Loader2, Sparkles, Trash2 } from "lucide-react";
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
import {
  DEFAULT_TONE_ID,
  REPORT_PRESETS,
  REPORT_TONES,
  presetById,
  sanitiseSpecialRequest,
  toneById,
  type ReportBrief,
  type ReportToneId,
} from "@/lib/report/brief";
import { SURVEY_TYPE_FIELD } from "@/lib/report/sections";
import {
  deleteReportTemplate,
  listReportTemplates,
  saveReportTemplate,
} from "@/lib/report/templates.functions";

type CustomReportSearch = { type?: string | undefined };

export const Route = createFileRoute("/_authenticated/reports/quick")({
  validateSearch: (search: Record<string, unknown>): CustomReportSearch => ({
    type: typeof search["type"] === "string" ? search["type"] : undefined,
  }),
  head: () => {
    const title = "Custom report — instructBrain";
    const description =
      "Choose a preset and tone, add a special request, then shoot. Photographs upload as you take them and the AI drafts the findings.";
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
  component: CustomReport,
});

function todayLabel(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function CustomReport() {
  const { type: typeParam } = Route.useSearch();
  const queryClient = useQueryClient();
  const { organisationId, userId } = useOrganisations();
  const usage = usePlanUsage(organisationId);

  const loadTemplates = useServerFn(listReportTemplates);
  const storeTemplate = useServerFn(saveReportTemplate);
  const removeTemplate = useServerFn(deleteReportTemplate);

  const [selectedIds, setSelectedIds] = useState<string[]>(
    systemDefinitions.some((definition) => definition.id === typeParam)
      ? [typeParam as string]
      : [systemDefinitions[0]?.id ?? ""],
  );
  const [presetId, setPresetId] = useState<string>("record");
  const [tone, setTone] = useState<ReportToneId>(DEFAULT_TONE_ID);
  const [specialRequest, setSpecialRequest] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [briefOpen, setBriefOpen] = useState(false);

  const [reportId, setReportId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SurveyTypeSnapshot | null>(null);
  const [initialFiles, setInitialFiles] = useState<File[]>([]);
  const [activeType, setActiveType] = useState<string | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  const templates = useQuery({
    queryKey: ["report-templates", organisationId],
    queryFn: () => loadTemplates({ data: { organisationId: organisationId as string } }),
    enabled: Boolean(organisationId),
  });

  const chosen = useMemo(
    () =>
      selectedIds
        .map((id) => systemDefinitions.find((definition) => definition.id === id))
        .filter((definition): definition is (typeof systemDefinitions)[number] => !!definition),
    [selectedIds],
  );

  const brief: ReportBrief = {
    presetId,
    tone,
    specialRequest: sanitiseSpecialRequest(specialRequest),
    surveyTypes: chosen.map((definition) => ({
      id: definition.id,
      label: definitionLabel(snapshotOf(definition)),
    })),
  };

  const applyPreset = (id: string) => {
    setPresetId(id);
    const preset = presetById(id);
    if (!preset) return;
    setTone(preset.tone);
    if (preset.specialRequest) setSpecialRequest(preset.specialRequest);
  };

  const toggleType = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.length === 1
          ? current
          : current.filter((entry) => entry !== id)
        : [...current, id],
    );
  };

  // The report row is created on the first photograph, never on arrival, so an
  // abandoned visit costs nothing against the monthly allowance.
  const start = useMutation({
    mutationFn: async (files: File[]) => {
      const primary = chosen[0];
      if (!primary) throw new Error("Choose at least one survey type first.");
      if (!organisationId) throw new Error("You are not a member of an organisation yet.");
      const frozen = snapshotOf(primary);
      const id = await createReport({
        organisationId,
        projectId: null,
        isQuick: true,
        title:
          chosen.length > 1
            ? `Custom report — ${todayLabel()}`
            : `${definitionLabel(frozen)} — ${todayLabel()}`,
        reference: "",
        definition: frozen,
        authorId: userId,
        brief,
        surveyTypeIds: chosen.map((definition) => definition.id),
      });
      return { id, frozen, files };
    },
    onSuccess: async ({ id, frozen, files }) => {
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      setSnapshot(frozen);
      setInitialFiles(files);
      setActiveType(chosen[0]?.id ?? null);
      setReportId(id);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveTemplate = useMutation({
    mutationFn: async () => {
      if (!organisationId) throw new Error("You are not a member of an organisation yet.");
      return storeTemplate({
        data: {
          organisationId,
          name: templateName,
          presetId,
          tone,
          specialRequest,
          surveyTypeIds: selectedIds,
        },
      });
    },
    onSuccess: async () => {
      setTemplateName("");
      toast.success("Template saved.");
      await queryClient.invalidateQueries({ queryKey: ["report-templates", organisationId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const dropTemplate = useMutation({
    mutationFn: (id: string) => removeTemplate({ data: { id } }),
    onSuccess: async () => {
      toast.success("Template removed.");
      await queryClient.invalidateQueries({ queryKey: ["report-templates", organisationId] });
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
  const activeSnapshot = useMemo(() => {
    const definition = chosen.find((entry) => entry.id === activeType);
    return definition ? snapshotOf(definition) : snapshot;
  }, [activeType, chosen, snapshot]);

  return (
    <AppShell>
      <nav aria-label="Breadcrumb" className="pb-4 text-sm">
        <Link to="/projects" className="font-medium text-muted-foreground hover:text-foreground">
          Custom reports
        </Link>
      </nav>

      <header className="border-b border-border pb-5">
        <p className="eyebrow">Custom report</p>
        <h1 className="editorial-title mt-1.5 text-2xl font-semibold sm:text-3xl">
          Set the brief, then shoot
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          No project, no client details. The report starts itself with your first photograph.
        </p>
      </header>

      {organisationId ? <PlanUsageMeter usage={usage} className="mt-5" /> : null}

      <section aria-labelledby="type-heading" className="mt-6">
        <h2 id="type-heading" className="text-sm font-semibold">
          Survey types
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {capturing
            ? "Locked — start a new custom report to change them."
            : "Choose one, or several to cover more than one in a single report."}
        </p>

        <fieldset className="mt-3" disabled={capturing || start.isPending}>
          <legend className="sr-only">Choose the survey types this report covers</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {systemDefinitions.map((definition) => {
              const active = selectedIds.includes(definition.id);
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
                    type="checkbox"
                    name="survey-type"
                    value={definition.id}
                    checked={active}
                    onChange={() => toggleType(definition.id)}
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

      {!capturing ? (
        <section aria-labelledby="brief-heading" className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="brief-heading" className="text-sm font-semibold">
              The brief
            </h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-expanded={briefOpen}
              aria-controls="brief-panel"
              onClick={() => setBriefOpen((open) => !open)}
            >
              <Sparkles aria-hidden="true" className="size-4" />
              {briefOpen ? "Hide the brief" : "Set the brief"}
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {presetById(presetId)?.label ?? "No preset"} · {toneById(tone).label}
            {brief.specialRequest ? " · special request set" : ""}
          </p>

          {briefOpen ? (
            <div
              id="brief-panel"
              className="mt-4 space-y-6 rounded-xl border border-border bg-surface-raised p-4 shadow-raised"
            >
              {templates.data && templates.data.length > 0 ? (
                <fieldset>
                  <legend className="text-sm font-semibold">Saved templates</legend>
                  <ul className="mt-2 space-y-2">
                    {templates.data.map((template) => (
                      <li key={template.id} className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="flex-1 justify-start"
                          onClick={() => {
                            setPresetId(template.presetId ?? "blank");
                            setTone(toneById(template.tone).id);
                            setSpecialRequest(template.specialRequest);
                            if (template.surveyTypeIds.length > 0) {
                              setSelectedIds(template.surveyTypeIds);
                            }
                            toast.success(`Loaded “${template.name}”.`);
                          }}
                        >
                          {template.name}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete template ${template.name}`}
                          onClick={() => dropTemplate.mutate(template.id)}
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              ) : null}

              <fieldset>
                <legend className="text-sm font-semibold">Preset</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {REPORT_PRESETS.map((preset) => (
                    <label
                      key={preset.id}
                      className={`flex min-h-14 cursor-pointer items-start gap-2 rounded-xl border p-3 transition-colors ${
                        preset.id === presetId
                          ? "border-brand-accent bg-surface-sunken"
                          : "border-border hover:bg-surface-sunken"
                      }`}
                    >
                      <input
                        type="radio"
                        name="preset"
                        value={preset.id}
                        checked={preset.id === presetId}
                        onChange={() => applyPreset(preset.id)}
                        className="mt-0.5 size-4 shrink-0 accent-[var(--brand-accent)]"
                      />
                      <span>
                        <span className="block text-sm font-semibold">{preset.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {preset.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-semibold">Tone</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {REPORT_TONES.map((option) => (
                    <label
                      key={option.id}
                      className={`flex min-h-14 cursor-pointer items-start gap-2 rounded-xl border p-3 transition-colors ${
                        option.id === tone
                          ? "border-brand-accent bg-surface-sunken"
                          : "border-border hover:bg-surface-sunken"
                      }`}
                    >
                      <input
                        type="radio"
                        name="tone"
                        value={option.id}
                        checked={option.id === tone}
                        onChange={() => setTone(option.id)}
                        className="mt-0.5 size-4 shrink-0 accent-[var(--brand-accent)]"
                      />
                      <span>
                        <span className="block text-sm font-semibold">{option.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="special-request" className="text-sm font-semibold">
                  Special request
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  In your own words. It changes what the AI emphasises — never whether something
                  passes.
                </p>
                <textarea
                  id="special-request"
                  value={specialRequest}
                  maxLength={500}
                  rows={3}
                  onChange={(event) => setSpecialRequest(event.target.value)}
                  placeholder="Focus on the roof edge detail. Flag anything affecting handover."
                  className="mt-2 w-full rounded-xl border border-border bg-surface p-3 text-sm"
                />
              </div>

              <div>
                <label htmlFor="template-name" className="text-sm font-semibold">
                  Save this setup as a template
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    id="template-name"
                    value={templateName}
                    onChange={(event) => setTemplateName(event.target.value)}
                    placeholder="Template name"
                    className="min-h-11 flex-1 rounded-xl border border-border bg-surface px-3 text-sm"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!templateName.trim() || saveTemplate.isPending}
                    onClick={() => saveTemplate.mutate()}
                  >
                    {saveTemplate.isPending ? (
                      <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                    ) : null}
                    Save template
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {capturing && activeSnapshot ? (
        <>
          {chosen.length > 1 ? (
            <section aria-labelledby="active-type-heading" className="mt-8">
              <h2 id="active-type-heading" className="text-sm font-semibold">
                Photographs I am taking now are
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {chosen.map((definition) => {
                  const active = definition.id === activeType;
                  return (
                    <Button
                      key={definition.id}
                      type="button"
                      variant={active ? "default" : "secondary"}
                      size="sm"
                      aria-pressed={active}
                      onClick={() => setActiveType(definition.id)}
                    >
                      {definitionLabel(snapshotOf(definition))}
                    </Button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="mt-8">
            <PhotosPanel
              reportId={reportId}
              snapshot={activeSnapshot}
              initialFiles={initialFiles}
              {...(chosen.length > 1 && activeType
                ? { pinnedFields: { [SURVEY_TYPE_FIELD]: activeType } }
                : {})}
            />
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
        <section aria-labelledby="capture-heading" className="mt-8">
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
