# Tidy up the 28 database security warnings

## What the warnings are
- **27 "can execute a privileged function" warnings.** Some behind-the-scenes database functions run with elevated rights, and anyone (4 of them) or any signed-in user (23) is allowed to call them directly.
- **1 "leaked password protection is off" warning.** Supabase can refuse passwords that have turned up in known data breaches. It's currently switched off.

## What I'll do
1. **Lock down the automatic checks.** These are the functions that run by themselves when data changes: the locked-register guards, the issued-report lock, the confidential-finding block, the reference lock, the photo and report limits, and the creation log. No one needs to call them directly, so direct access comes off for everyone. They keep working exactly as they do now.
2. **Remove public (signed-out) access** from every privileged function. Shared links and trade links already go through the app's server, not these functions.
3. **Keep signed-in access only where the security rules need it.** Membership and role checks, "which organisation owns this", platform admin, next finding reference and create organisation stay available to signed-in users. The access rules call these on every read and write, so removing them would lock everyone out. They only answer about the person asking, so they're safe. After step 3 these warnings will still show; I'll mark each one as reviewed with the reason.
4. **Leaked password protection:** this is a switch in your Supabase dashboard, not something I can change from here. I'll give you the exact steps: Authentication, then Sign in / Providers, then Email, then "Prevent use of leaked passwords".

## What does not change
- Every screen, report, register, share link and send works as it does now.
- Confidential findings are still blocked from distribution, issued reports stay locked, and reference numbers stay fixed.

## Technical notes
- One migration on the external Supabase project: `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` on the trigger functions (`*_guard`, `*_locked_when_issued`, `distributions_block_confidential`, `findings_confidentiality_transition`, `findings_ref_immutable`, `photos_enforce_cap`, `reports_enforce_allowance`, `reports_record_creation`, `report_shares_expiry_rules`, `organisations_apply_plan_defaults`, `rls_auto_enable`, `set_updated_at`). Triggers don't need EXECUTE grants to fire.
- `REVOKE ... FROM PUBLIC, anon` on the policy helpers, keep `GRANT EXECUTE ... TO authenticated, service_role`.
- Before revoking anything, check that no anon policy references these helpers. If one does, that helper keeps its anon grant.
- Re-run the linter and the full suite afterwards. Mark the remaining helper warnings as reviewed, with the reason.
