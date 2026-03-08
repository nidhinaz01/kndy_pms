-- =============================================================================
-- Archive work order: move one WO from public to archive (single transaction).
-- Run after database_schema_archive.sql. Call via supabase.rpc('archive_work_order', {...}).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.archive_work_order(
  p_wo_details_id integer,
  p_archived_by text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, archive
AS $$
DECLARE
  v_wo_no text;
  v_file_paths text[];
BEGIN
  -- Check WO exists
  SELECT wo_no INTO v_wo_no FROM public.prdn_wo_details WHERE id = p_wo_details_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Work order not found: ' || p_wo_details_id);
  END IF;

  -- Collect RND document storage paths before we delete (for app to free bucket storage)
  SELECT array_agg(file_path) INTO v_file_paths
  FROM public.rnd_document_submissions
  WHERE sales_order_id = p_wo_details_id AND file_path IS NOT NULL AND file_path <> '';

  -- 1. Insert into archive.prdn_wo_details (with audit columns)
  INSERT INTO archive.prdn_wo_details (
    id, wo_no, pwo_no, wo_type, wo_model, wo_chassis, wo_date, wo_delivery,
    wo_prdn_start, wo_prdn_end, model_rate, work_order_cost, gst, cess, total_cost,
    wheel_base, body_width_mm, height, air_ventilation_nos, escape_hatch, front, rear,
    front_glass, emergency_door_nos, platform, inside_grab_rails, seat_type, no_of_seats,
    seat_configuration, dickey, passenger_door_nos, side_ventilation, door_position_front,
    door_position_rear, inside_top_panel, inside_side_panel, inside_luggage_rack,
    sound_system, paint, fire_extinguisher_kg, wiper, stepney, record_box_nos,
    route_board, seat_fabrics, rear_glass, driver_cabin_partition, voltage, customer_name,
    archived_by, archived_dt
  )
  SELECT
    id, wo_no, pwo_no, wo_type, wo_model, wo_chassis, wo_date, wo_delivery,
    wo_prdn_start, wo_prdn_end, model_rate, work_order_cost, gst, cess, total_cost,
    wheel_base, body_width_mm, height, air_ventilation_nos, escape_hatch, front, rear,
    front_glass, emergency_door_nos, platform, inside_grab_rails, seat_type, no_of_seats,
    seat_configuration, dickey, passenger_door_nos, side_ventilation, door_position_front,
    door_position_rear, inside_top_panel, inside_side_panel, inside_luggage_rack,
    sound_system, paint, fire_extinguisher_kg, wiper, stepney, record_box_nos,
    route_board, seat_fabrics, rear_glass, driver_cabin_partition, voltage, customer_name,
    p_archived_by, (now() AT TIME ZONE 'utc')
  FROM public.prdn_wo_details
  WHERE id = p_wo_details_id;

  -- 2. Copy child tables into archive (no FK order required in archive)
  INSERT INTO archive.prdn_wo_add_req SELECT id, wo_id, pos_num, work_details, work_qty, work_rate FROM public.prdn_wo_add_req WHERE wo_id = p_wo_details_id;
  INSERT INTO archive.prdn_wo_amend SELECT id, wo_id, pos_num, work_details, work_type, work_cost, gst, amend_date FROM public.prdn_wo_amend WHERE wo_id = p_wo_details_id;
  INSERT INTO archive.prdn_work_additions SELECT id, wo_details_id, stage_code, derived_sw_code, other_work_code, other_work_sc, other_work_desc, other_work_est_time_min, addition_reason, added_by, added_dt FROM public.prdn_work_additions WHERE wo_details_id = p_wo_details_id;
  INSERT INTO archive.prdn_work_status SELECT id, wo_details_id, stage_code, derived_sw_code, other_work_code, current_status, created_by, created_dt, modified_by, modified_dt FROM public.prdn_work_status WHERE wo_details_id = p_wo_details_id;
  INSERT INTO archive.prdn_work_removals (id, wo_details_id, stage_code, derived_sw_code, other_work_code, removal_reason, removed_by, removed_dt)
  SELECT id, wo_details_id, stage_code, derived_sw_code, other_work_code, removal_reason, removed_by, removed_dt FROM public.prdn_work_removals WHERE wo_details_id = p_wo_details_id;
  INSERT INTO archive.prdn_dates SELECT id, sales_order_id, stage_code, date_type, planned_date, actual_date, created_by, created_dt, modified_by, modified_dt FROM public.prdn_dates WHERE sales_order_id = p_wo_details_id;
  INSERT INTO archive.rnd_document_requirements SELECT id, sales_order_id, document_type, is_not_required, not_required_comments, marked_by, marked_dt, created_dt, modified_by, modified_dt FROM public.rnd_document_requirements WHERE sales_order_id = p_wo_details_id;
  INSERT INTO archive.rnd_document_submissions SELECT id, sales_order_id, document_type, document_name, file_path, file_size, file_type, submission_date, revised_date, revision_number, is_current, is_deleted, replaced_by_id, uploaded_by, created_dt, modified_by, modified_dt FROM public.rnd_document_submissions WHERE sales_order_id = p_wo_details_id;
  INSERT INTO archive.sales_chassis_receival_records SELECT id, sales_order_id, template_id, inspection_date, inspection_status, inspection_notes, inspector_name, field_responses, is_deleted, created_by, created_dt, modified_by, modified_dt FROM public.sales_chassis_receival_records WHERE sales_order_id = p_wo_details_id;
  INSERT INTO archive.prdn_work_planning SELECT id, planning_submission_id, wo_details_id, stage_code, derived_sw_code, other_work_code, worker_id, from_date, from_time, to_date, to_time, planned_hours, time_worked_till_date, remaining_time, status, notes, report_unplanned_work, sc_required, wsm_id, is_active, is_deleted, created_by, created_dt, modified_by, modified_dt FROM public.prdn_work_planning WHERE wo_details_id = p_wo_details_id;
  INSERT INTO archive.prdn_work_planning_deviations SELECT d.id, d.planning_id, d.deviation_type, d.reason, d.is_active, d.is_deleted, d.created_by, d.created_dt, d.modified_by, d.modified_dt FROM public.prdn_work_planning_deviations d JOIN public.prdn_work_planning p ON p.id = d.planning_id WHERE p.wo_details_id = p_wo_details_id;
  INSERT INTO archive.prdn_work_reporting (id, reporting_submission_id, planning_id, worker_id, from_date, from_time, to_date, to_time, hours_worked_today, hours_worked_till_date, status, completion_status, pr_type, pr_std_time, pr_rate, pr_pow, pr_amount, pr_calculated_dt, overtime_minutes, overtime_amount, lt_minutes_total, lt_details, lt_comments, remarks, is_active, is_deleted, created_by, created_dt, modified_by, modified_dt)
  SELECT r.id, r.reporting_submission_id, r.planning_id, r.worker_id, r.from_date, r.from_time, r.to_date, r.to_time, r.hours_worked_today, r.hours_worked_till_date, r.status, r.completion_status, r.pr_type, r.pr_std_time, r.pr_rate, r.pr_pow, r.pr_amount, r.pr_calculated_dt, r.overtime_minutes, r.overtime_amount, r.lt_minutes_total, r.lt_details, r.lt_comments, r.remarks, r.is_active, r.is_deleted, r.created_by, r.created_dt, r.modified_by, r.modified_dt FROM public.prdn_work_reporting r JOIN public.prdn_work_planning p ON p.id = r.planning_id WHERE p.wo_details_id = p_wo_details_id;
  INSERT INTO archive.prdn_work_reporting_deviations SELECT d.id, d.reporting_id, d.planning_id, d.deviation_type, d.reason, d.is_active, d.is_deleted, d.created_by, d.created_dt, d.modified_by, d.modified_dt FROM public.prdn_work_reporting_deviations d JOIN public.prdn_work_planning p ON p.id = d.planning_id WHERE p.wo_details_id = p_wo_details_id;

  -- 3. Delete from public (children first, then root)
  DELETE FROM public.prdn_work_reporting_deviations WHERE reporting_id IN (SELECT id FROM public.prdn_work_reporting WHERE planning_id IN (SELECT id FROM public.prdn_work_planning WHERE wo_details_id = p_wo_details_id));
  DELETE FROM public.prdn_work_reporting WHERE planning_id IN (SELECT id FROM public.prdn_work_planning WHERE wo_details_id = p_wo_details_id);
  DELETE FROM public.prdn_work_planning_deviations WHERE planning_id IN (SELECT id FROM public.prdn_work_planning WHERE wo_details_id = p_wo_details_id);
  DELETE FROM public.prdn_work_planning WHERE wo_details_id = p_wo_details_id;
  DELETE FROM public.sales_chassis_receival_records WHERE sales_order_id = p_wo_details_id;
  DELETE FROM public.rnd_document_submissions WHERE sales_order_id = p_wo_details_id;
  DELETE FROM public.rnd_document_requirements WHERE sales_order_id = p_wo_details_id;
  DELETE FROM public.prdn_dates WHERE sales_order_id = p_wo_details_id;
  DELETE FROM public.prdn_work_removals WHERE wo_details_id = p_wo_details_id;
  DELETE FROM public.prdn_work_status WHERE wo_details_id = p_wo_details_id;
  DELETE FROM public.prdn_work_additions WHERE wo_details_id = p_wo_details_id;
  DELETE FROM public.prdn_wo_amend WHERE wo_id = p_wo_details_id;
  DELETE FROM public.prdn_wo_add_req WHERE wo_id = p_wo_details_id;
  DELETE FROM public.prdn_wo_details WHERE id = p_wo_details_id;

  RETURN jsonb_build_object(
    'success', true,
    'wo_no', v_wo_no,
    'file_paths', to_jsonb(COALESCE(v_file_paths, ARRAY[]::text[]))
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.archive_work_order(integer, text) IS 'Moves one work order and all related rows from public to archive. Audit: archived_by, archived_dt on archive.prdn_wo_details.';

-- =============================================================================
-- List archived work orders (for UI). Use this so the app does not need
-- direct SELECT on the archive schema; call via supabase.rpc('get_archived_work_orders').
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_archived_work_orders()
RETURNS TABLE (
  id integer,
  wo_no text,
  wo_type text,
  wo_model text,
  wo_date date,
  wo_delivery date,
  archived_by text,
  archived_dt timestamp without time zone
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, archive
AS $$
  SELECT a.id, a.wo_no::text, a.wo_type::text, a.wo_model::text, a.wo_date, a.wo_delivery, a.archived_by::text, a.archived_dt
  FROM archive.prdn_wo_details a
  ORDER BY a.archived_dt DESC;
$$;

COMMENT ON FUNCTION public.get_archived_work_orders() IS 'Returns list of archived work orders for the Archive WO UI. Does not require client access to archive schema.';
