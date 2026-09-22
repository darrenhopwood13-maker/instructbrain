# Whole-app QA: the QR fix, an honest walk-through, and where the AI ideas fit

## 1. Why the QR code looks ghosted — and the fix

The dashboard is the navy screen. The QR code is drawn in the same navy as the
background on a transparent backing, so it is navy on navy — barely visible,
and a phone camera will struggle to read it. The card it sits on is white; the
code itself is the wrong colour.

The fix: draw the QR code on a small white tile with padding around it, the
code itself in near-black — the contrast a camera expects, readable first time
in poor light. Same size and same place on the dashboard, with the printed
address beneath it for anyone who cannot scan. One file
(`src/components/field/field-app-card.tsx`).

## 2. The honest walk-through

I went through every screen as a user would. The good news first: the report
steps (Photos → Review → Issue, numbered, with what's still outstanding) are
right, the Options drawer split into "How it reads" / "What it includes" is
right, and the photo-order and room fixes from the last few days have made
capture trustworthy. What follows is what is genuinely wrong or wasteful.

### Navigation: one slot in the phone's bottom bar is wasted

The four destinations are Dashboard, Projects, Organisation, Directory.
Organisation settings is a screen you visit twice a year — it should not have
one of four slots on a phone. It is reachable from Account anyway.

- Swap **Organisation** out of the bottom bar for **On site** (the field
  cockpit). Someone arriving at a site on their phone gets capture in one tap.
- Organisation settings stays exactly where it is on screen, reached from the
  Account menu; the top-bar navigation is unchanged.

### The field cockpit and the full app do not connect

The "Send to the dashboard" button exists only on the field home screen. A
surveyor who opens a report directly (from a notification, or from Recent
reports) has no way to hand it off — the one moment the button matters most is
the moment it is absent.

- Add "Send to the dashboard" to the report screen itself (the More menu, with
  the same confirmation and the same plain list of what is still unresolved).
- It stays a person pressing a button, never automatic.

### The dashboard should open on the queue, not the buttons

The desk user's first question is "what came in from site?" Today the action
tiles sit above the Sent-for-review queue. Swap the order: the queue first,
then Start a report. The QR card stays at the foot — it is setup, not daily
work.

### Reports list: the sticky red banner is shouting

"All reports" carries a sticky banner with a red border whenever anything is
unresolved. Red is for failure; "work in progress" is normal here. Restyle it
to the neutral raised surface with the count in text — the fail colour stays
reserved for genuinely overdue items, where it already is.

### Capture: heading sizes disagree

"Start a report" is set smaller than every other page heading (text-xl where
Projects, Reports and Organisation use text-2xl/sm:text-3xl). Standardise on
the larger pattern on every page — one size, everywhere, including the field
cockpit.

### A real accessibility miss I introduced: the orange wordmark on white

On the light working screens the header wordmark renders "instruct" in orange
on white. Orange on white fails the same contrast rule that forced orange off
navy. Switch the wordmark's accent span to the text-safe ink on light screens;
on the navy console it stays as it is. No other colour changes.

### Small repetitions worth tidying

- The Directory appears in the bottom bar and again as a card inside every
  project. Keep the bottom-bar Directory; the project card stays (it is scoped
  to that project's trades — that is not duplication, it is context).
- The dashboard already says "Start a report"; the capture screen says it
  again as its heading. Fine — but the capture screen should not also repeat
  the template explanation once the template is remembered from last time.
  Show the explanation only the first time, or when the template changes.

## 3. My view on the colours and fonts

**Keep the palette.** Navy console + orange action is the instructSite family
signature and it is distinctive — nobody else in this market looks like it. The
split (navy for brand and home, light for working screens) is the right call
for a product used in daylight on site; I would not introduce a third surface
colour. Two refinements only:

- The blueprint grid on the console screens is attractive but it is doing
  nothing the border and spacing could not do — I would keep it on the landing
  page (where it is branding) and drop it behind data-dense console screens if
  it ever competes with content. Low priority.
- The wordmark orange-on-white fix above is the one hard accessibility item.

**Keep the type system.** Inter Tight headings + Inter body is correct for a
document-led product — quiet, legible at small sizes, and it lets the PDF (the
actual product) be the impressive thing. Audiowide belongs on the wordmark only
and nowhere else, which is exactly where it is. No change.

## 4. The two AI ideas, explained properly

Both use the same analysis the app already does. Neither sends anything to
anyone; a person still confirms every line before a report leaves the office.

**Idea 1 — group photos into rooms automatically.** Today you create each room
by hand and drag photos into it — the slowest part of a big inventory. With
this, once photographs finish uploading you press one button and the app reads
the pictures and proposes the rooms ("these nine look like a kitchen"), in the
order you took them, including which three are the wide shots. You would see
the room organiser pre-filled, every suggestion labelled as a suggestion, with
rename/move/remove untouched. If it cannot tell, it says so and leaves those
photos unallocated rather than guessing. **This is the genuinely new
capability and the one worth building.**

**Idea 2 — draft findings for a chosen report type.** This is mostly what the
app already does when you press "Draft the findings". The only new part would
be starting the draft automatically once photographs finish uploading, as an
option in the brief. Useful, but a setting — not a feature.

## 5. What this plan commits to

1. The QR code fix (white tile, near-black code, padding, alt text).
2. Bottom bar: swap Organisation for On site; Organisation reachable from
   Account.
3. "Send to the dashboard" added to the report screen's More menu.
4. Dashboard order: Sent-for-review queue above the action tiles.
5. "All reports" banner restyled from red to neutral.
6. Page headings standardised to one size pattern; template explanation shown
   only when first chosen or changed.
7. Wordmark accent switched to the text-safe ink on light screens.
8. Tests extended: QR tile contrast, nav swap, hand-off present on the report
   screen.

The AI room-grouping (idea 1) is the recommendation for the next plan — say the
word and I will plan it properly, including what happens when the app gets a
room wrong. Inventory PDF layout, status colours and the report paper styling
stay exactly as they are.
