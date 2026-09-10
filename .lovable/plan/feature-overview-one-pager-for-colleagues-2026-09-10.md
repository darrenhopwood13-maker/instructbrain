# Feature overview one-pager for colleagues

Create a branded, high-level PDF one-pager that an operations or site colleague can read in 60 seconds and forward to a director or project manager.

## What it will contain

- **Header:** instructBrain wordmark + "An instructSite Company" strapline.
- **Hero line:** "Photos in. Client-ready report out. Minutes, not days."
- **Four capability blocks**, each with a one-line benefit and 3–4 bullet details:
  1. **Custom Reports** — standalone reports with no project setup; pick a report template, set tone (Formal / Easy-going / Sharp / Meticulous / Sarcastic), choose Assessment or Identifier, add a special request, batch-upload full-resolution photos, issue a PDF with contents page.
  2. **Project Reports** — tied to a project directory; supports distribution to trades, close-out lifecycle, stable references, and multi-survey reports.
  3. **Weekly Compliance Registers** — six checks (Fire, Excavation, Scaffold, Welfare, Lifting & Plant, Housekeeping); photo evidence, actions with owners and due dates, rolling six-week view, automatic flags for overdue scaffold reports and out-of-date thorough examinations.
  4. **Review & Issue** — keyboard-first review, status confirmation, AI-suggested trade attribution with human confirmation, multilingual issue and share links, server-side PDF generation.
- **Safety & audit guarantees:** `not_assessed` never becomes a pass; confidential findings restricted to supervisor+ and excluded from subcontractor shares; full-resolution images to the AI; EXIF/GPS provenance; stable references; snapshot-driven definitions so issued reports do not change retrospectively.
- **Built for site:** mobile-first, 44px touch targets, primary actions in the lower third, resumable upload queue, works in poor signal.
- **Footer:** instructSite family note + published app URL.

## What it will look like

- Single A4/Letter page, portrait.
- Navy (#24417B) header band with white/orange wordmark and orange accent rule.
- White body with four navy-bordered blocks, orange icon bullets.
- Clean sans-serif typography, plenty of whitespace, no decorative imagery, no mascots or orbs.
- WCAG-safe contrast: navy on white, white on navy, orange used only for accents and bullets.

## How it will be built

- Generate the PDF with Python/reportlab.
- Register a Unicode system font (DejaVu Sans) so the copy renders correctly.
- Hard-code the brand colours as constants for this artifact only — no component/theme dependency.
- Write the output to `/mnt/documents/instructBrain-feature-overview.pdf`.
- Convert the PDF to an image and visually inspect for overflow, alignment, contrast, and missing glyphs.
- Deliver via `<presentation-artifact>` so the user can open or download it.

## Out of scope

- No new app routes, no database changes, no marketing website edits.
- No animated or video content — this is a static, printable one-pager.
- No pricing tables or plan limits unless the user asks to add them later.
