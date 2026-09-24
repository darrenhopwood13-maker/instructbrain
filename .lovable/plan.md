# Whole-app manual test plan

A scripted walk-through you can run on the phone and the laptop. Work top to bottom: each task says what to do and exactly what you should see. Nothing here changes the app — if any expected result fails, stop and tell me the task number and what you saw.

## 1. Accounts and first run
1. **Sign up** with a new email and password. Expect: a confirmation email, then sign-in works; weak passwords and breached passwords are refused with a plain-English message.
2. **Magic link** sign-in: request a one-time link, open it on the phone. Expect: you land signed-in without typing a password.
3. **Forgot password** returns a reset email; the new password must differ from the old one.
4. **Create organisation**: first sign-in offers to create one; you become its owner.
5. **Invite a teammate** from the directory with a role (e.g. surveyor). Expect: accept-invite email, no password generated anywhere, the invitee sees only your organisation's data.
6. **Sign out everywhere**: sign out on one device; the other device's session ends too.

## 2. Dashboard hub (desktop)
1. Dashboard opens on the **Sent for review** queue, oldest first, with outstanding counts that match Review.
2. **QR card** sits at the foot, on a white tile with near-black code — scan it with a phone camera; it must be readable and open the field app.
3. One **Start a report** tile and one **Compliance reports** tile. No template/mode picker on the dashboard.
4. Reports list: selecting rows shows a **neutral** selection bar (not red-edged).

## 3. Field cockpit (phone)
1. Open the app on the phone: a bar offers to **add to home screen**; accept it. It then opens as its own app straight onto "On site".
2. The screen shows one big orange **Start a report**, your open reports beneath, and a link to the full dashboard.
3. **Send to the dashboard** on an open report asks for confirmation first; after sending it disappears from the button list and the report appears in the desktop site queue. Nothing is emailed or issued by this action.

## 4. Starting a report — one path for every type
1. **Start a report** from either surface opens the same screen: template explained once ("The template sets the instructions the AI works to."), nothing else.
2. Pick a template. The explanation disappears once the template is known.
3. **Options** is a single full-width button whose label shows preset · tone · special request · project. Inside: **How it reads** (preset, tone, report type, special request, saved templates) and **What it includes** (include-fix, include-severity, advisory footer, findings-per-photo, header fields, branding, optional project).
4. **Title-page photo and logo**: upload a dedicated cover photo at creation, or later tap "Use as title page" on any uploaded photo; the saved organisation logo is used by default and can be overridden per report. Cover photos are never analysed.
5. Save a **named template** with your settings; start a new report and load it — every toggle comes back as saved.
6. Core template parameters cannot be changed; only tone, report type, include toggles and special requests are editable.

## 5. Photo upload
1. Upload 12+ photos in a deliberate order (photo A first, photo Z last). Expect: they appear in **selection order**, not upload-completion order, and keep that order through slow uploads and retries.
2. On the phone, **Choose from Photos** opens the phone's own picker (camera roll, Google Photos, Drive).
3. **Signal resilience**: turn on airplane mode mid-upload, turn it off. Expect: a plain-English message, held photographs, and a **Try again** that completes the batch in the original order.
4. A report row is created on the **first photograph**, not on arrival at the screen.

## 6. Rooms (Property inventory only)
1. **Create rooms one by one** (Porch, Hallway, Kitchen…), multi-select photos, "Add N here", pick **up to three room overview photos** per room — these are never analysed.
2. **Suggest rooms**: press it, review the proposal — rooms in photo order, three overviews proposed, uncertain photos in "Not sure", a short reason per room. Change assignments in the dropdowns, untick any room, then **Apply**. Expect: nothing written until Apply; a failed run leaves your manual rooms untouched; every room afterwards behaves like a normal room.
3. Move a photo to a different room after analysis: its row must move with it, references stay stable.

## 7. Review and analysis
1. Run analysis on a multi-photo report. Expect: every photo gets a status; any AI failure, timeout or low-confidence result shows as **Not assessed** with a text label — never silently passed.
2. Press **"Take me to the first not assessed image"** — it must jump, focus and scroll to that photo, in every report type.
3. **Keyboard-only review**: J/K to move, status keys, Enter to confirm — complete a 20-finding session without touching the mouse. Shortcuts live behind a dialog, not on screen.
4. **Trade confirmation**: findings with an AI trade suggestion ≥80% confident arrive pre-confirmed; below 80% they are confirmed to the principal contractor. Change one manually — it saves and the AI suggestion stays visible alongside your decision.
5. Status colours always carry a **text label**; the four statuses stay distinguishable.

## 8. Generate and check every report type
For each: preview on screen, then download the PDF.
1. **Site condition / snagging** — grouped sections, severity and fixes where enabled.
2. **Electrical, Mechanical & HVAC, Fit-out, Damp** — tone rules applied, wording matches the chosen tone.
3. **Photo condition record** — title page, one photo per finding, condition text only; no fix, remedial, severity or deadline fields anywhere.
4. **Identifier/custom type** — plain descriptions, no damage judgement, no repairs.
5. **Special requests** text shapes the output; over the character limit it is capped with a message.
6. **Your branding**: your organisation name and logo prominent; the product credit is one small muted line at the **foot** of each page — nothing across the top, no "instructSite family" wording anywhere.

## 9. Property inventory output
1. Cover = your chosen exterior/title photo; index lists every room; all pages **landscape**.
2. Each room renders: title → three overview photos → four-column table (Item / Description / Condition / Check Out Comment) → that room's numbered photos beneath, each linked to its row.
3. Rear appendix repeats every photo **numbered to match the items**, in upload order.
4. Backing pages (guidance, check-in/out, schedule, keys) present and aligned to the same margins.
5. **Shared link** version: also landscape, same layout, honours the report's issue language.

## 10. Weekly compliance register
1. Create a register; complete the six ordered checks in order; mark one **N/A** explicitly and one non-compliant with an action.
2. **Close out** the action; try editing a completed week — it must be locked.
3. Rolling **six-week history** view; download the weekly pack and the six-week pack — both PDFs open correctly.

## 11. Issue, distribute and share
1. **Issue** a report with any Not assessed findings outstanding — it must block with a plain reason.
2. Issue cleanly, then: **Download PDF** on desktop opens a Save-as window; on the phone, "Share / Save to…" opens the device share sheet; cancelled saves are silent (no error).
3. **Share link**: opens without an account, landscape for inventory, correct language, your branding.
4. **Trade access link**: a subcontractor sees only their own findings; any confidential (involves-person) finding is absent — check at the link, not just in the app.
5. Confirm **nothing sends automatically**: every send required a button press by you.

## 12. Language
1. Toggle the **screen language** — the interface switches; the report keeps its own language setting.
2. Change a report's **issue language**, re-issue, open the share link — the shared copy follows the report's language, not the reader's screen language.

## 13. Settings, directory and admin
1. **Account**: change password (re-checks the current one first); change email if offered.
2. **Organisation settings**: rename, plan/allowance shown; Organisation lives in the Account menu, not the bottom bar.
3. **Directory**: add/edit members and roles; only supervisor-and-above can see confidential findings (test with a surveyor account).
4. **Founder/admin** (darrenhopwood13@gmail.com): admin menu present, unlimited reports, no photo cap.

## 14. Mobile, accessibility and polish
1. At 375px: no horizontal overflow anywhere, including with the keyboard open; primary action in the lower third; all touch targets comfortable with gloves.
2. Bottom bar: Dashboard, Projects, On site, Directory. Account menu holds Account, Organisation, Admin (if founder), Sign out.
3. Keyboard reach: every dialog and menu fully operable without a mouse; screen-reader labels on the wordmark, tabs and primary buttons.
4. No native alert/confirm/prompt anywhere; no dark mode; working screens light, dashboard/landing navy with the blueprint grid.

## What to record
For each task number: pass, or fail plus what you saw and on which device. I'll fix any failures before anything else.
