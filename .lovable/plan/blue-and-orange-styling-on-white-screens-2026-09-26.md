# Blue-and-orange styling on white screens

## Goal
Make every white working screen feel consistently part of instructBrain by using the same restrained blue-and-orange visual language as the dashboard.

## Changes
- Give boxes, cards, form fields, menus, dialogs, and buttons on white screens a thin blue edge with a restrained orange accent/keyline.
- Keep surfaces white and readable; do not turn white working screens into dark dashboard screens.
- Restyle solid red action buttons on white screens as blue controls with an orange outline, matching the dashboard button style.
- Preserve destructive meaning through the button label, icon, accessible description, and a restrained red warning cue where needed—never through a solid red fill.
- Change the white-screen wordmark to orange “instruct” and blue “Brain”; remove the current red/dark appearance.
- Keep status colours distinct and labelled. Pass, fail, warning, and flag indicators will not be converted into ordinary brand-coloured controls.
- Preserve existing page layouts, navigation, wording, and behaviour.

## Accessibility and checks
- Keep controls at least 44px high and ensure long labels wrap comfortably at 375px.
- Check colour contrast, keyboard focus, hover, pressed, disabled, and destructive states.
- Inspect representative white screens including report setup, photos, review, issue/share, compliance, settings, and admin.
- Run the existing automated checks and confirm the preview builds cleanly.

## Technical details
- Update the white-screen theme tokens and shared control variants rather than adding page-by-page colour overrides.
- Scope the treatment to the white working surface so navy dashboard screens and the light legal/report document output retain their intended styling.
- Keep semantic status and report-paper styling isolated from the general control treatment.
