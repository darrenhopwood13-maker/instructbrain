# Fix Property inventory room reports and shared landscape output

Property inventory only. Other report types and existing issued versions remain unchanged.

## What will be fixed

- Make the photograph's **current room allocation** the source of truth when building the report, even if the photograph was analysed before it was moved into a room.
- Exclude a photograph from item rows when it is currently one of that room's three overview photographs, even if it was analysed earlier.
- Build each room as one complete section in this order:
  1. room title;
  2. up to three overview photographs;
  3. the four-column table — Item / Description / Condition / Check Out Comment;
  4. every item photograph allocated to that room, in saved photograph order.
- Put the next room immediately after the previous room's photographs and repeat the same structure.
- Number item photographs using their permanent saved photograph number and show the matching number beside the item description in the table.
- Keep photographs that have not been assigned to a room visible in a final clearly labelled section, so none disappear.
- Apply the Property inventory landscape setting to public shared links as well as downloaded PDFs and the signed-in print view.

## Why it is currently going wrong

Room allocation updates the photograph correctly, but findings created earlier retain the room value they had at analysis time. The report builder currently prefers that older finding value, so tables and photographs can be separated into different rooms. The public shared-report page also uses the default portrait print setting instead of the inventory landscape setting.

## Technical changes

- Update the inventory layout builder to resolve each finding's room and role from its currently linked photograph first, falling back safely only when no photograph is linked.
- Filter table rows and room photograph groups from the same resolved photograph state, preventing the table and photographs from disagreeing.
- Keep sorting based on persisted `photo.sequence`, preserving the user's original selection order rather than upload completion or AI completion order.
- Apply the existing inventory print class to the public shared-report page when the report snapshot uses the inventory room schedule.
- Do not change the database schema or survey definition; the necessary room, role and sequence data already exists.

## Verification

- Test a photograph analysed before room allocation, then moved into a room: its row and photograph must move together.
- Test an already-analysed photograph changed to an overview: it must appear in the three-photo header and not as an item row.
- Test multiple rooms end to end: each room must contain its own overview photos, table and item photographs before the next room begins.
- Test table photo references against the numbered photographs below it.
- Test unallocated photographs remain visible.
- Test every downloaded Property inventory PDF page is landscape Letter.
- Test the public shared-link print page selects the same landscape inventory format.
- Run the complete test suite before and after the change.

## Protected behaviour

This will not alter AI safety handling, full-resolution analysis, stable finding references, title-page selection, other report templates, compliance registers, distribution approval, confidential-item filtering, or the external Supabase connection.
