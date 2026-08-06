import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageUp, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState, LoadingState } from "@/components/query-states";
import { organisationQuery, updateOrganisation } from "@/lib/data";
import { useOrganisations } from "@/lib/use-organisations";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/organisation")({
  head: () => ({
    meta: [
      { title: "Organisation settings — Report Ready" },
      {
        name: "description",
        content:
          "Set your practice name, report logo and brand colour so every issued report carries your identity.",
      },
      { property: "og:title", content: "Organisation settings — Report Ready" },
      {
        property: "og:description",
        content: "Set your practice name, report logo and brand colour for issued reports.",
      },
    ],
  }),
  component: OrganisationSettings,
});


/**
 * Owners and admins need to know that the default Supabase sender is not a
 * production email service. Being locked out of your own account is what
 * happens when this is left alone.
 */
function EmailDeliveryWarning() {
  return (
    <div
      role="alert"
      className="mt-6 max-w-2xl rounded-xl border border-warn/40 bg-warn-soft p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warn" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">
            Action required: email is not production-ready
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Sign-in links, confirmations, password resets and invitations are currently sent by
            Supabase&rsquo;s built-in sender. It is heavily rate-limited (a handful of messages per
            hour, shared across the whole project), it is not guaranteed to be delivered, and it
            will silently stop working under real use. People will be locked out of their own
            accounts.
          </p>
          <p className="mt-3 text-sm font-medium">Configure custom SMTP before real use:</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>Create a Resend account and verify your sending domain (SPF, DKIM, DMARC records).</li>
            <li>
              In Supabase, open Authentication → Emails → SMTP Settings and enable a custom SMTP
              provider.
            </li>
            <li>
              Host <span className="font-mono text-xs">smtp.resend.com</span>, port{" "}
              <span className="font-mono text-xs">465</span>, username{" "}
              <span className="font-mono text-xs">resend</span>, password: a Resend API key.
            </li>
            <li>Set the sender name and a sender address on your verified domain.</li>
            <li>Raise the auth email rate limit once SMTP is active, and send a test message.</li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Until then, keep password sign-in as the primary route: it does not depend on email
            after the account is confirmed.
          </p>
        </div>
      </div>
    </div>
  );
}

const swatches = [
  { id: "blue", label: "Instruct Blue", className: "bg-brand-blue" },
  { id: "orange", label: "Instruct Orange", className: "bg-brand-accent" },
  { id: "ink", label: "Deep Ink", className: "bg-brand-blue-ink" },
];

function OrganisationSettings() {
  const { organisationId, role } = useOrganisations();
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

      {role === "owner" || role === "admin" ? <EmailDeliveryWarning /> : null}

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
    </AppShell>
  );
}
