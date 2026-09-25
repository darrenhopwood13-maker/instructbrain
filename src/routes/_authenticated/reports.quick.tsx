import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { PhotosPanel } from "@/components/photos/photos-panel";
import { PhotoCaptureActions } from "@/components/photos/photo-capture-actions";
import { TemplateSelect } from "@/components/template-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createReport, projectsQuery } from "@/lib/data";
import { usePlanUsage } from "@/lib/plans";
import { PlanUsageMeter } from "@/components/plan-usage-meter";
import { Label } from "@/components/ui/label";
import { CoverBrandingFields } from "@/components/report/cover-branding-fields";
import { applyBranding } from "@/lib/report/branding";
import { useOrganisations } from "@/lib/use-organisations";
import { snapshotOf, systemDefinitions } from "@/lib/survey-definitions";
import { snapshotFiles } from "@/lib/photos/file-snapshot";
import { describeStartFailure, withNetworkRetry } from "@/lib/network-error";
import {
  allowsMultipleFindingsPerPhoto,
  asksForDocumentHeader,
  definitionLabel,
  type SurveyTypeSnapshot,
} from "@/lib/survey-types";
import { DocumentHeaderFields } from "@/components/report/document-header-fields";
import { useSession } from "@/lib/auth";
import {
  DEFAULT_TONE_ID,
  REPORT_TONES,
  REPORT_TYPES,
  SPECIAL_REQUEST_LIMIT,
  findingsPerPhotoById,
  isMinimalBriefTemplate,
  reportTypeById,
  sanitiseSpecialRequest,
  toneById,
  type FindingsPerPhoto,
  type ReportBrief,
  type ReportToneId,
  type ReportTypeId,
} from "@/lib/report/brief";

type CustomReportSearch = { type?: string | undefined; project?: string | undefined };

export const Route = createFileRoute("/_authenticated/reports/quick")({
  validateSearch: (search: Record<string, unknown>): CustomReportSearch => ({
    type: typeof search["type"] === "string" ? search["type"] : undefined,
    project: typeof search["project"] === "string" ? search["project"] : undefined,
  }),
  head: () => {
    const title = "Start a report — instructBrain";
    const description =
      "Pick the report template, take the photographs and the AI drafts the findings. One start screen for every report.";
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

// Group headings only — the templates themselves carry every discipline term.
const CATEGORY_LABELS: Record<string, string> = {
  condition_survey: "Building fabric",
  condition: "Building fabric",
  snagging: "Quality & handover",
  fit_out: "Quality & handover",
  site_walk: "Site & safety",
  inventory: "Property records",
  electrical: "Electrical",
  mechanical: "Mechanical & HVAC",
};

/** Device-local memory of the last brief used, so capture needs no set-up. */
const LAST_BRIEF_KEY = "instructbrain.custom-report.last-brief";

function todayLabel(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function CustomReport() {
  const { type: typeParam, project: projectParam } = Route.useSearch();
  const queryClient = useQueryClient();
  const { organisationId, organisationIds, userId } = useOrganisations();
  const { user } = useSession();
  const usage = usePlanUsage(organisationId);
  const projects = useQuery(projectsQuery(organisationIds));
  // One start screen for every report. A report belongs to a project only when
  // the person picks one — otherwise it is a standalone report.
  const [projectId, setProjectId] = useState<string>(projectParam ?? "");
  const project = (projects.data ?? []).find((item) => item.id === projectId) ?? null;

  const [templateId, setTemplateId] = useState<string>(
    systemDefinitions.some((definition) => definition.id === typeParam)
      ? (typeParam as string)
      : (systemDefinitions[0]?.id ?? ""),
  );
  const [tone, setTone] = useState<ReportToneId>(DEFAULT_TONE_ID);
  const [specialRequest, setSpecialRequest] = useState("");
  const [reportType, setReportType] = useState<ReportTypeId>("assessment");
  const [includeFix, setIncludeFix] = useState(true);
  const [includeSeverity, setIncludeSeverity] = useState(true);
  const [advisoryFooter, setAdvisoryFooter] = useState(false);
  const [findingsPerPhoto, setFindingsPerPhoto] = useState<FindingsPerPhoto>("template");
  const [draftSummary, setDraftSummary] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docSubtitle, setDocSubtitle] = useState("");
  const [docDate, setDocDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [briefOpen, setBriefOpen] = useState(false);
  // The template explanation shows only until the template is known — a
  // remembered brief or a deliberate choice — and never nags after that.
  const [templateKnown, setTemplateKnown] = useState(() => Boolean(typeParam));

  const [reportId, setReportId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SurveyTypeSnapshot | null>(null);
  const [initialFiles, setInitialFiles] = useState<File[]>([]);

  const cameraRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  // The last brief this device used, restored after hydration so a returning
  // user lands on a screen where the only thing to do is take a photograph.
  const [recalled, setRecalled] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LAST_BRIEF_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, unknown>;
        if (
          !typeParam &&
          typeof saved["templateId"] === "string" &&
          systemDefinitions.some((definition) => definition.id === saved["templateId"])
        ) {
          setTemplateId(saved["templateId"] as string);
          setTemplateKnown(true);
        }
        if (typeof saved["tone"] === "string") setTone(toneById(saved["tone"]).id);
        if (typeof saved["reportType"] === "string") {
          setReportType(reportTypeById(saved["reportType"]));
        }
        if (typeof saved["includeFix"] === "boolean") setIncludeFix(saved["includeFix"]);
        if (typeof saved["includeSeverity"] === "boolean") {
          setIncludeSeverity(saved["includeSeverity"]);
        }
        if (typeof saved["advisoryFooter"] === "boolean") {
          setAdvisoryFooter(saved["advisoryFooter"]);
        }
        setFindingsPerPhoto(findingsPerPhotoById(saved["findingsPerPhoto"]));
        if (typeof saved["draftSummary"] === "boolean") setDraftSummary(saved["draftSummary"]);
      }
    } catch {
      // A corrupt or blocked store simply means the defaults stand.
    }
    setRecalled(true);
    // Restore once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!recalled) return;
    try {
      window.localStorage.setItem(
        LAST_BRIEF_KEY,
        JSON.stringify({
          templateId,
          tone,
          reportType,
          includeFix,
          includeSeverity,
          advisoryFooter,
          findingsPerPhoto,
          draftSummary,
        }),
      );
    } catch {
      // Storage unavailable — the brief simply is not remembered.
    }
  }, [
    recalled,
    templateId,
    tone,
    reportType,
    includeFix,
    includeSeverity,
    advisoryFooter,
    findingsPerPhoto,
    draftSummary,
  ]);

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
  // A minimal record template carries no fix, no severity and no report type
  // choice — those controls are hidden rather than shown switched off.
  const minimal = isMinimalBriefTemplate(templateId);
  // Only a template that allows several findings per photograph can be tightened.
  const multiFindingTemplate = chosenDefinition
    ? allowsMultipleFindingsPerPhoto(snapshotOf(chosenDefinition))
    : false;
  // Whether this template writes its own document header comes from the
  // template itself, never from a discipline named here.
  const asksForHeader = chosenDefinition
    ? asksForDocumentHeader(snapshotOf(chosenDefinition))
    : false;
  const stripped = identifier || minimal;
  const focusMissing = minimal && sanitiseSpecialRequest(specialRequest) === "";

  const brief: ReportBrief = {
    presetId: null,
    tone,
    reportType,
    includeFix: stripped ? false : includeFix,
    includeSeverity: stripped ? false : includeSeverity,
    advisoryFooter,
    specialRequest: sanitiseSpecialRequest(specialRequest),
    findingsPerPhoto,
    draftSummary,
    surveyTypes: chosenDefinition
      ? [
          {
            id: chosenDefinition.id,
            label: definitionLabel(snapshotOf(chosenDefinition)),
          },
        ]
      : [],
  };

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  // The photographs already chosen are held so a dropped signal never loses them.
  const heldFilesRef = useRef<File[]>([]);
  const [heldCount, setHeldCount] = useState(0);

  // The report row is created on the first photograph, never on arrival, so an
  // abandoned visit costs nothing against the monthly allowance.
  const start = useMutation({
    mutationFn: async (files: File[]) => {
      const primary = chosenDefinition;
      if (!primary) throw new Error("Choose a report template first.");
      if (focusMissing) {
        throw new Error("Write the focus of this report before you start.");
      }
      if (!organisationId) throw new Error("You are not a member of an organisation yet.");
      const frozen = snapshotOf(primary);
      // A momentary signal drop must not cost the photographs already chosen.
      const id = await withNetworkRetry(() =>
        createReport({
          organisationId,
          projectId: projectId || null,
          isQuick: projectId === "",
          title:
            asksForHeader && docTitle.trim() !== ""
              ? docTitle
              : `${definitionLabel(frozen)} — ${project?.name ?? todayLabel()}`,
          reference: "",
          ...(asksForHeader ? { subtitle: docSubtitle, reportDate: docDate } : {}),
          definition: frozen,
          authorId: userId,
          brief,
          surveyTypeIds: [primary.id],
        }),
      );
      // Optional title-page photo and per-report logo. The report already
      // exists, so a failure here is a warning — never a discarded report.
      try {
        await applyBranding({ organisationId, reportId: id, coverFile, logoFile });
      } catch {
        toast.warning("Your title page photo did not save", {
          description: "The report is saved. Pick any uploaded photograph as the title page.",
        });
      }
      return { id, frozen, files };
    },
    onSuccess: async ({ id, frozen, files }) => {
      heldFilesRef.current = [];
      setHeldCount(0);
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      setSnapshot(frozen);
      setInitialFiles(files);
      setReportId(id);
    },
    onError: (error: Error) => toast.error(describeStartFailure(error)),
  });

  const retryStart = () => {
    if (heldFilesRef.current.length === 0) return;
    start.mutate(heldFilesRef.current);
  };


  const receive = async (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (files.length === 0) return;
    if (reportId) return;
    // Hold the bytes now: the report is created first, and a camera/gallery
    // file reference can be revoked before the capture panel mounts.
    const held = await snapshotFiles(files);
    heldFilesRef.current = held;
    setHeldCount(held.length);
    start.mutate(held);

  };

  const capturing = reportId !== null && snapshot !== null;
  const activeSnapshot = snapshot;

  return (
    <AppShell surface="light">
      <h1 className="editorial-title mt-1 text-2xl font-semibold sm:text-3xl">Start a report</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {capturing
          ? "Photographs upload as you take them."
          : "Your last set-up is ready — take a photo to start."}
      </p>

      {capturing && activeSnapshot ? (
        <p className="mt-4 text-sm">
          <span className="font-semibold">Report template:</span>{" "}
          {definitionLabel(activeSnapshot)} — locked for this report.
          {project ? ` In ${project.name}.` : ""}
        </p>
      ) : (
        <section aria-labelledby="type-heading" className="mt-5">
          <h2 id="type-heading" className="text-sm font-semibold">
            Report template
          </h2>
          <div className="mt-2">
            <TemplateSelect
              id="custom-report-template"
              value={templateId}
              onChange={(id) => {
                setTemplateId(id);
                setTemplateKnown(true);
              }}
              disabled={start.isPending}
            />
          </div>
          {/* The template is explained once, here, and nowhere else — and
              only until it is known (first visit or a deliberate change). */}
          {templateKnown ? null : (
            <p className="mt-1 text-xs text-muted-foreground">
              The template sets the instructions the AI works to.
            </p>
          )}
        </section>
      )}

      {!capturing ? <PlanUsageMeter usage={usage} className="mt-5" /> : null}


      {minimal && !capturing ? (
        <section aria-labelledby="focus-heading" className="mt-6">
          <h2 id="focus-heading" className="text-sm font-semibold">
            Focus of this report
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            In your own words — what each photograph is a record of. Required for this template.
          </p>
          <textarea
            id="report-focus"
            value={specialRequest}
            maxLength={SPECIAL_REQUEST_LIMIT}
            rows={3}
            required
            aria-describedby="report-focus-hint"
            onChange={(event) => setSpecialRequest(event.target.value)}
            placeholder="Condition of doors and ironmongery on level 2 before handover."
            className="mt-2 w-full rounded-xl border border-border bg-surface p-3 text-sm"
          />
          <p id="report-focus-hint" className="mt-1 text-xs text-muted-foreground">
            {focusMissing
              ? "Write the focus before you start."
              : `${sanitiseSpecialRequest(specialRequest).length} of ${SPECIAL_REQUEST_LIMIT} characters.`}
          </p>
        </section>
      ) : null}

      {!capturing ? (
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
              void receive(event.target.files);
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
              void receive(event.target.files);
              event.target.value = "";
            }}
          />
           <PhotoCaptureActions
             onCamera={() => cameraRef.current?.click()}
             onGallery={() => pickerRef.current?.click()}
             disabled={!organisationId || focusMissing}
             busy={start.isPending}
           />
          {start.isError && heldCount > 0 ? (
            <div
              role="status"
              className="mt-4 rounded-xl border border-border bg-surface p-3 text-sm"
            >
              <p>
                {heldCount === 1
                  ? "Your photograph is still held here."
                  : `Your ${heldCount} photographs are still held here.`}{" "}
                Nothing was lost.
              </p>
              <Button
                type="button"
                className="mt-3 min-h-11 w-full"
                disabled={start.isPending}
                onClick={retryStart}
              >
                Try again
              </Button>
            </div>
          ) : null}

        </section>
      ) : null}

      {!capturing ? (
        <section aria-labelledby="brief-heading" className="mt-8">
          {/* One control, not a heading and a button saying the same word. */}
          <h2 id="brief-heading" className="sr-only">
             AI brief
          </h2>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 w-full justify-between"
            aria-expanded={briefOpen}
            aria-controls="brief-panel"
            onClick={() => setBriefOpen((open) => !open)}
          >
            <span className="flex items-center gap-2">
              <Sparkles aria-hidden="true" className="size-4" />
               {briefOpen ? "Hide AI brief" : "AI brief"}
            </span>
            <span className="truncate text-xs font-normal">
               {toneById(tone).label}
              {brief.specialRequest ? " · special request" : ""}
            </span>
          </Button>


          {briefOpen ? (
            <div
              id="brief-panel"
              className="mt-4 space-y-6 rounded-xl border border-border bg-surface-raised p-4 shadow-raised"
            >
              <h3 className="eyebrow">How it reads</h3>

              <div>
                <label htmlFor="tone" className="text-sm font-semibold">
                  Tone
                </label>
                <Select value={tone} onValueChange={(next) => setTone(toneById(next).id)}>
                  <SelectTrigger
                    id="tone"
                    aria-label="Tone"
                    className="mt-2 h-11 w-full bg-surface-raised text-sm"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TONES.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {REPORT_TONES.find((option) => option.id === tone)?.description}
                </p>
              </div>

              {minimal ? null : (
                <div>
                  <label htmlFor="report-type" className="text-sm font-semibold">
                    Report type
                  </label>
                  <Select
                    value={reportType}
                    onValueChange={(next) => setReportType(reportTypeById(next))}
                  >
                    <SelectTrigger
                      id="report-type"
                      aria-label="Report type"
                      className="mt-2 h-11 w-full bg-surface-raised text-sm"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REPORT_TYPES.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {REPORT_TYPES.find((option) => option.id === reportType)?.description}
                  </p>
                </div>
              )}

              {minimal ? null : (
                <div>
                  <label htmlFor="special-request" className="text-sm font-semibold">
                     Special instruction
                  </label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    In your own words. It changes what the AI emphasises — never whether something
                    passes.
                  </p>
                  <textarea
                    id="special-request"
                    value={specialRequest}
                    maxLength={SPECIAL_REQUEST_LIMIT}
                    rows={3}
                    onChange={(event) => setSpecialRequest(event.target.value)}
                    placeholder="Focus on the roof edge detail. Flag anything affecting handover."
                    className="mt-2 w-full rounded-xl border border-border bg-surface p-3 text-sm"
                  />
                </div>
              )}

              <h3 className="eyebrow">What it includes</h3>

              {asksForHeader ? (
                <DocumentHeaderFields
                  title={docTitle}
                  subtitle={docSubtitle}
                  reportDate={docDate}
                  authorLabel={user?.email ?? "The signed-in account"}
                  titlePlaceholder={
                    chosenDefinition ? definitionLabel(snapshotOf(chosenDefinition)) : "Report title"
                  }
                  onTitle={setDocTitle}
                  onSubtitle={setDocSubtitle}
                  onReportDate={setDocDate}
                  disabled={start.isPending}
                />
              ) : null}

              {multiFindingTemplate ? (
                <div>
                  <label htmlFor="findings-per-photo" className="text-sm font-semibold">
                    Findings per photograph
                  </label>
                  <Select
                    value={findingsPerPhoto}
                    onValueChange={(next) => setFindingsPerPhoto(findingsPerPhotoById(next))}
                  >
                    <SelectTrigger
                      id="findings-per-photo"
                      aria-label="Findings per photograph"
                      className="mt-2 h-11 w-full bg-surface-raised text-sm"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="template">
                        Follow the template — every item found
                      </SelectItem>
                      <SelectItem value="one">One finding per photograph</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {findingsPerPhoto === "one"
                      ? "Each photograph gets one combined entry, so a single photograph cannot produce several near-identical items."
                      : "A photograph showing several separate items produces a separate entry for each."}
                  </p>
                </div>
              ) : null}

              {minimal ? (
                <p className="text-xs text-muted-foreground">
                  This template records the item and its condition only. No suggested repairs, no
                  severity rating and no target dates.
                </p>
              ) : (
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
                       {
                         id: "draft-summary",
                         label: "Draft report summary",
                         checked: draftSummary,
                         disabled: false,
                         set: setDraftSummary,
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
              )}

              <CoverBrandingFields
                organisationId={organisationId}
                coverFile={coverFile}
                logoFile={logoFile}
                onCoverFile={setCoverFile}
                onLogoFile={setLogoFile}
                disabled={start.isPending}
              />
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
      ) : null}
    </AppShell>
  );
}
