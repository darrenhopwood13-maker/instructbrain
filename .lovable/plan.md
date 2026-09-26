# Continuous photo taking, with uploads and analysis in the background

## What you'll see

1. Press **Take photo**. The camera opens inside the app and stays open.
2. Tap the shutter as many times as you like. Each shot shows as a small numbered thumbnail along the bottom with a counter ("12 taken · 9 uploaded").
3. Every shot starts uploading straight away while you keep shooting. Nothing waits for you to finish.
4. Press **Done** to close the camera. You're back on the report with all the photos in the order you took them.
5. If the camera can't open in the app (older phones, permission refused), the button falls back to the phone's own camera exactly as now.

## Analysing while you shoot

Yes, this can be done. There's an **Analyse as I shoot** switch in Options (off by default):

- **On:** each photo is analysed as soon as its upload finishes, up to 12 at once, so most findings are ready when you press Done.
- **Off:** works as now. You press Draft the findings when you're finished.

Not every report type can do this:

- **Property inventory:** analysing as you shoot stays off. Photos have to go into rooms and you have to pick the overview photos first, and those are never analysed.
- **Photo condition record:** needs your focus text written before the switch will turn on.
- **Title-page photos:** never analysed.

## What does not change

- Photos are saved at full resolution. The camera takes the largest image the phone offers, never lower than 1500px on the long edge.
- Photo numbers follow the order you tap the shutter, even if later uploads finish first.
- Any failed, timed-out or unsure analysis is marked Not assessed and stops the report being issued until you sort it out.
- No signal: photos wait on the phone and upload when the connection comes back, as they do now.

## Technical notes

- New `src/components/photos/continuous-camera.tsx`: full-screen dialog using `getUserMedia` (rear camera, highest resolution the device offers) and `ImageCapture.takePhoto()` where it's supported, otherwise a canvas grab from the video frame at native track resolution with JPEG quality 0.95. Frames smaller than 1500px on the long edge trigger the fallback to `<input capture>`. Shutter, counter, thumbnail strip and Done controls are all 44px+ and sit in the thumb zone.
- Each shot goes into the existing upload path through an incremental enqueue: its sequence is reserved when the shutter is tapped (`assignUploadSequences`), and the queue gains `enqueue()` so that it keeps running while shots arrive. The concurrency 12 limit and the retry and resume behaviour stay the same.
- Camera-frame shots have no EXIF, so the capture time is recorded at the moment the shutter is tapped, and GPS is taken from `navigator.geolocation` if permission is granted.
- `use-analysis-run.ts` gains `analyseOnArrival(photoId)`, using the same concurrency, cache, Standard/Fast tier and `not_assessed` coercion. It is gated by the `analyseWhileShooting` flag in the brief, which is off for room-schedule layouts, for cover photos and when a required focus is missing. Refreshes are throttled as they are now.
- Wired into `photo-capture-actions.tsx` so that the quick start screen and the photos panel both use it.
- Tests cover: sequence order follows shutter order when uploads finish out of order; enqueue while running; the auto-analysis gate for the inventory, cover and focus cases; and that the fallback is used when the camera resolution is under 1500px. The full test suite runs before and after.

---

# Also in this plan: clearer numbering, and Recent reports that fit

## Photo and finding numbers

Under each photo in Review you see two counters today, for example "Finding 1 of 1 · Photo 12 of 18". The first counts findings on that photo and the second counts photos. It reads like two different numbering systems.

Change:

- Show **one line: "Photo 12 of 18"**, the photo's own number, which is the same number it has in the report.
- Only when a photo has more than one finding, add a small second line: **"2 findings on this photo · this is 1"**. On single-finding reports (weatherproofing, photo condition, most inventory items) that line never appears.
- The "X of Y findings confirmed" progress at the top stays as it is.
- Screen readers get the same wording.

## Recent reports on the dashboard

The report cards don't fit on a phone screen. Fix:

- Each card stays inside the screen width at 375px and 320px, with nothing cut off at the side.
- A long report title wraps onto up to two lines instead of pushing the card wider. The status label sits on its own line underneath if there isn't room beside it.
- One card per row on phones, two per row on wider screens.

## Technical notes (additions)

- `src/components/review-list.tsx` (around line 642): replace the combined caption with `Photo {photoIndex} of {photoTotal}`, plus a conditional secondary line when `findingTotal > 1`, and update the image `alt` to match. The photo number comes from the persisted sequence position already in `position`.
- `src/routes/_authenticated/dashboard.tsx` (lines 236–251): add `min-w-0` to the `li` and the `Link`; use a grid header `grid-cols-[minmax(0,1fr)_auto]` that stacks below `sm`; use `line-clamp-2 break-words` on the title in place of `truncate`. The exact cause of the overflow will be checked with a 375px screenshot before the fix.
- `roadmap.md`: add both items when the plan is approved (it can't be edited in plan mode).
