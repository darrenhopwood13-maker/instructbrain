# Larger, faster in-app camera

## What will change

- Make the live camera image fill nearly the entire phone screen, edge to edge, rather than sitting inside a small panel.
- Place the essential controls over the camera image: a large shutter button in the thumb zone, **Done** in the top corner, and a compact taken/uploaded counter.
- Move the time/location state, recent-photo strip, and **Analyse as I shoot** switch into a small expandable control so they do not shrink the viewfinder.
- Keep every control at least 44px, keep labels available to screen readers, respect safe areas, and prevent any horizontal overflow at 375px.
- On wider screens, keep the camera sensibly contained without reverting to the current small mobile view.

## Make it feel quicker

- Give immediate visual and tactile-style feedback when the shutter is pressed, before the full-resolution image has finished processing.
- Add a short capture-in-progress guard so repeated taps cannot start overlapping camera reads, while keeping the next shot available as soon as the device is ready.
- Avoid the redundant full-file memory copy for photographs created inside this camera. Those files are already owned by the app; gallery and phone-camera files will keep the existing Android-safe copy step.
- Add the captured photo to the counter and thumbnail strip promptly, then continue the unchanged full-resolution upload and optional analysis in the background.
- Keep uploads concurrent and keep the camera open while uploads or analysis continue.

## What will not change

- Full-resolution originals still go to storage and AI; no resizing or quality reduction is added to that path.
- Time and available GPS location remain attached to every in-app shot.
- Photo numbers remain fixed in shutter order, regardless of upload completion order.
- Property inventory still does not analyse while shooting; other eligible reports retain the optional switch.
- Camera permission or insufficient-resolution failures still fall back to the phone's camera.

## Verification

- Test the camera at 375px portrait and a wider screen: viewfinder size, safe-area controls, no clipped text, and no overlap.
- Test rapid repeated shutter presses, continuous shooting while uploads complete, Done during background uploads, and camera reopen/cleanup.
- Test time/location stamps, low-resolution fallback, single-photo capture screens, upload numbering, and the Android gallery-copy safeguard.
- Run the complete automated test suite before and after the change.

## Technical notes

- Restructure `ContinuousCamera` as a true full-viewport capture surface instead of a content-heavy dialog layout.
- Separate immediate capture state from completed blob processing so the pressed/working state appears synchronously.
- Mark app-created camera files as safe in-memory files and let `snapshotFiles` skip only their redundant byte-for-byte copy; external file references remain protected exactly as today.
- Add focused tests for the safe-file distinction and capture lock, while retaining the existing resolution and sequence tests.
