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
  REPORT_TYPES,
  SPECIAL_REQUEST_LIMIT,
  presetById,
  reportTypeById,
  sanitiseSpecialRequest,
  toneById,
  type ReportBrief,
  type ReportToneId,
  type ReportTypeId,
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

  const [templateId, setTemplateId] = useState<string>(
    systemDefinitions.some((definition) => definition.id === typeParam)
      ? (typeParam as string)
      : (systemDefinitions[0]?.id ?? ""),
  );
  const [presetId, setPresetId] = useState<string>("record");
  const [tone, setTone] = useState<ReportToneId>(DEFAULT_TONE_ID);
  const [specialRequest, setSpecialRequest] = useState("");
  const [reportType, setReportType] = useState<ReportTypeId>("assessment");
  const [includeFix, setIncludeFix] = useState(true);
  const [includeSeverity, setIncludeSeverity] = useState(true);
  const [advisoryFooter, setAdvisoryFooter] = useState(false);
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

  const chosenDefinition = useMemo(
    () =>
      systemDefinitions.find((definition) => definition.id === templateId) ??
      systemDefinitions[0] ??
      null,
    [templateId],
  );

  const groupedTemplates = useMemo(() => {
    const groups: { category: string; label: string; definitions: typeof systemDefinitions }[] = [];
    for (const definition of systemDefinitions) {
      const category = definition.category ?? "other";
      let group = groups.find((entry) => entry.category === category);
      if (!group) {
        group = { category, label: CATEGORY_LABELS[category] ?? "Other", definitions: [] };
        groups.push(group);
      }
      group.definitions.push(definition);
    }
    return groups;
  }, []);

  const identifier = reportType === "identifier";

  const brief: ReportBrief = {
    presetId,
    tone,
    reportType,
    includeFix: identifier ? false : includeFix,
    includeSeverity: identifier ? false : includeSeverity,
    advisoryFooter,
    specialRequest: sanitiseSpecialRequest(specialRequest),
    surveyTypes: chosenDefinition
      ? [
          {
            id: chosenDefinition.id,
            label: definitionLabel(snapshotOf(chosenDefinition)),
          },
        ]
      : [],
  };

  const applyPreset = (id: string) => {
    setPresetId(id);
    const preset = presetById(id);
    if (!preset) return;
    setTone(preset.tone);
    setReportType(preset.reportType);
    setIncludeFix(preset.includeFix);
    setIncludeSeverity(preset.includeSeverity);
    setAdvisoryFooter(preset.advisoryFooter);
    if (preset.specialRequest) setSpecialRequest(preset.specialRequest);
  };

  // The report row is created on the first photograph, never on arrival, so an
  // abandoned visit costs nothing against the monthly allowance.
  const start = useMutation({
    mutationFn: async (files: File[]) => {
      const primary = chosenDefinition;
      if (!primary) throw new Error("Choose a report template first.");
      if (!organisationId) throw new Error("You are not a member of an organisation yet.");
      const frozen = snapshotOf(primary);
      const id = await createReport({
        organisationId,
        projectId: null,
        isQuick: true,
        title: `${definitionLabel(frozen)} — ${todayLabel()}`,
        reference: "",
        definition: frozen,
        authorId: userId,
        brief,
        surveyTypeIds: [primary.id],
      });
      return { id, frozen, files };
    },
    onSuccess: async ({ id, frozen, files }) => {
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      setSnapshot(frozen);
      setInitialFiles(files);
      setActiveType(chosenDefinition?.id ?? null);
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
          reportType,
          includeFix: brief.includeFix,
          includeSeverity: brief.includeSeverity,
          advisoryFooter,
          specialRequest,
          surveyTypeIds: [templateId],
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
  const activeSnapshot = snapshot;

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

      <section aria-labelledby="type-heading" className="mt-6">
        <h2 id="type-heading" className="text-sm font-semibold">
          Report template
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {capturing
            ? "Locked — start a new custom report to change it."
            : "The template sets the instructions the AI works to. Tone, report type and what the report includes stay yours to change."}
        </p>

        <fieldset className="mt-3" disabled={capturing || start.isPending}>
          <legend className="sr-only">Choose the report template</legend>
          <div className="space-y-4">
            {groupedTemplates.map((group) => (
              <div key={group.category}>
                <p className="eyebrow text-xs">{group.label}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {group.definitions.map((definition) => {
                    const active = definition.id === templateId;
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
                          name="report-template"
                          value={definition.id}
                          checked={active}
                          onChange={() => setTemplateId(definition.id)}
                          className="size-4 shrink-0 accent-[var(--brand-accent)]"
                        />
                        <span className="text-sm font-semibold leading-tight">
                          {definitionLabel(snapshotOf(definition))}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
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
                            setReportType(reportTypeById(template.reportType));
                            setIncludeFix(template.includeFix);
                            setIncludeSeverity(template.includeSeverity);
                            setAdvisoryFooter(template.advisoryFooter);
                            setSpecialRequest(template.specialRequest);
                            const first = template.surveyTypeIds[0];
                            if (first) setTemplateId(first);
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

              <fieldset>
                <legend className="text-sm font-semibold">Report type</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {REPORT_TYPES.map((option) => (
                    <label
                      key={option.id}
                      className={`flex min-h-14 cursor-pointer items-start gap-2 rounded-xl border p-3 transition-colors ${
                        option.id === reportType
                          ? "border-brand-accent bg-surface-sunken"
                          : "border-border hover:bg-surface-sunken"
                      }`}
                    >
                      <input
                        type="radio"
                        name="report-type"
                        value={option.id}
                        checked={option.id === reportType}
                        onChange={() => setReportType(option.id)}
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

              <fieldset>
                <legend className="text-sm font-semibold">What the report includes</legend>
                {identifier ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    An identifier report describes what is in each photograph, so repairs and
                    severity are left out.
                  </p>
                ) : null}
                <div className="mt-2 space-y-2">
                  {[
                    {
                      id: "include-fix",
                      label: "Suggested remedial work",
                      checked: identifier ? false : includeFix,
                      disabled: identifier,
                      set: setIncludeFix,
                    },
                    {
                      id: "include-severity",
                      label: "Severity rating",
                      checked: identifier ? false : includeSeverity,
                      disabled: identifier,
                      set: setIncludeSeverity,
                    },
                    {
                      id: "advisory-footer",
                      label: "Advisory note at the end of the report",
                      checked: advisoryFooter,
                      disabled: false,
                      set: setAdvisoryFooter,
                    },
                  ].map((row) => (
                    <label
                      key={row.id}
                      htmlFor={row.id}
                      className="flex min-h-11 items-center gap-3 rounded-xl border border-border p-3 text-sm"
                    >
                      <input
                        id={row.id}
                        type="checkbox"
                        checked={row.checked}
                        disabled={row.disabled}
                        onChange={(event) => row.set(event.target.checked)}
                        className="size-4 shrink-0 accent-[var(--brand-accent)]"
                      />
                      {row.label}
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
          <section className="mt-8">
            <PhotosPanel reportId={reportId} snapshot={activeSnapshot} initialFiles={initialFiles} />
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
