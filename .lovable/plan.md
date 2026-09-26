# Restore white working screens to the approved feature-overview style

## Visual direction
Use the supplied `instructBrain-feature-overview.pdf` as the exact design reference for white working screens only:

- White page background with a solid navy header.
- A single thin orange divider or top accent, not blue-and-orange double borders.
- Pale blue-grey panels with fine neutral-blue outlines.
- Dark navy headings and charcoal body copy.
- Orange reserved for small labels, bullets, dividers, and clear primary emphasis.
- Restrained corner radii and flat surfaces; remove the recent heavy outlines and dashboard-style button treatment from white screens.
- Keep the existing navigation, screen structure, features, and wording unless spacing is needed to match the reference.

## Typography
- Remove Audiowide from the `instructBrain` wordmark.
- Set the wordmark in Sora ExtraBold/Bold, with `instruct` orange and `Brain` white on navy or navy on white.
- Use Sora for headings and Manrope for main copy, matching the reference’s weight, line height, and compact professional feel.
- Keep labels, metadata, buttons, tables, and status text naturally aligned; justify only readable narrative paragraphs.

## Components and screens
- Rework shared white-screen tokens and controls first so cards, fields, menus, dialogs, and buttons inherit the reference style consistently.
- Keep primary actions obvious without turning every control orange or outlining every object twice.
- Apply the same visual language only where report start, capture, review, issue, projects, compliance, directory, settings, and admin use white working surfaces.
- Leave navy screens and their buttons, borders, wordmarks, colours, and typography unchanged in this first pass.
- Leave the `.paper` report preview, shared report view, and generated PDF completely unchanged in this first pass.

## Quality checks
- Compare representative white screens directly against the supplied PDF at desktop and 375px phone widths.
- Check every changed control for comfortable text fit, 44px touch targets, keyboard focus, contrast, and no horizontal overflow.
- Run the full automated suite and confirm the preview build is clean.

## Boundaries
- White working screens only; no changes to navy screens or report output.
- No workflow, data, AI, report-order, photo-role, permission, or Supabase changes.
- No dark mode, gradients, mascots, decorative blobs, or broad navigation redesign.
