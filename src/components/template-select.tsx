import { useMemo } from "react";

import { systemDefinitions } from "@/lib/survey-definitions";
import { definitionLabel } from "@/lib/survey-types";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Group headings only — every discipline term itself comes from the definition.
 */
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

export function useGroupedTemplates() {
  return useMemo(() => {
    const groups: {
      category: string;
      label: string;
      definitions: typeof systemDefinitions;
    }[] = [];
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
}

/**
 * One picker for the report template, used everywhere a template is chosen.
 * A dropdown rather than a long list: the library keeps growing and a person on
 * site should never have to scroll a wall of options one-handed.
 */
export function TemplateSelect({
  value,
  onChange,
  disabled = false,
  id = "report-template",
  label = "Report template",
  placeholder = "Choose a report template…",
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
  placeholder?: string;
  className?: string;
}) {
  const groups = useGroupedTemplates();

  return (
    <Select {...(value === "" ? {} : { value })} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger
        id={id}
        aria-label={label}
        className={className ?? "h-11 w-full max-w-xl bg-surface-raised text-sm"}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {groups.map((group) => (
          <SelectGroup key={group.category}>
            <SelectLabel>{group.label}</SelectLabel>
            {group.definitions.map((definition) => (
              <SelectItem key={definition.id} value={definition.id}>
                {definitionLabel(definition)}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
