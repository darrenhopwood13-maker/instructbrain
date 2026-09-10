# Dropdowns instead of scrolling lists, across the whole app

Rule applied everywhere: if a list exists so you can *pick one thing from it*, it becomes a dropdown. Lists that exist so you can *see and work on many things at once* (photo grids, the report document, project/report cards) stay as they are.

## Screens that change

**1. Dashboard — report template grid**
The row of template buttons under the mode tiles becomes a single "Report template" dropdown. Choosing an option does exactly what pressing the button does today.

**2. New report (`/reports/new`) — report template list**
The stack of radio cards becomes one dropdown, grouped by category (Building fabric, Quality & handover, Site & safety, Electrical, Mechanical & HVAC). The detail panel beside it stays and updates to match your choice. The start button stays disabled until a template is chosen.

**3. Custom Reports (`/reports/quick`)**
- Template picker: grouped dropdown, same grouping as above.
- Saved templates: dropdown to pick and apply one, with a Delete action next to it for the selected one (existing confirmation kept).
- Tone, report type, includes and special request are unchanged.

**4. Findings review — jump-to-finding dropdown**
Review already shows one finding at a time with Previous/Next. Add a "Go to finding" dropdown at the top listing every finding by its stable reference, short title and status word, so 150 findings are reachable in one press instead of tapping Next repeatedly. Previous/Next, keyboard shortcuts and swipe all keep working and keep the dropdown in sync.

**5. Choice fields inside a finding**
Status choices, severity, trade attribution and regulatory reference all become the same styled dropdown control, so every pick-one control in the app looks and behaves identically. The trade suggestion still shows the AI's confidence and reasoning, and still needs a human confirmation press — that is unchanged.

**6. Other pick-one lists**
Language pickers and the report-language control are already dropdowns and stay. The results-order control on the report page (three options side by side) stays a toggle — it is not a list.

## What deliberately does not change

- Photo grids, the report preview/print document, project and report card grids: these are browsing surfaces, not pickers.
- The upload tray progress list and the distribution recipient list: they show live state for many items at once.
- No behaviour, data, AI or report logic changes anywhere — this is presentation only.

## Technical notes

- Files: `src/routes/_authenticated/dashboard.tsx`, `reports.new.tsx`, `reports.quick.tsx`, `src/components/review-list.tsx`, `src/components/review/trade-assignment-card.tsx`.
- Use the shadcn `Select` (`SelectGroup`/`SelectLabel` for categories) in place of native `<select>` and the radio/button lists; keep 44px minimum targets, `aria-label` on every trigger, and existing state variables untouched.
- No discipline wording hardcoded: every option label comes from the survey-type snapshot exactly as today.
- Verify with `bunx tsgo --noEmit`, the full Vitest suite, and a Playwright pass at 375px and 1280px over dashboard, new report, custom report and review, confirming each dropdown opens, selects and drives the same behaviour.
