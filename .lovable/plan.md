# Fix sign-in emails (magic links, password resets, sign-up confirmations)

## The situation

The app already sends its own report and distribution emails through Resend — that key is saved and working. But **sign-in emails** (magic links, password resets, sign-up confirmations) are sent by Supabase itself, using Supabase's default shared mail service. That service is heavily rate-limited and unreliable — which is why people can get locked out of their own accounts.

The fix is to point Supabase's sign-in emails at your Resend account. Almost all of this lives in two dashboards — it is mostly a settings job, not a code change.

## What you need to do (about 10 minutes, no coding)

**1. Get your Resend API key**
- Open resend.com → API Keys, and copy the key (starts with `re_`).
- The app's saved copy is encrypted, so grab it from Resend directly. If you've lost it, create a new key there.

**2. Turn on custom email in Supabase**
- Open https://supabase.com/dashboard/project/krwphsejinmlwvtwugwk/auth/smtp
- Enable **Custom SMTP** and enter:
  - Host: `smtp.resend.com`
  - Port: `465`
  - Username: `resend`
  - Password: your Resend API key
  - Sender email: `noreply@instructbrain.com` (must be on your verified domain)
  - Sender name: `instructBrain`
- Save. Supabase will send a test email to confirm it works.

**3. Raise the email rate limit**
- Open https://supabase.com/dashboard/project/krwphsejinmlwvtwugwk/auth/rate-limits
- Raise **Rate limit for sending emails** from the default (2/hour) to something sensible like **30–60/hour** — enough for a team signing in and resetting passwords without inviting abuse.
- Save.

**4. Quick check**
- From the app, sign out and use "Email me a sign-in link" — the link should arrive within a minute.
- Try "Forgot password" too.

## What I will do (once you've confirmed it works)

1. Update the warning box on the organisation settings screen so it no longer shouts at you once sign-in email is healthy — it becomes a quiet "configured" note instead of a red warning.
2. Check the Supabase auth logs to confirm sign-in emails are going out cleanly.

## What does not change

- Report and distribution emails — already on Resend, untouched.
- No database changes, no code changes until you've done the dashboard steps.
- Nothing sends automatically — this is only about the sign-in emails arriving reliably.
