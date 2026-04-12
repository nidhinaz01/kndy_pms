-- =============================================================================
-- OPTIONAL ROLLBACK — only if you previously added redundant from_date / to_date
-- on manpower tables. The app uses planning_from_date / planning_to_date and
-- reporting_from_date / reporting_to_date for the attendance date span.
-- =============================================================================

BEGIN;

ALTER TABLE public.prdn_planning_manpower
  DROP COLUMN IF EXISTS from_date,
  DROP COLUMN IF EXISTS to_date;

ALTER TABLE public.prdn_reporting_manpower
  DROP COLUMN IF EXISTS from_date,
  DROP COLUMN IF EXISTS to_date;

COMMIT;
