-- ============================================================================
-- Database Migration: Piece Rate columns pr_rate_work and pr_rate_worker
-- ============================================================================
-- Renames pr_rate to pr_rate_work and adds pr_rate_worker.
-- Run before database_procedure_calculate_piece_rates.sql.
-- ============================================================================

-- Add new column pr_rate_worker (amount per piece based on worker skill, or daily rate for SL)
ALTER TABLE public.prdn_work_reporting
  ADD COLUMN IF NOT EXISTS pr_rate_worker NUMERIC(10,2) DEFAULT NULL;

-- Rename pr_rate to pr_rate_work (amount per piece based on work required skill; 0 for SL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'prdn_work_reporting' AND column_name = 'pr_rate'
  ) THEN
    ALTER TABLE public.prdn_work_reporting RENAME COLUMN pr_rate TO pr_rate_work;
  END IF;
END $$;

-- If pr_rate was already dropped or never existed, ensure pr_rate_work exists
ALTER TABLE public.prdn_work_reporting
  ADD COLUMN IF NOT EXISTS pr_rate_work NUMERIC(10,2) DEFAULT NULL;

COMMENT ON COLUMN public.prdn_work_reporting.pr_rate_work IS 'Piece rate amount per unit based on work required skill (sc_required). 0 for SL type.';
COMMENT ON COLUMN public.prdn_work_reporting.pr_rate_worker IS 'Piece rate amount per unit based on worker skill (PR), or daily rate salary/working_days (SL).';

-- Note: If you use archive.prdn_work_reporting (database_archive_function.sql or database_schema_archive.sql),
-- add columns pr_rate_work and pr_rate_worker there and update archive_work_order() INSERT to use them instead of pr_rate.

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
