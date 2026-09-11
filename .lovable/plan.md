# Cleaner working-screen buttons and reliable PDF downloads

## What will change

### 1. Buttons on white working screens

Use the selected **Industrial Gloss** direction, with a lighter Instruct blue:

- **Primary action:** orange, glossy and raised, reserved for the one main action such as “Take photo” or “Download pack”. White label and icon, restrained depth, and a clear pressed state.
- **Selected choices:** lighter mid-navy with white text and a check/cross icon where useful. This makes the chosen Yes/No answer unambiguous without relying on colour alone.
- **Unselected choices:** white or very pale grey, dark text, a defined border and shallow neutral shadow. They will no longer look disabled or compete with the primary action.
- **Secondary actions:** pale neutral or outlined, with no orange edge or glow.
- Keep 44px minimum touch targets, strong keyboard focus, disabled states, and WCAG AA contrast.

The change will apply only inside the light working-screen scope: Custom Report capture/photos, review, and compliance registers. Dashboard and marketing buttons keep their existing branded treatment.

### 2. Fix report and compliance-pack downloads

The screenshot error is caused by the current PDF library being packaged incorrectly for the live server environment. It is not caused by the answers or photographs in the compliance check.

- Force the PDF library onto its self-contained ESM build so its older CommonJS helper cannot fail at runtime.
- Pin the server bundler to Node-compatible module interop for the Cloudflare runtime.
- Apply the repair centrally because full report PDFs and weekly compliance packs use the same PDF library.
- Keep PDF content, photographs, ordering, confidentiality rules, `not_assessed` handling and download filenames unchanged.
- Keep the existing plain-English failure notification if a genuine PDF-building problem occurs.

## Safety and verification

- Run the full test suite before and after implementation.
- Add a production-build regression check that imports and creates both a report PDF and a compliance-pack PDF.
- Run the production build, not only the development preview, because this failure appears in server packaging.
- Verify the selected/unselected/disabled button states at 375px with no horizontal overflow.
- Do not change Supabase, report data, AI analysis, report templates, compliance logic or the light-screen layout.
