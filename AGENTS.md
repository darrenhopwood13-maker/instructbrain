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
