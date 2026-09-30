# Smaller, faster photos for the no-AI photographic report

## What you'll see
- In the Manual photographic report, each photo is shrunk on the phone before it uploads: about 2000px on the long side, as a good-quality JPEG.
- A typical 2–3 MB photo becomes around 400–600 KB, so uploads should be roughly 4–6 times quicker on the same signal.
- Photos stay sharp in the report, PDF and shared link, including when you zoom in on markup.
- The photo's time and location are read before shrinking, so they are kept.

## What doesn't change
- Every other report type still uploads the untouched full-size original, because the AI needs it.
- Markup, descriptions, numbering, retries and the progress counter all work as now.
- Photos already uploaded are not changed.

## Technical notes
- New module `src/lib/photos/manual-upload-image.ts` resizes to a 2000px long edge at JPEG quality 0.85, using `createImageBitmap` with `imageOrientation: "from-image"` plus a canvas, one image at a time through a shared slot. If decoding fails, the original is sent unchanged.
- The module shares no code with `thumbnail.ts` or `analysis-derivative.ts`. Extend the existing separation test to cover it.
- `uploadPhoto`: when `skipAnalysisDerivative` is set, read EXIF and the checksum from the original bytes first, then upload the reduced blob as `storage_path` (`.jpg`) and make the thumbnail from the reduced blob. Record the reduced width and height.
- Guard `analysisSourcePath` callers: they are already unreachable for `manualOnly` reports through the existing server guards.
- Tests: manual uploads call the resizer and others never do; EXIF is read before resize; the fallback on a decode failure. Run the full suite before and after.
