# Landing hero, icon cleanup and glass buttons

Visual only. No data, routing or business logic changes.

## 1. A much bigger wordmark

The hero currently stacks: eyebrow, a modest `instructBrain` wordmark, a one-line
strapline, then a second eyebrow and a large headline. Two competing "first things".

New top block:

```text
AN INSTRUCTSITE COMPANY
instructBrain          <- roughly double current size
Photos in. Client-ready reports out.
Walk the site. Issue the same afternoon.
```

- Wordmark scales from `text-4xl / sm:text-5xl` to about `text-6xl / sm:text-7xl /
  lg:text-8xl`, still Audiowide, still orange `instruct` + white `Brain`.
- The "UK construction reporting" eyebrow and the old `<h1>` slot are merged into
  this block, so the page has one clear opening statement rather than two.

## 2. The headline

"Three days of writing up becomes minutes." is replaced with:

**"Walk the site. Issue the same afternoon."**

It becomes the `<h1>` directly under the wordmark, at a size that supports the
wordmark rather than fighting it. The existing supporting sentence is reworded so
it doesn't repeat the same claim twice.

The page title and social description are updated to match, since the old ones
lead on "three days of writing up becomes minutes".

## 3. Remove the orange document marks

Every small orange rounded-square icon chip goes, site-wide:

- Landing header, next to the wordmark
- Use-case cards, "how it works" step cards, closing call-to-action panel
- The signed-in app header
- The sign-in / sign-up layout header

Wordmark alone, everywhere. Card headings move up into the space that frees.
Nothing here carried meaning — each one was decorative and `aria-hidden`, so
screen readers and keyboard users are unaffected.

## 4. Glass buttons, white text

A new frosted-glass button treatment replaces the glossy 3D orange on secondary
controls, with two deliberate exceptions so the interface stays usable on site.

| Control | Treatment |
| --- | --- |
| Primary action on a screen (Start free, Issue report, Send, Save) | Stays solid orange, now with **white** text |
| Everything else (secondary, outline, quiet) | Frosted glass: translucent surface, soft blur, thin light edge, white text |
| Destructive | Unchanged |

Why not full glass: frosted panels on navy are low contrast by nature, and the
primary user is on a phone in daylight. Keeping one solid orange action per screen
means "the thing you press" is still unmistakable, and it keeps the family
resemblance to instructSite.

Black text on orange is removed everywhere — all button text becomes white, at a
contrast ratio that passes WCAG AA against both the orange and the glass.

Focus rings, disabled states, hover and pressed states are all re-checked on the
new glass so keyboard users still get a visible focus indicator.

## Technical notes

- New `@utility glass` (and a quiet variant) in `src/styles.css`, sitting alongside
  the existing `gloss` / `gloss-outline`. Uses `backdrop-filter` via the standard
  property only.
- `--primary-foreground` in the dark theme changes from deep navy to white so the
  solid orange button and its focus/hover states pick it up automatically.
- `src/components/ui/button.tsx`: `default` and `outline` map to the glass
  utilities; `brand` remains the solid orange primary. No component call sites need
  to change, though I will sweep the app for screens that use two `brand` buttons
  side by side and demote the lesser one.
- Icon chips removed from `src/routes/index.tsx`, `src/components/app-shell.tsx`
  and `src/components/auth-layout.tsx`; unused `lucide-react` imports cleaned up.
- Nothing hardcoded: all new colours are theme tokens in `src/styles.css`.
