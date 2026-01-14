-- ============================================================================
-- Database Migration: Remove Duplicate Holidays
-- ============================================================================
-- This script removes duplicate holiday entries where the same date AND
-- description exist multiple times. It keeps the oldest entry (lowest id)
-- and soft-deletes the duplicates.
-- ============================================================================

-- ============================================================================
-- STEP 1: Identify Duplicates (for review)
-- ============================================================================
-- Run this query first to see what duplicates will be removed
SELECT 
    dt_value,
    description,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(id ORDER BY id) as holiday_ids,
    ARRAY_AGG(created_dt ORDER BY id) as created_dates
FROM plan_holidays
WHERE is_deleted = false
GROUP BY dt_value, description
HAVING COUNT(*) > 1
ORDER BY dt_value, description;

-- ============================================================================
-- STEP 2: Remove Duplicates (keeps oldest entry, soft-deletes others)
-- ============================================================================
-- This will soft-delete duplicate holidays, keeping only the one with the
-- lowest id (oldest entry) for each unique combination of dt_value and description

WITH duplicates AS (
    SELECT 
        id,
        dt_value,
        description,
        ROW_NUMBER() OVER (
            PARTITION BY dt_value, description 
            ORDER BY id ASC
        ) as row_num
    FROM plan_holidays
    WHERE is_deleted = false
)
UPDATE plan_holidays
SET 
    is_deleted = true,
    modified_by = 'system_cleanup',
    modified_dt = NOW()
WHERE id IN (
    SELECT id 
    FROM duplicates 
    WHERE row_num > 1
);

-- ============================================================================
-- STEP 3: Verify Removal (check results)
-- ============================================================================
-- Run this to verify no duplicates remain (should return 0 rows)
SELECT 
    dt_value,
    description,
    COUNT(*) as count
FROM plan_holidays
WHERE is_deleted = false
GROUP BY dt_value, description
HAVING COUNT(*) > 1;

-- ============================================================================
-- STEP 4: Summary Report
-- ============================================================================
-- Get summary of what was removed
SELECT 
    COUNT(*) as total_duplicates_removed,
    COUNT(DISTINCT dt_value) as unique_dates_affected,
    COUNT(DISTINCT description) as unique_descriptions_affected
FROM plan_holidays
WHERE is_deleted = true 
    AND modified_by = 'system_cleanup';

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================
-- If you need to restore the duplicates, run this:
-- UPDATE plan_holidays
-- SET 
--     is_deleted = false,
--     modified_by = NULL,
--     modified_dt = NULL
-- WHERE modified_by = 'system_cleanup';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

