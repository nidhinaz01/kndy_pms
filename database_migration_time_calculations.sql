-- Database functions to replace time calculation functions
-- These functions calculate time totals/breakdowns directly in the database
-- instead of fetching all records and calculating in application code

-- ============================================================================
-- Function 1: calculate_total_time_for_mapping
-- ============================================================================
-- Simple SUM aggregation for a work-skill mapping
CREATE OR REPLACE FUNCTION calculate_total_time_for_mapping(p_wsm_id INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(standard_time_minutes), 0)
    FROM std_skill_time_standards
    WHERE wsm_id = p_wsm_id
      AND is_deleted = false
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function 2: get_time_breakdown_for_derivative_work
-- ============================================================================
-- Complex calculation: Groups by skill_order, finds max per order, sums totals
CREATE OR REPLACE FUNCTION get_time_breakdown_for_derivative_work(
  p_derived_sw_code VARCHAR
)
RETURNS JSONB AS $$
DECLARE
  v_total_minutes INTEGER;
  v_breakdown JSONB;
  v_is_uniform BOOLEAN;
BEGIN
  -- Calculate total minutes by grouping by skill_order and taking max per order
  -- Then sum all the max times (sequential skills)
  WITH order_max_times AS (
    SELECT 
      sts.skill_order,
      MAX(sts.standard_time_minutes) as max_time
    FROM std_work_skill_mapping wsm
    INNER JOIN std_skill_time_standards sts ON sts.wsm_id = wsm.wsm_id
    WHERE wsm.derived_sw_code = p_derived_sw_code
      AND wsm.is_deleted = false
      AND wsm.is_active = true
      AND sts.is_deleted = false
      AND sts.is_active = true
    GROUP BY sts.skill_order
  )
  SELECT COALESCE(SUM(max_time), 0)
  INTO v_total_minutes
  FROM order_max_times;

  -- Create breakdown with all time standards (for detailed view)
  SELECT jsonb_agg(
    jsonb_build_object(
      'skillOrder', skill_order,
      'minutes', standard_time_minutes,
      'skillName', 'Skill ' || skill_order::TEXT,
      'manpowerRequired', 1
    )
    ORDER BY skill_order
  )
  INTO v_breakdown
  FROM std_work_skill_mapping wsm
  INNER JOIN std_skill_time_standards sts ON sts.wsm_id = wsm.wsm_id
  WHERE wsm.derived_sw_code = p_derived_sw_code
    AND wsm.is_deleted = false
    AND wsm.is_active = true
    AND sts.is_deleted = false
    AND sts.is_active = true;

  -- Check if uniform (simplified - always returns true for now)
  -- TODO: Implement proper uniformity check if needed
  v_is_uniform := true;

  -- Return result as JSONB
  RETURN jsonb_build_object(
    'totalMinutes', v_total_minutes,
    'breakdown', COALESCE(v_breakdown, '[]'::jsonb),
    'isUniform', v_is_uniform
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions (adjust role as needed)
-- GRANT EXECUTE ON FUNCTION calculate_total_time_for_mapping TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_time_breakdown_for_derivative_work TO authenticated;

-- Example usage:
-- SELECT calculate_total_time_for_mapping(123);
-- SELECT get_time_breakdown_for_derivative_work('C0101');

