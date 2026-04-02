-- =============================================================================
-- Example: Restore a single archived work order back into public schema
-- For DBA/backend use only. Not exposed in the application.
--
-- INSTRUCTIONS:
-- 1. Replace every occurrence of 12345 below with your actual wo_details_id.
-- 2. Run inserts in order (parents before children). Wrap in a transaction
--    (BEGIN; ... COMMIT;) so you can ROLLBACK if anything fails.
-- 3. Optional: run the DELETE block at the end to remove data from archive
--    after a successful restore.
-- =============================================================================

-- Replace 12345 with your actual wo_details_id in every statement below.

-- -----------------------------------------------------------------------------
-- INSERT order (respect public schema FKs: parent tables first)
-- -----------------------------------------------------------------------------

-- 1. Root: work order details
INSERT INTO public.prdn_wo_details (
    id, wo_no, pwo_no, wo_type, wo_model, wo_chassis, wo_date, wo_delivery,
    wo_prdn_start, wo_prdn_end, model_rate, work_order_cost, gst, cess, total_cost,
    wheel_base, body_width_mm, height, air_ventilation_nos, escape_hatch, front, rear,
    front_glass, emergency_door_nos, platform, inside_grab_rails, seat_type, no_of_seats,
    seat_configuration, dickey, passenger_door_nos, side_ventilation, door_position_front,
    door_position_rear, inside_top_panel, inside_side_panel, inside_luggage_rack,
    sound_system, paint, fire_extinguisher_kg, wiper, stepney, record_box_nos,
    route_board, seat_fabrics, rear_glass, driver_cabin_partition, voltage, customer_name
)
SELECT
    id, wo_no, pwo_no, wo_type, wo_model, wo_chassis, wo_date, wo_delivery,
    wo_prdn_start, wo_prdn_end, model_rate, work_order_cost, gst, cess, total_cost,
    wheel_base, body_width_mm, height, air_ventilation_nos, escape_hatch, front, rear,
    front_glass, emergency_door_nos, platform, inside_grab_rails, seat_type, no_of_seats,
    seat_configuration, dickey, passenger_door_nos, side_ventilation, door_position_front,
    door_position_rear, inside_top_panel, inside_side_panel, inside_luggage_rack,
    sound_system, paint, fire_extinguisher_kg, wiper, stepney, record_box_nos,
    route_board, seat_fabrics, rear_glass, driver_cabin_partition, voltage, customer_name
FROM archive.prdn_wo_details
WHERE id = 12345;

-- 2. Child tables that reference prdn_wo_details only
INSERT INTO public.prdn_wo_add_req (id, wo_id, pos_num, work_details, work_qty, work_rate)
SELECT id, wo_id, pos_num, work_details, work_qty, work_rate
FROM archive.prdn_wo_add_req WHERE wo_id = 12345;

INSERT INTO public.prdn_wo_amend (id, wo_id, pos_num, work_details, work_type, work_cost, gst, amend_date)
SELECT id, wo_id, pos_num, work_details, work_type, work_cost, gst, amend_date
FROM archive.prdn_wo_amend WHERE wo_id = 12345;

INSERT INTO public.prdn_work_additions (id, wo_details_id, stage_code, derived_sw_code, other_work_code, other_work_sc, other_work_desc, other_work_est_time_min, addition_reason, added_by, added_dt)
SELECT id, wo_details_id, stage_code, derived_sw_code, other_work_code, other_work_sc, other_work_desc, other_work_est_time_min, addition_reason, added_by, added_dt
FROM archive.prdn_work_additions WHERE wo_details_id = 12345;

INSERT INTO public.prdn_work_status (id, wo_details_id, stage_code, derived_sw_code, other_work_code, current_status, created_by, created_dt, modified_by, modified_dt)
SELECT id, wo_details_id, stage_code, derived_sw_code, other_work_code, current_status, created_by, created_dt, modified_by, modified_dt
FROM archive.prdn_work_status WHERE wo_details_id = 12345;

INSERT INTO public.prdn_work_removals (id, wo_details_id, stage_code, derived_sw_code, other_work_code, removal_reason, removed_by, removed_dt)
SELECT id, wo_details_id, stage_code, derived_sw_code, other_work_code, removal_reason, removed_by, removed_dt
FROM archive.prdn_work_removals WHERE wo_details_id = 12345;

INSERT INTO public.prdn_dates (id, sales_order_id, stage_code, date_type, planned_date, actual_date, created_by, created_dt, modified_by, modified_dt)
SELECT id, sales_order_id, stage_code, date_type, planned_date, actual_date, created_by, created_dt, modified_by, modified_dt
FROM archive.prdn_dates WHERE sales_order_id = 12345;

INSERT INTO public.rnd_document_requirements (id, sales_order_id, document_type, is_not_required, not_required_comments, marked_by, marked_dt, created_dt, modified_by, modified_dt)
SELECT id, sales_order_id, document_type, is_not_required, not_required_comments, marked_by, marked_dt, created_dt, modified_by, modified_dt
FROM archive.rnd_document_requirements WHERE sales_order_id = 12345;

INSERT INTO public.rnd_document_submissions (id, sales_order_id, document_type, document_name, file_path, file_size, file_type, submission_date, revised_date, revision_number, is_current, is_deleted, replaced_by_id, uploaded_by, created_dt, modified_by, modified_dt)
SELECT id, sales_order_id, document_type, document_name, file_path, file_size, file_type, submission_date, revised_date, revision_number, is_current, is_deleted, replaced_by_id, uploaded_by, created_dt, modified_by, modified_dt
FROM archive.rnd_document_submissions WHERE sales_order_id = 12345;

INSERT INTO public.sales_chassis_receival_records (id, sales_order_id, template_id, inspection_date, inspection_status, inspection_notes, inspector_name, field_responses, is_deleted, created_by, created_dt, modified_by, modified_dt)
SELECT id, sales_order_id, template_id, inspection_date, inspection_status, inspection_notes, inspector_name, field_responses, is_deleted, created_by, created_dt, modified_by, modified_dt
FROM archive.sales_chassis_receival_records WHERE sales_order_id = 12345;

-- 3. prdn_work_planning (references wo_details_id; no FK to submissions required for restore if you allow orphaned planning or restore submissions separately)
INSERT INTO public.prdn_work_planning (id, planning_submission_id, wo_details_id, stage_code, shift_code, derived_sw_code, other_work_code, worker_id, from_date, from_time, to_date, to_time, planned_hours, time_worked_till_date, remaining_time, status, notes, report_unplanned_work, sc_required, wsm_id, is_active, is_deleted, created_by, created_dt, modified_by, modified_dt)
SELECT id, planning_submission_id, wo_details_id, stage_code, COALESCE(shift_code, 'GEN'), derived_sw_code, other_work_code, worker_id, from_date, from_time, to_date, to_time, planned_hours, time_worked_till_date, remaining_time, status, notes, report_unplanned_work, sc_required, wsm_id, is_active, is_deleted, created_by, created_dt, modified_by, modified_dt
FROM archive.prdn_work_planning WHERE wo_details_id = 12345;

-- 4. Deviations (reference planning_id)
INSERT INTO public.prdn_work_planning_deviations (id, planning_id, deviation_type, reason, is_active, is_deleted, created_by, created_dt, modified_by, modified_dt)
SELECT d.id, d.planning_id, d.deviation_type, d.reason, d.is_active, d.is_deleted, d.created_by, d.created_dt, d.modified_by, d.modified_dt
FROM archive.prdn_work_planning_deviations d
JOIN archive.prdn_work_planning p ON p.id = d.planning_id AND p.wo_details_id = 12345;

INSERT INTO public.prdn_work_reporting (id, reporting_submission_id, planning_id, worker_id, from_date, from_time, to_date, to_time, hours_worked_today, hours_worked_till_date, status, completion_status, pr_type, pr_std_time, pr_rate_work, pr_pow, pr_amount, pr_calculated_dt, overtime_minutes, overtime_amount, lt_minutes_total, lt_details, lt_comments, remarks, is_active, is_deleted, created_by, created_dt, modified_by, modified_dt, pr_rate_worker)
SELECT r.id, r.reporting_submission_id, r.planning_id, r.worker_id, r.from_date, r.from_time, r.to_date, r.to_time, r.hours_worked_today, r.hours_worked_till_date, r.status, r.completion_status, r.pr_type, r.pr_std_time, r.pr_rate_work, r.pr_pow, r.pr_amount, r.pr_calculated_dt, r.overtime_minutes, r.overtime_amount, r.lt_minutes_total, r.lt_details, r.lt_comments, r.remarks, r.is_active, r.is_deleted, r.created_by, r.created_dt, r.modified_by, r.modified_dt, r.pr_rate_worker
FROM archive.prdn_work_reporting r
JOIN archive.prdn_work_planning p ON p.id = r.planning_id AND p.wo_details_id = 12345;

INSERT INTO public.prdn_work_reporting_deviations (id, reporting_id, planning_id, deviation_type, reason, is_active, is_deleted, created_by, created_dt, modified_by, modified_dt)
SELECT d.id, d.reporting_id, d.planning_id, d.deviation_type, d.reason, d.is_active, d.is_deleted, d.created_by, d.created_dt, d.modified_by, d.modified_dt
FROM archive.prdn_work_reporting_deviations d
JOIN archive.prdn_work_planning p ON p.id = d.planning_id AND p.wo_details_id = 12345;

-- -----------------------------------------------------------------------------
-- Optional: Remove from archive after successful restore (run only if desired)
-- -----------------------------------------------------------------------------
-- DELETE FROM archive.prdn_work_reporting_deviations WHERE planning_id IN (SELECT id FROM archive.prdn_work_planning WHERE wo_details_id = 12345);
-- DELETE FROM archive.prdn_work_reporting WHERE planning_id IN (SELECT id FROM archive.prdn_work_planning WHERE wo_details_id = 12345);
-- DELETE FROM archive.prdn_work_planning_deviations WHERE planning_id IN (SELECT id FROM archive.prdn_work_planning WHERE wo_details_id = 12345);
-- DELETE FROM archive.prdn_work_planning WHERE wo_details_id = 12345;
-- DELETE FROM archive.prdn_work_removals WHERE wo_details_id = 12345;
-- DELETE FROM archive.prdn_work_status WHERE wo_details_id = 12345;
-- DELETE FROM archive.prdn_dates WHERE sales_order_id = 12345;
-- DELETE FROM archive.rnd_document_requirements WHERE sales_order_id = 12345;
-- DELETE FROM archive.rnd_document_submissions WHERE sales_order_id = 12345;
-- DELETE FROM archive.sales_chassis_receival_records WHERE sales_order_id = 12345;
-- DELETE FROM archive.prdn_wo_add_req WHERE wo_id = 12345;
-- DELETE FROM archive.prdn_wo_amend WHERE wo_id = 12345;
-- DELETE FROM archive.prdn_work_additions WHERE wo_details_id = 12345;
-- DELETE FROM archive.prdn_wo_details WHERE id = 12345;
