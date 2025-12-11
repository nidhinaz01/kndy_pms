-- ============================================================================
-- Database Migration: Add 'cancelled' status to prdn_work_planning
-- ============================================================================
-- This migration adds 'cancelled' as a valid status value for prdn_work_planning
-- to support work cancellation functionality.
-- ============================================================================

-- Drop the existing check constraint
ALTER TABLE prdn_work_planning 
  DROP CONSTRAINT IF EXISTS chk_prdn_work_planning_status;

-- Add the constraint back with 'cancelled' included
ALTER TABLE prdn_work_planning 
  ADD CONSTRAINT chk_prdn_work_planning_status 
    CHECK (status IN ('draft', 'planned', 'submitted', 'to_redo', 'approved', 'pending_approval', 'rejected', 'cancelled'));

-- Update comment to reflect the new status
COMMENT ON COLUMN prdn_work_planning.status IS 'draft: Can be edited, pending_approval: Submitted for review, approved: Manager approved, rejected: Manager rejected, cancelled: Work plan cancelled, planned: Legacy status (approved plans)';

-- ============================================================================
-- Migration Complete
-- ============================================================================

