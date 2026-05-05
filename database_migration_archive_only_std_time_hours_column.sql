-- =============================================================================
-- Add std_time_hours to existing archive.prdn_work_planning (data-preserving)
-- =============================================================================
-- Run on databases where archive.prdn_work_planning already exists and must not
-- be dropped/recreated. Uses ADD COLUMN IF NOT EXISTS — nullable, no default,
-- existing rows get NULL until new archives populate the column.
--
-- After this, deploy an updated public.archive_work_order() that copies
-- public.prdn_work_planning.std_time_hours into archive (see
-- database_migration_archive_std_time_hours.sql or database_archive_function.sql).
--
-- If public.prdn_work_planning does not yet have std_time_hours, add it first:
--   ALTER TABLE public.prdn_work_planning
--     ADD COLUMN IF NOT EXISTS std_time_hours numeric;
-- =============================================================================

ALTER TABLE archive.prdn_work_planning
  ADD COLUMN IF NOT EXISTS std_time_hours numeric;

COMMENT ON COLUMN archive.prdn_work_planning.std_time_hours IS 'Snapshot of public.prdn_work_planning.std_time_hours at archive time (decimal hours).';
