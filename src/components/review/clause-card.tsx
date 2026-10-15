import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldCard } from "@/components/field-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Finding } from "@/lib/types";
import {
  clauseLabel,
  clausesOf,
  resolveClause,
  type ReferenceDefinition,
} from "@/lib/survey-types";

/**
 * The clause control, in the review flow.
 *
 * A clause is a PERSON's choice and nothing else. There is no suggestion here, no model
 * value, no confidence number and no free text: the only thing this control can produce is
 * one of the entries the instrument publishes for itself, and the list it offers is that
 * instrument's own. That is the whole point of it - a finding may name the instrument the
 * assessment judged it engages, but only a person may name the section, because a wrong
 * section on a document somebody else relies on is worse than none at all.
 *
 * The control is not rendered for an instrument that publishes no titles for its numbered
 * units: `clausesOf` returns nothing for those, so their list would be a wall of bare
 * numbers, which is not a choice anybody can make. Nor is it rendered when no instrument is
 * named - a clause belongs to an instrument.
 *
 * Nothing is written until a person chooses. The instrument's own line is shown back exactly
 * as the report will print it, so what a reviewer picks is what the client reads.
 */
export function ClauseCard({
  finding,
  reference,
  onChoose,
  disabled,
}: {
  finding: Finding;
  /** The instrument the finding already names. Its own list is the only source of clauses. */
  reference: ReferenceDefinition;
  /** One route in, one write out: the chosen number lands in the finding's own record. */
  onChoose: (clause: string | null) => Promise<void> | void;
  disabled?: boolean;
}) {
  const clauses = clausesOf(reference);
  const [busy, setBusy] = useState(false);
  const stored = finding.regulatoryClause ?? "";
  // Resolved through the instrument's own list, so a stored number this instrument does not
  // carry shows as nothing chosen rather than as text the publisher never wrote.
  const chosen = resolveClause(reference, stored);
  const printed = clauseLabel(reference, stored);

  const choose = async (value: string) => {
    setBusy(true);
    try {
      await onChoose(value === "__none__" ? null : value);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FieldCard
      label="Clause"
      actionLabel={`Open clause for ${finding.ref}`}
      popOutDescription={`Chosen by a person from the entries ${reference.label} publishes for itself. The report prints it exactly as the instrument titles it, and nothing outside that list can be recorded.`}
      badge={
        chosen ? (
          <span className="text-[0.6875rem] font-semibold text-muted-foreground">
            Chosen by reviewer
          </span>
        ) : null
      }
      popOut={
        <div>
          <label htmlFor={`clause-${finding.id}`} className="eyebrow block text-muted-foreground">
            Clause
          </label>
          {/* Radix refuses an empty-string item value, so "no clause" is a sentinel - the same
              shape the reference picker beside this one uses. A number the instrument does not
              carry reads as nothing chosen, which is what the report prints. */}
          <Select value={chosen ? stored : "__none__"} onValueChange={(value) => void choose(value)}>
            <SelectTrigger
              id={`clause-${finding.id}`}
              aria-label={`Clause for ${finding.ref}`}
              className="mt-2 h-11 w-full bg-surface-raised text-base"
            >
              <SelectValue placeholder="No clause chosen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No clause</SelectItem>
              {clauses.map((clause) => (
                <SelectItem key={clause.number} value={clause.number}>
                  {clause.number} — {clause.heading}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {chosen ? (
            <Button
              variant="quiet"
              className="mt-3 min-h-11 w-full sm:w-auto"
              disabled={disabled || busy}
              aria-label={`Clear clause for ${finding.ref}`}
              onClick={() => void choose("__none__")}
            >
              Clear clause
            </Button>
          ) : null}
        </div>
      }
    >
      {printed ? (
        <p className="break-words">{printed}</p>
      ) : (
        <p className="text-muted-foreground">
          No clause chosen. {reference.label} is named without one — a person decides whether a
          specific section is named as well.
        </p>
      )}
    </FieldCard>
  );
}
