# Continue the approved Property inventory implementation

I will stop the new feature plan and return to the Property inventory work that was already underway.

## Finish the current inventory report output

- Keep Property inventory as a portrait, phone-first capture and review flow.
- Generate the final Property inventory PDF in the landscape schedule format from the uploaded sample.
- Keep the exterior/title-page photograph separate from AI analysis.
- Keep the first three room overview photographs per room separate from AI analysis.
- Analyse only the inventory item/detail photographs.
- Force Property inventory item/detail photographs to produce one table row per photograph.
- Put the three room overview photographs above that room's four-column table.
- Add the numerical photo reference into each item row.
- Add rear photograph pages showing the inventory item/detail photos in upload order.
- Add backing/guidance pages in the same style as the sample report, branded to instructSite/instructBrain.

## Finish the multi-room capture flow

The user should be able to capture one report like this:

```text
Exterior/title-page photo

Living room
  3 room overview photos
  item/detail photos

Kitchen
  3 room overview photos
  item/detail photos

Dining room
  3 room overview photos
  item/detail photos
```

The saved upload order remains the source of truth for room order, item order, and rear photo appendix order.

## Complete the work already started

- Finish the definition update for the new Property inventory version.
- Finish the landscape PDF branch with item/photo references, rear appendix pages, and backing pages.
- Finish the on-screen inventory report preview so it matches the same structure.
- Tighten the photo upload controls so the current room and photo type are clear.
- Add or update tests for:
  - multiple rooms in one inventory report;
  - first/exterior photo excluded from AI;
  - three room overview photos excluded from AI;
  - one row per item/detail photo;
  - photo references matching table rows and appendix photos;
  - rear appendix order matching upload order;
  - non-inventory reports staying unchanged.

## What this will not include yet

I will not add the later new features from the rejected plan yet:

- AI-written room notes or wording suggestions;
- a new pre-export checklist;
- full drag-and-drop ordering.

Those can be planned and built after this existing inventory report work is finished.

## What this will not affect

This remains limited to **Property inventory** reports.

It will not change:

- Snagging reports;
- Site condition reports;
- Weatherproofing reports;
- Electrical, mechanical, damp, fit-out or basic photo reports;
- Weekly Compliance Registers;
- existing issued report snapshots;
- full-resolution image handling for AI;
- stable finding references;
- the rule that AI errors become **Not assessed**, never a pass;
- distribution rules or automatic sending;
- the external Supabase setup.
