# Make Property inventory reports match the uploaded sample format

## What I found

The uploaded reference report is a **19-page landscape Letter inventory report**. Its flow is:

1. Cover page
   - Company name at the top.
   - Large “Inventory” title.
   - Property address, postcode, client name and report date centred.
   - Contact line at the bottom.

2. Index page
   - Simple room/page list.
   - Backing sections listed too: meter readings, keys, schedule of condition.

3. Room schedule pages
   - Room title at the top.
   - Four-column table:
     - Item
     - Description
     - Condition
     - Check Out Comment
   - Item names include the matching photo number, for example `Couch (Photo 8)`.
   - The check-out column is blank unless filled later.

4. Backing pages
   - Inventory Guidance Notes.
   - Check-in / check-out wording.
   - Schedule of Condition.
   - Keys / meter readings.

The current generated Property inventory PDF is already landscape, but it is still too thin: it is producing a short report with an index and room page, rather than the fuller sample-style inventory pack.

## What will change

### 1. Match the report structure more closely

For **Property inventory only**, the generated PDF will be rebuilt around the uploaded sample’s structure:

```text
Cover page
Index page
Room 1 inventory table page(s)
Room 2 inventory table page(s)
Room 3 inventory table page(s)
Rear photograph pages
Inventory Guidance Notes
Check-in notes
Check-out wording
Schedule of Condition
Keys / meter readings
```

Every page will remain **landscape Letter**.

### 2. Keep the uploaded-photo order as the source of truth

The order the surveyor selects/adds the photos will drive everything:

```text
1. Exterior/title photo
2. Living room wide 1
3. Living room wide 2
4. Living room wide 3
5. Living room item photo
6. Living room item photo
7. Kitchen wide 1
8. Kitchen wide 2
9. Kitchen wide 3
10. Kitchen item photo
```

That order will control:

- room order;
- room overview photo order;
- item table row order;
- item photo reference numbers;
- rear photograph page order.

Slow uploads, retries, or AI finishing out of order must not move a photo later in the report.

### 3. Use the three wide-angle room photos correctly

For each room:

- the first three room overview photos are shown together at the start of the room section;
- those overview photos are **not analysed by AI**;
- they are there to show the room context, like the uploaded sample/report style.

### 4. One item/detail photo becomes one inventory row

The AI should not split one item/detail photo into lots of separate rows unless the user has chosen that behaviour elsewhere.

For Property inventory, the expected result is:

```text
Item name (Photo 12) | Description | Condition | Check Out Comment
```

The photo reference in the table must match the rear photograph number.

### 5. Add the rear photograph section properly

After the room tables, the report will include rear photograph pages.

These pages will show the item/detail photographs in the same saved order, numbered to match the table references.

### 6. Brand it as instructSite / instructBrain, not as the sample company

The layout will follow the uploaded report, but the branding will be yours:

- instructSite / instructBrain name treatment;
- your navy/orange rules where appropriate;
- white paper and black text;
- no dark app styling inside the PDF;
- no decorative UI chrome in the report.

## What will not change

This is limited to **Property inventory reports**.

It will not change:

- Snagging reports;
- Site condition reports;
- Weatherproofing reports;
- Electrical reports;
- Mechanical reports;
- Damp reports;
- Fit-out reports;
- Basic photo reports;
- Weekly Compliance Registers;
- distribution rules;
- issued historic report snapshots;
- the rule that AI failures become **Not assessed**, never a pass;
- full-resolution images going to AI;
- the portrait phone-first upload/review working screen.

## Technical details

- Tighten the Property inventory PDF builder so every section uses the sample-style landscape report flow.
- Keep `photo.sequence` as the ordering source for rooms, rows, table references and rear photographs.
- Keep cover-counting and room-overview photos out of the AI/item appendix.
- Ensure the item table label format reads like `Item name (Photo 8)` rather than a generic internal item label.
- Make the backing pages render as proper separate report pages, not a compact notes block.
- Strengthen tests to prove:
  - every Property inventory PDF page is landscape;
  - multiple rooms stay in upload/selection order;
  - three overview photos per room stay together and are not analysed;
  - item references match rear photo numbers;
  - rear photographs stay in saved photo order;
  - backing pages are present;
  - non-inventory report layouts are unchanged.

## Expected result

When the surveyor generates a Property inventory report, it should look and read like the uploaded sample: a professional landscape inventory pack with a cover, index, room-by-room tables, matching photo references, rear photographs, and backing pages — branded for instructSite / instructBrain.
