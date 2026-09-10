# Landing page: refreshed feature copy + product motion

Update the marketing copy on `src/routes/index.tsx` so the landing page sells the expanded instructBrain product accurately, with sharper slogans and lightweight product motion. No schema, auth or report logic changes.

## 1. New hero messaging

Replace the current headline/sub-head with copy that covers the full product surface:

- Main headline options to choose from:
  - "Walk the site. Issue the same afternoon." (kept, but paired with a rotating/secondary slogan)
  - "Photos in. Reports out. Minutes, not days."
  - "The construction report engine. From phone photos to client-ready PDFs."
- Supporting line must mention all three report streams:
  - Custom Reports driven by fixed construction templates
  - Project Reports for site walks, snagging and weatherproofing
  - Weekly Compliance Registers (Fire, Excavation, Scaffold, Welfare, Lifting & plant, Housekeeping)
- Keep the two orange glass hero actions:
  - "Create custom report" → `/reports/quick`
  - "Create project report" → `/reports/new`
- Add a short rotating slogan strip under the hero actions, e.g.:
  - "AI drafts the findings. You confirm and issue."
  - "Full-resolution image analysis. Structured output. Human sign-off."
  - "Per-trade extracts, close-out tracking and shared links — in English or issued in another language."

## 2. Refreshed feature sections

Rewrite the existing sections so each one showcases a real product capability:

### "Three jobs it does today" → "Built for what you actually do on site"
Replace the three use-case cards with four cards covering:
- **Custom Reports** — pick a construction template (electrical, mechanical, fit-out, damp, etc.), set tone, report type and special instructions; AI analyses photos against fixed core parameters.
- **Project Reports** — site walks, snagging and weatherproofing with per-trade attribution, stable references and close-out tracking.
- **Weekly Compliance Registers** — six ordered checks, previous-run prepopulation, locked completed runs, rolling six-week history, action close-out and downloadable packs.
- **Multilingual issue & share** — issue reports in another language; shared links and trade-access pages render in that language while English stays the record copy.

### "How it works" → keep structure, sharpen copy
Three steps, but the body text should mention:
1. Upload photos — full-resolution originals go to the AI; thumbnails and display copies are separate.
2. AI drafts findings — structured output, confidence scoring, `not_assessed` on uncertainty; trade suggestions are suggestions until a human confirms.
3. Review and issue — keyboard-first review, audited edits, PDF with contents page, per-trade extracts and close-out tracking where required.

### "What it gives you back" / ROI section
Keep the interactive ROI calculator, but update the intro copy to mention time saved across all three report streams, not just survey write-ups.

### "What the AI actually does" / plain English
Update to emphasise:
- AI only describes conditions and hazards, never people.
- Confidential findings are restricted and excluded from subcontractor distribution.
- `not_assessed` is a first-class status — the system prefers saying "I can't tell" over guessing.

### Pricing / closing CTA
Keep pricing tiers, but make sure the free tier description mentions "3 reports across Custom Reports, Project Reports and Compliance Registers". Update closing CTA copy to match the new hero angle.

## 3. Product motion

Add lightweight, scroll-aware animation that demonstrates the workflow without mascots, floating orbs or gradient blobs:

- **Hero photo-to-report sequence** — a small CSS/Motion component in the hero that cycles through:
  1. A stack of site photographs dropping in.
  2. A "scan line" passing over them.
  3. Structured finding rows appearing with status pills.
  4. A PDF/report document sliding out.
- **Feature card entrance** — cards in the use-cases and how-it-works sections fade/slide up as they enter the viewport (respect `prefers-reduced-motion`).
- **Compliance register mini-demo** — a small animated strip showing the six checks ticking through, with one non-compliant item surfacing an action.
- **No video file assets** unless the user supplies one. Use CSS-driven motion and, if needed, a generated illustrative image that fits the navy/orange design system.

## 4. Constraints

- Stay inside the existing instructSite visual system: navy blueprint grid, orange glossy controls, frosted panels, Audiowide wordmark, accessible micro-labels.
- No dark-mode change, no mascots, no floating orbs, no gradient blobs.
- All animations respect `prefers-reduced-motion`.
- Keep SEO metadata and page title/description intact or improved.
- No schema, migration, auth, AI or report logic changes.

## 5. Verification

- `bunx tsgo --noEmit`
- Full Vitest suite
- Manual preview check at 375px and 1280px for overflow and readability
