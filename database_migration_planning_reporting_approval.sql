-- ============================================================================
-- Database Migration: Planning and Reporting Approval Workflow
-- ============================================================================
-- This migration adds support for:
-- 1. Planning submissions with manager approval workflow
-- 2. Reporting submissions with manager approval workflow
-- 3. Attendance planning for next day
-- 4. Stage reassignment planning for next day
-- 5. Status tracking for drafts, pending approval, approved, rejected
-- ============================================================================

-- ============================================================================
-- 1. PLANNING SUBMISSIONS TABLE
-- ============================================================================
-- Tracks batch submissions of work plans + manpower plans for manager review
CREATE TABLE prdn_planning_submissions (
  id SERIAL PRIMARY KEY,
  
  -- Submission identification
  stage_code VARCHAR(10) NOT NULL,
  planning_date DATE NOT NULL,  -- Date being planned for (next day)
  
  -- Submission details
  submitted_by VARCHAR(100) NOT NULL,
  submitted_dt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'pending_approval',  -- 'pending_approval', 'approved', 'rejected'
  
  -- Review details
  reviewed_by VARCHAR(100),
  reviewed_dt TIMESTAMP,
  rejection_reason TEXT,  -- Manager's message when rejecting
  
  -- Audit fields
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_by VARCHAR(100),
  created_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_by VARCHAR(100),
  modified_dt TIMESTAMP,
  
  -- Constraints
  CONSTRAINT chk_planning_submission_status 
    CHECK (status IN ('pending_approval', 'approved', 'rejected')),
  CONSTRAINT uq_planning_submission_stage_date 
    UNIQUE(stage_code, planning_date)  -- One submission per stage-date
);

-- Indexes for planning submissions
CREATE INDEX idx_planning_submissions_stage_date 
  ON prdn_planning_submissions(stage_code, planning_date);
CREATE INDEX idx_planning_submissions_status 
  ON prdn_planning_submissions(status);
CREATE INDEX idx_planning_submissions_submitted_by 
  ON prdn_planning_submissions(submitted_by);
CREATE INDEX idx_planning_submissions_submitted_dt 
  ON prdn_planning_submissions(submitted_dt DESC);

-- Comments
COMMENT ON TABLE prdn_planning_submissions IS 'Tracks batch submissions of work plans and manpower plans for manager approval';
COMMENT ON COLUMN prdn_planning_submissions.planning_date IS 'Date being planned for (typically next day)';
COMMENT ON COLUMN prdn_planning_submissions.status IS 'pending_approval: Awaiting manager review, approved: Manager approved, rejected: Manager rejected';
COMMENT ON COLUMN prdn_planning_submissions.rejection_reason IS 'Manager message explaining rejection reason, shown to engineer';

-- ============================================================================
-- 2. REPORTING SUBMISSIONS TABLE
-- ============================================================================
-- Tracks batch submissions of work reports + manpower reports for manager review
CREATE TABLE prdn_reporting_submissions (
  id SERIAL PRIMARY KEY,
  
  -- Submission identification
  stage_code VARCHAR(10) NOT NULL,
  reporting_date DATE NOT NULL,  -- Date being reported for
  
  -- Submission details
  submitted_by VARCHAR(100) NOT NULL,
  submitted_dt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'pending_approval',  -- 'pending_approval', 'approved', 'rejected'
  
  -- Review details
  reviewed_by VARCHAR(100),
  reviewed_dt TIMESTAMP,
  rejection_reason TEXT,  -- Manager's message when rejecting
  
  -- Audit fields
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_by VARCHAR(100),
  created_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_by VARCHAR(100),
  modified_dt TIMESTAMP,
  
  -- Constraints
  CONSTRAINT chk_reporting_submission_status 
    CHECK (status IN ('pending_approval', 'approved', 'rejected')),
  CONSTRAINT uq_reporting_submission_stage_date 
    UNIQUE(stage_code, reporting_date)  -- One submission per stage-date
);

-- Indexes for reporting submissions
CREATE INDEX idx_reporting_submissions_stage_date 
  ON prdn_reporting_submissions(stage_code, reporting_date);
CREATE INDEX idx_reporting_submissions_status 
  ON prdn_reporting_submissions(status);
CREATE INDEX idx_reporting_submissions_submitted_by 
  ON prdn_reporting_submissions(submitted_by);
CREATE INDEX idx_reporting_submissions_submitted_dt 
  ON prdn_reporting_submissions(submitted_dt DESC);

-- Comments
COMMENT ON TABLE prdn_reporting_submissions IS 'Tracks batch submissions of work reports and manpower reports for manager approval';
COMMENT ON COLUMN prdn_reporting_submissions.reporting_date IS 'Date being reported for (typically current day)';
COMMENT ON COLUMN prdn_reporting_submissions.status IS 'pending_approval: Awaiting manager review, approved: Manager approved, rejected: Manager rejected';
COMMENT ON COLUMN prdn_reporting_submissions.rejection_reason IS 'Manager message explaining rejection reason, shown to engineer';

-- ============================================================================
-- 3. MANPOWER PLANNING TABLE
-- ============================================================================
-- Stores planned attendance for next day (linked to planning submission)
CREATE TABLE prdn_planning_manpower (
  id SERIAL PRIMARY KEY,
  
  -- Link to planning submission
  planning_submission_id INTEGER REFERENCES prdn_planning_submissions(id) ON DELETE CASCADE,
  
  -- Employee and stage
  emp_id VARCHAR(50) NOT NULL,
  stage_code VARCHAR(10) NOT NULL,
  planning_date DATE NOT NULL,  -- Date being planned for
  
  -- Attendance details
  attendance_status VARCHAR(20) NOT NULL,  -- 'present', 'absent'
  notes TEXT,
  
  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- 'draft', 'pending_approval', 'approved', 'rejected'
  
  -- Audit fields
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_by VARCHAR(100),
  created_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_by VARCHAR(100),
  modified_dt TIMESTAMP,
  
  -- Constraints
  CONSTRAINT chk_planning_manpower_status 
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected')),
  CONSTRAINT chk_planning_manpower_attendance_status 
    CHECK (attendance_status IN ('present', 'absent')),
  CONSTRAINT fk_planning_manpower_emp 
    FOREIGN KEY (emp_id) REFERENCES hr_emp(emp_id)
);

-- Indexes for manpower planning
CREATE INDEX idx_planning_manpower_submission 
  ON prdn_planning_manpower(planning_submission_id);
CREATE INDEX idx_planning_manpower_emp_stage_date 
  ON prdn_planning_manpower(emp_id, stage_code, planning_date);
CREATE INDEX idx_planning_manpower_status 
  ON prdn_planning_manpower(status);
CREATE INDEX idx_planning_manpower_date 
  ON prdn_planning_manpower(planning_date);

-- Comments
COMMENT ON TABLE prdn_planning_manpower IS 'Stores planned attendance for next day, linked to planning submission';
COMMENT ON COLUMN prdn_planning_manpower.planning_date IS 'Date being planned for (typically next day)';
COMMENT ON COLUMN prdn_planning_manpower.status IS 'draft: Can be edited, pending_approval: Submitted, approved: Manager approved, rejected: Manager rejected';

-- ============================================================================
-- 4. STAGE REASSIGNMENT PLANNING TABLE
-- ============================================================================
-- Stores planned stage reassignments for next day (linked to planning submission)
CREATE TABLE prdn_planning_stage_reassignment (
  id SERIAL PRIMARY KEY,
  
  -- Link to planning submission
  planning_submission_id INTEGER REFERENCES prdn_planning_submissions(id) ON DELETE CASCADE,
  
  -- Employee and reassignment details
  emp_id VARCHAR(50) NOT NULL,
  from_stage_code VARCHAR(10) NOT NULL,
  to_stage_code VARCHAR(10) NOT NULL,
  planning_date DATE NOT NULL,  -- Date being planned for
  
  -- Time details
  shift_code VARCHAR(20) NOT NULL,
  from_time TIME NOT NULL,
  to_time TIME NOT NULL,
  reason TEXT,
  
  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- 'draft', 'pending_approval', 'approved', 'rejected'
  
  -- Audit fields
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_by VARCHAR(100),
  created_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_by VARCHAR(100),
  modified_dt TIMESTAMP,
  
  -- Constraints
  CONSTRAINT chk_planning_stage_reassignment_status 
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected')),
  CONSTRAINT chk_planning_stage_reassignment_stages 
    CHECK (from_stage_code != to_stage_code),
  CONSTRAINT fk_planning_stage_reassignment_emp 
    FOREIGN KEY (emp_id) REFERENCES hr_emp(emp_id)
);

-- Indexes for stage reassignment planning
CREATE INDEX idx_planning_stage_reassignment_submission 
  ON prdn_planning_stage_reassignment(planning_submission_id);
CREATE INDEX idx_planning_stage_reassignment_emp_date 
  ON prdn_planning_stage_reassignment(emp_id, planning_date);
CREATE INDEX idx_planning_stage_reassignment_to_stage_date 
  ON prdn_planning_stage_reassignment(to_stage_code, planning_date);
CREATE INDEX idx_planning_stage_reassignment_status 
  ON prdn_planning_stage_reassignment(status);
CREATE INDEX idx_planning_stage_reassignment_date 
  ON prdn_planning_stage_reassignment(planning_date);

-- Comments
COMMENT ON TABLE prdn_planning_stage_reassignment IS 'Stores planned stage reassignments for next day, linked to planning submission';
COMMENT ON COLUMN prdn_planning_stage_reassignment.planning_date IS 'Date being planned for (typically next day)';
COMMENT ON COLUMN prdn_planning_stage_reassignment.status IS 'draft: Can be edited, pending_approval: Submitted, approved: Manager approved, rejected: Manager rejected';

-- ============================================================================
-- 5. MODIFY PRDN_WORK_PLANNING TABLE
-- ============================================================================
-- Add planning_submission_id and update status default to 'draft'
ALTER TABLE prdn_work_planning 
  ADD COLUMN IF NOT EXISTS planning_submission_id INTEGER 
    REFERENCES prdn_planning_submissions(id) ON DELETE SET NULL;

-- Update status column to include 'draft' and change default
-- Note: This assumes status column exists. If it doesn't, create it.
-- If status column already exists with different values, we may need to migrate existing data
DO $$
BEGIN
  -- Check if status column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prdn_work_planning' 
    AND column_name = 'status'
  ) THEN
    -- Update existing 'planned' status to 'draft' for records without submission
    UPDATE prdn_work_planning 
    SET status = 'draft' 
    WHERE status = 'planned' 
      AND planning_submission_id IS NULL;
    
    -- Add 'draft' to check constraint if it doesn't exist
    -- Note: This may fail if constraint doesn't allow 'draft', adjust accordingly
    ALTER TABLE prdn_work_planning 
      DROP CONSTRAINT IF EXISTS chk_prdn_work_planning_status;
    
    ALTER TABLE prdn_work_planning 
      ADD CONSTRAINT chk_prdn_work_planning_status 
        CHECK (status IN ('draft', 'planned', 'submitted', 'to_redo', 'approved', 'pending_approval', 'rejected'));
    
    -- Set default to 'draft'
    ALTER TABLE prdn_work_planning 
      ALTER COLUMN status SET DEFAULT 'draft';
  ELSE
    -- Create status column if it doesn't exist
    ALTER TABLE prdn_work_planning 
      ADD COLUMN status VARCHAR(20) DEFAULT 'draft';
    
    ALTER TABLE prdn_work_planning 
      ADD CONSTRAINT chk_prdn_work_planning_status 
        CHECK (status IN ('draft', 'planned', 'submitted', 'to_redo', 'approved', 'pending_approval', 'rejected'));
  END IF;
END $$;

-- Index for planning_submission_id
CREATE INDEX IF NOT EXISTS idx_work_planning_submission 
  ON prdn_work_planning(planning_submission_id);
CREATE INDEX IF NOT EXISTS idx_work_planning_status 
  ON prdn_work_planning(status);

-- Comments
COMMENT ON COLUMN prdn_work_planning.planning_submission_id IS 'Links to planning submission batch. NULL for draft plans not yet submitted.';
COMMENT ON COLUMN prdn_work_planning.status IS 'draft: Can be edited, pending_approval: Submitted for review, approved: Manager approved, rejected: Manager rejected, planned: Legacy status (approved plans)';

-- ============================================================================
-- 6. MODIFY PRDN_WORK_REPORTING TABLE
-- ============================================================================
-- Add reporting_submission_id and status column
ALTER TABLE prdn_work_reporting 
  ADD COLUMN IF NOT EXISTS reporting_submission_id INTEGER 
    REFERENCES prdn_reporting_submissions(id) ON DELETE SET NULL;

-- Add status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prdn_work_reporting' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE prdn_work_reporting 
      ADD COLUMN status VARCHAR(20) DEFAULT 'draft';
    
    ALTER TABLE prdn_work_reporting 
      ADD CONSTRAINT chk_prdn_work_reporting_status 
        CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'submitted'));
  ELSE
    -- Update constraint to include new statuses
    ALTER TABLE prdn_work_reporting 
      DROP CONSTRAINT IF EXISTS chk_prdn_work_reporting_status;
    
    ALTER TABLE prdn_work_reporting 
      ADD CONSTRAINT chk_prdn_work_reporting_status 
        CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'submitted'));
  END IF;
END $$;

-- Index for reporting_submission_id
CREATE INDEX IF NOT EXISTS idx_work_reporting_submission 
  ON prdn_work_reporting(reporting_submission_id);
CREATE INDEX IF NOT EXISTS idx_work_reporting_status 
  ON prdn_work_reporting(status);

-- Comments
COMMENT ON COLUMN prdn_work_reporting.reporting_submission_id IS 'Links to reporting submission batch. NULL for draft reports not yet submitted.';
COMMENT ON COLUMN prdn_work_reporting.status IS 'draft: Can be edited, pending_approval: Submitted for review, approved: Manager approved, rejected: Manager rejected, submitted: Legacy status';

-- ============================================================================
-- 7. UPDATE PRDN_WORK_STATUS TO SUPPORT 'Draft Plan' STATUS
-- ============================================================================
-- Ensure prdn_work_status.current_status can accept 'Draft Plan'
-- Note: This assumes current_status is a VARCHAR without strict constraint
-- If there's a CHECK constraint, we may need to update it
DO $$
BEGIN
  -- Check if constraint exists and update it
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'prdn_work_status' 
    AND constraint_name LIKE '%current_status%'
    AND constraint_type = 'CHECK'
  ) THEN
    -- Drop existing constraint (adjust constraint name as needed)
    ALTER TABLE prdn_work_status 
      DROP CONSTRAINT IF EXISTS chk_prdn_work_status_current_status;
    
    -- Add new constraint with 'Draft Plan'
    ALTER TABLE prdn_work_status 
      ADD CONSTRAINT chk_prdn_work_status_current_status 
        CHECK (current_status IN (
          'Yet to be Planned', 
          'Draft Plan', 
          'Planned', 
          'In Progress', 
          'Completed', 
          'Removed'
        ));
  END IF;
END $$;

-- Comments
COMMENT ON COLUMN prdn_work_status.current_status IS 'Yet to be Planned: Not planned yet, Draft Plan: Draft created, Planned: Approved plan, In Progress: Work started, Completed: Work finished, Removed: Work removed';

-- ============================================================================
-- 8. MANPOWER REPORTING TABLE (for LTP/LTNP per employee)
-- ============================================================================
-- Stores employee-level lost time reporting (LTP/LTNP) linked to reporting submission
-- Note: Work-level lost time is in prdn_work_reporting.lt_details
CREATE TABLE prdn_reporting_manpower (
  id SERIAL PRIMARY KEY,
  
  -- Link to reporting submission
  reporting_submission_id INTEGER REFERENCES prdn_reporting_submissions(id) ON DELETE CASCADE,
  
  -- Employee and stage
  emp_id VARCHAR(50) NOT NULL,
  stage_code VARCHAR(10) NOT NULL,
  reporting_date DATE NOT NULL,  -- Date being reported for
  
  -- Attendance details
  attendance_status VARCHAR(20) NOT NULL,  -- 'present', 'absent'
  
  -- Lost Time details (per employee, aggregated from work reports)
  ltp_hours DECIMAL(5,2) NOT NULL DEFAULT 0,  -- Lost Time Payable (hours)
  ltnp_hours DECIMAL(5,2) NOT NULL DEFAULT 0,  -- Lost Time Non Payable (hours)
  
  -- Notes
  notes TEXT,
  
  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- 'draft', 'pending_approval', 'approved', 'rejected'
  
  -- Audit fields
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_by VARCHAR(100),
  created_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_by VARCHAR(100),
  modified_dt TIMESTAMP,
  
  -- Constraints
  CONSTRAINT chk_reporting_manpower_status 
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected')),
  CONSTRAINT chk_reporting_manpower_attendance_status 
    CHECK (attendance_status IN ('present', 'absent')),
  CONSTRAINT chk_reporting_manpower_lt_hours 
    CHECK (ltp_hours >= 0 AND ltnp_hours >= 0),
  CONSTRAINT fk_reporting_manpower_emp 
    FOREIGN KEY (emp_id) REFERENCES hr_emp(emp_id)
);

-- Indexes for manpower reporting
CREATE INDEX idx_reporting_manpower_submission 
  ON prdn_reporting_manpower(reporting_submission_id);
CREATE INDEX idx_reporting_manpower_emp_stage_date 
  ON prdn_reporting_manpower(emp_id, stage_code, reporting_date);
CREATE INDEX idx_reporting_manpower_status 
  ON prdn_reporting_manpower(status);
CREATE INDEX idx_reporting_manpower_date 
  ON prdn_reporting_manpower(reporting_date);

-- Comments
COMMENT ON TABLE prdn_reporting_manpower IS 'Stores employee-level attendance and lost time reporting (LTP/LTNP), linked to reporting submission';
COMMENT ON COLUMN prdn_reporting_manpower.reporting_date IS 'Date being reported for (typically current day)';
COMMENT ON COLUMN prdn_reporting_manpower.ltp_hours IS 'Lost Time Payable - hours that are payable to employee';
COMMENT ON COLUMN prdn_reporting_manpower.ltnp_hours IS 'Lost Time Non Payable - hours that are not payable to employee';
COMMENT ON COLUMN prdn_reporting_manpower.status IS 'draft: Can be edited, pending_approval: Submitted, approved: Manager approved, rejected: Manager rejected';

-- ============================================================================
-- 9. STAGE REASSIGNMENT REPORTING TABLE
-- ============================================================================
-- Stores actual stage reassignments for reporting (linked to reporting submission)
CREATE TABLE prdn_reporting_stage_reassignment (
  id SERIAL PRIMARY KEY,
  
  -- Link to reporting submission
  reporting_submission_id INTEGER REFERENCES prdn_reporting_submissions(id) ON DELETE CASCADE,
  
  -- Employee and reassignment details
  emp_id VARCHAR(50) NOT NULL,
  from_stage_code VARCHAR(10) NOT NULL,
  to_stage_code VARCHAR(10) NOT NULL,
  reporting_date DATE NOT NULL,  -- Date being reported for
  
  -- Time details
  shift_code VARCHAR(20) NOT NULL,
  from_time TIME NOT NULL,
  to_time TIME NOT NULL,
  reason TEXT,
  
  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- 'draft', 'pending_approval', 'approved', 'rejected'
  
  -- Audit fields
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_by VARCHAR(100),
  created_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_by VARCHAR(100),
  modified_dt TIMESTAMP,
  
  -- Constraints
  CONSTRAINT chk_reporting_stage_reassignment_status 
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected')),
  CONSTRAINT chk_reporting_stage_reassignment_stages 
    CHECK (from_stage_code != to_stage_code),
  CONSTRAINT fk_reporting_stage_reassignment_emp 
    FOREIGN KEY (emp_id) REFERENCES hr_emp(emp_id)
);

-- Indexes for stage reassignment reporting
CREATE INDEX idx_reporting_stage_reassignment_submission 
  ON prdn_reporting_stage_reassignment(reporting_submission_id);
CREATE INDEX idx_reporting_stage_reassignment_emp_date 
  ON prdn_reporting_stage_reassignment(emp_id, reporting_date);
CREATE INDEX idx_reporting_stage_reassignment_to_stage_date 
  ON prdn_reporting_stage_reassignment(to_stage_code, reporting_date);
CREATE INDEX idx_reporting_stage_reassignment_status 
  ON prdn_reporting_stage_reassignment(status);
CREATE INDEX idx_reporting_stage_reassignment_date 
  ON prdn_reporting_stage_reassignment(reporting_date);

-- Comments
COMMENT ON TABLE prdn_reporting_stage_reassignment IS 'Stores actual stage reassignments for reporting, linked to reporting submission';
COMMENT ON COLUMN prdn_reporting_stage_reassignment.reporting_date IS 'Date being reported for (typically current day)';
COMMENT ON COLUMN prdn_reporting_stage_reassignment.status IS 'draft: Can be edited, pending_approval: Submitted, approved: Manager approved, rejected: Manager rejected';

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Tables Created:
-- 1. prdn_planning_submissions - Batch planning submissions
-- 2. prdn_reporting_submissions - Batch reporting submissions
-- 3. prdn_planning_manpower - Planned attendance for next day
-- 4. prdn_planning_stage_reassignment - Planned reassignments for next day
-- 5. prdn_reporting_manpower - Employee-level reporting (LTP/LTNP)
-- 6. prdn_reporting_stage_reassignment - Actual stage reassignments for reporting
--
-- Tables Modified:
-- 1. prdn_work_planning - Added planning_submission_id, updated status
-- 2. prdn_work_reporting - Added reporting_submission_id, added status
-- 3. prdn_work_status - Updated to support 'Draft Plan' status
--
-- Status Flow:
-- Planning: draft → pending_approval → approved/rejected
-- Reporting: draft → pending_approval → approved/rejected
-- ============================================================================

