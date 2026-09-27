# Add whole albums and Google Photos when adding report photos

## What you'll see
- On every report's photo screen, the second button reads **Add from albums** (next to Take photo), with the small hint "Google Photos, albums or Files".
- Tapping it opens the phone's own picker. You can pick from Google Photos, any album, Drive or Files, choose as many photos as you like, or use the picker's select-all to take a whole album.
- The selected photos upload in the background in the order you selected them, with the same progress counter, retries, full-size saving and time and location details as photos taken with the camera.
- Large albums: a short note shows "Preparing 84 photos…" while photos that live only in Google Photos download to the phone, so none are lost.

## What does not change
- Single-photo spots (title page, close-out, compliance) still take one photo.
- Photo numbering, room labelling, analysis rules and the report layout stay the same.
- There is no Google sign-in and nothing new to set up.

## Technical notes
- `photo-capture-actions.tsx`: rename the gallery button label and add the hint line. It must fit at 320px and keep a 44px target.
- The gallery inputs in `photos-panel.tsx` and `reports.quick.tsx` already use `multiple`. Remove any `capture` attribute from them, and keep `accept="image/*"` so Android shows its full picker, including Google Photos. Snapshot the files one after another, reusing the existing Android-safe snapshot path, with a "Preparing N" progress state.
- Keep the selection order through `assignUploadSequences`.
- Add a test that a multi-file selection keeps its order. Run the full suite before and after.
