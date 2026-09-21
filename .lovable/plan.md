# Match the attached inventory-report format

Yes — we can match the attached report closely while branding it as instructSite / instructBrain.

## What I found in the attached PDF

The sample is a 19-page landscape inventory report. Its structure is:

1. **Cover page**
   - Large company name at the top.
   - Report type: “Inventory”.
   - Property address, postcode, client name and date centred on the page.
   - Contact line at the bottom.

2. **Index page**
   - Simple contents list with room/section names and page numbers.

3. **Room inventory pages**
   - Each room starts with the room name and a thin divider line.
   - The top of the page shows **three wide-angle room photographs** across the page.
   - These room photographs are presentation/context photos only, not item-analysis photos.
   - Below the photos is a four-column table:
     - Item
     - Description
     - Condition
     - Check Out Comment
   - “Check Out Comment” is blank in the inventory stage.

4. **Guidance and schedule pages**
   - Inventory guidance notes.
   - Check-in notes.
   - Check-out report wording.
   - Schedule of condition.
   - Keys / meter readings style pages.

## What the new workflow will be

For **Property inventory** reports only:

1. The user starts a Property inventory report.
2. The first photograph taken is treated as the **exterior / title-page photograph**.
3. For each room, the user selects or captures the **first three wide-angle room photos**.
   - These three photos appear at the top of that room’s report page.
   - They are not sent for item-by-item AI analysis.
4. After the room photos, the user captures item/detail photos.
   - These are analysed into table rows.
   - Each row becomes: **Item / Description / Condition / Check Out Comment**.
5. The user can review and edit the table before issuing or downloading the PDF.

## What the final PDF will look like

The Property inventory PDF will use a dedicated landscape layout:

- instructSite/instructBrain branded cover page.
- Exterior title-page photograph where appropriate.
- Clean index page.
- One room section at a time.
- Three room overview photos across the top of the room page.
- A four-column inventory table beneath.
- Repeated room pages if the table is too long.
- Check Out Comment column left blank unless the user fills it later.
- Guidance / schedule wording adapted to instructSite branding.

The aim is to feel like the sample report, but sharper and branded:

- White paper.
- Black report text.
- Thin instructSite navy/orange rules.
- instructSite-style heading treatment.
- No dark app styling inside the PDF.

## What changes in the app

1. **Property inventory capture flow**
   - Add clear steps for:
     - title-page exterior photo,
     - room overview photos,
     - item/detail photos.
   - Keep upload order stable.
   - Make it obvious which photos are “room overview” and which photos are “inventory item” photos.

2. **Room grouping**
   - Use the existing Room field to group inventory rows.
   - Add a simple way to mark the current room while capturing.
   - Room overview photos attach to that room, not to an individual item.

3. **AI behaviour**
   - AI analysis only runs on item/detail photos.
   - The first exterior photo and three room overview photos are excluded from AI item extraction.
   - The existing rule remains: if AI cannot assess an item, it becomes **Not assessed**, never a pass.

4. **Inventory review screen**
   - Show inventory rows in a table-style review for Property inventory.
   - Let the user edit item, description, condition and check-out comment.
   - Keep ordinary report types unchanged.

5. **PDF generation**
   - Add a Property inventory PDF layout separate from the general defect/snag report layout.
   - Keep the normal report PDF builder for all other report types.
   - Make the on-screen report preview and downloaded PDF match.

## What this will not affect

This change will be limited to **Property inventory** reports.

It will not change:

- Snagging reports.
- Site condition reports.
- Weatherproofing reports.
- Electrical, mechanical, damp, fit-out or basic photo reports.
- Weekly Compliance Registers.
- Distribution / trade extracts.
- Share links, except that shared Property inventory reports will show the new inventory layout.
- Issued historic reports, because issued reports keep their frozen snapshot.
- The AI safety rule that failures must become **Not assessed**.

## Technical notes

- Extend the report document model so a Property inventory can carry room overview photos separately from item findings.
- Add a property-inventory-specific rendering path for screen, print and PDF.
- Use the existing persisted photo order for sequencing.
- Use the existing cover photo field for the exterior/title-page photograph where possible.
- Store room overview photo intent in photo capture fields or a small report-photo role layer, depending on what the existing database supports cleanly.
- If a database change is needed for room photo roles or check-out comments, it will be narrow and Property-inventory-specific.
- Add tests for:
  - exterior photo is used as cover,
  - room overview photos are excluded from AI analysis,
  - first three room photos render above the table,
  - item rows keep upload/order stability,
  - unknown AI statuses still resolve to Not assessed,
  - other report types keep the current layout.

## Expected result

A Property inventory report should read like the attached sample: cover, index, room photos, then a professional four-column inventory table — but with instructSite branding and the app’s existing safety rules intact.
