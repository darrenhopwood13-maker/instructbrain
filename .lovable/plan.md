# Fix the "Failed to fetch" failure when starting a report on site

## What is happening

Tapping **Take photo** does two things before any photograph uploads: it creates the report record, then saves the cover photo and logo. Both of those need a live connection. On a weak or dropping site signal one of them fails, the phone reports the bare browser message **"Failed to fetch"**, and the whole attempt is thrown away — the report is not created and the photographs you just chose are gone, so you have to pick them all again.

The message itself is also meaningless to the person holding the phone. Elsewhere in the app this same failure is already translated into plain English; the capture screen is not.

## What will change

- Replace the raw "Failed to fetch" with a plain message: we could not reach the service, your photographs are still held, try again.
- Keep the chosen photographs in memory when starting fails, and show a **Try again** action that resumes with the same photographs, the same brief and the same cover — no re-picking.
- Retry the connection automatically a couple of times with a short pause before showing any error, so a one-second signal drop is invisible.
- If the phone reports it is offline, say so directly rather than attempting and failing.
- Treat the cover photo and logo as non-blocking: if the report record is created but the cover upload fails, keep the report and let the user set the title page later from the uploaded photographs, instead of discarding everything.

## What stays exactly as it is

- The report row is still created on the first photograph, never on arrival.
- Photograph order still follows the order you selected them.
- Full-resolution photographs still reach the AI; nothing is downscaled.
- No change to other report types, the Property inventory layout, compliance registers, issued reports, distribution rules, or the external Supabase setup.

## Technical notes

- Route the capture-start error through the existing plain-language network translation used by the sign-in path, extended for report actions, rather than surfacing `error.message`.
- Wrap the create call in a bounded retry (2 retries, short backoff) for network-class failures only; never retry a plan-limit or permission error.
- Hold the snapshotted files in a ref on failure and expose a retry that re-runs the same mutation payload.
- Move `applyBranding` out of the create mutation's failure path: run it after the report exists and report a soft warning toast if it fails.

## Verification

- Test that a network-class failure yields the plain message and preserves the held files.
- Test that a plan-limit error is not retried and keeps its own wording.
- Test that a failing cover upload still leaves a usable report.
- Run the full suite before and after.
