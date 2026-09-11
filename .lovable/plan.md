# Light working screens, one primary action

Navy and orange stay as the brand. The screens people use outdoors go light and plain.

## 1. Light working screens

Extend the existing `.paper` light scope — no new theme — and apply a `work-surface`
wrapper (paper tokens, no blueprint grid, no outer glow, no layered raised panels) to:

- Custom report capture screen
- Photos panel, photo grid, upload tray
- Review screen
- Compliance register screens (index and run)

Navy stays on: landing/marketing, dashboard, report document cover, sign-in.

The app shell gains an opt-in light mode so the page background, header and bottom
tab bar match the screen they frame instead of a navy frame around a white sheet.
The blueprint grid is suppressed on those routes.

## 2. Capture screen: photo first

New order on arrival:

```text
Report template (one line, current template + Change)
[  Take photo  ]        <- large, orange, full width, only primary action
Add photos              <- ghost/secondary, text-weight
Options (the brief)     <- collapsed; one tap opens presets, tone,
                           report type, includes, special request,
                           template save, cover & logo
```

- Removed from the default view: eyebrow, headline, subhead, breadcrumb clutter,
  usage/plan wording, and the expanded brief block.
- The last brief used (template, preset, tone, report type, include switches,
  advisory footer) is remembered on the device and restored, so a returning user
  taps straight through. Restore happens after load to avoid a flash mismatch.
- The minimal photo-condition template still requires its "Focus of this report"
  box, which stays visible above the buttons because the report cannot start
  without it.
- Once capturing, the sticky "Draft the findings" button behaves exactly as now.

## 3. Wording

Capture screen and its toasts, locked and empty states say "Report template"
throughout. Remaining "survey type" phrasing in shared capture/review helper copy
(capture fields, analysis panel, review status messages, trade card) is updated to
"report template". Code comments and stored data keys are unchanged.

## 4. Accent tokens

Reduce the accent set to three roles: accent (primary action), accent-hover, and
accent-ink (text-safe). The extra variants are mapped onto those three so nothing
breaks, and orange is reserved for the single primary action on a screen —
borders, micro-labels and panels on working screens use neutral paper tokens.

## 5. Kept intact

44px+ touch targets, mobile bottom tab bar and single Account menu, report row
created on the first photograph, `.paper` document scope, status colour always
paired with a text label, WCAG AA contrast.

## Technical notes

- `src/styles.css`: add a `work-surface` utility built on the existing `.paper`
  variable block, suppress `body::before` grid under it, collapse accent tokens
  to three with aliases.
- `src/components/app-shell.tsx`: optional `surface="light"` prop.
- `src/routes/_authenticated/reports.quick.tsx`: reordered layout, single
  Options disclosure, remembered brief, primary/secondary demotion, wording.
- `src/components/photos/*`, `src/components/review-list.tsx`,
  `src/routes/_authenticated/projects.$id.compliance.*`: light surface, chrome
  stripped, no behaviour change.
- Verify at 375px with the keyboard open: no horizontal overflow, primary action
  in thumb reach. Run typecheck and the full test suite before and after.
