# Landing page: instructSite treatment, two orange glass buttons

Visual and navigation only. No schema, AI or report logic changes.

## 1. The two buttons

The hero's current "Start free — 3 reports" / "See how it works" pair is replaced by
two large orange glass buttons, side by side on desktop, stacked full-width on a phone:

```text
[  Create project report  ]   [  Create quick report  ]
```

They use the exact instructSite `glass-orange` treatment — translucent orange fill,
blur, inset highlight, 3D drop edge, lift on hover — copied verbatim from that
project's stylesheet rather than re-derived, so the two products match pixel for pixel.
Sized large (tall, generous padding) so they read as the page's centre of gravity and
are easy to hit one-handed on site.

Where they go:

- Signed in: straight to the full report set-up, and straight to the quick report.
- Signed out: to sign-up, and once the account is made the user lands directly on the
  screen they pressed for — no bounce back to the marketing page or a cold dashboard.

A quiet "See how it works" text link sits under them so the section is still
explorable without competing with the two actions.

## 2. instructSite surface treatment across the page

The page keeps its current sections and copy — wordmark, headline, ROI race, use
cases, how it works, plain English, pricing, closing call to action — but the
surfaces change to instructSite's console language:

- Section cards (use cases, steps, pricing tiers, the plain-English pull quote)
  become dark frosted glass panels: translucent white wash, blur, hairline light
  edge, deep soft shadow.
- The two `paper` bands (ROI and how-it-works) lose the light sheet and sit on the
  navy canvas like the rest, so the page reads as one continuous console rather than
  alternating light and dark. The white `.paper` scope stays untouched everywhere it
  matters — the report document preview and print output are not affected.
- Header and footer become the same glass bar instructSite uses.
- Secondary buttons on the page use the frosted neutral glass; orange is reserved for
  the two hero actions and the featured pricing call to action.

Spacing, type and the existing copy stay as they are.

## Technical notes

- Copy `glass-orange`, `glass-panel` and `glass-btn` from instructSite's
  `src/styles.css` into `src/styles.css` as `@utility` blocks, with their colour
  values expressed against the existing `--brand-accent` token family so nothing is
  hardcoded per component. Standard `backdrop-filter` only, no `-webkit-` twin.
- `src/components/ui/button.tsx` gains a `glass-orange` variant and an `xl` size;
  existing variants are untouched so no other screen shifts.
- `src/routes/index.tsx`: hero action block rewritten; section wrappers swapped from
  `console-panel` / `paper` to the glass panels.
- Deep link after sign-up: the buttons link to `/auth/sign-up` with a `next` search
  param (`/reports/new` or `/reports/quick`). `src/routes/auth.sign-up.tsx` and
  `src/routes/auth.callback.tsx` carry that param through and navigate to it on
  success instead of the current hard-coded `/projects`; the param is validated
  against a small allow-list of internal paths so it cannot be used to redirect
  off-site.
- Page title and meta text are unchanged.
