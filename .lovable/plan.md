# Two languages, kept apart: screen language and report language

Today there is only one language setting. The toggle in the top bar changes the
interface, and the report on screen quietly follows it. There is nothing that lets
you issue a report in a language different from the one you are working in, and
nothing about language is carried into the PDF or the email.

This splits them into two independent choices.

---

## 1. Screen language (unchanged behaviour, narrowed scope)

The control in the top bar stays exactly where it is and keeps doing what it does:
buttons, labels and guidance change language, remembered on the device.

Change: it stops driving the report content. From now on it translates the
interface only.

---

## 2. Report language (new)

A separate control lives in the report header, directly beside **Issue report** and
**Share/Send**, plainly labelled **Report language — English (record copy)**. It is a
visible control at the point of issue, never inside a menu, so choosing the language
is a deliberate act each time a report goes out.

- Chosen per report, saved with the report, and shown wherever the report is.
- Applies to the OUTPUT only: report preview, print view, the PDF attached to any
  send, and the covering email.
- **The working screens stay in your own language.** Photos, Review, capture fields,
  trade assignment and every button follow the top-bar screen language. Setting a
  report to issue in Polish does not flip the review screen into Polish mid-approval.
- Defaults to English. Changing it never rewrites the stored report.
- One press returns to English.


Two rules the document side must keep:

- The English text stays the stored record. A translation is a presentation of it.
- Every translated document carries a line saying which language it was produced
  in and that the English original is the version of record.

A trade extract or a close-out email sent to a subcontractor uses that same report
language, so a crew reading Polish gets the Polish sheet. Nothing sends by itself —
every send is still a person pressing a button.

---

## Technical notes

- `reports.output_language text not null default 'en'` (new migration), read and
  written through the existing report data layer. Report snapshots are untouched.
- `useReportTranslation` currently reads `language` from the i18n provider; it takes
  a language argument instead, and the report screens pass `report.outputLanguage`.
  The provider language no longer reaches report content.
- Server-side output — `document.server.ts` / `pdf.server.ts` /
  `pdf-attachment.server.ts` / `email.server.ts` — gains the same overlay: fetch the
  translation for the report's language via the existing `translateReport` path and
  apply `applyTranslation` before rendering. Caching already exists per report,
  language and source checksum in `finding_translations`, so a reissue costs nothing.
- The record-copy notice is rendered from a single shared helper so the preview,
  print route and PDF all state it identically. The `.paper` scope stays light.
- Email subject and body strings go through the same flat-string translation path
  already used for the interface, keyed by language, not by the sender's device.
- New control is a small component reused by the report workspace and the quick
  report issue step; 44px target, label plus language name, keyboard reachable.

## Order of work

1. Migration and data plumbing for `output_language`.
2. Detach report content from the interface toggle.
3. Report language control on the report and quick report screens.
4. Carry the language into PDF, print view and every email send.
5. Tests: the screen language never alters review or report content; a report set to
   a language renders and exports in it; English source is never overwritten; the
   record-copy notice is present on every translated output.

