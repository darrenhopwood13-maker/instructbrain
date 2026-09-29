# Create the Instruct family system and rebrand instructBrain in laser green

## Goal
Turn the current visual language into a reusable, copy-ready AI build brief for every future Instruct app, then make instructBrain the first implementation of the new family rule.

The permanent family formula will be:

- **“instruct” is always white.**
- **The product name carries that product’s own bright, optimistic accent colour.**
- That same product colour replaces the current orange throughout the app’s brand accents, borders, buttons, active states and decorative rules.
- Each app keeps the shared Instruct navy, typography, blueprint background, working-screen structure, interaction rules and accessibility baseline.
- Marketing wording remains bespoke to the product being designed; the master brief defines structure and standards, not reusable sales copy.

For **instructBrain**, the product colour will be **Laser Green `#57FF00`**, with pale companion **`#D8FFBF`** where a softer or text-safe green is required.

## 1. Build the reusable Instruct family design system

Create one detailed, standalone AI build brief covering:

- The family naming pattern: `instruct[Product]` and “An instructSite Company”.
- Exact shared colours, led by royal navy **`#24417B`**, deep navy **`#172B55`**, white **`#FFFFFF`**, and a per-product accent slot.
- The exact accent-role formula every product colour must provide: main, light/text-safe, deep/pressed, translucent panel, focus and subtle surface variants.
- Wordmark construction, spacing, minimum size, clear space, approved colour combinations and prohibited treatments.
- Sora headings, Manrope interface/body text and Audiowide wordmark usage, including weights and alignment rules.
- The exact 48px blueprint grid: 1px white lines at 7% opacity over navy, fixed behind content.
- Navy console screens, white working screens and light document/report output as three separately governed surfaces.
- Exact button recipes by surface, including shape, height, border, fill, focus, hover, pressed, disabled and icon treatment.
- Header, desktop navigation and four-destination mobile navigation patterns, including safe-area handling.
- Cards, fields, menus, dialogs, sheets, status labels, tables, lists, empty/loading/error states and report/document presentation.
- Layout tokens, spacing rhythm, container width, corner-radius limits, shadows and responsive breakpoints.
- Workflow doctrine: field-first, one-handed use, one primary action, progressive disclosure, guided steps, pick-one dropdowns, browse-many lists, keyboard-first review and explicit human confirmation.
- Copy doctrine: concise working screens, fuller product-specific marketing pages, one-line empty states and help behind short silent clips.
- Accessibility and acceptance checks: WCAG 2.1 AA, 44px touch targets, visible focus, reduced motion, status never by colour alone, 320–375px checks and no horizontal overflow.
- A “do not copy” section covering known historical inconsistencies and banned patterns.
- A final copy-and-paste implementation prompt with placeholders for `[PRODUCT NAME]`, `[PRODUCT ACCENT]`, `[PRODUCT PURPOSE]`, navigation, workflows and bespoke marketing copy.

Deliver the brief as a Markdown file in Files so it can be attached to any future app project.

## 2. Rebrand instructBrain from orange to Laser Green

Update the shared design tokens first, then remove remaining orange-specific overrides so the change is consistent rather than page-by-page:

- Replace the normal brand accent **`#FF5E00`** with **Laser Green `#57FF00`**.
- Define accessible green companions from the approved palette, using **`#D8FFBF`** where pale green is required and a tested deeper green where dark text or pressed states need stronger contrast.
- Change every instructBrain wordmark to white **“instruct”** plus Laser Green **“Brain”** on navy.
- On white surfaces, use a dark navy **“instruct”** only where white would disappear; keep Laser Green **“Brain”**. The master rule remains white “instruct” whenever the wordmark sits on its standard navy brand field.
- Replace orange brand borders, button accents, active navigation indicators, separators, focus accents, micro-labels and decorative rules with the green token family.
- Replace hardcoded orange values in landing-page-only styling with semantic product-accent tokens.
- Define the missing reusable blueprint-grid token so the navy header and mobile bar on white working screens receive the intended grid treatment.

## 3. Preserve semantic and functional boundaries

- Do **not** recolour pass, fail, warning or flag states into brand green. Each remains labelled and visually distinct.
- Do **not** use Laser Green as body text where contrast is inadequate; use the tested pale or deep companion token for that role.
- Keep working pages white, flat and editorial, with navy shared navigation chrome.
- Keep report and print output light, restrained and legally readable; use the product accent only for small rules and brand details.
- Keep all workflows, data, AI behaviour, permissions, report content and external Supabase integration unchanged.
- Do not add gradients, mascots, floating decoration, dark-mode controls or automatic actions.

## 4. Exact component standards to implement

### Navy screens
- Navy field with the 48px blueprint grid.
- Primary action: transparent navy glass, **1.5px Laser Green border**, pill shape, bold label, green-tinted hover surface and a clear focus ring.
- Secondary controls: quieter navy/glass surface with the same green keyline system.
- Panels: restrained translucent navy surfaces; no decorative floating shapes.

### White working screens
- White page, pale blue-grey panels, fine neutral-blue edges and navy text.
- Navy header and complete navy mobile navigation bar, each separated from the white content by a **3px Laser Green rule**.
- One solid Laser Green primary action per state; supporting actions remain neutral or navy.
- Fields and cards keep neutral-blue borders; green is reserved for action, selection and brand emphasis.

### Documents and reports
- White paper, dark ink, compact professional typography and minimal Laser Green rules/details.
- No navy page background, blueprint grid, glow or glass effects in report content or print.
- Preserve print-safe black text and all existing report structures.

## 5. Verification

- Run the complete existing test suite before and after the branding change.
- Check the landing page, dashboard, authentication, representative working screens, menus/dialogs, report preview and print output.
- Inspect desktop and 375px phone layouts; also check 320px for long labels and navigation fit.
- Verify the wordmark rule everywhere, including headers, mobile navigation, sign-in screens, reports, emails and product mock-ups.
- Verify every former orange appearance is either intentionally replaced by the product green or retained only because it is a separate semantic warning/status colour.
- Measure contrast for all green-on-navy, green-on-white and text-on-green combinations; adjust companion shades, never the approved main **`#57FF00`** swatch.
- Confirm visible keyboard focus, reduced-motion support, 44px touch targets, no overlap and no horizontal overflow.
- Confirm the final preview builds cleanly and all tests pass.

## Technical details

- Keep one semantic `product-accent` token family and derive component colours from it; do not scatter literal green values through components.
- Keep shared family navy and surface tokens separate from per-product accent tokens so a future Instruct app can change one palette slot without redesigning every component.
- Keep the three surface scopes independent: navy console, white working surface and paper/document output.
- Correct existing token leaks while converting them: undefined blueprint-grid reference, hardcoded orange keylines and landing-page literals, duplicated focus treatments and incomplete reduced-motion coverage.
- Record the reusable accent-token architecture as a project rule after implementation.
