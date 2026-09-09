# Custom Reports and the full-resolution photograph rule

## What I checked

I read the actual image-handling code before answering, so this is the app as it is today, not from memory.

## What "invariant 3" means, in plain terms

It is one of your standing rules for this app: **the photograph the AI looks at is the full-size one you took.** Never a shrunk copy.

How it is enforced today:

- There are two completely separate pieces of code. One makes the small preview pictures for the grid (deliberately shrinks them). The other prepares pictures for the AI and is written so it **cannot** shrink anything — no size limit, no quality limit.
- The only time a photo is re-made for the AI is when the phone produced a format the AI cannot open (iPhone HEIC). Even then it is re-saved at the **identical pixel size** at 95% quality.
- There is a safety catch: if any code ever tries to hand a small preview picture to the AI, it throws an error rather than proceed.
- A test locks this in — the two pieces of code are not allowed to reference each other.

The reason is commercial, not technical: a 2mm sealant gap, a hairline crack, a missing fire-extinguisher tag, a scaffold tie — these disappear when a photo is shrunk. A report that misses them is worse than no report, because it has been signed.

## Your question: can Custom Reports be standalone and do it differently?

Technically, yes — Custom Reports could be given its own photo path. Structurally I would advise against it, for three reasons:

1. **Same photos, same eyes.** The proposed shrink (640px, 60% quality) is roughly a 90% loss of detail. The AI would miss small defects in Custom Reports that it catches in a Project report — on the same photograph. That is the exact failure the rule exists to prevent.
2. **The output looks identical to the client.** A Custom Report still leaves the building as an instructBrain PDF on your name. A recipient cannot tell which engine produced it.
3. **Two photo paths become one photo path.** In practice someone later reuses the "fast" path "for consistency" and the whole app quietly degrades. That is what happened in the v1 prototype.

## The real goal, and a better way to get it

The point of the shrink was **speed**. There are faster levers that cost no accuracy:

- **Run more photos at once.** The app currently analyses 4 at a time, capped at 6. Raising this is the single biggest win and changes nothing about quality.
- **Trim the output length.** The AI is currently allowed a very long answer (6000 tokens). Most of the wait is the AI writing, not looking. Tightening this per report type speeds every analysis.
- **Skip the second-opinion pass** for Custom Reports where a fast draft is the point, rather than degrading the photograph.

Together these get most of the speed the brief was chasing, on full-size photographs.

## What I suggest we do

Build Custom Reports as its own standalone feature exactly as the brief describes — presets, tones, special requests, saved templates, batch analysis, multi-survey reports, contents-page PDFs, the rename from Quick Report — but keep it on the full-size photo path shared with the rest of the app, and get the speed from concurrency and shorter answers.

Two items in the brief also clash with your standing design rule against mascots and floating ornament: the draggable animated purple oracle with eyes. I would deliver that as a fixed, restrained assistant button instead.

## Your call

Tell me which you want and I will write the build plan:

- **A** — Custom Reports standalone, full-size photos, speed from concurrency and shorter answers, restrained assistant button. (Recommended.)
- **B** — As above, but you want the shrunk-photo fast path for Custom Reports anyway, accepting that small defects will be missed there.
- **C** — As A, but build the animated oracle as written in the brief.
