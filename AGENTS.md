<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Mark only browser-created camera files as app-owned so snapshotting skips their redundant memory copy; external camera and gallery files must always retain the Android-safe snapshot path.
- Apply typography and borders by semantic role: centre content headings, justify narrative copy only where readable, and preserve functional alignment for controls, tables, metadata, and status labels so mobile and report layouts remain scannable.
- Keep Property inventory photo roles and their limits in the versioned survey definition; shared capture and report code must interpret those roles generically so issued snapshots remain unchanged.
- Scope the feature-overview treatment through `.work-surface`, with shared navy header/mobile navigation chrome and the current product accent; navy console screens and `.paper` report output remain independently styled.
- Use the Instruct family accent architecture: shared navy surfaces, white “instruct”, product-coloured name, and one semantic per-product accent token family; instructBrain uses Laser Green #57FF00. This lets future Instruct apps change one accent slot without restyling components.
