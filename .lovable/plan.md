# QA-2 sign-up sales flash + dashboard tidy

## Goal
Make the zero-risk trial the first thing a cold visitor reads on sign-up, and clean up the authenticated dashboard so the brand mark is larger and the "Start here" label is gone.

## Changes

### 1. Sign-up page (`src/routes/auth.sign-up.tsx`)
- Keep the existing H1 title: **"3 free reports — no card needed"**.
- Replace the current intro with warmer, outcome-led sales copy:
  > "Turn your site photos into client-ready construction reports in minutes. Start now — your first three are on us."
- Keep the email + password + confirm form exactly as-is, including strength/breach checks and confirm validation.
- Change the submit button copy from "Create account" to **"Start my 3 free reports"** (busy state: "Creating account…").
- Update page metadata (`head().meta`) so title/description match the offer:
  - Title: "3 free reports — instructBrain"
  - Description: "Turn site photos into client-ready construction reports. Start with 3 free reports, no card needed."

### 2. Authenticated dashboard (`src/routes/_authenticated/dashboard.tsx`)
- Remove the "Start here" eyebrow text above the action tiles.
- Keep the three action tiles and their behavior unchanged.

### 3. App shell logo (`src/components/app-shell.tsx`)
- Increase the top-bar instructBrain wordmark size from `text-base` to `text-xl` (or equivalent token) so it reads clearly as the brand mark.
- Maintain the existing `wordmark` font family and colour split (`instruct` orange, `Brain` foreground).
- Preserve layout: keep the logo left-aligned, keep the account/language controls right-aligned, and ensure no truncation or wrap at mobile widths.

## Out of scope
- No changes to auth logic, form validation, or password rules.
- No changes to dashboard routing, action-tile behavior, or navigation structure.
- No new pages or database changes.

## Verification
- Typecheck passes.
- Existing tests pass.
- Visual check: sign-up headline and button read as the offer; dashboard no longer shows "Start here"; logo is visibly larger but does not wrap on a 375px viewport.
