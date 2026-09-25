# Fix the downloaded report stopping after the first room

## What's happening
When you download the finished inventory report, you only get the cover, index and the first room's overview photos. Everything after that is missing or blank: the item table, the room's numbered photos, the later rooms and the backing pages.

## Most likely cause (to be confirmed first)
The file builder has a size limit of about 14 MB for photos, set up so emailed reports stay small. Each full-size site photo is 2–4 MB, so the limit is used up after about four or five photos. That is roughly the cover plus the first room's three overviews. After that, photos are left out. The download may also be running out of time while it fetches every full-size original one after another.

I haven't confirmed this yet, so the first step is to reproduce it.

## Steps
1. **Reproduce.** Build the file from your latest inventory report on the server. Record the page count, how many photos made it in, where it stops and the time taken. Check this matches what you see before changing anything.
2. **Separate the download limit from the email limit.** A download you save yourself has no email size cap. It will include every photo in every room. Emailed copies keep a limit, but they will use the smaller preview copy of each photo so every page still has its pictures, rather than photos stopping partway.
3. **Use a print-sized photo copy in the file.** A photo printed in a 150-point box doesn't need a 4000px original. The file will use the preview copy, or the original when there's no preview. This keeps the file small and fast. The AI still gets full-size originals (not touched).
4. **Fetch photos a few at a time instead of one by one**, so a 60-photo report finishes well within the time limit.
5. **Never cut the report short silently.** If a photo really can't be read, its box says "Photo unavailable" and the rest of the report still builds. Every room, table, photo page and backing page is always drawn.
6. **Tests.** Add a test with a report of several rooms and 40+ photos, checking that every room title, item row, numbered photo and backing page appears, the pages are landscape and the numbering is unchanged. Run the full suite.

## Not changing
Upload order, room allocation, numbering, the landscape layout, full-resolution AI analysis, and Not assessed items appearing and blocking issue.

## Technical details
- `src/lib/report/pdf.server.ts`: `PHOTO_BUDGET_BYTES` (14 MB) and `SINGLE_PHOTO_LIMIT_BYTES` in `embedPhoto` get a `variant`-aware budget: download has no cap, email is capped and prefers the thumbnail. Also candidate order becomes thumb-first for print. Add a prefetch pool (concurrency 6) for all photos in the inventory branch before drawing.
- The placeholder text is drawn in `drawInventoryOverviewPhotos` / `drawInventoryPhotoPages` when `embedPhoto` returns null.
- This doesn't touch the analysis path, `thumbnail.ts` or the analysis derivative module.
