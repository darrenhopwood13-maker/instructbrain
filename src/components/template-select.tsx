import { useMemo } from "react";

import { systemDefinitions } from "@/lib/survey-definitions";
import { definitionLabel } from "@/lib/survey-types";
import { cn } from "@/lib/utils";
import { purposeOf, templateGroups } from "@/lib/report/template-families";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select";

/**
 * One picker for the report template, used everywhere a template is chosen.
 *
 * A dropdown rather than a long list, because the field cockpit has no room for one
 * and a person on site should never have to scroll a wall of options one-handed.
 * The main way in is the chooser screen (`/reports/choose`), which shows every
 * template with a line saying what it is for; this control is for changing the
 * answer afterwards.
 *
 * Two things were wrong with it on 12 Oct 2026 and both are fixed here:
 *
 * 1. It grouped by the internal category key, and two pairs of keys share one
 *    display label, so "Building fabric" and "Quality & handover" each printed
 *    twice, in two places in the list. Groups come from `templateGroups()` now:
 *    one heading per family, printed once.
 * 2. The popup is rendered in a portal on <body>, outside the surface that opened
 *    it, so it picked up the console's navy tokens on a white working screen.
 *    `surface` carries the surface's own tokens into the portal.
 */
export function useGroupedTemplates() {
  return useMemo(() => templateGroups(), []);
}

export function TemplateSelect({
  value,
  onChange,
  disabled = false,
  id = "report-template",
  label = "Report template",
  placeholder = "Choose a report template…",
  className,
  surface = "light",
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
  placeholder?: string;
  className?: string;
  /** Which surface the popup opens on. The field cockpit and the working screens are light. */
  surface?: "light" | "console";
}) {
  const groups = useGroupedTemplates();
  const selected = systemDefinitions.find((definition) => definition.id === value) ?? null;

  return (
    <Select {...(value === "" ? {} : { value })} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger
        id={id}
        aria-label={label}
        className={className ?? "h-11 w-full max-w-xl bg-surface-raised text-sm"}
      >
        {/* The chosen name is rendered here rather than through SelectValue: each
            option carries a line of explanation, and SelectValue would copy that
            line into the closed control. */}
        {selected ? (
          <span className="truncate text-left">{definitionLabel(selected)}</span>
        ) : (
          <span className="truncate text-left text-muted-foreground">{placeholder}</span>
        )}
      </SelectTrigger>
      <SelectContent
        className={cn(
          surface === "light" ? "popover-light" : null,
          // The panel is the trigger's width and no wider: each option carries a line
          // of explanation, and left to itself that line stretched the panel 38px past
          // the right-hand edge of a 390px phone (measured), clipping every purpose.
          "w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-1.5rem)]",
        )}
      >
        {groups.map((group) => (
          <SelectGroup key={group.id}>
            <SelectLabel className="text-[11px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
              {group.label}
            </SelectLabel>
            {group.definitions.map((definition) => (
              <SelectItem
                key={definition.id}
                value={definition.id}
                textValue={definitionLabel(definition)}
                className="items-start py-2.5"
              >
                <span className="block text-base font-semibold leading-snug">
                  {definitionLabel(definition)}
                </span>
                {purposeOf(definition.id) ? (
                  <span className="mt-0.5 block text-[13px] leading-snug whitespace-normal text-muted-foreground">
                    {purposeOf(definition.id)}
                  </span>
                ) : null}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
