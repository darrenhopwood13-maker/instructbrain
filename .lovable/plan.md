# Fix the faint QR code, and what those two AI ideas actually are

## Why the QR code looks ghosted

The dashboard is the navy screen. The QR code is currently drawn in the same
navy as the background (`#24417B`) on a transparent backing, so it is navy on
navy — barely there, and a phone camera will struggle to read it.

## The fix

- Draw the QR code on a small white tile with a little padding around it, with
  the code itself in near-black. That is the contrast a camera expects, and it
  reads first time in poor light.
- Keep the tile the same size as now (about 128px) and keep it inside the
  existing card, so nothing else on the dashboard moves.
- Give the tile a text alternative ("Scan to open the instructBrain field app")
  so it is not invisible to a screen reader, with the address printed beneath as
  it is now for anyone who cannot scan.

Technical detail: in `src/components/field/field-app-card.tsx`, generate the SVG
with dark modules and a light quiet zone rather than navy-on-transparent, and
wrap it in a white, rounded, padded container. No other file changes.

## What those two AI ideas actually are

Both use the same photo analysis you already have. Neither sends anything to
anyone, and neither decides anything on its own — a person still confirms every
line before a report leaves the office.

### 1. Group photos into rooms automatically

Today you create each room by hand and drag photos into it. With this, after the
photographs finish uploading you press one button and the app reads the pictures
and proposes the rooms: "these nine look like a kitchen, these six a bathroom",
in the order you took them. It also proposes which three are the wide shots for
each room's overview, and drafts the numbered item lines underneath.

What you would see: the room organiser pre-filled with suggested room names and
photo groups, every one labelled as a suggestion, with rename, move and remove
still available. Nothing is locked in until you accept it. If the app cannot
tell what a room is, it says so and leaves those photos unallocated rather than
guessing.

What it saves: the allocation step on a large inventory — the slowest part of
the job today.

### 2. Draft the findings for a chosen report type

This is the existing "Draft the findings" behaviour, offered earlier in the
flow: upload the photographs, pick the report template, and the app drafts the
findings for review before you have opened anything else. For a condition
survey that is a condition per photograph; for an inventory it is the item,
description and condition lines.

What you would see: a review list already populated, each line marked as a draft
with the reasoning behind it, and anything the app was not confident about set
to "not assessed" so it blocks the report until you have resolved it. A trade is
only ever suggested, never assigned.

What it saves: you arrive at review with something to correct rather than a
blank list.

### The honest difference between them

They overlap. Idea 2 is largely what the app already does — the new part is
offering it at the point of upload. Idea 1 is the genuinely new capability, and
the one that would save real time on inventories.

## What this plan commits to

Only the QR code fix. The two AI ideas are described here so you can decide;
say which (if either) you want and I will plan it properly, including what
happens when the app gets a room wrong.
