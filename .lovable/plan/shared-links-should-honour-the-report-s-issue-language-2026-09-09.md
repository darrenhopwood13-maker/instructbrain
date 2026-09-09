# Shared links should honour the report's issue language

When a report is set to issue in another language, the PDF and the covering email
already come out in that language. The **share link** does not: the page a client
opens still shows the English text.

Cause, confirmed in the code: the public share endpoint reads the report and its
findings straight from the database and returns them as they are stored — English.
It never asks for the report's chosen language, and no translation is applied
before the page is built. The same is true of the subcontractor trade link.

## What changes

- Opening a share link for a report issued in, say, Polish shows the report in
  Polish: title, subtitle, scope, methodology, summary, and every finding's text,
  remedial text, likely cause and regulatory reference.
- The page carries the same record-copy line the PDF carries — which language it
  was produced in, and that the English original is the version of record.
- A subcontractor trade link behaves the same way, so a crew reading Polish gets
  the Polish sheet.
- If the translation cannot be produced for any reason, the English text is shown
  rather than nothing.
- The stored English text is never overwritten. Nothing about issuing or sending
  changes; every send is still a person pressing a button.

## Technical notes

- `src/routes/api/public/shared-report.$token.ts`: add `output_language` to the
  report select; after loading findings, call `reportTranslationStrings(admin,
  reportId, output_language)` and overlay the returned strings onto the report and
  finding rows before returning JSON. Cached per report, language and source
  checksum in `finding_translations`, so a repeat open costs nothing.
- `src/lib/report/shared-document.ts` already maps `output_language` into
  `report.outputLanguage`, so `report-document-view.tsx` will render the
  record-copy notice once the field is present in the payload.
- `src/routes/api/public/trade-access.$token.ts`: same overlay, applied to the
  finding fields it returns (it selects `finding_text` / `remedial_text` at
  line 95 and maps them at line 220), plus `output_language` on its report read.
- Overlay uses the existing key scheme (`report.title`, `<findingId>.finding_text`,
  …) rather than a new one; no change to `applyTranslation` or the translation
  cache.
- Tests: a share payload for a non-English report returns translated finding text
  and keeps the English rows untouched in the database; an English report is
  unchanged; a translation failure falls back to English.
