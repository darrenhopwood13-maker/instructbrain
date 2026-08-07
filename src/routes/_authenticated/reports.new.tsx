import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Camera, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState, LoadingState } from "@/components/query-states";
import { EmptyState } from "@/components/empty-state";
import { FolderOpen } from "lucide-react";
import { createReport, projectsQuery } from "@/lib/data";
import { useOrganisations } from "@/lib/use-organisations";
import { snapshotOf, systemDefinitions } from "@/lib/survey-definitions";
import {
  captureFieldsOf,
  categoryGroupsOf,
  definitionLabel,
  outputSectionsOf,
  requiresLifecycle,
  severitiesOf,
  statusesOf,
  supportsDistribution,
} from "@/lib/survey-types";
import { StatusPill } from "@/components/status-pill";
import { toast } from "sonner";

type NewReportSearch = { project?: string | undefined };

export const Route = createFileRoute("/_authenticated/reports/new")({
  validateSearch: (search: Record<string, unknown>): NewReportSearch => ({
    project: typeof search["project"] === "string" ? search["project"] : undefined,
  }),
  head: () => {
    const title = "Start a report — instructBrain";
    const description =
      "Choose the survey type before uploading photographs. The survey type determines the statuses, capture fields and output the report will use.";
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
  component: NewReport,
});

function NewReport() {
  const { project: projectParam } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organisationIds, organisationId, userId } = useOrganisations();
  const projects = useQuery(projectsQuery(organisationIds));

  const [selectedId, setSelectedId] = useState<string>(systemDefinitions[0]?.id ?? "");
  const [projectId, setProjectId] = useState<string>(projectParam ?? "");
  const [title, setTitle] = useState("");
  const [reference, setReference] = useState("");

  const selected = systemDefinitions.find((definition) => definition.id === selectedId);
  const projectList = projects.data ?? [];
  const project = useMemo(
    () => projectList.find((item) => item.id === (projectId || projectParam)),
    [projectList, projectId, projectParam],
  );
  const effectiveProjectId = projectId || projectParam || "";
  const titleInvalid = title.trim().length === 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Choose a survey type first.");
      if (!organisationId) throw new Error("You are not a member of an organisation yet.");
      if (!effectiveProjectId) throw new Error("Choose the project this report belongs to.");
      // The definition is COPIED into the report at creation; the report never
      // reads a live definition again.
      return createReport({
        organisationId,
        projectId: effectiveProjectId,
        title,
        reference,
        definition: snapshotOf(selected),
        authorId: userId,
      });
    },
    onSuccess: async (reportId) => {
      await queryClient.invalidateQueries({ queryKey: ["reports", "project", effectiveProjectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Report started", {
        description: "The survey type is frozen into this report. Upload photographs next.",
      });
      void navigate({
        to: "/reports/$id",
        params: { id: reportId },
        search: { tab: "photos" },
      });
    },
  });

  return (
    <AppShell>
      <nav aria-label="Breadcrumb" className="pb-4 text-sm">
        <Link to="/projects" className="font-medium text-muted-foreground hover:text-foreground">
          Projects
        </Link>
        {project ? (
          <>
            <ChevronRight
              aria-hidden="true"
              className="mx-1 inline size-3.5 text-muted-foreground"
            />
            <Link
              to="/projects/$id"
              params={{ id: project.id }}
              className="font-medium text-muted-foreground hover:text-foreground"
            >
              {project.reference}
            </Link>
          </>
        ) : null}
        <ChevronRight aria-hidden="true" className="mx-1 inline size-3.5 text-muted-foreground" />
        <span className="text-foreground">New report</span>
      </nav>

      <header className="border-b border-border pb-6">
        <p className="eyebrow">Step one</p>
        <h1 className="editorial-title mt-1.5 text-2xl font-semibold sm:text-3xl">
          Choose the survey type
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          The survey type determines what the app asks for — the statuses, the capture fields, the
          severity scale and the sections of the issued document. Choose it before uploading, and
          it is frozen into this report.
        </p>
      </header>

      <section aria-labelledby="report-details" className="mt-6 max-w-2xl space-y-4">
        <h2 id="report-details" className="editorial-title text-lg font-semibold">
          Report details
        </h2>

        {projects.isPending ? (
          <LoadingState label="Loading your projects…" />
        ) : projects.isError ? (
          <ErrorState
            title="Your projects could not be loaded"
            error={projects.error}
            onRetry={() => void projects.refetch()}
          />
        ) : projectList.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            eyebrow="No projects"
            title="Create a project first"
            description="A report always belongs to a project. Create one, then come back and start the report."
            action={
              <Button variant="brand" asChild>
                <Link to="/projects">Go to projects</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            <Label htmlFor="report-project">Project</Label>
            <select
              id="report-project"
              value={effectiveProjectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="h-11 w-full rounded-md border border-border bg-surface-raised px-3 text-sm"
            >
              <option value="">Select a project…</option>
              {projectList.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.reference})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="report-title">Report title</Label>
          <Input
            id="report-title"
            name="report-title-new"
            autoComplete="off"
            data-form-type="other"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-invalid={titleInvalid || undefined}
            aria-describedby="report-title-help"
          />
          <p id="report-title-help" className="text-xs text-muted-foreground">
            Required. For example, the level, block or area this survey covers.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="report-reference">Report reference</Label>
          <Input
            id="report-reference"
            name="report-reference-new"
            autoComplete="off"
            data-form-type="other"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </div>

      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <fieldset>
          <legend className="editorial-title text-lg font-semibold">Survey types</legend>
          <div role="radiogroup" aria-label="Survey type" className="mt-3 space-y-3">
            {systemDefinitions.map((definition) => {
              const active = definition.id === selectedId;
              return (
                <label
                  key={definition.id}
                  className={
                    "block cursor-pointer rounded-xl border bg-surface-raised p-4 transition-colors " +
                    (active
                      ? "border-brand-accent ring-2 ring-brand-accent/30"
                      : "border-border hover:border-border-strong")
                  }
                >
                  <span className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="survey-type"
                      value={definition.id}
                      checked={active}
                      onChange={() => setSelectedId(definition.id)}
                      className="mt-1 size-4 accent-[var(--brand-accent)]"
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold">{definitionLabel(definition)}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {statusesOf(definition).length} statuses ·{" "}
                        {severitiesOf(definition).length} severity levels ·{" "}
                        {definition.findingsPerPhoto === "multiple"
                          ? "several findings per photograph"
                          : "one finding per photograph"}
                      </span>
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {selected ? (
          <section
            aria-label={`${definitionLabel(selected)} detail`}
            className="rounded-xl border border-border bg-surface-raised p-5 shadow-raised"
          >
            <h2 className="editorial-title text-lg font-semibold">{definitionLabel(selected)}</h2>

            <h3 className="eyebrow mt-4">Statuses</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {statusesOf(selected).map((status) => (
                <StatusPill key={status.id} status={status} />
              ))}
            </div>

            {severitiesOf(selected).length > 0 ? (
              <>
                <h3 className="eyebrow mt-4">Severity scale</h3>
                <dl className="mt-2 space-y-1.5 text-sm">
                  {severitiesOf(selected).map((severity) => (
                    <div key={severity.id}>
                      <dt className="font-semibold">{severity.label}</dt>
                      <dd className="text-muted-foreground">{severity.guidance}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : null}

            {captureFieldsOf(selected).length > 0 ? (
              <>
                <h3 className="eyebrow mt-4">Captured on site</h3>
                <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                  {captureFieldsOf(selected).map((field) => (
                    <li key={field.id}>
                      {field.label}
                      {field.required ? " (required)" : ""}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {categoryGroupsOf(selected).map((group) => (
              <div key={group.key}>
                <h3 className="eyebrow mt-4">{group.label}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {group.items.map((item) => item.label).join(" · ")}
                </p>
              </div>
            ))}

            <h3 className="eyebrow mt-4">Output</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {outputSectionsOf(selected).join(" · ")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {requiresLifecycle(selected)
                ? "Close-out is tracked on every open item."
                : "No close-out tracking."}{" "}
              {supportsDistribution(selected)
                ? "Per-trade extracts can be prepared for review before anything is sent."
                : "This type is not distributed to subcontractors."}
            </p>
          </section>
        ) : null}
      </div>

      {mutation.error ? (
        <div className="mt-6">
          <ErrorState title="The report could not be created" error={mutation.error} />
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <Button
          variant="brand"
          onClick={() => mutation.mutate()}
          disabled={!selected || !effectiveProjectId || titleInvalid || mutation.isPending}
        >
          <Camera aria-hidden="true" />
          {mutation.isPending ? "Creating…" : "Start report and upload photographs"}
          <ArrowRight aria-hidden="true" />
        </Button>
        <p className="text-sm text-muted-foreground">
          The definition is copied into the report, so a later change to the survey type never
          alters an issued document.
        </p>
      </div>
    </AppShell>
  );
}
