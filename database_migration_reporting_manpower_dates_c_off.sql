-- =============================================================================
-- prdn_reporting_manpower: align with prdn_planning_manpower
--   reporting_date -> reporting_from_date
--   reporting_to_date (backfill = reporting_from_date, then NOT NULL)
--   c_off_value (0.0 default, NOT NULL, CHECK)
--   c_off_from_date, c_off_from_time, c_off_to_date, c_off_to_time (nullable)
-- =============================================================================
-- Run after backup. Regenerate Supabase types after apply.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'prdn_reporting_manpower'
      AND c.column_name = 'reporting_date'
  ) THEN
    RAISE EXCEPTION
      'Column public.prdn_reporting_manpower.reporting_date not found. '
      'If this migration already ran, skip it.';
  END IF;
END $$;

ALTER TABLE public.prdn_reporting_manpower
  RENAME COLUMN reporting_date TO reporting_from_date;

ALTER TABLE public.prdn_reporting_manpower
  ADD COLUMN IF NOT EXISTS reporting_to_date date;

UPDATE public.prdn_reporting_manpower
SET reporting_to_date = reporting_from_date
WHERE reporting_to_date IS NULL;

ALTER TABLE public.prdn_reporting_manpower
  ALTER COLUMN reporting_to_date SET NOT NULL;

ALTER TABLE public.prdn_reporting_manpower
  ADD COLUMN IF NOT EXISTS c_off_value numeric(2, 1);

UPDATE public.prdn_reporting_manpower
SET c_off_value = 0.0
WHERE c_off_value IS NULL;

ALTER TABLE public.prdn_reporting_manpower
  ALTER COLUMN c_off_value SET DEFAULT 0.0,
  ALTER COLUMN c_off_value SET NOT NULL;

ALTER TABLE public.prdn_reporting_manpower
  DROP CONSTRAINT IF EXISTS chk_prdn_reporting_manpower_c_off_value;

ALTER TABLE public.prdn_reporting_manpower
  ADD CONSTRAINT chk_prdn_reporting_manpower_c_off_value
  CHECK (c_off_value IN (0.0, 0.5, 1.0, 1.5));

ALTER TABLE public.prdn_reporting_manpower
  ADD COLUMN IF NOT EXISTS c_off_from_date date,
  ADD COLUMN IF NOT EXISTS c_off_from_time time without time zone,
  ADD COLUMN IF NOT EXISTS c_off_to_date date,
  ADD COLUMN IF NOT EXISTS c_off_to_time time without time zone;

COMMIT;

-- Optional: recreate indexes with clearer names ( btree columns auto-follow RENAME in PG )
-- CREATE INDEX IF NOT EXISTS idx_reporting_manpower_stage_shift_from_date
--   ON public.prdn_reporting_manpower (stage_code, shift_code, reporting_from_date)
--   WHERE is_deleted = false;
