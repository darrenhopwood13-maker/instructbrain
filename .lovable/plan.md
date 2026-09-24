# Fix the reset link landing page + brand the sign-in emails

## Problem 1 — the reset link opens the QR code screen, not the password form

**What's happening:** the password-reset email drops you on the app's home page carrying your sign-in token. The home page sees a signed-in visitor and sends you straight to the dashboard — which is where the QR card lives. You never reach the "set a new password" screen.

**Fix (code change, one file):** the home page will check the link before redirecting. If the link carries a password-reset token, you go to the "Set a new password" screen. If it carries a sign-in token, you go to the sign-in callback. Only then does a signed-in visitor get sent to the dashboard. Works no matter how the email provider builds the link.

## Problem 2 — the sign-in emails are not instructBrain branded

Supabase sends these emails from its own templates, and they can only be changed in the Supabase dashboard — I can't reach them from the code. What I can do is everything except the final paste:

**I will create:** four ready-to-paste branded email templates (magic link, password reset, sign-up confirmation, change of email), matching the app — navy header with the instructBrain wordmark, white body, orange button, and the discreet "instructBrain — An instructSite Company" footer. Delivered as files you can open, copy, and paste.

**You then paste them (about 5 minutes):**
1. Open https://supabase.com/dashboard/project/krwphsejinmlwvtwugwk/auth/templates
2. For each of the four templates, replace the body with the matching branded version and save.
3. The button link in each template (`{{ .ConfirmationURL }}`) is already in place — don't change that line.

**Also while you're in the dashboard (fixes the root cause properly):**
- Open https://supabase.com/dashboard/project/krwphsejinmlwvtwugwk/auth/url-configuration
- Add `https://instructbrain.com/auth/reset-password` and `https://instructbrain.com/auth/callback` to the allowed redirect URLs. The code fix above covers you either way, but this makes the emails land on the right screen directly.

## Checks afterwards
- Request a password reset from the sign-in screen — the email should arrive branded, and the link should open the "Set a new password" screen.
- Request a magic link — same branding, link signs you in.
- Run the full test suite after the code change.
