/**
 * How a report reference is shaped, and how to recognise one the system built.
 *
 * A reference is allocated by the database when the report is created - see
 * `supabase/migrations/20261006151232_report_reference_builder.sql` - in the
 * form TYPE-YYYY-MM-NNN (`SOC-2026-10-001`), and it is immutable once
 * allocated. Nothing in the app ever writes the column.
 *
 * Reports issued BEFORE that builder carry hand-typed references instead -
 * `001`, `DEMO-INV-001`, `FC-LI-001` - which are deliberately NOT renumbered,
 * because issued evidence is never rewritten. So this module must never claim
 * one of those was system-built: the two cases read differently to the person
 * looking at the report.
 *
 * REFERENCE_PATTERN must stay identical to the predicate on the
 * `reports_generated_reference_unique` index in that migration. If one moves
 * and the other does not, the app starts describing rows the database does not
 * consider allocated.
 */
export const REFERENCE_PATTERN = /^[A-Z0-9]{2,6}-[0-9]{4}-[0-9]{2}-[0-9]{3,}$/;

/** True when this reference was allocated by the builder, not typed by a person. */
export function isAllocatedReference(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  return REFERENCE_PATTERN.test(value.trim());
}

export const REFERENCE_ALLOCATED_NOTE =
  "Allocated automatically when the report was created. This cannot be changed.";

export const REFERENCE_LEGACY_NOTE =
  "Recorded by hand before references were allocated automatically. This cannot be changed.";

export const REFERENCE_MISSING_NOTE = "No reference recorded against this report yet.";
