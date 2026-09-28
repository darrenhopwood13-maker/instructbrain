# Make the phone photo screen usable during large uploads

## What will change

- Keep the desktop layout unchanged.
- On phone-sized report photo screens, stop the top app bar and bottom photo controls from covering the working content.
- Reduce the bottom photo controls to a compact, stable dock above the four-button navigation bar.
- Keep the next-step button and **Take photo / Add from albums** controls reachable with one hand, but remove the long albums hint from this cramped dock.
- Reserve the dock’s actual height below the photo content so the final photograph and room controls can always scroll fully into view.

## Compact upload progress

- Replace the full list of every uploading photograph with one compact summary: **Uploading 18 of 47**, an overall progress bar, and a failed count when needed.
- Do not show a row for every successful photograph.
- Automatically show failed photographs with individual and **Retry all** controls, because failed uploads must never be hidden.
- Add an optional **View details** control for anyone who needs to inspect the remaining queued or active files.
- Once all photographs are safely stored, collapse this to a short **47 photographs uploaded** confirmation that can be cleared.

## Behaviour that stays unchanged

- Full-resolution storage, Android/Google Photos safe copying, upload order, retries, room labels, overview rules, photo numbering, and analysis readiness remain unchanged.
- Uploading continues in the background.
- No report, desktop, PDF, shared-link, or dashboard layout changes.

## Verification

- Check the photo workflow at 320px and 375px widths with a large simulated album.
- Confirm the header, action dock, and four-button navigation never overlap controls or photographs.
- Confirm the last item can scroll above the dock, button text fits, and every touch target remains at least 44px.
- Confirm failed uploads remain visible and retryable while successful uploads do not create a long scrolling list.
- Run the full automated test suite and current checks.
