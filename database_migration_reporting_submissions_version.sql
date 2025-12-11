-- ============================================================================
-- Database Migration: Add Version Field to Reporting Submissions
-- ============================================================================
-- This migration adds version tracking to prdn_reporting_submissions
-- to support multiple submission attempts (resubmissions after rejection)
-- ============================================================================

-- Add version column
ALTER TABLE prdn_reporting_submissions 
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Set version = 1 for all existing records (if any exist)
UPDATE prdn_reporting_submissions 
  SET version = 1 
  WHERE version IS NULL OR version = 0;

-- Drop old unique constraint
ALTER TABLE prdn_reporting_submissions 
  DROP CONSTRAINT IF EXISTS uq_reporting_submission_stage_date;

-- Add new unique constraint with version
ALTER TABLE prdn_reporting_submissions 
  ADD CONSTRAINT uq_reporting_submission_stage_date_version 
  UNIQUE(stage_code, reporting_date, version);

-- Add index for efficiently querying latest version
CREATE INDEX IF NOT EXISTS idx_reporting_submissions_latest 
  ON prdn_reporting_submissions(stage_code, reporting_date, version DESC);

-- Add index for querying by version
CREATE INDEX IF NOT EXISTS idx_reporting_submissions_version 
  ON prdn_reporting_submissions(version);

-- Comments
COMMENT ON COLUMN prdn_reporting_submissions.version IS 'Version number for resubmissions. Increments with each resubmission after rejection. Version 1 is the first submission.';

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
-- ============================================================================

