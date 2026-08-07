# instructBrain

IMPORTANT — READ THIS FIRST: Do NOT connect this project to Lovable Cloud. Do not provision or enable the built-in backend. This project will be connected to my own external Supabase project shortly, and once Lovable Cloud attaches there is no way to switch. Build this first version using local React state and mock data only. No database, no auth backend, no edge functions in this step.

Build the front-end shell for "instructBrain" — a UK construction site reporting application. Photos in, client-ready report out.

WHAT IT DOES (context only, do not build the functionality yet): a surveyor or site manager uploads site photographs, an AI drafts findings against a chosen survey type, a human reviews and confirms them, and the app issues a professional PDF report and distributes per-trade extracts to subcontractors.

BUILD IN THIS STEP — navigation shell with real, considered empty states and mock data:
- /  — project list. Cards showing project name, reference, client, and counts of open reports.
- /projects/:id — project dashboard. Report list, plus a placeholder panel for overdue open items.
- /reports/:id — report workspace. Tabbed shell: Photos, Review, Output. Empty states in each.
- /settings/organisation — organisation name, logo upload placeholder, brand colour.
- /settings/directory — project directory placeholder: trade, company, contacts table.
- Auth screens (sign in, accept invite) as UI only, not wired to any backend.

DESIGN — this matters as much as the structure:
This product sits in the Instruct suite alongside instructSite and must read as the same family — same palette, same typographic voice, same component language. It does NOT copy instructSite's surface treatment. instructSite is a dark operational console; instructBrain is a LIGHT, editorial, document-led application, because its output is a legal-adjacent document issued to tier-1 construction clients and the interface must look like something a chartered surveyor is comfortable being seen using in front of one.

- Palette: blue, purple and white. Blue is the primary structural colour. Purple is the accent, reserved for primary actions, emphasis, and anything AI-generated. White and near-white are the working surfaces.
- Set the palette up as CSS custom properties / Tailwind theme tokens from the very first commit: brand-blue, brand-purple, surface, surface-raised, border, plus semantic tokens for pass, fail, warn and flag. Never hardcode a hex value in a component.
- Hierarchy comes from surface elevation and spacing, not from colour blocking.
- Professional and restrained. Editorial, high contrast, generous white space. NO decorative mascots, cartoon characters, floating orbs, gradient blobs or animated ornament of any kind.
- Do NOT build a dark mode. The document preview and the app surface must stay visually consistent.
- Mobile-first and genuinely usable one-handed — the primary user is on site, on a phone, often in bad light and wearing gloves.
- Real components for all dialogs and notifications. Never use native alert(), confirm() or prompt().
- WCAG 2.1 AA. All controls keyboard reachable and screen-reader labelled. Status is never communicated by colour alone — always a colour plus a text label.
- Design the findings list for keyboard-first review: a 150-item session must be completable without a mouse. Build the keyboard affordances into the layout now even though the data is mocked.

Stack: React + TypeScript + Vite + Tailwind. Nothing else in this step.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://instructbrain.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f09eb546-1f32-431d-b95e-3b83983c044f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
