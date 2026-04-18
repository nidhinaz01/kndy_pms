-- ============================================================================
-- attendance_status: migrate legacy 'absent' -> 'absent_informed'
-- New allowed values: present | absent_informed | absent_uninformed
--
-- Tables: public.prdn_planning_manpower, public.prdn_reporting_manpower
-- (matches live DDL: attendance_status VARCHAR(20), CHECK present/absent)
--
-- Constraint names (live DB):
--   prdn_planning_manpower:    chk_planning_attendance_attendance_status
--   prdn_reporting_manpower:   chk_reporting_manpower_attendance_status
--
-- Run in a transaction; verify row counts before COMMIT.
-- ============================================================================

BEGIN;

-- 1) Remove CHECK constraints (they only allow present / absent today).
ALTER TABLE public.prdn_planning_manpower
  DROP CONSTRAINT IF EXISTS chk_planning_attendance_attendance_status;

ALTER TABLE public.prdn_reporting_manpower
  DROP CONSTRAINT IF EXISTS chk_reporting_manpower_attendance_status;

-- 2) Migrate historical absent -> absent_informed.
UPDATE public.prdn_planning_manpower
SET attendance_status = 'absent_informed'
WHERE attendance_status = 'absent';

UPDATE public.prdn_reporting_manpower
SET attendance_status = 'absent_informed'
WHERE attendance_status = 'absent';

-- Optional: legacy mixed case
-- UPDATE public.prdn_planning_manpower SET attendance_status = 'absent_informed' WHERE LOWER(TRIM(attendance_status)) = 'absent';
-- UPDATE public.prdn_reporting_manpower SET attendance_status = 'absent_informed' WHERE LOWER(TRIM(attendance_status)) = 'absent';

-- Optional: limit to non-deleted rows only
-- AND (is_deleted IS NOT TRUE)

-- 3) New CHECK constraints (reuse planning constraint name from your DDL).
ALTER TABLE public.prdn_planning_manpower
  ADD CONSTRAINT chk_planning_attendance_attendance_status
  CHECK (
    attendance_status::text = ANY (
      ARRAY[
        'present'::varchar,
        'absent_informed'::varchar,
        'absent_uninformed'::varchar
      ]::text[]
    )
  );

ALTER TABLE public.prdn_reporting_manpower
  ADD CONSTRAINT chk_reporting_manpower_attendance_status
  CHECK (
    attendance_status::text = ANY (
      ARRAY[
        'present'::varchar,
        'absent_informed'::varchar,
        'absent_uninformed'::varchar
      ]::text[]
    )
  );

COMMIT;

-- Verify:
-- SELECT attendance_status, COUNT(*) FROM public.prdn_planning_manpower GROUP BY 1;
-- SELECT attendance_status, COUNT(*) FROM public.prdn_reporting_manpower GROUP BY 1;
