import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageUp, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmailSettingsPanel } from "@/components/settings/email-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ErrorState, LoadingState } from "@/components/query-states";
import { organisationQuery, updateOrganisation } from "@/lib/data";
import { PlanUsageMeter } from "@/components/plan-usage-meter";
import { usePlanUsage } from "@/lib/plans";
import { useOrganisations } from "@/lib/use-organisations";
import { deleteOrganisation, getOrganisationDeleteSummary } from "@/lib/delete.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/organisation")({
  head: () => ({
    meta: [
      { title: "Organisation settings — instructBrain" },
      {
        name: "description",
        content:
          "Set your practice name, report logo and brand colour so every issued report carries your identity.",
      },
      { property: "og:title", content: "Organisation settings — instructBrain" },
      {
        property: "og:description",
        content: "Set your practice name, report logo and brand colour for issued reports.",
      },
    ],
  }),
  component: OrganisationSettings,
});

const swatches = [
  { id: "blue", label: "Instruct Blue", className: "bg-brand-blue" },
  { id: "orange", label: "Instruct Orange", className: "bg-brand-accent" },
  { id: "ink", label: "Deep Ink", className: "bg-brand-blue-ink" },
];

function OrganisationSettings() {
  const { organisationId, role } = useOrganisations();
  const usage = usePlanUsage(organisationId);
  const { isPlatformAdmin } = useIsPlatformAdmin();
  const query = useQuery(organisationQuery(organisationId));
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("blue");
  const [address, setAddress] = useState("");

  const organisation = query.data ?? null;

  useEffect(() => {
    if (!organisation) return;
    setName(organisation.name);
    setAddress(organisation.address ?? "");
    if (organisation.brand_colour) setBrand(organisation.brand_colour);
  }, [organisation]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!organisationId) throw new Error("You are not a member of an organisation yet.");
      return updateOrganisation(organisationId, { name, brand_colour: brand, address });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["organisation"] });
      toast.success("Organisation details saved");
    },
  });

  return (
    <AppShell>
      <header className="border-b border-border pb-6">
        <p className="eyebrow">Settings</p>
        <h1 className="editorial-title mt-1 text-2xl font-semibold sm:text-3xl">Organisation</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          These details appear on the cover and footer of every report you issue.
        </p>
      </header>

      <PlanUsageMeter usage={usage} className="mt-6 max-w-xl" />



      {role === "owner" || role === "admin" ? (
        <EmailSettingsPanel
          organisationId={organisationId}
          organisationName={organisation?.name ?? "your organisation"}
        />
      ) : null}

      {query.isPending ? (
        <LoadingState label="Loading your organisation…" />
      ) : query.isError ? (
        <ErrorState
          title="Your organisation could not be loaded"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <form
          className="mt-8 max-w-2xl space-y-8"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="org-name">Organisation name</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="organization"
              required
            />
            <p className="text-xs text-muted-foreground">Printed on the report cover page.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-address">Registered address</Label>
            <Input
              id="org-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              autoComplete="street-address"
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Report logo</legend>
            <div className="flex items-center gap-4 rounded-xl border border-dashed border-border bg-surface-raised p-5">
              <span
                aria-hidden="true"
                className="grid size-12 shrink-0 place-items-center rounded-lg bg-surface-sunken text-brand-blue"
              >
                <ImageUp className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {organisation?.logo_path ? "Logo uploaded" : "No logo uploaded"}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  PNG or SVG, at least 512px wide.
                </p>
              </div>
              <Button type="button" variant="quiet" className="ml-auto shrink-0" disabled>
                Upload
              </Button>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Brand colour</legend>
            <div className="flex flex-wrap gap-2">
              {swatches.map((swatch) => (
                <button
                  key={swatch.id}
                  type="button"
                  aria-pressed={brand === swatch.id}
                  onClick={() => setBrand(swatch.id)}
                  className={`flex min-h-11 items-center gap-2.5 rounded-lg border px-3 text-sm font-medium transition-colors ${
                    brand === swatch.id
                      ? "border-brand-accent bg-brand-accent-soft text-brand-accent-ink"
                      : "border-border bg-surface-raised hover:bg-surface-sunken"
                  }`}
                >
                  <span aria-hidden="true" className={`size-4 rounded-full ${swatch.className}`} />
                  {swatch.label}
                  {brand === swatch.id ? <span className="sr-only">(selected)</span> : null}
                </button>
              ))}
            </div>
          </fieldset>

          {mutation.error ? (
            <ErrorState title="Your changes were not saved" error={mutation.error} />
          ) : null}

          <div className="rule-top pt-6">
            <Button type="submit" variant="brand" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      )}


      {isPlatformAdmin && organisationId ? (
        <DeleteOrganisationZone
          organisationId={organisationId}
          organisationName={organisation?.name ?? "this organisation"}
        />
      ) : null}
    </AppShell>
  );
}

/**
 * Danger zone, owners only. Permanently deletes the organisation and
 * everything beneath it. Completed registers are archived (kept as evidence)
 * before the cascade, so deletion always finishes.
 */
function DeleteOrganisationZone({
  organisationId,
  organisationName,
}: {
  organisationId: string;
  organisationName: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [typed, setTyped] = useState("");
  const [open, setOpen] = useState(false);

  const summary = useQuery({
    queryKey: ["organisation", "delete-summary", organisationId],
    enabled: !!organisationId && open,
    queryFn: async () => getOrganisationDeleteSummary({ data: { organisationId } }),
  });

  const mutation = useMutation({
    mutationFn: async () => deleteOrganisation({ data: { organisationId } }),
    onSuccess: async () => {
      toast.success("Organisation deleted.");
      queryClient.clear();
      await navigate({ to: "/dashboard" });
    },
  });

  const counts = summary.data;
  const matches = typed === organisationName;

  return (
    <section className="mt-12 max-w-2xl rounded-xl border border-fail/40 bg-fail/5 p-6">
      <h2 className="text-base font-semibold text-fail">Delete organisation</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Permanently deletes the organisation
        {counts
          ? ` and everything inside it — ${counts.projects} ${counts.projects === 1 ? "project" : "projects"}, ${counts.reports} ${counts.reports === 1 ? "report" : "reports"}${
              counts.lockedRuns > 0
                ? ` and ${counts.lockedRuns} completed ${counts.lockedRuns === 1 ? "register" : "registers"} (archived as evidence first)`
                : ""
            }`
          : ""}
        — every photograph, finding, share link and audit record. This cannot be undone.
      </p>

      <div className="mt-4 space-y-3">
        <div className="space-y-2">
          <Label htmlFor="org-delete-confirm">Type the organisation name to confirm</Label>
          <Input
            id="org-delete-confirm"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={organisationName}
            className="max-w-sm"
            autoComplete="off"
          />
        </div>

        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="quiet"
              className="min-h-11 text-fail hover:text-fail"
              disabled={!matches}
            >
              <Trash2 aria-hidden="true" className="size-4" />
              Delete organisation
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{organisationName}” forever?</AlertDialogTitle>
              <AlertDialogDescription>
                Everything inside it is permanently deleted and cannot be recovered.
                {counts && counts.lockedRuns > 0
                  ? ` ${counts.lockedRuns} completed ${counts.lockedRuns === 1 ? "register is" : "registers are"} archived as evidence first.`
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="min-h-11">Keep the organisation</AlertDialogCancel>
              <AlertDialogAction
                className="min-h-11 bg-fail text-white hover:bg-fail/90"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Deleting…" : "Delete permanently"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {mutation.error ? (
          <p className="text-sm text-fail">
            {mutation.error instanceof Error ? mutation.error.message : "The organisation could not be deleted."}
          </p>
        ) : null}
      </div>
    </section>
  );
}
