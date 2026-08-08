# Fixing the quick report flow

I watched the full nine minutes. The report you produced is good. Getting to it took
too many screens, asked you for the same information three times, and lost one of your
two photographs to a database error that was shown to you as raw Postgres text.

Below: what went wrong, then what to change.

---

## What I saw

**1. A photograph was silently dropped.** At 19:44 the run reported
`46639.jpg — Failed — F-001: duplicate key value violat…`. Two photographs were analysed
at the same time, both worked out that the next item number was `F-001`, and the second
insert was rejected. The observation was thrown away — not saved, not marked
`not assessed`. Your finished report says "1 finding · 100% assessed" when in fact one
photograph was never assessed at all. That is the one failure in this app that must never
happen, and it is the first thing to fix.

**2. Three screens before the camera.** Landing tile → sign in → Projects → Quick report
intro → survey type → Start → report workspace → Photos tab → Add photos. On a phone,
in the field, that is six taps and four full page loads before you can shoot.

**3. The same details asked three times.** Location / Element / Stage appear in the
sticky "Current zone" block, again in the per-photograph dialog, and the report's
identity (title, subtitle, reference) is asked again on the Report tab. You typed
"East Elevation" four separate times in the recording, and "Various" three times.

**4. Trade assignment cleared itself.** At 19:45 you opened Responsible trade, the
suggestion was Carpenter / joiner at 95%, you pressed Confirm assignment, and got
"Trade assignment cleared — this item will go to the project's fallback recipient."
The Assign-to select was still on "No trade assigned"; pressing "Use the suggestion"
is a separate step that isn't obvious. You then had to type "Carpenter" by hand on the
Report tab.

**5. A quick report doesn't behave like a quick report.** Breadcrumb reads
"Projects > DH001". The Report tab demands a title, subtitle and reference — the exact
fields the quick flow promised to skip. Review distribution is offered even though there
is no project directory to distribute to.

**6. Share defaulted to 14 days on a draft.** You sent the link at 19:48 from a draft.
The no-expiry option only unlocks after issuing, so the client got a link that dies on
22/08 with no warning to you at send time.

**7. Long instructional prose on a phone.** "Step one — Photographs" and "Step two —
Analyse photographs" each occupy most of a screen, above the controls, on every visit.

---

## The changes

### 1. Item numbers can never collide (do first)
Move item-number allocation into the database: a single statement that takes the next
number for that report under a lock, so two photographs analysed at once can never claim
the same one. On top of that, if an insert still fails for any reason, the observation is
written as **not assessed** with the error attached, never discarded. The run summary
counts it, and the report cannot be issued until a person resolves it.

Also: the run panel stops showing raw database text. A failed photograph reads
"Not assessed — could not be saved. Try again." with a Re-analyse button.

### 2. Quick report goes straight to the camera
One screen. Survey type as a row of large tiles at the top, camera and gallery buttons
directly beneath, both live immediately — picking a type and shooting is one continuous
motion, and the report record is created in the background on first photograph.

```text
 ┌──────────────────────────────┐
 │ Quick report                 │
 │ ┌──────┐ ┌──────┐ ┌──────┐   │
 │ │ Snag │ │ Site │ │Weath.│   │   survey type, one tap
 │ │  ✓   │ │ walk │ │      │   │
 │ └──────┘ └──────┘ └──────┘   │
 │                              │
 │ ┌────────────┐ ┌───────────┐ │
 │ │ 📷 Take    │ │ 🖼 Add     │ │   thumb row, always reachable
 │ │   photo    │ │  photos   │ │
 │ └────────────┘ └───────────┘ │
 │  Where are you?  [East Elev] │   one optional field, sticky
 │  ─────────────────────────── │
 │  [thumbnails appear here]    │
 │  [ Analyse 4 photographs → ] │
 └──────────────────────────────┘
```

The landing tile links straight here, carrying through sign-up, so a signed-in tap goes
tile → camera with nothing in between.

### 3. Ask for a detail once
- The sticky zone block becomes the single place capture fields are entered. What you set
  there is stamped onto every photograph taken after it, which is already how it behaves —
  it just stops being asked again.
- The per-photograph dialog becomes "correct this one", opened only when you want to
  differ from the zone. It opens pre-filled from the zone rather than blank.
- A quick report's Report tab drops title, subtitle and reference entirely. It is named
  from the survey type and the date, exactly as it is now, and is editable in one place
  from the report header if you want to change it.

### 4. Trade assignment confirms what is on screen
The suggestion becomes the pre-selected value in Assign to, marked as unconfirmed.
Confirm assignment then confirms the carpenter. Clearing is a separate, explicit
"No trade" choice. The rule that a person confirms every attribution is unchanged —
what changes is that the confirmation is one press instead of two, and the destructive
outcome is no longer the default.

### 5. Quick reports read as standalone
Breadcrumb "Quick reports", not "Projects". Review distribution is replaced by
"Send link" — one email field, one button, nothing sends on its own. "Attach to a
project" stays available and is where distribution unlocks.

### 6. Sharing a draft is honest
The share sheet defaults to no expiry once issued, and when you share a draft it says so
plainly: "This is a draft. The recipient sees it marked Draft, and the link expires on
22 August." Issuing first is offered as the one-tap alternative in the same sheet.

### 7. Guidance gets out of the way
The step explanations collapse to a single line with a "What happens here" disclosure,
expanded by default only on your first report. The controls come first on the screen.

---

## Technical notes

- **Ref allocation**: a `SECURITY DEFINER` function `public.next_finding_ref(report_id)`
  doing `insert … returning` against a per-report counter row, or an advisory lock plus
  `max(sequence)`, replacing the read-then-insert in `src/lib/ai/analyse.server.ts`.
  Insert failure falls through to a `not_assessed` finding carrying `ai_raw_output` and
  the error, so Invariant 1 holds. `nextRef` in `src/lib/finding-refs.ts` stays for the
  client-side manual create path but is no longer the source of truth during analysis.
- **Quick capture screen**: `src/routes/_authenticated/reports.quick.tsx` becomes the
  capture surface itself, reusing `PhotosPanel` and `upload-queue` unchanged. Report row
  created lazily on the first successful upload so an abandoned visit costs no allowance.
- **Capture fields**: `capture-fields-form.tsx` gains a `mode` of `zone` or `single`;
  the per-photo dialog seeds from the current zone rather than empty.
- **Trade**: `trade-assignment-card.tsx` initialises `assignedTrade` from
  `aiSuggestedTrade` in unconfirmed state. `ai_suggested_trade` and `assigned_trade`
  remain stored separately.
- **Quick report chrome**: `reports.$id.tsx` branches on `is_quick` for breadcrumb,
  Report-tab identity fields and the distribution action.

## Order of work

1. Item-number collision and the not-assessed fallback.
2. Single-screen quick capture.
3. Ask-once capture fields.
4. Trade confirmation default.
5. Quick report chrome and Send link.
6. Share expiry honesty, guidance collapse.
