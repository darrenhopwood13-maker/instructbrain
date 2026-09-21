# Lock Property inventory to landscape and user-selected photo order

## What will change

- Keep every page of the generated **Property inventory PDF** in landscape format: title page, index, room schedules, photograph appendix, and backing pages.
- Give every selected photograph its permanent sequence number as soon as the user selects the batch, before any upload starts.
- Preserve that same number through slow uploads and retries, so a failed or slower photograph cannot move to the end.
- Keep photographs, rooms, item rows, photo references, and rear appendix photographs ordered by that saved sequence.
- Keep the chosen title-page photograph separate from the ordering rule: selecting a different cover will not renumber the photographs.

## Expected result

If the user selects photographs in this order:

```text
1. Exterior
2. Living room overview 1
3. Living room overview 2
4. Living room overview 3
5. Living room item
6. Kitchen overview 1
7. Kitchen overview 2
8. Kitchen overview 3
9. Kitchen item
```

that exact order remains the source of truth even if photograph 9 finishes uploading before photograph 2. The landscape report will use the same order for room sections, table references, and rear photographs.

## Verification

- Add a test where concurrent uploads finish in reverse order and confirm their saved numbers still match selection order.
- Add a retry test proving a failed photograph keeps its original reserved number.
- Strengthen the PDF test to inspect **every** Property inventory page and confirm each page is landscape Letter, not only the first page.
- Verify room sections, table items, and appendix photographs follow the persisted sequence.
- Run the full test suite before and after the change, as required by the project rules.

## Scope protection

- This change is limited to Property inventory output and the shared upload numbering safeguard.
- It will not change AI completion order, stable finding references, other report layouts, issued report snapshots, or the external Supabase connection.
- It will not add drag-and-drop ordering; this fix preserves the order originally selected by the user.
