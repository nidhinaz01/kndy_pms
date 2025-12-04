-- Database function to replace getWorkOrderStatistics
-- This function calculates work order statistics directly in the database
-- instead of fetching all records and calculating in application code

CREATE OR REPLACE FUNCTION get_work_order_statistics(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_type_stats JSONB := '[]'::jsonb;
  v_total_stats JSONB;
BEGIN
  -- Calculate statistics by work order type
  WITH type_statistics AS (
    SELECT 
      m.wo_type_name as label,
      COUNT(*) FILTER (WHERE wo.wo_date IS NOT NULL) as ordered_count,
      COUNT(*) FILTER (WHERE wo.wo_prdn_start IS NOT NULL AND wo.wo_delivery IS NULL) as wip_count,
      COUNT(*) FILTER (WHERE wo.wo_delivery IS NOT NULL) as delivered_count
    FROM mstr_wo_type m
    LEFT JOIN prdn_wo_details wo ON wo.wo_model = m.wo_type_name
      AND (p_start_date IS NULL OR wo.wo_date >= p_start_date)
      AND (p_end_date IS NULL OR wo.wo_date <= p_end_date)
    WHERE m.is_active = true 
      AND m.is_deleted = false
    GROUP BY m.wo_type_name
    ORDER BY m.wo_type_name
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'label', label,
      'ordered', ordered_count,
      'wip', wip_count,
      'delivered', delivered_count
    )
  )
  INTO v_type_stats
  FROM type_statistics;

  -- Calculate total statistics
  SELECT jsonb_build_object(
    'ordered', COUNT(*) FILTER (WHERE wo_date IS NOT NULL),
    'wip', COUNT(*) FILTER (WHERE wo_prdn_start IS NOT NULL AND wo_delivery IS NULL),
    'delivered', COUNT(*) FILTER (WHERE wo_delivery IS NOT NULL)
  )
  INTO v_total_stats
  FROM prdn_wo_details
  WHERE (p_start_date IS NULL OR wo_date >= p_start_date)
    AND (p_end_date IS NULL OR wo_date <= p_end_date);

  -- Combine results
  v_result := jsonb_build_object(
    'typeStats', COALESCE(v_type_stats, '[]'::jsonb),
    'totalStats', COALESCE(v_total_stats, '{"ordered": 0, "wip": 0, "delivered": 0}'::jsonb)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission (adjust role as needed)
-- GRANT EXECUTE ON FUNCTION get_work_order_statistics TO authenticated;

-- Example usage:
-- SELECT get_work_order_statistics('2024-01-01'::DATE, '2024-12-31'::DATE);
-- SELECT get_work_order_statistics(); -- All time statistics

