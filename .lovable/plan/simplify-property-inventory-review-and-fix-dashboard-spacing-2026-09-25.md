# Simplify property inventory review and fix dashboard spacing

## What will change

### Property inventory review
- Keep each item’s **Description** visible directly in the review card, but remove its repeated **Open description** action.
- Remove the **Remedial action** card entirely from Property inventory reports, because that template records condition only and already instructs the AI not to produce remedial work.
- Detect this through the report layout stored in the template snapshot, so the shared review screen does not hardcode property-inventory vocabulary.
- Leave the pop-out controls and remedial fields unchanged for report templates that genuinely need them.

### Dashboard on phones
- Rebuild the **Recent reports / count / All reports** heading as a narrow-screen grid so the title and count stay together and the link has its own clear space.
- Keep the link’s 44px touch target and prevent text collision or horizontal overflow at 320px and 375px.
- Preserve the existing desktop arrangement and dashboard behaviour.

## Validation
- Run the full existing test suite before and after the change.
- Add focused coverage for the definition-driven inventory review behaviour.
- Check the dashboard and a Property inventory review at 320px and 375px, including text wrapping, alignment, touch targets and horizontal overflow.
- Confirm another report template still shows its normal description/remedial controls.

## Technical scope
- Presentation and shared definition-reader changes only.
- No database migration, report data change, AI prompt change, PDF change or existing-report conversion.
