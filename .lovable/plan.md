# Faster uploads and faster photo analysis

Good news first: analysis already runs **12 photographs at once** — the same as your other app. So the slowness you are feeling is coming from elsewhere. Here is what is actually holding it up, and what I would change.

## What is slowing things down

1. **Uploads are capped at 5 at a time**, and the upload queue itself refuses to go above 6 no matter what it is asked for.
2. **Every finished photograph triggers a full refresh** of the findings list, the report and the usage meter. With 12 running at once on a 150-photo job, that is hundreds of refreshes fighting the uploads for bandwidth — each one makes the next photograph wait.
3. **A second AI opinion runs on many photographs.** Anything low-confidence or fail-toned is re-read by the slower, stronger model. That is deliberate (it stops missed defects), but it roughly doubles the time on those items.
4. **A one-second pause between retries** on uploads, even for the first quick retry.

## What I would change

- **Raise upload concurrency to 12** and lift the queue's hard ceiling to match, so photos go up as fast as the connection allows. Retry, resume and progress behaviour stay exactly as they are.
- **Batch the screen refresh** instead of firing one per photograph: refresh at most about twice a second while a run is going, plus once at the end. Results still stream into review as they land — you just stop paying for 150 refreshes.
- **Add a speed control on the analysis panel**: Standard (as now, with the second opinion) or Fast (single pass, no escalation). Fast is opt-in per run and clearly labelled as a single-pass read, so nobody gets a quieter check without choosing it.
- **Shorten the first upload retry** so a single blip does not cost a whole second.

## What does not change

- Full-resolution photographs still go to the AI. Speed never comes from shrinking an image.
- Any AI failure, timeout or low confidence still becomes **Not assessed** — never a pass, on either speed setting.
- Item numbering, upload order, cancel/resume, cost logging and the cache all behave as they do today.

## Technical notes

- `src/lib/photos/upload-queue.ts`: raise the concurrency clamp from 6 to 12; make the first backoff step shorter.
- `src/components/photos/photos-panel.tsx`: `CONCURRENCY` 5 → 12.
- `src/lib/ai/use-analysis-run.ts`: replace the per-photo `invalidate()` with a throttled invalidation (~500ms trailing) plus a final flush; thread an optional `fast` flag through `execute`/`start`.
- `src/lib/ai/analyse.functions.ts` + `analyse.server.ts`: accept an optional `fast` input that sets `escalationEnabled: false` for that call only. Cache key already includes tone/brief; tier is recorded per attempt, so cost logging stays accurate.
- `src/components/ai/analysis-panel.tsx`: add the Standard/Fast selector as a dropdown (matching the app's pick-one convention) with helper text.
- Tests: queue honours concurrency 12; throttled invalidation still flushes once at the end; `fast` disables escalation without changing status coercion.
