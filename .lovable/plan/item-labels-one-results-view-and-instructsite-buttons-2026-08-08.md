# Item labels, one results view, and instructSite buttons

Five changes. No schema migration needed.

## 1. "Item 1, Item 2" everywhere

Findings are currently shown as `F-001`, `F-002`. They become **Item 1**, **Item 2** —
in the review list, the report document, the share link, per-trade extracts and the PDF.

The stored reference itself is not renumbered or reassigned (Invariant 4 stands); only
the way it is displayed changes, so an existing report keeps the same item numbers it
was issued with, and deleting a photo still never renumbers anything.

## 2. Stop asking for the same thing twice

- **Quick report**: the "Title" section goes. The report is named automatically from the
  survey type and today's date, exactly as the blank placeholder already does. One screen:
  choose type, press Start.
- **Project report**: "Report title" and "Report reference" stop being asked up front.
  The title defaults to the survey type plus the date and the reference defaults from the
  project's reference; both stay editable inside the report itself, where they already are.
  Creating a report becomes: pick project, pick survey type, start.
- **Capture fields entered twice**: the zone values set on the upload screen (Location,
  Element, Stage) already ride along with each photograph. Review will read those values
  as the starting point for the finding instead of presenting them empty, so a field
  filled once on site is not asked for again at the desk. Editing it in Review still
  overrides it for that item.

## 3. "Executive summary" becomes "Report summary"

Every visible label — report workspace, document view, share link, per-trade extract and
PDF — reads "Report summary". The underlying column keeps its name, so nothing breaks and
no migration is required.

## 4. One set of results with a view toggle

The report output currently prints several separate lists (prioritised actions, grouped
sections). That is replaced by **one list of items** with a segmented toggle above it:

```text
View:  [ By trade ]  [ By severity ]  [ By deadline ]
```

- **By trade** — grouped by assigned trade, unassigned items first.
- **By severity** — highest severity first, `not_assessed` always surfaced at the top.
- **By deadline** — soonest due date first, overdue items first, no-date items last.

Every item appears exactly once in whichever view is selected. The chosen view is the
order used in the issued PDF and the share link, so what you see is what the client gets.

## 5. Buttons matched to instructSite exactly

The orange and navy buttons are replaced with instructSite's actual button treatment,
copied from its stylesheet rather than re-derived: translucent orange fill with a navy
label, 2px navy outline, inset white top highlight, 4px 3D drop edge, orange glow shadow,
press-down on active — plus the glossy top sheen the instructSite tiles have, which is the
piece the current buttons are missing. The navy secondary button gets the same treatment
with a white label and an orange 3D edge.

This applies app-wide, not just the landing page.

## Technical notes

- New `src/lib/item-label.ts` with `itemLabel(ref)` deriving "Item N" from the trailing
  number in a persisted `ref`; used by `review-list`, `report-document-view`,
  `shared-document`, extract and print routes. `nextRef` in `finding-refs.ts` is unchanged.
- `reports.quick.tsx`: drop the title state and section; always send the generated title.
  `reports.new.tsx`: drop the title/reference inputs and derive both at creation.
- Review seeds finding capture fields from `photos.capture_fields` when the finding's own
  `capture_fields` is empty; no write until the user edits.
- `document.ts` label map `summary: "Executive summary"` becomes `"Report summary"`; sweep
  remaining literals in the workspace, extract and print views.
- `report-document-view.tsx`: replace `documentSections`/`groupingForSection` rendering
  with a single grouped list driven by a `view` state (`trade | severity | deadline`),
  persisted in the route search param so print and share inherit it. Grouping helpers move
  into `src/lib/report/grouping.ts` and get unit tests for "every item appears once".
- `src/styles.css`: rewrite `@utility glass-orange` and add `glass-navy` from instructSite's
  `src/index.css` (lines 247–314), values converted to the existing `--brand-accent` token
  family, plus the `::after` gloss sheen. `button.tsx` maps `brand`/`default` to
  `glass-orange` and `outline`/`secondary` to `glass-navy`.
