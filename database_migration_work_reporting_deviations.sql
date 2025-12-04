-- ============================================================================
-- CREATE PRDN_WORK_REPORTING_DEVIATIONS TABLE
-- ============================================================================
-- Table for tracking deviations in work reporting (e.g., no worker available)

CREATE TABLE IF NOT EXISTS prdn_work_reporting_deviations (
  id SERIAL PRIMARY KEY,
  
  -- Link to reporting record
  reporting_id INTEGER NOT NULL REFERENCES prdn_work_reporting(id) ON DELETE CASCADE,
  
  -- Link to planning record (for reference)
  planning_id INTEGER REFERENCES prdn_work_planning(id) ON DELETE SET NULL,
  
  -- Deviation type
  deviation_type VARCHAR(50) NOT NULL,
  
  -- Reason for deviation (mandatory)
  reason TEXT NOT NULL,
  
  -- Status tracking
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  
  -- Audit fields
  created_by VARCHAR(100),
  created_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_by VARCHAR(100),
  modified_dt TIMESTAMP,
  
  -- Constraints
  CONSTRAINT chk_deviation_type 
    CHECK (deviation_type IN ('no_worker', 'skill_mismatch', 'exceeds_std_time')),
  CONSTRAINT chk_deviation_reason_not_empty 
    CHECK (LENGTH(TRIM(reason)) > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_work_reporting_deviations_reporting_id 
  ON prdn_work_reporting_deviations(reporting_id);
CREATE INDEX IF NOT EXISTS idx_work_reporting_deviations_planning_id 
  ON prdn_work_reporting_deviations(planning_id);
CREATE INDEX IF NOT EXISTS idx_work_reporting_deviations_type 
  ON prdn_work_reporting_deviations(deviation_type);
CREATE INDEX IF NOT EXISTS idx_work_reporting_deviations_active 
  ON prdn_work_reporting_deviations(is_active, is_deleted);

-- Comments
COMMENT ON TABLE prdn_work_reporting_deviations IS 'Tracks deviations in work reporting (e.g., no worker available, skill mismatch, exceeds standard time)';
COMMENT ON COLUMN prdn_work_reporting_deviations.reporting_id IS 'Links to the work reporting record';
COMMENT ON COLUMN prdn_work_reporting_deviations.planning_id IS 'Links to the original planning record for reference';
COMMENT ON COLUMN prdn_work_reporting_deviations.deviation_type IS 'Type of deviation: no_worker, skill_mismatch, exceeds_std_time';
COMMENT ON COLUMN prdn_work_reporting_deviations.reason IS 'Mandatory reason explaining the deviation';

