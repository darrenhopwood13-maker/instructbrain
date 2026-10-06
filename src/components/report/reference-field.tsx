import {
  REFERENCE_ALLOCATED_NOTE,
  REFERENCE_LEGACY_NOTE,
  REFERENCE_MISSING_NOTE,
  isAllocatedReference,
} from "@/lib/report/reference";

/**
 * The report reference, shown as plain text on purpose.
 *
 * There is no input here because there is nothing a user may do to this value:
 * the database allocates it on insert and refuses every later change. Rendering
 * an editable box that silently rejected your typing would be worse than
 * showing the number and saying so.
 */
export function ReferenceField({ value }: { value: string | null }) {
  const trimmed = (value ?? "").trim();
  const note = trimmed
    ? isAllocatedReference(trimmed)
      ? REFERENCE_ALLOCATED_NOTE
      : REFERENCE_LEGACY_NOTE
    : REFERENCE_MISSING_NOTE;

  return (
    <div>
      <p className="eyebrow">Reference</p>
      <p className="mt-1 text-sm leading-relaxed">
        {trimmed || <span className="text-muted-foreground">Not allocated</span>}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
