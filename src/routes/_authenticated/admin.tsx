import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { ErrorState, LoadingState } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { FieldCard } from "@/components/field-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminOrganisations, adminSetPlan, adminSignUps } from "@/lib/admin/admin.functions";
import { useIsPlatformAdmin } from "@/lib/platform-admin";
import { planLimitsQuery } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => {
    const title = "Platform administration — instructBrain";
    const description =
      "Founder view of every sign-up, organisation, plan and report across the platform.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: AdminConsole,
});

function formatDate(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function AdminConsole() {
  const { isPlatformAdmin, loading } = useIsPlatformAdmin();
  const queryClient = useQueryClient();

  const signUps = useQuery({
    queryKey: ["admin", "sign-ups"],
    queryFn: () => adminSignUps(),
    enabled: isPlatformAdmin,
  });
  const organisations = useQuery({
    queryKey: ["admin", "organisations"],
    queryFn: () => adminOrganisations(),
    enabled: isPlatformAdmin,
  });
  const plans = useQuery(planLimitsQuery());

  const changePlan = useMutation({
    mutationFn: (input: { organisationId: string; plan: string }) => adminSetPlan({ data: input }),
    onSuccess: async () => {
      toast.success("Plan updated.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "organisations"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (loading) {
    return (
      <AppShell>
        <LoadingState label="Checking your access level" />
      </AppShell>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <AppShell>
        <EmptyState
          icon={ShieldCheck}
          eyebrow="Restricted"
          title="This area is for platform administrators"
          description="Your account does not hold founder access. If that is wrong, it has to be granted on the platform administrator list."
          action={
            <Button variant="quiet" asChild>
              <Link to="/projects">Back to projects</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="border-b border-border pb-6">
        <p className="eyebrow">Founder access</p>
        <h1 className="editorial-title mt-1.5 text-2xl font-semibold sm:text-3xl">
          Platform administration
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every sign-up, organisation and report on the platform. Edits made here are recorded in
          the audit log in the same way as any other change.
        </p>
      </header>

      <section aria-labelledby="orgs-heading" className="mt-10">
        <h2 id="orgs-heading" className="text-lg font-semibold">
          Organisations
        </h2>

        {organisations.isPending ? (
          <LoadingState label="Loading organisations" />
        ) : organisations.error ? (
          <ErrorState
            error={organisations.error as Error}
            onRetry={() => void organisations.refetch()}
          />
        ) : (organisations.data ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No organisations yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {(organisations.data ?? []).map((org) => (
              <li key={org.id}>
                <FieldCard
                  title={org.name}
                  description={`${org.members} member${org.members === 1 ? "" : "s"} · ${org.projects} project${org.projects === 1 ? "" : "s"} · ${org.reports} report${org.reports === 1 ? "" : "s"} · created ${formatDate(org.createdAt)}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">Plan</span>
                    <Select
                      value={org.plan}
                      onValueChange={(plan) =>
                        changePlan.mutate({ organisationId: org.id, plan })
                      }
                    >
                      <SelectTrigger className="h-11 w-48" aria-label={`Plan for ${org.name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(plans.data ?? []).map((plan) => (
                          <SelectItem key={plan.plan} value={plan.plan}>
                            {plan.label}
                            {plan.report_allowance === null
                              ? " — unlimited"
                              : ` — ${plan.report_allowance} reports`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </FieldCard>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="users-heading" className="mt-12">
        <h2 id="users-heading" className="text-lg font-semibold">
          Sign-ups
        </h2>

        {signUps.isPending ? (
          <LoadingState label="Loading sign-ups" />
        ) : signUps.error ? (
          <ErrorState error={signUps.error as Error} onRetry={() => void signUps.refetch()} />
        ) : (
          <ul className="mt-4 space-y-3">
            {(signUps.data ?? []).map((user) => (
              <li
                key={user.id}
                className="rounded-xl border border-border bg-surface-raised p-4 shadow-raised"
              >
                <p className="truncate text-sm font-semibold">{user.email}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Joined {formatDate(user.createdAt)} · last signed in{" "}
                  {formatDate(user.lastSignInAt)} ·{" "}
                  {user.confirmed ? "Email confirmed" : "Email not confirmed"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {user.organisations.length === 0
                    ? "No organisation yet"
                    : user.organisations
                        .map((org) => `${org.name} (${org.role})`)
                        .join(", ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
