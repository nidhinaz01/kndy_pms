-- ============================================================================
-- Database Migration: Add Version Field to Planning Submissions
-- ============================================================================
-- This migration adds version tracking to prdn_planning_submissions
-- to support multiple submission attempts (resubmissions after rejection)
-- This matches the versioning approach used for reporting submissions
-- ============================================================================

-- Add version column
ALTER TABLE prdn_planning_submissions 
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Set version = 1 for all existing records (if any exist)
UPDATE prdn_planning_submissions 
  SET version = 1 
  WHERE version IS NULL OR version = 0;

-- Drop old unique constraint
ALTER TABLE prdn_planning_submissions 
  DROP CONSTRAINT IF EXISTS uq_planning_submission_stage_date;

-- Add new unique constraint with version
ALTER TABLE prdn_planning_submissions 
  ADD CONSTRAINT uq_planning_submission_stage_date_version 
  UNIQUE(stage_code, planning_date, version);

-- Add index for efficiently querying latest version
CREATE INDEX IF NOT EXISTS idx_planning_submissions_latest 
  ON prdn_planning_submissions(stage_code, planning_date, version DESC);

-- Add index for querying by version
CREATE INDEX IF NOT EXISTS idx_planning_submissions_version 
  ON prdn_planning_submissions(version);

-- Comments
COMMENT ON COLUMN prdn_planning_submissions.version IS 'Version number for resubmissions. Increments with each resubmission after rejection. Version 1 is the first submission.';

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Changes:
-- 1. Added version column (defaults to 1)
-- 2. Modified unique constraint to include version
-- 3. Added indexes for efficient version queries
-- 
-- This allows multiple submission attempts:
-- - Version 1: First submission (rejected)
-- - Version 2: Resubmission after rejection (rejected)
-- - Version 3: Second resubmission (approved)
-- 
-- This matches the versioning approach used for reporting submissions
-- ============================================================================

