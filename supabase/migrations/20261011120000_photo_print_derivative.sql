-- A print-sized copy of each photograph for the report PDF.
--
-- The PDF used to embed the 480px display thumbnail, because embedding
-- full-resolution originals exhausted its byte budget and left the tail of a
-- long report with no photographs at all. 480px prints at about 87dpi and
-- reads as mush on a plate. This column points at a third object sized for the
-- paper (~1600px long edge, ~300KB) so a report is both sharp and sendable.
--
-- Nullable on purpose: photographs uploaded before this column existed, and any
-- upload whose browser could not decode the source, fall back to the original
-- and then to the thumbnail exactly as they do today. Nothing breaks, and the
-- reader is never told a sharp copy exists when one does not.
--
-- The AI path is untouched. Analysis reads storage_path, or the full-resolution
-- analysis derivative. Nothing printed is ever sent to a model.

alter table public.photos
  add column if not exists print_path text;

comment on column public.photos.print_path is
  'Storage object for the print-sized PDF copy (~1600px long edge). Display only: never read by an AI model. Null falls back to storage_path then thumbnail_path.';
