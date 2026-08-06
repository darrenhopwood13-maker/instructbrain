import type { CaptureField } from "@/lib/survey-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Capture fields come from the report's survey type snapshot via the
 * definition engine. Nothing here knows what discipline it is rendering.
 *
 * Required fields are flagged but never block an upload — the surveyor is on
 * site and completes them later.
 */
export function CaptureFieldsForm({
  fields,
  values,
  onChange,
  idPrefix,
  compact = false,
}: {
  fields: CaptureField[];
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  idPrefix: string;
  compact?: boolean;
}) {
  if (fields.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This survey type records no on-site fields against a photograph.
      </p>
    );
  }

  return (
    <div className={compact ? "grid gap-3 sm:grid-cols-2" : "grid gap-4"}>
      {fields.map((field) => {
        const id = `${idPrefix}-${field.id}`;
        const value = values[field.id] ?? "";
        const missing = field.required === true && value.trim() === "";
        return (
          <div key={field.id} className="min-w-0">
            <Label htmlFor={id} className="flex flex-wrap items-center gap-2">
              <span>{field.label}</span>
              {field.required ? (
                <span className="rounded-sm border border-border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  Required
                </span>
              ) : null}
              {missing ? (
                <span className="text-xs font-medium text-warn-foreground">Not yet completed</span>
              ) : null}
            </Label>

            {field.type === "textarea" ? (
              <Textarea
                id={id}
                value={value}
                onChange={(event) => onChange(field.id, event.target.value)}
                className="mt-1.5 min-h-20"
                {...(field.hint ? { placeholder: field.hint } : {})}
              />
            ) : field.type === "select" ? (
              <select
                id={id}
                value={value}
                onChange={(event) => onChange(field.id, event.target.value)}
                className="mt-1.5 h-11 w-full rounded-md border border-border bg-background px-3 text-base"
              >
                <option value="">Not set</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id={id}
                type={field.type === "number" ? "number" : "text"}
                value={value}
                onChange={(event) => onChange(field.id, event.target.value)}
                className="mt-1.5 h-11"
                {...(field.hint ? { placeholder: field.hint } : {})}
              />
            )}

            {field.hint ? (
              <p className="mt-1 text-xs text-muted-foreground">{field.hint}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
