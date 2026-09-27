# Match white-screen orange to the dashboard

## Goal
Use the dashboard’s exact brand orange, **#FF5E00**, everywhere orange appears on white working screens.

## Changes
- Remove the darker white-screen orange override and inherit the established dashboard brand-orange token.
- Apply the matching orange consistently to primary buttons, outlines, separator stripes, active indicators, icons, small emphasis details, and the orange half of the instructBrain wordmark.
- Keep suitable lighter/deeper brand-orange variants only for hover, focus, and contrast states; the normal visible orange remains #FF5E00.
- Include menus and dialogs opened from white screens so they do not retain the mismatched shade.
- Leave navy dashboard screens, report/PDF output, status colours, layouts, wording, and behaviour unchanged.

## Verification
- Compare the dashboard and white-screen accents side by side at phone width.
- Check text contrast, focus visibility, 44px touch targets, and button-label wrapping.
- Run the existing automated checks and confirm the preview builds successfully.

## Technical note
The global dashboard token is documented as instructSite orange `#FF5E00` and is represented by `oklch(0.686 0.21 41.1)`. The white working-screen scope currently replaces it with `oklch(0.52 0.19 38.2)`, which accounts for the darker mismatch.
