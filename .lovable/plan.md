# Hero action tiles — instructSite orb buttons, moved to the top

Landing page only. Visual and layout. No data, routing logic or report behaviour changes.

## The tiles

The exact instructSite treatment from the screenshot: a domed orange radial fill
(bright highlight top-left falling to deep burnt orange at the base), a silver/white
ring border, a glossy top sheen sheet, a deep drop shadow, a white line icon in the
middle, and a bold label underneath. On hover the tile lifts and brightens; on press
it sinks. Every value copied verbatim from instructSite's `enterprise-orb-button`
rather than re-derived, so the two products match.

Three tiles side by side, always in one row (like the screenshot), tall on desktop,
slightly shorter on a phone but still large and thumb-friendly:

```text
 ┌─────────────────────────────────────────────────────────┐
 │              instructBrain      (wordmark)              │
 │        Photos in. Client-ready reports out.             │
 │                                                         │
 │  ╔═══════════╗   ╔═══════════╗   ╔═══════════╗          │
 │  ║ ░░sheen░░ ║   ║ ░░sheen░░ ║   ║ ░░sheen░░ ║          │
 │  ║           ║   ║           ║   ║           ║          │
 │  ║    [▤]    ║   ║    [◉]    ║   ║    [🗀]   ║          │
 │  ║           ║   ║           ║   ║           ║          │
 │  ║  orange   ║   ║  orange   ║   ║  orange   ║          │
 │  ╚═══════════╝   ╚═══════════╝   ╚═══════════╝          │
 │    Project        Quick            My                   │
 │     report        report          reports               │
 │                                                         │
 │   Free for your first 3 reports · No card required      │
 │ ─────────────────────────────────────────────────────── │
 │  Walk the site. Issue the same afternoon.               │
 │  Upload the walk. Every photo read against your survey  │
 │  type, drafted into referenced findings, assembled      │
 │  into a signed-off PDF.        See how it works →       │
 └─────────────────────────────────────────────────────────┘
```

- Tile 1 — **Project report** (clipboard icon) → full report set-up.
- Tile 2 — **Quick report** (camera icon) → quick report.
- Tile 3 — **My reports** (folder icon) → the report list; signed out it goes to sign-in.

Signed-out visitors go to sign-up first and land on the screen they pressed, exactly as
now (the existing `next` parameter is reused, nothing changes there).

## Layout above and below

- The tiles move up directly under the wordmark and the one-line strap, so they are the
  first thing on the screen with no scrolling on a phone.
- The long hero paragraph and the headline move **below** the tiles and are tightened:
  headline one line, body trimmed to two short sentences at a smaller size, with "See
  how it works" on the same line rather than its own block. Roughly half the vertical
  space it takes now.
- Everything below the hero (ROI, use cases, steps, pricing, footer) is untouched.

## Technical notes

- Add an `orb-tile` utility to `src/styles.css`, copied from instructSite's
  `enterprise-orb-button`: radial-gradient fill, the stacked ring shadow
  (dark orange / near-white / dark orange), outer drop shadow and the two inset
  shadows, plus hover and active shadow sets. Colours expressed against the existing
  `--brand-accent` token family — no hardcoded hex in components.
- The sheen is a `::before` sheet inset from the top, same geometry instructSite uses.
- Hover: `scale(1.03)` and brightness lift; active: `scale(0.95)`; focus-visible ring —
  same transitions as instructSite, and respects reduced-motion.
- Tiles are rendered in `src/routes/index.tsx` as a small local `ActionTile` component
  wrapping a `<Link>`, with icon plus visible text label (label is outside the tile, so
  the control is never icon-only for screen readers; each also carries an aria-label).
- The existing `glass-orange` button variant stays for the pricing call to action.
