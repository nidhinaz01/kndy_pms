-- ============================================================================
-- Database Migration: Piece Rate Calculation
-- ============================================================================
-- This migration adds piece rate calculation fields to prdn_work_reporting table
-- Piece rates are automatically calculated when work is marked as completed
-- ============================================================================

-- ============================================================================
-- ADD PIECE RATE COLUMNS TO PRDN_WORK_REPORTING TABLE
-- ============================================================================
ALTER TABLE prdn_work_reporting 
  ADD COLUMN IF NOT EXISTS pr_amount DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pr_calculated_dt TIMESTAMP DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pr_rate DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pr_std_time INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pr_pow DECIMAL(5,4) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pr_type VARCHAR(2) DEFAULT NULL;

-- Add constraint for pr_type
ALTER TABLE prdn_work_reporting
  DROP CONSTRAINT IF EXISTS chk_prdn_work_reporting_pr_type;
  
ALTER TABLE prdn_work_reporting
  ADD CONSTRAINT chk_prdn_work_reporting_pr_type
    CHECK (pr_type IS NULL OR pr_type IN ('PR', 'SL'));

-- Indexes for piece rate queries
CREATE INDEX IF NOT EXISTS idx_work_reporting_pr_calculated 
  ON prdn_work_reporting(pr_calculated_dt) 
  WHERE pr_calculated_dt IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_reporting_pr_amount 
  ON prdn_work_reporting(pr_amount) 
  WHERE pr_amount IS NOT NULL;

-- Comments
COMMENT ON COLUMN prdn_work_reporting.pr_amount IS 'Piece rate amount calculated for this work report';
COMMENT ON COLUMN prdn_work_reporting.pr_calculated_dt IS 'Timestamp when piece rate was calculated';
COMMENT ON COLUMN prdn_work_reporting.pr_rate IS 'Rate per hour used for calculation (from hr_skill_master for standard work, or calculated hourly rate for non-standard work)';
COMMENT ON COLUMN prdn_work_reporting.pr_std_time IS 'Standard time in minutes for this work (for standard work only)';
COMMENT ON COLUMN prdn_work_reporting.pr_pow IS 'Proportion of work: minutes worked by this worker / total minutes worked by all workers with same sc_required on same planning_id';
COMMENT ON COLUMN prdn_work_reporting.pr_type IS 'Type of payment: PR (Piece Rate) for standard work, SL (Salary) for non-standard work';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

