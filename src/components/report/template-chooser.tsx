import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { definitionLabel } from "@/lib/survey-types";
import { purposeOf, type TemplateGroup } from "@/lib/report/template-families";

/**
 * Choosing a report template, as a working screen rather than a dropdown.
 *
 * The list ran to a dozen templates and the choices are made of similar words, so
 * a dropdown could only ever show names, seven at a time, in a panel that had to be
 * tapped before it could be read. Here the whole list is on the screen, grouped by
 * the job, each template carrying one line saying what it is for.
 *
 * Presentational on purpose: the route owns the registry, the device-local memory
 * of the last template and the navigation, so this can be tested without a router.
 */
export function TemplateChooser({
  groups,
  selectedId,
  lastUsedId,
  onSelect,
  onUse,
  className,
}: {
  groups: TemplateGroup[];
  selectedId: string | null;
  lastUsedId: string | null;
  onSelect: (id: string) => void;
  onUse: () => void;
  className?: string;
}) {
  const all = groups.flatMap((group) => group.definitions);
  const lastUsed = lastUsedId ? (all.find((item) => item.id === lastUsedId) ?? null) : null;
  const selected = selectedId ? (all.find((item) => item.id === selectedId) ?? null) : null;

  return (
    <div className={cn("flex min-h-dvh flex-col", className)}>
      <div className="flex-1">
        <h1 className="editorial-title mt-1 text-center text-2xl font-semibold text-brand-blue">
          Choose a report
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted-foreground">
          The template sets the instructions the AI works to. You can change it before you photograph
          anything.
        </p>

        {lastUsed ? (
          <div className="mt-5">
            <button
              type="button"
              onClick={() => onSelect(lastUsed.id)}
              aria-pressed={selectedId === lastUsed.id}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border-2 bg-surface-raised p-3.5 text-left transition-colors",
                selectedId === lastUsed.id ? "border-brand-accent" : "border-brand-blue/40",
              )}
            >
              <span className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent-ink">
                  Last used
                </span>
                <span className="mt-0.5 block text-[17px] font-bold leading-snug text-brand-blue">
                  {definitionLabel(lastUsed)}
                </span>
              </span>
              <span aria-hidden="true" className="ml-auto text-xl text-brand-blue">
                &rsaquo;
              </span>
            </button>
          </div>
        ) : null}

        {groups.map((group) => (
          <section key={group.id} className="mt-5">
            <h2 className="border-t border-border pt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {group.label}
            </h2>
            <div className="mt-2.5 space-y-2">
              {group.definitions.map((definition) => {
                const picked = selectedId === definition.id;
                const purpose = purposeOf(definition.id);
                return (
                  <button
                    key={definition.id}
                    type="button"
                    onClick={() => onSelect(definition.id)}
                    aria-pressed={picked}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border bg-surface p-3.5 text-left transition-colors",
                      picked ? "border-2 border-brand-blue" : "border-border hover:border-brand-blue/50",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full border text-xs font-bold",
                        picked
                          ? "border-brand-blue bg-brand-blue text-primary-foreground"
                          : "border-border text-transparent",
                      )}
                    >
                      <Check className="size-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[17px] font-bold leading-snug tracking-[-0.01em] text-foreground">
                        {definitionLabel(definition)}
                      </span>
                      {purpose ? (
                        <span className="mt-1 block text-sm leading-snug text-muted-foreground">
                          {purpose}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="sticky bottom-0 mt-6 flex items-center gap-3 border-t border-border bg-surface py-3">
        <span className="min-w-0 text-[13px] text-muted-foreground">
          {selected ? (
            <span data-testid="chosen-template" className="block truncate">
              {definitionLabel(selected)}
            </span>
          ) : (
            "Nothing chosen yet"
          )}
        </span>
        <Button
          type="button"
          onClick={onUse}
          disabled={!selected}
          className="ml-auto h-12 shrink-0 px-5 text-[15px] font-bold"
        >
          Use this template
        </Button>
      </div>
    </div>
  );
}
