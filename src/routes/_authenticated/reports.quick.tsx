import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Zap } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlanUsageMeter } from "@/components/plan-usage-meter";
import { createReport } from "@/lib/data";
import { usePlanUsage } from "@/lib/plans";
import { useOrganisations } from "@/lib/use-organisations";
import { snapshotOf, systemDefinitions } from "@/lib/survey-definitions";
import { definitionLabel } from "@/lib/survey-types";

export const Route = createFileRoute("/_authenticated/reports/quick")({
  head: () => {
    const title = "Quick report — instructBrain";
    const description =
      "Pick a survey type, upload photographs, draft with AI or type it yourself, then send the link to any email address. No project set-up.";
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organisationId, userId } = useOrganisations();
  const usage = usePlanUsage(organisationId);

  const [selectedId, setSelectedId] = useState<string>(systemDefinitions[0]?.id ?? "");
  const [title, setTitle] = useState("");

  const selected = systemDefinitions.find((definition) => definition.id === selectedId);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Choose a survey type first.");
      if (!organisationId) throw new Error("You are not a member of an organisation yet.");
      return createReport({
        organisationId,
        projectId: null,
        isQuick: true,
        title: title.trim() || `${definitionLabel(snapshotOf(selected))} — ${todayLabel()}`,
        reference: "",
        definition: snapshotOf(selected),
        authorId: userId,
      });
    },
    onSuccess: async (reportId) => {
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Quick report started", {
        description: "Upload photographs next. You can draft with AI or write the findings yourself.",
      });
      void navigate({ to: "/reports/$id", params: { id: reportId }, search: { tab: "photos" } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell>
      <nav aria-label="Breadcrumb" className="pb-4 text-sm">
        <Link to="/projects" className="font-medium text-muted-foreground hover:text-foreground">
          Projects
        </Link>
      </nav>

      <header className="border-b border-border pb-6">
        <p className="eyebrow">Quick report</p>
        <h1 className="editorial-title mt-1.5 text-2xl font-semibold sm:text-3xl">
          Straight to the photographs
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          No project, no client details, no directory. Choose the survey type, upload the
          photographs, draft with AI or write the findings yourself, then send the link to any
          email address. You can attach it to a project later.
        </p>
      </header>

      {organisationId ? <PlanUsageMeter usage={usage} className="mt-6" /> : null}

      <section aria-labelledby="type-heading" className="mt-8">
        <h2 id="type-heading" className="text-lg font-semibold">
          Survey type
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This is frozen into the report at creation and decides its statuses, capture fields and
          output.
        </p>

        <fieldset className="mt-4">
          <legend className="sr-only">Choose a survey type</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {systemDefinitions.map((definition) => {
              const active = definition.id === selectedId;
              return (
                <label
                  key={definition.id}
                  className={`flex min-h-14 cursor-pointer flex-col justify-center rounded-xl border p-4 shadow-raised transition-colors ${
                    active
                      ? "border-brand-accent bg-surface-raised"
                      : "border-border bg-surface-raised hover:bg-surface-sunken"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="survey-type"
                      value={definition.id}
                      checked={active}
                      onChange={() => setSelectedId(definition.id)}
                      className="size-4 accent-[var(--brand-accent)]"
                    />
                    <span className="text-sm font-semibold">
                      {definitionLabel(snapshotOf(definition))}
                    </span>
                    {active ? (
                      <span className="ml-auto text-xs font-semibold text-brand-accent">
                        Selected
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-2 text-sm text-muted-foreground">
                    {definition.description ?? "Survey type"}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </section>

      <section aria-labelledby="title-heading" className="mt-10 max-w-xl">
        <h2 id="title-heading" className="text-lg font-semibold">
          Title
        </h2>
        <div className="mt-3">
          <Label htmlFor="quick-title">Report title (optional)</Label>
          <Input
            id="quick-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={
              selected
                ? `${definitionLabel(snapshotOf(selected))} — ${todayLabel()}`
                : "Site walk"
            }
            className="mt-1.5 h-12"
          />
          <p className="mt-1.5 text-sm text-muted-foreground">
            Leave it blank and today's date is used.
          </p>
        </div>
      </section>

      <div className="sticky bottom-20 z-20 mt-10 sm:bottom-4">
        <Button
          type="button"
          size="lg"
          className="w-full sm:w-auto"
          disabled={mutation.isPending || !organisationId}
          onClick={() => mutation.mutate()}
        >
          <Zap aria-hidden="true" className="size-4" />
          {mutation.isPending ? "Starting…" : "Start quick report"}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </AppShell>
  );
}
