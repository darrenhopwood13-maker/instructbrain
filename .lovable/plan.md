# Replace scrolling template lists with dropdown selects

With the template library growing (~15+ report templates), every place that lists templates as a long stack of cards or buttons becomes a scroll-a-thon. This plan swaps each of those lists for a compact dropdown (Select) you pick from.

## What changes

**1. Dashboard — "Report template" grid**
- The grid of template buttons under the mode tiles becomes a single dropdown: "Report template — choose…".
- Choosing an option runs exactly the same action as today's button (`chooseType(definition.id)`).

**2. New report (`/reports/new`) — "Report templates" radio list**
- The stacked radio cards become one dropdown with every template, grouped by category (Building fabric, Quality & handover, Site & safety, Electrical, Mechanical & HVAC).
- The detail panel on the right (statuses, severity scale, captured fields, output) stays — it updates to describe whichever template is picked in the dropdown. Nothing is selected until you choose, and the "Start report" button stays disabled until then.

**3. Custom Reports (`/reports/quick`) — template picker and saved templates**
- The grouped radio list becomes one grouped dropdown.
- The "Saved templates" list becomes a dropdown too: pick a saved template to apply it; a small "Delete" action stays next to the dropdown for the currently selected saved template (with the existing confirmation).
- Tone, report type, include toggles and special request are unchanged.

**Rules kept intact**
- No discipline wording is hardcoded — dropdown options and group headings come from the survey definitions exactly as the radio lists do today.
- Keyboard-first and screen-reader labelled (native Select component, 44px touch target), works one-handed on a phone.
- The results-order segmented control on the report page stays as-is (it's a 3-option toggle, not a list).

## Technical notes

- Files: `src/routes/_authenticated/dashboard.tsx`, `src/routes/_authenticated/reports.new.tsx`, `src/routes/_authenticated/reports.quick.tsx`.
- Use the existing shadcn `Select` component (already used for language and project pickers) with `SelectGroup`/`SelectLabel` for categories.
- Selection state variables (`selectedId`, `templateId`) stay the same — only the input control changes.
- Verify: `bunx tsgo --noEmit`, full Vitest suite, and a Playwright pass over all three screens at 375px and 1280px confirming a single dropdown opens, selects, and drives the same behaviour (detail panel updates, create button enables, dashboard navigates).
