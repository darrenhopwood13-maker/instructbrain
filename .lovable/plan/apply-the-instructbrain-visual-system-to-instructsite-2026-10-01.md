# Apply the instructBrain visual system to instructSite

## Outcome

Restyle **instructSite** (`d9feb17d-5b2a-4d30-84fd-6e26537b08a8`) so its working screens visibly belong to the same product family as instructBrain, while retaining:

- instructSite’s existing orange product accent
- all ten cinematic feature buttons on the dashboard, including their current behaviour and visual drama
- every existing workflow, route, permission, status meaning, and business function
- document/report output styling where it must remain readable and print-safe

## Visual system to transfer

- Use the same deep navy working canvas and faint white 48px blueprint/check grid.
- Adopt the Instruct family typography: Audiowide for the wordmark, Sora for headings and prominent labels, and Manrope for interface/body text.
- Match instructBrain’s app shell: navy header and mobile navigation, fine accent rule, consistent spacing, and clear active states.
- Apply instructBrain’s glossy, dimensional button construction to ordinary primary actions, using instructSite orange instead of Laser Green.
- Match secondary, outline, quiet, destructive, icon, and disabled button states, including 44px minimum touch targets and visible keyboard focus.
- Standardise panels, cards, dialogs, menus, fields, borders, shadows, corner radii, labels, metadata, and status presentation to the instructBrain system.
- Keep orange as a single semantic product-accent family so buttons, focus rings, selected states, borders, and highlights remain consistent.
- Keep status colours semantically distinct from orange and never communicate status by colour alone.

## Dashboard protection

- Preserve the exact set of ten cinematic dashboard feature buttons.
- Do not flatten, replace, remove, reorder, or reduce their cinematic treatment.
- Harmonise only their surrounding typography, spacing, containers, and page background with the transferred design system.

## Scope and safeguards

- Apply the treatment across authenticated working screens, shared shell elements, dialogs, forms, navigation, and mobile layouts.
- Preserve specialist visual tools where their current presentation carries functional meaning.
- Keep report, print, and public-document surfaces independently light and legible rather than forcing the navy working-screen theme onto them.
- Check phone layouts at 375px, desktop layouts, keyboard navigation, contrast, text fitting, and reduced-motion behaviour.
- Make no changes to data, AI behaviour, permissions, reports, or business logic.

## Technical approach

- Port instructBrain’s semantic visual tokens and scoped surface architecture into instructSite’s existing Tailwind setup, adapting syntax to its current Tailwind version rather than changing frameworks.
- Map the existing orange (`#FF5E00`) into the product-accent token slot and derive hover, pressed, soft, text-safe, border, and glow roles from it.
- Update the shared button and interface primitives first, then remove screen-level styling conflicts and hardcoded visual values.
- Load Audiowide, Sora, and Manrope in the app document head and route all typography through semantic font roles.
- Preserve the existing cinematic button classes as an explicit exception and verify all ten remain rendered and interactive.
- Run the existing automated checks and visually inspect representative dashboard, form, dialog, mobile, and report screens.

## Delivery constraint

This chat can inspect instructSite but cannot write into that separate project. I will produce a tailored, implementation-ready transfer brief based on its actual files and current styles. Open instructSite in Lovable, attach that brief, and submit its included one-message instruction there; that project can then apply and verify the restyle directly.
