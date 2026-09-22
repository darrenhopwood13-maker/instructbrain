# Two surfaces, one instructBrain: Hub and Field Cockpit

## What I think of the idea

The instinct is right: the person on the roof and the person at the desk want
different things from the same information. Splitting the *experience* is a good
call.

Two parts of it I'd push back on:

1. **Don't build two apps.** Two codebases means two sets of report rules, two
   PDF engines, and eventually two answers to the same question — which is how
   the v1 prototype went wrong. One app, one database, two front doors.
2. **"Send to dashboard" isn't really needed.** Phone and desk already read the
   same records, so a report captured on site is on the dashboard the moment it
   saves. Inventing a send step adds a way to forget to press it. What is
   genuinely missing is a **"Ready for review"** hand-off — the surveyor says
   "I'm done on site", and the desk sees it appear in a queue. Same button, but
   it means something, and it can't silently lose work.

So: the phone gets an installed, capture-first app. The desk gets a hub with
work queues. The QR code is exactly the right way to get from one to the other.

## What you'll see

**On a laptop (the Hub)**
- The dashboard gains a small card: "Get the field app" with a QR code and a
  short link. Scan it with a phone camera, the phone opens instructBrain and
  offers to install it to the home screen.
- A new **Site queue** on the dashboard: reports marked ready on site, oldest
  first, with what's still outstanding on each (not assessed, no trade, not
  confirmed). One tap into the report.

**On a phone (the Cockpit)**
- Installed to the home screen with the instructBrain icon, opens full screen
  with no browser bar — it looks and behaves like an app.
- Opens straight onto capture: the report template and brief, Take photo, and
  the photos for the report in progress. No marketing page, no desk-only
  screens.
- When the site work is done: one orange **"Send to the dashboard"** button.
  It marks the report ready for review and tells the person plainly what is
  still outstanding before they leave site.
- Keeps working with no signal for anything already loaded, and tells the person
  clearly when photos are still waiting to upload.

**Unchanged**
- Same reports, same templates, same rules. Nothing about analysis, review,
  issuing, distribution, compliance registers or Property inventory changes.
- No app store, no separate download, no second login.

## How it's built

- Installability: add a web app manifest (`public/manifest.webmanifest`,
  `display: "standalone"`, maskable icons, navy theme colour) linked from
  `src/routes/__root.tsx`, plus a minimal service worker registered after
  hydration that pre-caches the app shell only. No offline write queue in this
  step — uploads still need signal.
- Install prompt: a small dismissible bar on phone-sized screens using
  `beforeinstallprompt` on Android/Chrome, with iOS Safari's "Add to Home
  Screen" instructions as the fallback.
- QR code: rendered client-side on the dashboard from the site URL
  (`absoluteUrl("/field")`) — a tiny QR dependency, no image generation, no
  server call.
- New route `src/routes/_authenticated/field.tsx`: the cockpit home. Reuses the
  existing capture/photos components, no duplicated report logic. Detects
  standalone display mode and routes installed launches here by default; a link
  back to the full app stays available.
- Hand-off: one new nullable column on `reports` (`submitted_at`) plus a status
  transition, set only by a person pressing the button — never automatically.
  RLS unchanged, scoped by organisation as today. External Supabase migration,
  one ordered step.
- Site queue: a filtered read on the dashboard using the existing report
  document/blocker helpers so the outstanding counts match what Review shows.
- Tests: manifest/standalone routing, install-bar fallback behaviour, hand-off
  sets the timestamp only on an explicit action, and the queue's outstanding
  counts agree with `issueBlockers`.

## Sequence

1. Manifest, icons, service worker, install bar — the phone can be installed.
2. `/field` cockpit screen, standalone launches land there.
3. QR card on the dashboard.
4. Hand-off column, "Send to the dashboard" button, Site queue.

## Report branding, tidied

Right now every inventory page header carries "instructBrain · An instructSite
Company" in full at the top, and the landing page and emails repeat "An
instructSite company" in their own wording. That is too loud and inconsistent.

The rule going forward:

- The customer's own organisation name and logo stay the prominent branding on a
  report — it is their document, not ours.
- Our line becomes one discreet credit, identical everywhere:
  **instructBrain — An instructSite Company** — small, muted, at the foot of the
  page.
- No "instructSite family" wording anywhere, and nothing from instructSite
  running across the top of a report page.

Where that lands: inventory page headers keep only the report or room title and
the rule beneath it; the PDF footer carries the credit once per page; the
on-screen report document, the print view and the public shared view use the
same single credit; the landing page footer and the email footer use the exact
same sentence (the existing email tests updated to the agreed wording).

Copy pass at the same time: sentence-case headings, consistent spacing around
dashes, consistent capitalisation of "report template", "check-out comment" and
"room overview photo", and cover, index and backing pages aligned on the same
margins and type sizes so nothing sits a few points off its neighbour.

## The cockpit has to feel fast

Held as a requirement, not a nicety:

- Opens on the report in progress, capture ready — no loading screen between the
  person and the camera.
- Never more than one screen away from Take photo.
- Big targets, actions in thumb reach, usable one-handed at 375px with the
  keyboard open.
- Immediate feedback: a photo appears in the strip the instant it is chosen,
  with its uploading state on the tile rather than a blocking spinner.

## Not in this step

Offline capture with a queued upload, push notifications, an app-store build,
and any separate desktop binary.
