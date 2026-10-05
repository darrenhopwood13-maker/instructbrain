# FIELD COCKPIT - BUILD BRIEF (shell only)

Paste-into-Lovable brief for the instructBrain field cockpit. The shell belongs to
whoever builds UI; the logic below belongs to Dal's agent. Written to be followed
literally.

---

## Ownership and seam - read first

This brief covers the **field cockpit shell only**: layout, controls, states and
mobile ergonomics. The queue, the handoff contract, the confirmation rules and the
report logic belong to a second engineer and are **off limits**. Do not
reimplement or "improve" them.

- The second engineer is the **only person who pushes to this repo**. Do not commit
  or push. Leave changes in the working branch for review.
- If something in this brief appears to require changing a logic module, **stop and
  say so** rather than changing it.

## Scope - build this

1. **Field Home (`src/routes/_authenticated/field.tsx`)** - upgrade into a cockpit
   shell. Active project and survey template shown and **locked for the session** so
   the surveyor never re-selects between photos. One large primary action: Start site
   walk / snag. In-progress drafts listed with status pills and a photo count.
2. **Capture Cockpit (new `src/components/field/field-cockpit-view.tsx`)** - straight
   to camera on entry, no intermediate config modal. A continuous capture strip.
   Quick-tag chips for zone or level (Ground floor, Roof plant, Stairwell A, plus free
   text) that **stamp every subsequent photo until changed**. A live status line:
   "16 photos taken".
3. **Sync pill (new `src/components/field/field-sync-pill.tsx`)** - always visible,
   never dismissible, and **truthful**: how many uploaded, how many uploading, how
   many queued with no signal. It displays state; it must not implement the queue.
4. **Bottom action bar** - sticky, in the bottom third, two exits: **Send to office**
   and **Review here**. Both thumb-reachable. "Send to office" calls the existing
   handoff in `src/components/field/send-to-dashboard.tsx` /
   `src/lib/field/handoff.ts` - do not write a new one.
5. **Mobile review (`src/components/review-list.tsx`)** - single column, glove-friendly
   controls, accepting the existing grade and trade components as-is.
6. **PWA chrome** - in standalone or a mobile viewport, remove desktop navigation,
   search headers and multi-tier menus.

## ROUTE LOCKS - do not change these paths

An AI dev restructuring routes is the single most likely way to break something
outside the app that cannot be recalled.

- **`/field` is the payload of a QR code.** It is drawn on the dashboard's
  "Get the field app on your phone" card
  (`src/components/field/field-app-card.tsx`), which encodes the absolute URL of
  `/field` via the `qrcode` library. **Do not rename, move or nest this route.** A
  saved, screenshotted or site-office-wall QR that resolves to a 404 is a defect the
  surveyor cannot diagnose.
- **Keep the QR card where it is** - at the foot of the dashboard - and keep it a QR
  code. Do not replace it with a plain link or a download button. It is a desk-side
  handover: laptop on the desk, phone in hand, scan, in.
- **`/trade/{token}` must keep resolving.** Trade access is a share link scoped to one
  trade's items on one report. Printed or emailed links must not break.

## Hard rules - these are not preferences

- **An uncertain result must never become a pass.** The product invariant, verbatim
  from its own source: *"anything the engine cannot resolve becomes `not_assessed`.
  Never a pass."* Never add a default that upgrades an unknown status, and never hide
  a `not_assessed` item.
- **Nothing is issued or emailed automatically.** A person confirms before anything
  reaches a client. No auto-send, no auto-issue, no timers.
- **"Accept all" applies to status only.** It must **never** bulk-accept a trade
  suggestion or a condition grade. Those stay "to be confirmed" until a person sets
  them.
- **Every photograph keeps its full resolution and its stable reference.** Do not
  re-encode, downscale or renumber anything on capture.
- **Show the truth in the handoff receipt**: how many actually went, how many are
  still queued. Never a bare success message.
- **Manual (AI-free) templates must not show AI language.** If the template is a
  manual report, the cockpit must not say the AI is drafting.
- Do not change colours, fonts or the wordmark. The brand system is fixed: navy
  surfaces, white "instruct" with the product colour on "Brain", Laser Green accent.

## Do not touch these files

`src/lib/field/handoff.ts` ·
`src/lib/__tests__/field-handoff.test.ts` ·
`src/lib/field/` (anything else in it) ·
`src/components/field/site-queue.tsx` ·
`src/lib/review/condition-grade.ts` ·
`src/lib/review/trade-allocation.ts` ·
`src/components/review/trade-organiser.tsx` ·
`src/lib/trade-access/trade-access.ts` ·
anything under `src/lib/report/`.

## Acceptance criteria - measurable, not vibes

- Every primary action sits in the **bottom third** at 390x844 and 360x800, with
  **48px minimum** targets.
- On Field Home at 390x844, the active project, the primary action and the drafts list
  are visible **without scrolling**.
- No horizontal scrolling at 360, 390, 768, 1024 or 1440.
- Body copy never below 16px.
- Desktop at 1440 is **unchanged** - no regression to the existing layout.
- The sync pill states queued, uploading and uploaded as three distinct, legible
  states.

## Definition of done

Screens build and run, the criteria above hold at all five widths, nothing on the
do-not-touch list was modified, the `/field` and `/trade/{token}` routes still
resolve, and the existing test suite is still green. Report which files you changed -
and say plainly anything you could not verify.

## Known gap while this is built

The shell will look finished while the durable offline queue underneath it is still
being built by the second engineer. Until that lands, "send to office" is **not**
durable. Do not put this in front of a surveyor on a roof before the queue work is in.
