-- Database functions to replace statistics calculation functions
-- These functions calculate statistics directly in the database
-- instead of fetching all records and calculating in application code

-- ============================================================================
-- Function 1: get_work_order_stage_order_stats
-- ============================================================================
-- Calculates statistics for work order stage orders
-- Returns: total count, active count, inactive count, counts by type and stage
CREATE OR REPLACE FUNCTION get_work_order_stage_order_stats()
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_total INTEGER;
  v_by_type JSONB;
  v_by_stage JSONB;
BEGIN
  -- Calculate total count
  SELECT COUNT(*) INTO v_total
  FROM plan_wo_stage_order;

  -- Calculate counts by work order type
  SELECT jsonb_object_agg(wo_type_name, count)
  INTO v_by_type
  FROM (
    SELECT 
      wo_type_name,
      COUNT(*) as count
    FROM plan_wo_stage_order
    GROUP BY wo_type_name
    ORDER BY wo_type_name
  ) type_counts;

  -- Calculate counts by plant stage
  SELECT jsonb_object_agg(plant_stage, count)
  INTO v_by_stage
  FROM (
    SELECT 
      plant_stage,
      COUNT(*) as count
    FROM plan_wo_stage_order
    GROUP BY plant_stage
    ORDER BY plant_stage
  ) stage_counts;

  -- Build result object
  -- Note: All records are considered active since there's no is_active column
  v_result := jsonb_build_object(
    'total', COALESCE(v_total, 0),
    'active', COALESCE(v_total, 0),  -- All records are active
    'inactive', 0,                    -- No inactive records
    'byType', COALESCE(v_by_type, '{}'::jsonb),
    'byStage', COALESCE(v_by_stage, '{}'::jsonb)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function 2: get_production_plan_stats
-- ============================================================================
-- Calculates statistics for production plans
-- Returns: total plans, total slots, average slots per plan
CREATE OR REPLACE FUNCTION get_production_plan_stats()
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_total_plans INTEGER;
  v_total_slots INTEGER;
  v_average_slots NUMERIC;
BEGIN
  -- Count total production plans
  SELECT COUNT(*) INTO v_total_plans
  FROM plan_prod_plan_per_day;

  -- Count total time slots
  SELECT COUNT(*) INTO v_total_slots
  FROM plan_prod_times;

  -- Calculate average slots per plan
  IF v_total_plans > 0 THEN
    v_average_slots := ROUND((v_total_slots::NUMERIC / v_total_plans::NUMERIC)::NUMERIC, 2);
  ELSE
    v_average_slots := 0;
  END IF;

  -- Build result object
  v_result := jsonb_build_object(
    'total', COALESCE(v_total_plans, 0),
    'totalSlots', COALESCE(v_total_slots, 0),
    'averageSlots', v_average_slots
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function 3: get_holiday_stats
-- ============================================================================
-- Calculates statistics for holidays
-- Returns: total count, active count, inactive count, counts by year
-- Optional: filter by year
CREATE OR REPLACE FUNCTION get_holiday_stats(p_year INTEGER DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_total INTEGER;
  v_active INTEGER;
  v_inactive INTEGER;
  v_by_year JSONB;
BEGIN
  -- Calculate statistics
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE is_active = true) as active,
    COUNT(*) FILTER (WHERE is_active = false) as inactive
  INTO v_total, v_active, v_inactive
  FROM plan_holidays
  WHERE is_deleted = false
    AND (p_year IS NULL OR dt_year = p_year);

  -- Calculate counts by year
  SELECT jsonb_object_agg(dt_year::TEXT, count)
  INTO v_by_year
  FROM (
    SELECT 
      dt_year,
      COUNT(*) as count
    FROM plan_holidays
    WHERE is_deleted = false
      AND (p_year IS NULL OR dt_year = p_year)
    GROUP BY dt_year
    ORDER BY dt_year
  ) year_counts;

  -- Build result object
  v_result := jsonb_build_object(
    'total', COALESCE(v_total, 0),
    'active', COALESCE(v_active, 0),
    'inactive', COALESCE(v_inactive, 0),
    'byYear', COALESCE(v_by_year, '{}'::jsonb)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions (adjust role as needed)
-- GRANT EXECUTE ON FUNCTION get_work_order_stage_order_stats TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_production_plan_stats TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_holiday_stats TO authenticated;

-- Example usage:
-- SELECT get_work_order_stage_order_stats();
-- SELECT get_production_plan_stats();
-- SELECT get_holiday_stats();
-- SELECT get_holiday_stats(2024);

