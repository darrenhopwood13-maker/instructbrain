# Strip the app back to one clear report journey

The goal is one obvious next action at every stage:

```text
Start report → Add photos → Draft findings → Review → Issue → Share
```

The app keeps the safeguards that make the report defensible: full-resolution originals, Not assessed blocking issue, human confirmation, stable references, confidential-item restrictions, version locking, and manual sending. The simplification removes repeated choices and navigation, not those controls.

## 1. One simple start screen

- Keep **Report template**, **Take photo**, and **Add photos** as the visible starting controls.
- Rename every gallery/file-picker action to the shorter **Add photos**.
- Make **Take photo** the single large orange action; **Add photos** is a full-width secondary action beneath it on phones.
- Use one shared photo-control layout everywhere, including report creation and the Photos stage, so wording and sizing cannot drift.
- At 320px and 375px, stack the controls instead of forcing two long labels into half-width buttons. Text must remain inside the button at browser text zoom up to 200%.
- Remove the project picker from AI brief options. A report started from a project is filed there automatically; a standalone report gets one **Add to project** action afterward.
- Keep title-page photo and logo choices available, but place them in the collapsed setup area because they are occasional choices.

## 2. A much smaller AI brief

The collapsed **AI brief** contains only choices that materially change the generated report:

- Tone
- Report type
- What to include: remedial work, severity, advisory note
- Findings per photograph, only where the selected report template supports it
- Special instruction/focus, using one field and one name
- **Draft report summary** toggle

Remove the extra preset layer and saved-template load/save/delete controls from the start journey. The selected report template already supplies the core AI instructions, and the device continues remembering the last brief.

The summary toggle replaces the existing **Draft summary** command. When enabled, the app drafts the summary once the findings are confirmed and the user reaches the Issue stage. It remains editable before issue. When disabled, no summary AI call is made and no summary section is added unless the report template itself requires one. The toggle never changes finding statuses or bypasses human review.

## 3. One guided report workspace, not a bank of controls

Keep the report on one route, but replace three equal tabs and header actions with a guided stage bar:

1. **Photos** — upload, room allocation where required, title-page selection.
2. **Review** — one analysis action, then finding-by-finding confirmation.
3. **Issue** — edit the document, resolve any clearly listed blockers, issue it.
4. **Share** — available after a successful PDF can be built.

- Show only the current stage and one primary **Continue** action in the lower thumb area.
- Allow earlier stages to be reopened from the compact progress indicator; do not make people hunt through separate pages.
- Remove repeated step headings, template explanations, and status copy where the same fact is already shown immediately above.
- Keep blocker details in Review and in the final Issue confirmation because these are safety checks, not clutter.
- Keep property-inventory room setup inside Photos and trade confirmation inside Review; do not create extra routes for them.

## 4. One Share button

Replace the current Save/Send PDF button, Preview command, read-only-link command, and report-level print command with one visible **Share** button.

- On a supported phone or tablet, pressing **Share** builds the complete PDF and opens the device's native share sheet, exposing the installed choices such as WhatsApp, Mail, Messages, Drive, Files, AirDrop or Nearby Share.
- On desktop, the same button opens the existing Save As picker where supported and otherwise downloads the PDF.
- Cancelling the share sheet or Save As window remains silent.
- The full report preview remains visible in the Issue stage, so a separate Preview action is unnecessary.
- Browser printing remains available from the document/print view without another report-header button.
- Existing secure read-only links remain valid, but new link management is moved to the deliberate distribution area rather than competing with the main Share action.
- **Issue report** remains separate because it freezes a legal-adjacent version; Share must never issue or send automatically.
- **Review distribution** remains a deliberate workflow for controlled recipient extracts, not another generic share button.

## 5. Exactly one Add to project action

- Standalone reports show one visible **Add to project** button near the report title.
- Pressing it opens the existing project chooser and confirmation.
- Reports started from a project never show it.
- Remove project attachment from the More menu and remove the optional project picker from AI brief setup, eliminating the two competing paths.
- Keep the existing one-way attachment behaviour and directory/distribution inheritance.

## 6. Remove the report action menu

The report header becomes:

- **Add to project** only when the report is standalone
- **Issue report** or **Reopen for editing**
- **Share**

Move or remove everything currently under **More**:

- Remove **Preview** because the Issue stage already shows the document.
- Remove **Draft summary**; the AI brief toggle owns it.
- Remove **Attach to project**; the single visible action owns it.
- Move **Review distribution** into the issued report's Share/distribution area.
- Keep **Send to dashboard** only at the end of the on-site journey, not both on every open-report card and inside the report menu.
- Move **Delete report** to a quiet danger area at the bottom of report details or settings, never among everyday output actions.
- Keep report language beside the document controls, not among share actions.

## 7. Navigation and screen reduction

- Keep the desktop **Dashboard** and phone-focused **On site** experiences because they serve different working conditions, but stop duplicating report commands between them.
- Dashboard: queue, one **Start report** action, compliance, and recent work.
- On site: one **Start report** action and a short list of unfinished captures; remove a separate Send button from every list item.
- Project pages may keep **Start report** because it preselects that project; it opens the same start flow rather than a different setup screen.
- Continue redirecting the old new-report address to the single start route.
- Keep Account, Organisation, Directory and Admin management outside the daily report journey.

## 8. Whole-app UI cleanup

Audit every authenticated screen and apply the same rules:

- One orange primary action per screen or dialog.
- Secondary actions use quiet buttons or menus only when genuinely occasional.
- Pick-one choices use dropdowns; working lists remain visible lists.
- Remove duplicate headings, repeated instructions, and buttons that lead to the same result.
- Shorten labels before shrinking text; never allow button text to clip or overflow.
- Preserve 44px minimum targets, visible focus, keyboard operation, screen-reader names, status text plus colour, and real dialogs.
- Check compliance controls, room organisation, review, distribution, project lists, directory, settings and admin at 320px, 375px and desktop. Necessary compliance actions remain, but their layout becomes a stable stacked or grid arrangement on narrow screens.
- Do not change the light report document, report/PDF content rules, branding tokens, or status colours.

## Technical approach

- Refactor the repeated camera/gallery inputs into a shared capture control using the existing Button component.
- Simplify `reports.quick.tsx` to template + capture + collapsed AI brief; add a persisted `draftSummary` boolean to the existing report brief JSON. No database migration is required.
- Trigger synthesis once, after confirmation and on entry to Issue, only when the toggle is enabled and no summary exists.
- Simplify `report-actions.tsx` around Issue/Reopen and Share; reuse the current native PDF sharing and desktop Save As fallback.
- Move project attachment to one explicit control in `reports.$id.index.tsx`.
- Reshape the report workspace navigation without changing report, photo, finding, issue or distribution data models.
- Remove dead UI paths only after all links and tests are updated; preserve existing public/shared-report URLs.

## Verification

- Run the full test suite before changes and after each workflow slice; any failure stops the change.
- Add focused tests for the summary toggle, one-time summary generation, Share fallback behaviour, and project-button visibility.
- Test the full journey for every report family, including multi-room Property inventory and Weekly Compliance.
- At 320px and 375px: no horizontal overflow, no clipped **Add photos** text, no overlapping sticky controls, and all actions remain reachable with the on-screen keyboard open.
- On a real/simulated smartphone-capable browser: Share opens the native sheet with the complete PDF.
- On desktop: the same Share button opens Save As or downloads safely.
- Keyboard-only: create, upload, analyse, review 150 findings, issue and share without a mouse.
- Confirm Not assessed still blocks issue; no trade is assigned without a person; confidential findings stay excluded; nothing is sent automatically.

## Result

A user sees only the decision needed now, with a single path from photographs to an issued report. Advanced report behaviour remains available in one collapsed AI brief, while everyday output is reduced to **Issue**, **Share**, and—only when relevant—**Add to project**.
