# Short item labels in the Item column

## The problem

In Property inventory reports the Item column currently shows a truncated
sentence — the AI's opening description cut off at 54 characters with an
ellipsis (e.g. "Oak dining table, approximately 1.8m, seats six...") — and the
Description column then repeats the same wording. The Item column should hold
only a short item label ("Oak dining table"); everything descriptive belongs
under Description.

## Why it happens

- The AI writes one text field per finding (the description). There is no
  separate short-label output, so the report engine guesses the label from the
  first sentence of the description.
- The inventory definition (v5) never asks the AI for a label.

## The plan

### 1. Property inventory definition — bump to v6

Definitions are versioned in code (no database migration needed; issued
reports keep their frozen v5 snapshot). v6 adds:

- A new definition-level `aiCaptureFields` list with one entry:
  - `id: "item"`, label "Item", guidance: a short item label of one to three
    words (e.g. "Oak dining table", "Radiator"). No sizes, no condition, no
    quantities.
- Updated description guidance: the description covers material, size,
  quantity detail and condition, and does not start by repeating the item
  label in full.
- The photo role field stays `item`-agnostic; nothing else in v5 changes.

### 2. Engine: definition-driven AI item field (generic, no discipline words)

- Prompt builder: when a snapshot declares `aiCaptureFields`, add a section
  instructing the model to return a `capture_fields` object per observation
  with those ids, using each field's guidance.
- Observation schema: add optional `capture_fields` to each observation.
  The parser keeps only ids the snapshot declares and drops everything else;
  a missing or blank label simply falls back to the derived label below.
  Status handling is untouched — `not_assessed` still wins, and failure never
  becomes a pass.
- Analysis save: merge the AI-provided capture fields into the finding's
  stored `capture_fields` (alongside the existing room/type fields).

### 3. Better fallback label for existing findings

`inventoryItemTableLabel` already prefers an explicit `item` capture field.
For findings that don't have one (reports analysed before v6), the derived
label becomes genuinely short: take the first clause of the description (up to
the first comma or full stop) and cap it at about 30 characters — no ellipsis,
no mid-sentence cut. "Unidentified item" still applies to not-assessed
findings.

The Item column, the photograph-appendix "linked items" lines, and the HTML
report preview all share this one label function, so all three improve
together.

### 4. What does not change

- Refs, photo order, room organisation, landscape layout, columns and headings.
- Tone rules, report types, include toggles, checkout comments.
- Every other report template — the new `aiCaptureFields` mechanism is inert
  unless a definition declares it.
- The analysis cache key already includes the definition version, so v6
  re-analyses instead of reusing v5 wording.

## Tests

- Update the property-inventory tests: v6 present, item field declared,
  label derivation (first clause, capped, no ellipsis), explicit AI label
  preferred, "Unidentified item" unchanged for not-assessed.
- Add observation-parsing coverage: declared ids kept, unknown ids dropped,
  blank ignored.
- Run the full suite before and after; stop on any failure.

## Out of scope

- No migration (definition change is code-data; no schema change).
- No changes to other report templates or to the review-list layout.
