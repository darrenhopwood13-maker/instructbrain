# Meter readings and keys in Property inventory reports

## What is there today

At the end of the report, "Keys and meter readings" is a page with one fixed sentence on it. You can't add photos or readings, so it always comes out empty. Your sample report has a proper version of this: three meter photos (electric, gas, water) with their readings in Start of tenancy / End of tenancy columns, plus a Keys page ("Keys issued", "Handed over", "Tenant present").

## The workflow

It fits into the Photos step as one extra card, **Meters and keys**, placed under the rooms and above the room checklist. It is only shown for Property inventory reports.

```text
Upload photos -> Put in rooms -> Choose room photos -> Meters and keys -> Analyse
```

**Meters.** There are three slots: Electric, Gas and Water. Each slot has:
- **Take photo / Choose photo**, using the same camera as everywhere else, so the time and place are recorded
- a **Reading** box, plus an optional **Meter serial** box
- a small "No meter / not accessible" tick, so a missing meter is shown as missing on purpose, not as forgotten

**Keys.** Take one or more photos of the keys laid out, then list them in short rows, for example "Front door Yale × 2" or "Fob × 1". There is an **Add key** button. Below that are two Yes/No answers: **Handed over** and **Tenant present**.

**Getting photos in quickly.**
- You can take them in the card itself, straight from the meter.
- If you've already taken them with the rest, tick the photo in the grid and choose **Use as → Electric meter / Gas meter / Water meter / Keys**. It's the same idea as Put in a room.
- Meter and key photos are never counted as room items, never analysed into the room tables, and never block the room checklist.

**AI help with meter readings (optional).** Next to each reading there's a **Read from photo** button. The AI suggests the numbers it can see. The suggestion appears in the box marked "Suggested — check against the photo" and isn't saved until you accept it or type over it. If the AI can't read the display clearly, it says "Couldn't read — enter it yourself". It never guesses.

**Checklist.** A fifth line joins the room checklist: "Meters and keys", marked *optional*. It shows what's missing ("Gas reading not entered") but never stops you analysing or issuing the report.

## In the finished report (landscape, as now)

- **Meter Readings page:** the three meter photos side by side, each captioned with the meter name, reading and serial. Under them is the table from your sample with Start of tenancy filled in and End of tenancy left blank for check-out. Below that is the standard wording: "These readings must be checked by the relevant boards…". "No meter / not accessible" appears in words, not as a blank.
- **Keys page:** the key photos, the key list with quantities, then Handed over and Tenant present.
- Both pages take the place of the empty "Keys and meter readings" text page, and both are listed in the report index.
- If nothing was recorded, the pages still print with blank boxes so they can be filled in by hand, as in your sample.

## Things to decide

1. Is **Electric, Gas, Water** the right fixed set, or should there also be an **Add another meter** button (for example oil or a second electric meter)? The plan assumes Add another meter, with the three shown by default.
2. Should **Read from photo** be included now, or kept for later?

## Technical details

- **Template data, not code:** the Property inventory definition goes to **v7**, adding:
  - photo roles `meter` and `keys`, both with `excludesAi` for item analysis and excluded from room readiness
  - a `handover` block in `reportLayout` that declares the meter types, the reading/serial fields, the key fields and the Yes/No questions, with all wording coming from the definition
  - The old static "Keys and meter readings" backing page is removed from v7.
  - Issued v5/v6 reports keep their frozen snapshot unchanged.
- **Where it's stored:**
  - Meter and key photos are ordinary report photos (full resolution, stable numbers) with `_photo_role` = `meter`/`keys`. For meter photos, `capture_fields` also holds the meter type, reading, serial and not-accessible flag.
  - The key list and Handed over / Tenant present go in one new nullable `reports.handover jsonb` column. This is a small migration with no new table, and the existing report RLS applies.
- **UI:**
  - new `src/components/photos/handover-card.tsx`, using `useSinglePhotoCapture`
  - "Use as" in the photos-panel selection bar
  - a readiness step with `optional: true`, which `nextPhotoAction` ignores
- **Read from photo:** a server function using the configured AI adapter on the full-resolution image. It uses structured output `{ reading: string | null, confidence }` and treats anything below the threshold as null. It is metered against the AI cap, and nothing is written until the person accepts.
- **Output:** `inventory-layout.ts` gains a `handoverPages` model. Both `pdf.server.ts` and `report-document-view.tsx` render it, the photos go through the same prefetch pool, and index entries are added.
- **Tests:** v7 roles excluded from analysis and readiness; handover model with empty/partial/full data; "not accessible" rendered as text; the PDF includes both pages and index entries; the meter suggestion is never saved without acceptance.
