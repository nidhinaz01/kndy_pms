-- ============================================================================
-- Verification Script: Check rnd_documents cleanup in prdn_dates table
-- ============================================================================
-- Purpose: Verify that the cleanup was successful and identify any issues
-- ============================================================================

-- ============================================================================
-- CHECK 1: Verify all rnd_documents rows have stage_code = NULL
-- ============================================================================
-- This should return NO ROWS if cleanup was successful
SELECT 
    id,
    sales_order_id,
    date_type,
    stage_code,
    planned_date,
    actual_date
FROM prdn_dates
WHERE date_type = 'rnd_documents'
  AND stage_code IS NOT NULL;

-- ============================================================================
-- CHECK 2: Check for duplicate rnd_documents rows per work order
-- ============================================================================
-- This should return NO ROWS if cleanup was successful
-- Each work order should have at most one rnd_documents row
SELECT 
    sales_order_id,
    COUNT(*) as duplicate_count,
    array_agg(id ORDER BY planned_date) as row_ids,
    array_agg(stage_code) as stage_codes,
    array_agg(planned_date) as planned_dates
FROM prdn_dates
WHERE date_type = 'rnd_documents'
GROUP BY sales_order_id
HAVING COUNT(*) > 1
ORDER BY sales_order_id;

-- ============================================================================
-- CHECK 3: Work orders that lost their rnd_documents row
-- ============================================================================
-- These work orders had rnd_documents rows with stage_code other than P1S1
-- They were deleted and may need entry plans created
SELECT DISTINCT
    wo.id as sales_order_id,
    wo.wo_no,
    wo.wo_model,
    wo.customer_name,
    wo.wo_date
FROM prdn_wo_details wo
WHERE EXISTS (
    -- Has other date types (entry, exit, etc.) indicating it was planned
    SELECT 1 
    FROM prdn_dates 
    WHERE sales_order_id = wo.id 
      AND date_type IN ('entry', 'exit', 'chassis_arrival', 'final_inspection', 'delivery')
)
AND NOT EXISTS (
    -- But no rnd_documents row
    SELECT 1 
    FROM prdn_dates 
    WHERE sales_order_id = wo.id 
      AND date_type = 'rnd_documents'
)
ORDER BY wo.id;

-- ============================================================================
-- CHECK 4: Summary of rnd_documents rows by work order
-- ============================================================================
-- This should show one row per work order, all with stage_code = NULL
SELECT 
    sales_order_id,
    COUNT(*) as rnd_documents_count,
    COUNT(CASE WHEN stage_code IS NULL THEN 1 END) as null_stage_count,
    COUNT(CASE WHEN stage_code IS NOT NULL THEN 1 END) as non_null_stage_count,
    MIN(planned_date) as earliest_planned_date,
    MAX(planned_date) as latest_planned_date,
    COUNT(CASE WHEN actual_date IS NOT NULL THEN 1 END) as rows_with_actual_date
FROM prdn_dates
WHERE date_type = 'rnd_documents'
GROUP BY sales_order_id
ORDER BY sales_order_id;

-- ============================================================================
-- CHECK 5: Work orders with rnd_documents rows (final state)
-- ============================================================================
-- This shows the final state - all should have stage_code = NULL
SELECT 
    pd.id,
    pd.sales_order_id,
    wo.wo_no,
    wo.wo_model,
    pd.stage_code,
    pd.planned_date,
    pd.actual_date,
    pd.created_dt,
    pd.modified_dt
FROM prdn_dates pd
INNER JOIN prdn_wo_details wo ON wo.id = pd.sales_order_id
WHERE pd.date_type = 'rnd_documents'
ORDER BY pd.sales_order_id, pd.planned_date;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- If CHECK 1 and CHECK 2 return no rows, the cleanup was successful!
-- If CHECK 3 returns rows, those work orders may need entry plans created.
-- ============================================================================
