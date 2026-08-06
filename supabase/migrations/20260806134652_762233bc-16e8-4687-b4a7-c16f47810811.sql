ALTER TABLE public.photos
  ADD COLUMN IF NOT EXISTS capture_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS checksum text;

CREATE UNIQUE INDEX IF NOT EXISTS photos_report_storage_path_key
  ON public.photos (report_id, storage_path);

CREATE INDEX IF NOT EXISTS photos_report_sequence_idx
  ON public.photos (report_id, sequence);