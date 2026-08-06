import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ImageUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/organisation")({
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

const swatches = [
  { id: "blue", label: "Instruct Blue", className: "bg-brand-blue" },
  { id: "purple", label: "Instruct Purple", className: "bg-brand-purple" },
  { id: "ink", label: "Deep Ink", className: "bg-brand-blue-ink" },
];

function OrganisationSettings() {
  const [brand, setBrand] = useState("blue");

  return (
    <AppShell>
      <header className="border-b border-border pb-6">
        <p className="eyebrow">Settings</p>
        <h1 className="editorial-title mt-1 text-2xl font-semibold sm:text-3xl">Organisation</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          These details appear on the cover and footer of every report you issue.
        </p>
      </header>

      <form
        className="mt-8 max-w-2xl space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          toast.success("Organisation details saved");
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="org-name">Organisation name</Label>
          <Input id="org-name" defaultValue="Okonjo Building Consultancy" autoComplete="organization" />
          <p className="text-xs text-muted-foreground">Printed on the report cover page.</p>
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
              <p className="text-sm font-semibold">No logo uploaded</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                PNG or SVG, at least 512px wide. Placeholder — upload arrives with storage.
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
                    ? "border-brand-purple bg-brand-purple-soft text-brand-purple-ink"
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

        <div className="rule-top pt-6">
          <Button type="submit" variant="brand">
            Save changes
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
