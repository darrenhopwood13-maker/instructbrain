# Restore orange button outlines on blue screens

## Goal
Give the navy/blue areas a consistent instructBrain accent without filling buttons orange. White working screens remain neutral and unchanged.

## Changes
- On navy/blue screens only, replace orange-filled buttons with transparent or navy buttons using readable light text and a soft orange outline.
- Apply that outline consistently to action buttons on blue screens, including the dashboard and blue navigation areas.
- Keep selected and active controls visibly stronger with a slightly heavier orange edge, without becoming solid orange.
- Leave white working screens—including report setup, capture, room organisation, review, Issue/Share, compliance, and admin—using their existing neutral button treatment.
- Keep pressed, hover, keyboard-focus, loading, and disabled states clear and accessible.
- Remove raised/3D treatment from the outlined buttons on blue screens so they stay soft and flat.
- Preserve semantic exceptions: destructive actions remain red, status controls retain their distinct status colours, and plain text links remain links.
- Check long labels and 44px minimum touch targets at 375px width.

## Verification
- Run the full automated checks and type checks.
- Inspect representative blue screens and navigation at phone and desktop sizes, plus white working screens to confirm they remain unchanged.
- Confirm blue-screen action buttons use orange outlines without orange fills, and that no labels overflow.
