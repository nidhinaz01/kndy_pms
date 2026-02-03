-- ============================================================================
-- Migration: Add partial attendance support (half-day, early out)
-- ============================================================================
-- Adds time and hours fields to support partial attendance scenarios:
-- 1. Half-day employees (planned/actual hours < full shift)
-- 2. Early out employees (actual hours < planned hours)
-- ============================================================================

-- ============================================================================
-- 1. UPDATE prdn_planning_manpower TABLE
-- ============================================================================
-- Add fields for planned hours and time range

ALTER TABLE prdn_planning_manpower
  ADD COLUMN IF NOT EXISTS planned_hours DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS from_time TIME,
  ADD COLUMN IF NOT EXISTS to_time TIME;

-- Add constraints
ALTER TABLE prdn_planning_manpower
  ADD CONSTRAINT chk_planning_manpower_planned_hours 
    CHECK (planned_hours IS NULL OR (planned_hours >= 0 AND planned_hours <= 24));

-- Add comments
COMMENT ON COLUMN prdn_planning_manpower.planned_hours IS 'Planned working hours for this employee (full shift minus breaks if not specified). NULL means full shift.';
COMMENT ON COLUMN prdn_planning_manpower.from_time IS 'Planned start time for this employee. NULL means shift start time.';
COMMENT ON COLUMN prdn_planning_manpower.to_time IS 'Planned end time for this employee. NULL means shift end time.';
COMMENT ON COLUMN prdn_planning_manpower.notes IS 'Notes or reason for attendance. Required when planned_hours < full shift hours.';

-- ============================================================================
-- 2. UPDATE prdn_reporting_manpower TABLE
-- ============================================================================
-- Add fields for actual hours and time range

ALTER TABLE prdn_reporting_manpower
  ADD COLUMN IF NOT EXISTS actual_hours DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS from_time TIME,
  ADD COLUMN IF NOT EXISTS to_time TIME;

-- Add constraints
ALTER TABLE prdn_reporting_manpower
  ADD CONSTRAINT chk_reporting_manpower_actual_hours 
    CHECK (actual_hours IS NULL OR (actual_hours >= 0 AND actual_hours <= 24));

-- Add comments
COMMENT ON COLUMN prdn_reporting_manpower.actual_hours IS 'Actual working hours for this employee (full shift minus breaks if not specified). NULL means full shift.';
COMMENT ON COLUMN prdn_reporting_manpower.from_time IS 'Actual start time for this employee. NULL means shift start time.';
COMMENT ON COLUMN prdn_reporting_manpower.to_time IS 'Actual end time for this employee. NULL means shift end time.';
COMMENT ON COLUMN prdn_reporting_manpower.notes IS 'Notes or reason for attendance. Required when actual_hours < planned_hours or actual_hours < full shift hours.';

-- ============================================================================
-- 3. NOTES
-- ============================================================================
-- - When attendance_status = 'present' and hours/time fields are NULL:
--   System will default to full shift hours (shift duration minus breaks)
-- - When attendance_status = 'present' and planned_hours < full shift:
--   notes field MUST be provided (enforced in application layer)
-- - When attendance_status = 'present' and actual_hours < planned_hours:
--   notes field MUST be provided (enforced in application layer)
-- - When attendance_status = 'absent', hours/time fields should be NULL
