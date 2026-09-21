# Tighten the Property inventory workflow and report output

Yes, I understand: the user should capture the inventory in a simple portrait working flow, then the finished Property inventory report should be transformed into the same landscape schedule style as the sample report.

## What should happen for Property inventory only

The capture order should be:

```text
Exterior photo

Living room
  1. Wide-angle room photo
  2. Wide-angle room photo
  3. Wide-angle room photo
  4. Item/detail photo
  5. Item/detail photo
  6. Item/detail photo

Kitchen
  1. Wide-angle room photo
  2. Wide-angle room photo
  3. Wide-angle room photo
  4. Item/detail photo
  5. Item/detail photo

Dining room
  1. Wide-angle room photo
  2. Wide-angle room photo
  3. Wide-angle room photo
  4. Item/detail photo
```

The app should keep that order exactly and use it to build the report.

## Capture and review screen

- Keep the upload/review screen as a simple portrait working screen for phone use.
- Add a clearer **current room** flow so the user can start Living room, Kitchen, Dining room, etc. within one report.
- For each room, make the first three room photos clearly marked as **room overview** photos.
- Room overview photos are not analysed by AI.
- Only item/detail photos are analysed.
- Reduce over-analysis by making Property inventory produce **one inventory table row per item/detail photo**, not a long list of every separate object the AI can see.
- If the photo contains several similar items, the AI records them together with a quantity instead of making duplicate rows.

## Generated landscape report

When the user confirms the review and downloads/prints/issues the report, the Property inventory output should become the landscape inventory format:

1. Branded title page using the exterior/title-page photo.
2. Index page.
3. One room section per room, in upload order.
4. At the top of each room section: the three wide-angle room photos.
5. Under those photos: the four-column table:
   - Item
   - Description
   - Condition
   - Check Out Comment
6. Each item row includes a numerical photo reference that links back to the matching item/detail photograph.
7. Rear photograph pages show the item/detail photos in the same upload order, numbered to match the table references.
8. Add the backing/guidance pages from the sample report style, rewritten and branded for instructSite/instructBrain.

## What changes from the current version

The current inventory work already has room sections, three overview photos, AI exclusion for overview photos, and a landscape PDF path. This update tightens the missing parts:

- stronger multi-room capture flow;
- one-row-per-detail-photo AI behaviour for inventory;
- appendix/rear photo pages for the analysed item photos, not only unused photos;
- matching item/photo reference numbers in the table and rear photo pages;
- backing pages like the uploaded sample report;
- tests proving room order, photo order, AI exclusion, item references and rear photo pages.

## What this will not affect

This is limited to **Property inventory** reports.

It will not change:

- Snagging reports;
- Site condition reports;
- Weatherproofing reports;
- Electrical, mechanical, damp, fit-out or basic photo reports;
- Weekly Compliance Registers;
- distribution/trade extracts;
- existing issued reports with frozen snapshots;
- the rule that AI failures become **Not assessed**, never a pass;
- full-resolution image handling for AI.

## Technical notes

- Keep role and room metadata in the existing photo capture fields unless a narrow external-Supabase migration is genuinely required.
- Extend the inventory layout helpers so item photos are collected into rear appendix pages and cross-referenced from table rows.
- Update the Property inventory AI instruction path to enforce one output row per `inventory_detail` photo.
- Preserve persisted upload `sequence` as the source of truth for room order, item order and appendix order.
- Add or update tests for:
  - multiple rooms in one report;
  - three overview photos per room excluded from AI;
  - one inventory row per detail photo;
  - item table references matching rear photo references;
  - rear photo pages ordered by upload sequence;
  - backing pages present in the inventory PDF;
  - non-inventory report formats unchanged.

## Expected result

The user can photograph a whole property room-by-room in one report, review it on a phone, and generate a landscape inventory that reads like the uploaded sample: room photos first, table underneath, matching numbered item photos at the rear, and branded backing pages.
