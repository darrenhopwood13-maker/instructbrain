# Add a Property Inventory report type

A fourth survey type for inventorying contents and fixtures: each photograph produces items identified by name, with a very brief description, quantity, room, and a short condition comment.

## What the user sees

1. **Report selector** gains a fourth option, "Property inventory", alongside Snag identification, Site condition and Weatherproofing. Selecting it shows the same detail panel (statuses, condition scale, captured fields) as the others.
2. **Only when Property inventory is chosen**, an extra "Report details" block appears before starting: main title, subtitle, report date (defaults to today), and author shown read-only as the signed-in user. The other three types keep today's auto-titled flow untouched.
3. Photos upload as normal; AI analysis returns items rather than defects.
4. Every item is referred to as Item 1, Item 2 … exactly as elsewhere in the app, reports and PDFs.

## The definition (data, not code)

```text
id: property_inventory      label: Property inventory
findings per photo: multiple   trade assignment: no
lifecycle/close-out: no        distribution: no
```

Condition statuses (colour always paired with a text label):

```text
New      Good      Used      Worn      Damaged      Not assessed
 pass    pass     neutral    warn       fail          flag
```

Capture fields recorded on site: Room / location (required), Quantity (number).

Output sections: cover, scope, summary, schedule, appendix.

AI guidance, in the house Oracle voice:
- Identify the object plainly — what it is, material and approximate size where visible ("Oak dining table, approx. 1.8m, six seats").
- One or two sentences maximum per item. No sales language, no valuation, no brand guesses.
- A short condition comment tied to the chosen condition status ("Light surface scratches to the top; joints sound").
- Quantity from what is countable in the photograph; null where it cannot be counted.
- Never describe a person. Where the photograph is too dark, distant or ambiguous to identify the object, return `not_assessed` rather than guessing.

## Technical notes

- `src/lib/survey-definitions.ts`: add `propertyInventoryDefinition` (version 1, `HOUSE_VOICE`) and append it to `systemDefinitions`. No engine changes — statuses, fields and prompts all flow through the existing definition engine, and the snapshot is frozen into the report at creation as usual.
- Seed a matching system row in `survey_type_definitions` (organisation_id null, is_active) as a data insert, mirroring how the existing three are held.
- `src/lib/data.ts` — `createReport` accepts optional `subtitle` and `reportDate`; unchanged defaults for existing callers. `author_id` already stores the signed-in user, so no schema change is needed.
- `src/routes/_authenticated/reports.new.tsx`: render the title/subtitle/date block only when the selected definition id is the inventory one, and pass those values through. Author rendered read-only from `useOrganisations()`.
- Quick report route is unchanged.
- New test asserting the inventory vocabulary does not leak into the other three definitions, alongside the existing isolation test; full suite run before and after.
