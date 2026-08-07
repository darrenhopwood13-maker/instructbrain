# Fix the Directory dead end

## What's actually happening

The full directory editor already exists and works — adding trades, companies, contacts, primary contact, fallback recipient, CSV import, templates, copy from another project. It lives on the project directory page and is only reachable from a single link inside a project page.

The "Directory" item in the main navigation points somewhere else: a settings screen that lists contacts read-only, with an "Add contact" button that is permanently disabled. That is the screen you found, which is why the feature looks broken.

## The fix

Rewire the Directory navigation item so it leads to somewhere you can actually work.

1. **Settings > Directory becomes a hub, not a dead end.**
   - Lists your projects, each with a count of trades and contacts recorded.
   - Each row opens that project's directory editor (the working screen).
   - Keeps the organisation-wide contact list below as reference, grouped by project.
   - Removes the disabled "Add contact" button — contacts belong to a project, so the action is "Open project directory" instead.
   - Empty state when there are no projects points at creating a project first.

2. **Make the entry point obvious from a project.**
   - Promote the existing directory link on the project page into a clearly labelled card showing trades recorded, contacts recorded, and whether a fallback recipient is set (distribution is blocked without one).

3. **No changes to the directory editor itself** — it already does everything: entries, contacts, primary contact, fallback recipient, CSV import, templates, copy from another project.

## Technical notes

- `src/routes/_authenticated/settings.directory.tsx`: replace the read-only table with a project list built from the existing projects query plus per-project directory counts; link each to `/projects/$id/directory`.
- `src/routes/_authenticated/projects.$id.tsx`: replace the plain link with a summary card reading `projectDirectoryQuery` and `fallbackRecipientQuery`.
- No schema, RLS or data-layer changes. `directory-data.ts` stays as is.
