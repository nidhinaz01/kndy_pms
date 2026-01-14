-- ============================================================================
-- Database Migration: Cleanup rnd_documents in prdn_dates table (Simple Version)
-- ============================================================================
-- Purpose: Remove all unnecessary rnd_documents rows and ensure only one row
--          per work order with stage_code = NULL
-- ============================================================================
-- IMPORTANT: Backup your database before running this!
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: For work orders that have rnd_documents with stage_code = NULL,
--         but also have rows with stage_code set:
--         - Keep the one with stage_code = NULL
--         - Delete all with stage_code IS NOT NULL
-- ============================================================================

-- Delete all rnd_documents rows where stage_code IS NOT NULL
-- (These are the old stage-specific rows that are no longer needed)
DELETE FROM prdn_dates
WHERE date_type = 'rnd_documents'
  AND stage_code IS NOT NULL;

-- ============================================================================
-- STEP 2: Handle duplicate rnd_documents rows with stage_code = NULL
--         Keep only one per work order (prefer the one with actual_date,
--         otherwise the one with earliest planned_date)
-- ============================================================================

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
                    -- Prefer rows with actual_date
                    CASE WHEN actual_date IS NOT NULL THEN 0 ELSE 1 END,
                    -- Then by earliest planned_date
                    planned_date ASC,
                    -- Finally by id for consistency
                    id ASC
            ) as rn
        FROM prdn_dates
        WHERE date_type = 'rnd_documents'
          AND stage_code IS NULL
    ) ranked
    WHERE rn > 1
);

-- ============================================================================
-- STEP 3: Verification - Check final state
-- ============================================================================

-- This query should return NO ROWS if cleanup was successful
-- Each work order should have at most one rnd_documents row with stage_code = NULL
SELECT 
    sales_order_id,
    COUNT(*) as rnd_documents_rows,
    COUNT(CASE WHEN stage_code IS NULL THEN 1 END) as null_stage_rows,
    COUNT(CASE WHEN stage_code IS NOT NULL THEN 1 END) as non_null_stage_rows,
    array_agg(id) as row_ids
FROM prdn_dates
WHERE date_type = 'rnd_documents'
GROUP BY sales_order_id
HAVING COUNT(*) > 1 OR COUNT(CASE WHEN stage_code IS NOT NULL THEN 1 END) > 0
ORDER BY sales_order_id;

-- If the above query returns rows, there are still issues to fix
-- If it returns no rows, the cleanup was successful!

COMMIT;

-- ============================================================================
-- OPTIONAL: Check for work orders that might need manual attention
-- ============================================================================
-- Run this AFTER the migration to see if any work orders are missing
-- rnd_documents rows (they may need entry plans created)
/*
SELECT DISTINCT
    wo.id as sales_order_id,
    wo.wo_no,
    wo.wo_model,
    wo.customer_name
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
*/
