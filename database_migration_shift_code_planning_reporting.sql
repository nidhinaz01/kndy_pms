-- ============================================================================
-- Migration: shift_code on planning/reporting scope (stage + shift + date)
-- ============================================================================
-- Adds shift_code to:
--   prdn_planning_submissions, prdn_reporting_submissions,
--   prdn_work_planning, prdn_planning_manpower, prdn_reporting_manpower
-- Steps: NULLABLE column -> backfill 'GEN' -> NOT NULL -> constraints/indexes
-- Run on PostgreSQL (Supabase). Review locks on large tables in production.
-- ============================================================================

-- 1) Add columns (nullable)
ALTER TABLE prdn_planning_submissions
  ADD COLUMN IF NOT EXISTS shift_code VARCHAR(20);

ALTER TABLE prdn_reporting_submissions
  ADD COLUMN IF NOT EXISTS shift_code VARCHAR(20);

ALTER TABLE prdn_work_planning
  ADD COLUMN IF NOT EXISTS shift_code VARCHAR(20);

ALTER TABLE prdn_planning_manpower
  ADD COLUMN IF NOT EXISTS shift_code VARCHAR(20);

ALTER TABLE prdn_reporting_manpower
  ADD COLUMN IF NOT EXISTS shift_code VARCHAR(20);

-- 2) Backfill legacy rows (single implicit shift treated as GEN)
UPDATE prdn_planning_submissions SET shift_code = 'GEN' WHERE shift_code IS NULL;
UPDATE prdn_reporting_submissions SET shift_code = 'GEN' WHERE shift_code IS NULL;
UPDATE prdn_work_planning SET shift_code = 'GEN' WHERE shift_code IS NULL;
UPDATE prdn_planning_manpower SET shift_code = 'GEN' WHERE shift_code IS NULL;
UPDATE prdn_reporting_manpower SET shift_code = 'GEN' WHERE shift_code IS NULL;

-- 3) Enforce NOT NULL
ALTER TABLE prdn_planning_submissions
  ALTER COLUMN shift_code SET NOT NULL;

ALTER TABLE prdn_reporting_submissions
  ALTER COLUMN shift_code SET NOT NULL;

ALTER TABLE prdn_work_planning
  ALTER COLUMN shift_code SET NOT NULL;

ALTER TABLE prdn_planning_manpower
  ALTER COLUMN shift_code SET NOT NULL;

ALTER TABLE prdn_reporting_manpower
  ALTER COLUMN shift_code SET NOT NULL;

-- 4) Submissions: replace unique constraints (versioned rows per stage+shift+date)
ALTER TABLE prdn_planning_submissions
  DROP CONSTRAINT IF EXISTS uq_planning_submission_stage_date_version;

ALTER TABLE prdn_planning_submissions
  ADD CONSTRAINT uq_planning_submission_stage_shift_date_version
  UNIQUE (stage_code, shift_code, planning_date, version);

ALTER TABLE prdn_reporting_submissions
  DROP CONSTRAINT IF EXISTS uq_reporting_submission_stage_date_version;

ALTER TABLE prdn_reporting_submissions
  ADD CONSTRAINT uq_reporting_submission_stage_shift_date_version
  UNIQUE (stage_code, shift_code, reporting_date, version);

-- 5) Submissions: refresh "latest version" index (include shift_code)
DROP INDEX IF EXISTS idx_planning_submissions_latest;
CREATE INDEX idx_planning_submissions_latest
  ON prdn_planning_submissions (stage_code, shift_code, planning_date, version DESC);

DROP INDEX IF EXISTS idx_reporting_submissions_latest;
CREATE INDEX idx_reporting_submissions_latest
  ON prdn_reporting_submissions (stage_code, shift_code, reporting_date, version DESC);

-- Helpful lookup by stage+shift+date (non-versioned filters)
CREATE INDEX IF NOT EXISTS idx_planning_submissions_stage_shift_date
  ON prdn_planning_submissions (stage_code, shift_code, planning_date);

CREATE INDEX IF NOT EXISTS idx_reporting_submissions_stage_shift_date
  ON prdn_reporting_submissions (stage_code, shift_code, reporting_date);

-- 6) Work planning & manpower: composite indexes for common filters
CREATE INDEX IF NOT EXISTS idx_work_planning_stage_shift_from_date
  ON prdn_work_planning (stage_code, shift_code, from_date)
  WHERE is_deleted = false AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_planning_manpower_stage_shift_planning_date
  ON prdn_planning_manpower (stage_code, shift_code, planning_date)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_reporting_manpower_stage_shift_reporting_date
  ON prdn_reporting_manpower (stage_code, shift_code, reporting_date)
  WHERE is_deleted = false;

COMMENT ON COLUMN prdn_planning_submissions.shift_code IS 'Shift scope (matches hr_shift_master.shift_code) for this submission batch.';
COMMENT ON COLUMN prdn_reporting_submissions.shift_code IS 'Shift scope (matches hr_shift_master.shift_code) for this submission batch.';
COMMENT ON COLUMN prdn_work_planning.shift_code IS 'Shift scope for this planned work row.';

-- After this migration, run database_migration_archive_prdn_work_planning_shift_code.sql
-- so archive.prdn_work_planning and archive_work_order() preserve shift_code on archive.
COMMENT ON COLUMN prdn_planning_manpower.shift_code IS 'Shift scope for planned attendance.';
COMMENT ON COLUMN prdn_reporting_manpower.shift_code IS 'Shift scope for reported attendance.';
