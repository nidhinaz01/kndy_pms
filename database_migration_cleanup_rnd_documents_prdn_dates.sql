-- ============================================================================
-- Database Migration: Cleanup rnd_documents in prdn_dates table
-- ============================================================================
-- Purpose: Remove all unnecessary rnd_documents rows and ensure only one row
--          per work order with stage_code = NULL
-- ============================================================================

BEGIN;

-- Step 1: Identify and report what will be deleted
-- (Run this first to see what will be affected)
SELECT 
    sales_order_id,
    COUNT(*) as rows_to_delete,
    MIN(planned_date) as earliest_planned_date,
    MAX(planned_date) as latest_planned_date,
    COUNT(CASE WHEN actual_date IS NOT NULL THEN 1 END) as rows_with_actual_date
FROM prdn_dates
WHERE date_type = 'rnd_documents'
  AND stage_code IS NOT NULL
GROUP BY sales_order_id
ORDER BY sales_order_id;

-- Step 2: For work orders that have rnd_documents with stage_code = NULL,
--         but also have rows with stage_code set, we need to:
--         a) Keep the one with stage_code = NULL
--         b) Delete all with stage_code IS NOT NULL

-- First, let's see if there are any work orders with multiple rnd_documents rows where stage_code = NULL
SELECT 
    sales_order_id,
    COUNT(*) as duplicate_null_rows,
    array_agg(id ORDER BY planned_date) as row_ids
FROM prdn_dates
WHERE date_type = 'rnd_documents'
  AND stage_code IS NULL
GROUP BY sales_order_id
HAVING COUNT(*) > 1;

-- Step 3: For work orders with multiple rnd_documents rows where stage_code = NULL,
--         keep only one (prefer the one with actual_date, otherwise the earliest planned_date)
--         Delete the duplicates

-- Delete duplicate rnd_documents rows with stage_code = NULL
-- Keep the one with actual_date if exists, otherwise keep the one with earliest planned_date
DELETE FROM prdn_dates
WHERE id IN (
    SELECT id
    FROM (
        SELECT 
            id,
            sales_order_id,
            ROW_NUMBER() OVER (
                PARTITION BY sales_order_id 
                ORDER BY 
                    CASE WHEN actual_date IS NOT NULL THEN 0 ELSE 1 END,
                    planned_date ASC,
                    id ASC
            ) as rn
        FROM prdn_dates
        WHERE date_type = 'rnd_documents'
          AND stage_code IS NULL
    ) ranked
    WHERE rn > 1
);

-- Step 4: Delete all rnd_documents rows where stage_code IS NOT NULL
--         (These are the old stage-specific rows that are no longer needed)
DELETE FROM prdn_dates
WHERE date_type = 'rnd_documents'
  AND stage_code IS NOT NULL;

-- Step 5: For work orders that had rnd_documents rows with stage_code set but no row with stage_code = NULL,
--         we need to create one. However, we can't determine the planned_date from deleted rows.
--         So we'll check if any work orders are missing rnd_documents rows entirely.

-- Check work orders that might need a rnd_documents row created
-- (This is informational - you may need to manually create entry plans for these)
SELECT DISTINCT
    wo.id as sales_order_id,
    wo.wo_no,
    wo.wo_model
FROM prdn_wo_details wo
WHERE EXISTS (
    SELECT 1 
    FROM prdn_dates 
    WHERE sales_order_id = wo.id 
      AND date_type IN ('entry', 'exit', 'chassis_arrival', 'final_inspection', 'delivery')
)
AND NOT EXISTS (
    SELECT 1 
    FROM prdn_dates 
    WHERE sales_order_id = wo.id 
      AND date_type = 'rnd_documents'
)
ORDER BY wo.id;

-- Step 6: Verification - Check final state
-- After cleanup, each work order should have at most one rnd_documents row with stage_code = NULL
SELECT 
    sales_order_id,
    COUNT(*) as rnd_documents_rows,
    COUNT(CASE WHEN stage_code IS NULL THEN 1 END) as null_stage_rows,
    COUNT(CASE WHEN stage_code IS NOT NULL THEN 1 END) as non_null_stage_rows
FROM prdn_dates
WHERE date_type = 'rnd_documents'
GROUP BY sales_order_id
HAVING COUNT(*) > 1 OR COUNT(CASE WHEN stage_code IS NOT NULL THEN 1 END) > 0
ORDER BY sales_order_id;

-- If the above query returns no rows, the cleanup was successful!

COMMIT;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- If you need to rollback, you would need to restore from a backup.
-- This migration deletes data, so make sure to backup before running.
-- ============================================================================
