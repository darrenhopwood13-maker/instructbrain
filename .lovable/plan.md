# Restore orange button outlines

## Goal
Give the app a consistent instructBrain accent without filling buttons orange: buttons stay light and receive a soft orange outline.

## Changes
- Replace solid orange primary buttons on light working screens with white buttons, dark readable text, an orange border, and an orange icon where present.
- Apply the same outline treatment consistently to normal action buttons, including capture, report progression, room organisation, review, sharing, and setup controls.
- Keep selected and active controls visibly stronger with a slightly heavier orange edge or pale orange background, without becoming solid orange.
- Keep pressed, hover, keyboard-focus, loading, and disabled states clear and accessible.
- Remove the remaining raised/3D orange override from light working screens so buttons stay soft and flat.
- Preserve semantic exceptions: destructive actions remain red, status controls retain their distinct status colours, and plain text links remain links.
- Check long labels and 44px minimum touch targets at 375px width.

## Verification
- Run the full automated checks and type checks.
- Inspect representative light screens at phone and desktop sizes: report setup, photo capture, room organiser, review, Issue/Share, compliance, and admin.
- Confirm there is no solid orange button fill on light working screens and no text overflow.
