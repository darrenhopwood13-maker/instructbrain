import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { ReportStepper } from "@/components/report/report-stepper";
import { TemplateChooser } from "@/components/report/template-chooser";
import { lastUsedTemplateId } from "@/lib/report/last-template";
import { templateGroups } from "@/lib/report/template-families";
import { systemDefinitions } from "@/lib/survey-definitions";

type ChooseReportSearch = { project?: string | undefined; type?: string | undefined };

/**
 * The way in to starting a report: the template, chosen on a working screen.
 *
 * It used to be a dropdown on the capture screen. A dozen templates whose names are
 * made of the same words - "Schedule of Condition" against "Photo condition record"
 * - cannot be told apart in a panel that shows seven names at a time and nothing
 * about any of them. Here the whole list is on the screen, grouped by the job, with
 * one line under each template saying what it is for.
 *
 * Choosing a template hands off to the capture screen, which owns everything after
 * this point: project, photographs and the brief. The address carries the choice
 * across, so a link into the middle of this still works.
 */
export const Route = createFileRoute("/_authenticated/reports/choose")({
  validateSearch: (search: Record<string, unknown>): ChooseReportSearch => ({
    project: typeof search["project"] === "string" ? search["project"] : undefined,
    type: typeof search["type"] === "string" ? search["type"] : undefined,
  }),
  head: () => {
    const title = "Choose a report — instructBrain";
    const description =
      "Pick the report template, grouped by the job it is for, before you photograph anything.";
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
  component: ChooseReport,
});

function ChooseReport() {
  const { project, type } = Route.useSearch();
  const navigate = useNavigate();
  const groups = useMemo(() => templateGroups(), []);
  const known = useMemo(() => systemDefinitions.map((definition) => definition.id), []);
  // A link that names a template wins; otherwise the last one used, so the usual
  // job is one tap away and nobody has to find it again every morning.
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    type && known.includes(type) ? type : lastUsedTemplateId(known),
  );

  return (
    <AppShell surface="light">
      <div className="mt-4">
        <ReportStepper current="photos" interactive={false} />
      </div>
      <section aria-label="Choose a report template" className="mt-1">
        <TemplateChooser
          groups={groups}
          selectedId={selectedId}
          lastUsedId={lastUsedTemplateId(known)}
          onSelect={setSelectedId}
          onUse={() => {
            if (!selectedId) return;
            void navigate({
              to: "/reports/quick",
              search: { type: selectedId, ...(project ? { project } : {}) },
            });
          }}
        />
      </section>
    </AppShell>
  );
}
