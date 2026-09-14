-- Archiving for completed compliance registers (2026-09-14)
-- Lets owners archive a locked register (one-way, evidence preserved) and
-- lets organisation deletion finish cleanly instead of being hard-blocked.
-- A locked, un-archived register remains immutable and undeletable.

ALTER TABLE public.compliance_runs ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Helper: is the run archived?
CREATE OR REPLACE FUNCTION public.compliance_run_is_archived(_run_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.compliance_runs r
    WHERE r.id = _run_id AND r.archived_at IS NOT NULL
  )
$$;

REVOKE EXECUTE ON FUNCTION public.compliance_run_is_archived(uuid) FROM anon;

-- Runs guard: locked runs stay immutable, EXCEPT one-way archive (sets
-- archived_at and nothing else). Once archived, the run may be deleted
-- (final purge) or detached from its report (report_id -> null), nothing
-- else may change.
CREATE OR REPLACE FUNCTION public.compliance_runs_locked_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.locked_at IS NOT NULL AND OLD.archived_at IS NULL THEN
      RAISE EXCEPTION 'A completed register cannot be deleted. Archive it first.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.locked_at IS NOT NULL THEN
    -- One-way archive: only archived_at may change (from NULL to a timestamp).
    IF OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL
       AND to_jsonb(OLD) - 'archived_at' = to_jsonb(NEW) - 'archived_at' THEN
      RETURN NEW;
    END IF;
    -- Archived runs may be detached from their report; nothing else changes.
    IF OLD.archived_at IS NOT NULL AND NEW.report_id IS NULL
       AND OLD.report_id IS NOT NULL
       AND to_jsonb(OLD) - 'report_id' = to_jsonb(NEW) - 'report_id' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'This register is complete and locked. Record the correction in the next run.';
  END IF;
  RETURN NEW;
END;
$$;

-- Entries guard: only blocks deletion when the parent run is locked AND not
-- archived (so cascading cleanup of an archived register works).
CREATE OR REPLACE FUNCTION public.compliance_entries_locked_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public.compliance_run_is_locked(OLD.run_id)
       AND NOT public.compliance_run_is_archived(OLD.run_id) THEN
      RAISE EXCEPTION 'This register is complete and locked. Record the correction in the next run.';
    END IF;
    RETURN OLD;
  END IF;

  IF public.compliance_run_is_locked(NEW.run_id)
     AND NOT public.compliance_run_is_archived(NEW.run_id)
     AND (TG_OP = 'INSERT' OR public.compliance_run_is_locked(OLD.run_id)) THEN
    RAISE EXCEPTION 'This register is complete and locked. Record the correction in the next run.';
  END IF;
  RETURN NEW;
END;
$$;
