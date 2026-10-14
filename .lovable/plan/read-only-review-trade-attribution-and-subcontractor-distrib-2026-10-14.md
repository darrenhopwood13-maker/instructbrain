# Read-only review: trade attribution and subcontractor distribution (CBRE prep)

Audit only. No code or data was changed. Approving this card does not start any building work; it only records the review.

## 1. What the recent improvements changed, and whether they hold up
- **One-press trade confirmation** (`bulk-trade.ts`, 80% threshold in `ai/config.ts`): offers only findings with no trade yet and an AI suggestion at 80% or above. A person still presses the button, and the AI suggestion is stored separately from the person's decision. **Sound.** Tests cover the threshold edges (0.79 / 0.8 / null).
- **Principal contractor as a standard trade**: added through new versions of the templates. Issued reports keep their frozen template. **Sound.**
- **Trade allocation switch** (`trade-switch.ts`, migration `20261008`): can be set for the whole account or for one report. When left blank, a report follows the account setting; the default is on. Switching it off can only remove trades, never add them to a template that has none. **Sound.**
- **Trade organiser** (`review/trade-allocation.ts`): only proposes changes. Both routes (pick a trade, or accept the AI suggestion) write to one field on the finding, `assigned_trade`. There is no second table that could disagree. **Sound.**
- **Field Accept-all**: confirms statuses only. It never touches trade suggestions or condition grades. **Consistent with the rules.**

## 2. How trades and subcontractors are stored today, and how the AI suggestion flows
```text
Template (frozen copy on each report) -> list of trades the template recognises
     |                                      (given to the AI in its instructions)
Finding: ai_suggested_trade + ai_trade_confidence + ai_trade_reasoning   (AI, never overwritten)
         assigned_trade + confirmed_by/at + due_date                     (the person's decision)
Project directory: one row = (trade text, company name, active) -> contacts (one primary)
Project: fallback recipient (name, email)
Send screen: groups findings by assigned_trade -> first active directory row whose trade
             matches exactly -> its primary contact's email -> a person presses Send
```
- The AI picks from the **template's** trade list. It never sees the project directory, so it cannot name a company. That is good for the rule that the AI only suggests.
- Confidential findings involving a person are blocked at database level (trigger `distributions_block_confidential`).

## 3. Multiple trades mapped to one subcontractor on a project
**Partly, and only by workaround.** There is no "company" record. One firm covering Roofing and Cladding means two directory rows, each repeating the company name and its own copy of the contacts. It works for sending: that firm gets two separate extracts. But editing a contact in one place does not update the other, and there is no single "everything for this firm" pack.

## 4. Risks and gaps
1. **Several subcontractors for the same trade**: nothing stops it (there is no uniqueness rule on project + trade). The send screen silently uses the **first** matching row (`distribution-data.ts` around line 258), so the second firm never receives anything, with no warning. **Highest risk.**
2. **Inconsistent letter-case matching**: the organiser and pickers treat "Roofer" and "roofer" as the same trade, but the send screen requires an exact match. A difference in capitals sends the extract to the fallback recipient instead. This is unverified on real data and needs a query to check.
3. **Free-text trades**: "Another trade…" lets a person type any name. That causes drift between the template list, the directory and assigned trades.
4. **No package boundaries or exclusions**: there is no record of which zone, level or scope a firm covers, and nothing stops a trade being confirmed to a firm excluded from that work.
5. **Unassigned and ambiguous findings** go to one fallback recipient per project. That is safe, but it has no triage owner and no visible "why unassigned" reason beyond the AI's reasoning.
6. **The one-press button uses the AI's suggestion even when that trade is not in the project directory**. The finding then lands on the "no contact" block at send time. That is safe (nothing sends), but it is a surprise.
7. **Escalation provider key (OpenAI) still fails**: uncertain findings get one attempt and then fall to "not assessed". That is safe, but it means more manual work.

## 5. Recommended project setup workflow (proposal, not built)
1. **Choose the project's trade list**: start from the template trades plus Principal contractor, then add or remove trades. This becomes the only list the pickers offer; free text becomes "add to project list".
2. **Add subcontractors (companies) once**, each with its own contacts.
3. **Map each trade to firms**, with:
   - one firm covering several trades: one company linked to many trades, sharing one set of contacts and an optional combined pack;
   - several firms for the same trade: each mapping carries a **package boundary** (zone, level, block or scope note). A finding in that trade needs a person to pick the package; there is never a silent first match;
   - **exclusions**: a mapping can list "not included" scope, and confirming a finding against an excluded package shows a warning;
   - a **required owner** (usually Principal contractor or the fallback recipient) for anything not mapped.
4. **At review**: the AI still only suggests a trade, never a company. The person confirms the trade, and the package if it is ambiguous. Confirming in one press stays limited to suggestions at 80% or above that are **in the project list and have exactly one package**.
5. **Unassigned or ambiguous findings** stay in a visible "needs a decision" group. They go to the fallback owner only when a person presses Send.
6. **Before sending**, a pre-flight check lists trades with no firm, firms with no email, and duplicate mappings. Every send is still a person pressing a button.

Rules that stay unchanged: AI trade attribution is only a suggestion; a person confirms every assignment; nothing sends automatically; confidential findings are excluded from every subcontractor send; issued reports keep their frozen template.

## Technical notes (for the later build, if wanted)
- New `project_subcontractors` table (a company with its contacts) and a `trade_package` table (project, trade, subcontractor, boundary, exclusions). Each would have security rules limiting it to the organisation, with checks on both reading and writing.
- An optional `findings.assigned_package_id` field, separate from `assigned_trade` and from the AI suggestion.
- The send screen would match trades regardless of letter-case and refuse ambiguous matches.
- Existing directory rows would be moved over by grouping on company name. That needs a migration, which is a separate decision to raise.
