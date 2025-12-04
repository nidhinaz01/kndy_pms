-- ============================================================================
-- Database Function: get_active_work_orders
-- ============================================================================
-- Purpose: Get active work orders for a stage (entered but not exited)
-- Replaces: getActiveWorkOrders() in productionWorkFetchHelpers.ts
-- Impact: Reduces 2 queries → 1 query
-- ============================================================================

CREATE OR REPLACE FUNCTION get_active_work_orders(p_stage_code VARCHAR)
RETURNS TABLE (
  wo_id INTEGER,
  wo_model VARCHAR,
  wo_no VARCHAR,
  pwo_no VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    wo.id AS wo_id,
    wo.wo_model,
    wo.wo_no,
    wo.pwo_no
  FROM prdn_dates entry
  INNER JOIN prdn_wo_details wo ON wo.id = entry.sales_order_id
  WHERE entry.stage_code = p_stage_code
    AND entry.date_type = 'entry'
    AND entry.actual_date IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 
      FROM prdn_dates exit
      WHERE exit.sales_order_id = entry.sales_order_id
        AND exit.stage_code = p_stage_code
        AND exit.date_type = 'exit'
        AND exit.actual_date IS NOT NULL
    )
  ORDER BY wo.id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Database Function: get_work_statuses_with_codes
-- ============================================================================
-- Purpose: Get work statuses for active work orders and extract unique codes
-- Replaces: getWorkStatuses() in productionWorkFetchHelpers.ts
-- Impact: Single query with all necessary data
-- ============================================================================

CREATE OR REPLACE FUNCTION get_work_statuses_with_codes(
  p_stage_code VARCHAR,
  p_wo_ids INTEGER[]
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  v_work_statuses JSONB;
  v_unique_derived_codes JSONB;
  v_unique_other_codes JSONB;
BEGIN
  -- Get all work statuses
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ws.id,
      'wo_details_id', ws.wo_details_id,
      'derived_sw_code', ws.derived_sw_code,
      'other_work_code', ws.other_work_code,
      'stage_code', ws.stage_code,
      'current_status', ws.current_status,
      'created_by', ws.created_by,
      'created_dt', ws.created_dt,
      'modified_by', ws.modified_by,
      'modified_dt', ws.modified_dt
    )
    ORDER BY ws.wo_details_id, ws.id
  ), '[]'::jsonb)
  INTO v_work_statuses
  FROM prdn_work_status ws
  WHERE ws.stage_code = p_stage_code
    AND ws.wo_details_id = ANY(p_wo_ids)
    AND ws.current_status != 'Removed';

  -- Get unique derived_sw_codes
  SELECT COALESCE(jsonb_agg(DISTINCT ws.derived_sw_code), '[]'::jsonb)
  INTO v_unique_derived_codes
  FROM prdn_work_status ws
  WHERE ws.stage_code = p_stage_code
    AND ws.wo_details_id = ANY(p_wo_ids)
    AND ws.current_status != 'Removed'
    AND ws.derived_sw_code IS NOT NULL;

  -- Get unique other_work_codes
  SELECT COALESCE(jsonb_agg(DISTINCT ws.other_work_code), '[]'::jsonb)
  INTO v_unique_other_codes
  FROM prdn_work_status ws
  WHERE ws.stage_code = p_stage_code
    AND ws.wo_details_id = ANY(p_wo_ids)
    AND ws.current_status != 'Removed'
    AND ws.other_work_code IS NOT NULL;

  result := jsonb_build_object(
    'workStatuses', COALESCE(v_work_statuses, '[]'::jsonb),
    'uniqueDerivedSwCodes', COALESCE(v_unique_derived_codes, '[]'::jsonb),
    'uniqueOtherWorkCodes', COALESCE(v_unique_other_codes, '[]'::jsonb)
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

