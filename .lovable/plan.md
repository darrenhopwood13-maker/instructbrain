# Simplify report start and improve Property inventory photos

## Start report screen

- Remove the large **Start a report** heading and its introductory sentence.
- Move the **Report template** selector to the top of the page.
- Give the **Report template** label the established branded heading treatment, without redesigning the page.
- Remove the plan/usage box from this page. Plan information will remain available in Settings, where it already appears.
- Add one compact, single-line **Project** dropdown directly below the template selector.
- Show only active projects the signed-in user can access, with a clear **No project / standalone report** option.
- When a project is selected, create the report against that project immediately so its project directory, subcontractors and trades are available throughout review and distribution.
- Keep the report-template-specific AI brief controls collapsed and keep the existing photo-first start behaviour.

## Active projects

- Add a simple project lifecycle status: **Active**, **Completed**, or **Archived**, defaulting existing projects to Active.
- Add a project setting for changing that status.
- Use Active status for the new start-report dropdown; existing project lists and historical reports remain accessible.
- Apply the database change through the existing external Supabase setup only, with the current tenant security rules preserved.

## Organisation branding

- Remove cover-photo and logo controls from the report-start AI brief.
- Keep report branding in **Organisation settings**, supporting the existing multiple-organisation model so each organisation has its own name, logo and brand colour.
- Complete the organisation logo upload control so authorised organisation owners/admins can save or replace that organisation’s logo.
- Reports inherit the selected organisation’s branding; no large per-report branding box appears during capture.

## One quick photo-labelling flow for Property inventory

- All photographs are uploaded first, then labelled from the existing photo grid.
- Provide one fast, consistent control for assigning each uploaded photo as:
  - a room item;
  - one of up to three room overview photos;
  - a meter photo;
  - a keys photo;
  - an exterior photo; or
  - one of up to three title-page photos.
- Keep room assignment and photograph type visible together, with bulk selection where it saves repeated taps.
- Keep upload order and stable photo numbers unchanged.
- Room overview, meter, keys, exterior and title-page photos remain excluded from AI analysis. Only inventory item photos are analysed.
- Introduce this as a new version of the Property inventory definition so existing and issued reports do not change retrospectively.

## Property inventory title page

- Replace the single cover image with up to three user-selected title-page photographs.
- Display the selected photographs in one horizontal row beneath the title and property details in the on-screen report, shared-link report and landscape PDF.
- Use a tidy one-, two- or three-photo layout when fewer than three are selected.
- Do not automatically make the first upload a title-page photograph; selection belongs to the user after upload.

## Inventory review and shared links

- In the creator’s report review and the recipient’s shared-link view, show a small thumbnail beside each corresponding inventory item row.
- The thumbnail opens the full photograph for inspection without adding another navigation step.
- Keep the current room photograph sections available unless they would duplicate the same screen content unnecessarily.
- Keep downloaded PDFs in their current structure: text schedule rows followed by the existing full-size, numbered photograph pages. Do not add tiny row thumbnails to the PDF.

## Safety and verification

- Preserve stable references, upload order, full-resolution AI inputs, stored originals and the rule that AI failures become **Not assessed**, never a pass.
- Preserve all non-inventory report behaviour.
- Add tests for active-project filtering, project attachment, three title-page photos, role-based AI exclusion, item-to-thumbnail matching, shared-link visibility, unchanged PDF photo pages and existing report snapshots.
- Run the existing test suite before and after the work, then verify the start page and inventory review at phone width and inspect a generated landscape PDF visually.
