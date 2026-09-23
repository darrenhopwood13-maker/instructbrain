# Why photo uploads feel slow — and what I would change

## What is actually happening

The app never shrinks a photograph, and it shouldn't — the AI needs the full-size
picture to see a hairline crack. A phone photo is 4–8 MB, so 30 photographs is
roughly 150–250 MB going up a site 4G connection. That is the floor.

But on top of that, each photograph currently does more work than it needs to,
and some of it happens before anything starts uploading:

1. **Nothing uploads until every photograph has been copied into memory.** When
   you pick 30 photographs, the app reads all of them, one after another, before
   the first byte goes up. On a phone that is several seconds of nothing visibly
   happening. (This copy exists for a good reason — Android takes the photo away
   mid-upload otherwise — but it doesn't have to block the queue.)
2. **Each photograph is read twice.** Once to copy it, once again to read the
   date and location from it.
3. **Two more uploads per photograph after the original.** A small preview image
   is made and uploaded, and for iPhone formats a second full-size copy is made
   and uploaded as well. The photograph isn't counted as done until those finish.
4. **The preview image is made on the same thread as the screen**, so the app
   also feels sluggish while a batch runs.
5. **Twelve at once on one site connection.** Twelve uploads share the same
   uplink, so each one crawls, progress bars barely move, and any that time out
   get retried — which costs more time than it saves.

## What I would change

- **Start uploading the first photograph immediately** and keep copying the rest
  in the background, so the queue is never waiting on the whole selection.
- **Read the date and location from the copy already in memory** instead of
  reading the file a second time.
- **Upload the original, write the row, show it as done** — then make and upload
  the small preview afterwards, in the background. A missing preview already
  can't block anything; this makes that true in practice.
- **Move preview-making off the screen thread** so scrolling and tapping stay
  smooth during a batch.
- **Adapt how many upload at once to the connection**: around 4 on a slow mobile
  connection, up to 12 on good Wi-Fi, instead of always 12. Fewer at once on a
  weak signal is genuinely faster and far less likely to time out.
- **Show honest progress**: photographs done / total, plus megabytes remaining,
  so a slow connection reads as slow rather than as broken.

## What does not change

- Full-resolution photographs still go to the AI. No resizing, ever.
- EXIF date and location still read from the original bytes, before anything else.
- Photographs still appear in the order you added them, not the order they finish.
- Item numbering, retries, resume, duplicate detection and cancel all behave as now.
- Any AI failure still becomes **Not assessed**, never a pass.

## Technical notes

- `photos-panel.tsx`: replace the up-front `snapshotFiles(selected)` with a
  lazy per-task snapshot so the queue starts on the first file; derive
  `CONCURRENCY` from `navigator.connection.effectiveType` (`4g`/Wi-Fi → 12,
  `3g` → 4, `2g`/`slow-2g` → 2), clamped by the queue's existing limit.
- `photo-service.ts` `uploadPhoto`: pass the already-read `bytes` into
  `readProvenance` instead of `readProvenanceFromFile`; move
  `uploadThumbnail` (and the HEIC analysis twin) after the row insert and
  fire them without awaiting, patching `thumbnail_path` / `analysis_path`
  when they land.
- `thumbnail.ts`: run `createImageBitmap` + `OffscreenCanvas` inside a small
  worker when available; existing synchronous path stays as the fallback, and
  the module still shares no code with the analysis derivative (invariant 3
  test unchanged).
- `upload-queue.ts`: unchanged public behaviour; concurrency is supplied by the
  caller as today.
- Tests: queue still honours the clamp; lazy snapshot still yields the exact
  original bytes; provenance read from bytes matches the file path; a failed
  thumbnail leaves the photo row intact and analysable.
