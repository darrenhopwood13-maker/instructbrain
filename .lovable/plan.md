# Dashboard and navigation tidy-up

## Dashboard

- Remove “How are you working?” and place the small “Start here” label immediately above the action grid.
- Replace the current two-tile layout with three equal orange glass controls:
  1. **Project report** — retains the existing survey-type choice.
  2. **Quick report** — retains the existing quick-report choice.
  3. **Compliance reports** — opens Weekly Compliance for the project from the most recently updated project report. If there is no suitable recent project, show a compact project picker instead of sending the user to a dead end.
- Make the three controls a stable responsive grid: three columns where space allows, compact icon/label treatment on narrow phones, no clipped labels, no horizontal overflow, and minimum 44px touch targets.
- Remove the plan allowance card from the dashboard.
- Turn **Overdue items** into an accessible collapsed row showing its title and count; opening it reveals the existing linked items.
- Turn **Recent reports** into the same one-line collapsed pattern; opening it reveals the existing report cards.
- Change “All projects” to **All reports** and point it to a real combined reports page.

## All reports

- Add an authenticated **All reports** page that lists reports across all of the user’s organisations/projects, including standalone quick reports.
- Keep report title, type, project/quick-report context, status and updated date visible, with direct links into each report.
- Add route-specific title, description, Open Graph and Twitter metadata.

## Header and mobile navigation

- Replace the full language selector with a compact, colour-accented globe/language control beside Account in the top bar on every screen size. Its menu retains every language and the reversible English option.
- Replace the separate sign-out control with an **Account** dropdown containing Account settings and Sign out; show **Admin** in this menu only for the founder account.
- Remove Account and Admin from the fixed mobile footer. Keep Dashboard, Projects, Organisation and Directory as four evenly sized items so “Organisation” fits on one line without shrinking below touch-target size.
- Preserve keyboard navigation, screen-reader names, visible focus states and existing sign-out behaviour.

## Plan details

- Show the plan/usage card in Account settings.
- Remove duplicate plan cards from dashboard and the Projects overview. Keep plan-limit warnings at the point of creating a report and keep the dedicated plans page, because those prevent a failed action rather than adding dashboard clutter.

## Verification

- Run the existing test suite before and after the changes.
- Add focused coverage for the combined reports query, compliance destination fallback and founder-only Admin menu item.
- Check the dashboard and navigation at 375px/393px mobile widths and desktop: no horizontal overflow, all three orange controls fit, the footer labels stay on one line, menus are keyboard-operable, and both collapsed sections open correctly.
