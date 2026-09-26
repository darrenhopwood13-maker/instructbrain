# Simplify the entry action and refresh app typography

## Goal
Make the app feel clearer and more distinctive: remove the duplicate-looking entry action, replace the standard Inter typography, and justify text consistently without damaging controls or phone readability.

## Changes
- Keep one **Sign in** action in the top navigation and remove the neighbouring **Start** button.
- Preserve account creation through the existing **Sign up** link on the sign-in screen and the purposeful “Start free” calls to action within the public page.
- Replace the app-wide type system with:
  - **Sora** for headings, section titles, and prominent figures.
  - **Manrope** for standard copy, forms, navigation, buttons, and report text.
  - Keep **Audiowide** only for the instructBrain wordmark.
- Load the new fonts once at the app level and update the existing font tokens so screens inherit the change consistently.
- Apply justified alignment wherever possible to paragraphs, descriptions, report narrative, guidance, and longer messages.
- Keep headings, wordmarks, buttons, links, labels, form fields, numerical data, short status text, and deliberately centred or right-aligned content in their functional alignment; these are not readable or usable when stretched.
- Use mobile-safe justification so narrow screens do not produce extreme word gaps, overflow, or broken labels.

## Verification
- Check the public header at 320px and desktop widths: one Sign in action, no crowding, and account creation still reachable.
- Check representative blue and white screens, authentication, report setup, review, and report preview for the new fonts and alignment.
- Confirm buttons, fields, tables, status labels, headings, and the wordmark retain clean alignment.
- Run the full automated checks and type checks, then inspect phone and desktop layouts for overflow and uneven text spacing.
