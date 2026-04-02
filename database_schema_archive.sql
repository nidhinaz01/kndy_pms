-- =============================================================================
-- Archive schema for completed work orders (reporting only, no FKs)
-- Run this in Supabase SQL editor. Add archived_by, archived_dt on wo_details.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS archive;

-- -----------------------------------------------------------------------------
-- 1. archive.prdn_wo_details (root table; includes audit columns)
-- -----------------------------------------------------------------------------
CREATE TABLE archive.prdn_wo_details (
    id integer PRIMARY KEY,
    wo_no character varying,
    pwo_no character varying,
    wo_type character varying,
    wo_model character varying,
    wo_chassis character varying,
    wo_date date,
    wo_delivery date,
    wo_prdn_start date,
    wo_prdn_end date,
    model_rate numeric,
    work_order_cost numeric,
    gst numeric,
    cess numeric,
    total_cost numeric,
    wheel_base character varying,
    body_width_mm character varying,
    height character varying,
    air_ventilation_nos character varying,
    escape_hatch character varying,
    front character varying,
    rear character varying,
    front_glass character varying,
    emergency_door_nos character varying,
    platform character varying,
    inside_grab_rails character varying,
    seat_type character varying,
    no_of_seats character varying,
    seat_configuration character varying,
    dickey character varying,
    passenger_door_nos character varying,
    side_ventilation character varying,
    door_position_front character varying,
    door_position_rear character varying,
    inside_top_panel character varying,
    inside_side_panel character varying,
    inside_luggage_rack character varying,
    sound_system character varying,
    paint character varying,
    fire_extinguisher_kg character varying,
    wiper character varying,
    stepney character varying,
    record_box_nos character varying,
    route_board character varying,
    seat_fabrics character varying,
    rear_glass character varying,
    driver_cabin_partition character varying,
    voltage character varying,
    customer_name character varying,
    nc_category character varying(100) NULL,
    comments text NULL,
    archived_by character varying(100) NOT NULL,
    archived_dt timestamp without time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

COMMENT ON TABLE archive.prdn_wo_details IS 'Archived work order details; audit columns archived_by, archived_dt.';

-- -----------------------------------------------------------------------------
-- 2. archive.prdn_wo_add_req
-- -----------------------------------------------------------------------------
CREATE TABLE archive.prdn_wo_add_req (
    id integer PRIMARY KEY,
    wo_id integer NOT NULL,
    pos_num smallint,
    work_details character varying,
    work_qty smallint,
    work_rate numeric
);

-- -----------------------------------------------------------------------------
-- 3. archive.prdn_wo_amend
-- -----------------------------------------------------------------------------
CREATE TABLE archive.prdn_wo_amend (
    id integer PRIMARY KEY,
    wo_id integer NOT NULL,
    pos_num smallint,
    work_details character varying,
    work_type character varying,
    work_cost numeric,
    gst numeric,
    amend_date date
);

-- -----------------------------------------------------------------------------
-- 4. archive.prdn_work_additions
-- -----------------------------------------------------------------------------
CREATE TABLE archive.prdn_work_additions (
    id integer PRIMARY KEY,
    wo_details_id integer NOT NULL,
    stage_code character varying,
    derived_sw_code character varying,
    other_work_code character varying,
    other_work_sc character varying,
    other_work_desc character varying,
    other_work_est_time_min integer,
    addition_reason text,
    added_by character varying,
    added_dt timestamp without time zone
);

-- -----------------------------------------------------------------------------
-- 5. archive.prdn_work_planning
-- -----------------------------------------------------------------------------
CREATE TABLE archive.prdn_work_planning (
    id integer PRIMARY KEY,
    planning_submission_id integer,
    wo_details_id integer NOT NULL,
    stage_code character varying,
    shift_code character varying(20),
    derived_sw_code character varying,
    other_work_code character varying,
    worker_id character varying,
    from_date date,
    from_time time without time zone,
    to_date date,
    to_time time without time zone,
    planned_hours numeric,
    time_worked_till_date numeric,
    remaining_time numeric,
    status character varying,
    notes text,
    report_unplanned_work boolean,
    sc_required character varying,
    wsm_id integer,
    is_active boolean,
    is_deleted boolean,
    created_by character varying,
    created_dt timestamp without time zone,
    modified_by character varying,
    modified_dt timestamp without time zone
);

COMMENT ON COLUMN archive.prdn_work_planning.shift_code IS 'Snapshot of public.prdn_work_planning.shift_code at archive time (shift scope).';

-- -----------------------------------------------------------------------------
-- 6. archive.prdn_work_planning_deviations
-- -----------------------------------------------------------------------------
CREATE TABLE archive.prdn_work_planning_deviations (
    id integer PRIMARY KEY,
    planning_id integer NOT NULL,
    deviation_type character varying(50),
    reason text NOT NULL,
    is_active boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    created_by character varying(100),
    created_dt timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modified_by character varying(100),
    modified_dt timestamp without time zone
);

-- -----------------------------------------------------------------------------
-- 7. archive.prdn_work_removals
-- -----------------------------------------------------------------------------
CREATE TABLE archive.prdn_work_removals (
    id integer PRIMARY KEY,
    wo_details_id integer NOT NULL,
    stage_code character varying(10) NOT NULL,
    derived_sw_code character varying(15),
    other_work_code character varying,
    removal_reason text NOT NULL,
    removed_by character varying(100) NOT NULL,
    removed_dt timestamp without time zone NOT NULL,
    created_by character varying(100),
    created_dt timestamp without time zone,
    modified_by character varying(100),
    modified_dt timestamp without time zone,
    is_deleted boolean DEFAULT false
);

-- -----------------------------------------------------------------------------
-- 8. archive.prdn_work_reporting
-- -----------------------------------------------------------------------------
CREATE TABLE archive.prdn_work_reporting (
    id integer PRIMARY KEY,
    reporting_submission_id integer,
    planning_id integer NOT NULL,
    worker_id character varying,
    from_date date,
    from_time time without time zone,
    to_date date,
    to_time time without time zone,
    hours_worked_today numeric,
    hours_worked_till_date numeric,
    time_worked_till_date numeric,
    remaining_time numeric,
    status character varying,
    completion_status character varying,
    pr_type character varying,
    pr_std_time integer,
    pr_rate_work numeric,
    pr_pow numeric,
    pr_amount numeric,
    pr_calculated_dt timestamp without time zone,
    overtime_minutes smallint,
    overtime_amount double precision,
    lt_minutes_total integer,
    lt_details json,
    lt_comments character varying,
    remarks character varying,
    is_active boolean,
    is_deleted boolean,
    created_by character varying,
    created_dt timestamp without time zone,
    modified_by character varying,
    modified_dt timestamp without time zone,
    pr_rate_worker numeric(10, 2)
);

-- -----------------------------------------------------------------------------
-- 9. archive.prdn_work_reporting_deviations
-- -----------------------------------------------------------------------------
CREATE TABLE archive.prdn_work_reporting_deviations (
    id integer PRIMARY KEY,
    reporting_id integer NOT NULL,
    planning_id integer,
    deviation_type character varying(50) NOT NULL,
    reason text NOT NULL,
    is_active boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    created_by character varying(100),
    created_dt timestamp without time zone,
    modified_by character varying(100),
    modified_dt timestamp without time zone
);

-- -----------------------------------------------------------------------------
-- 10. archive.prdn_work_status
-- -----------------------------------------------------------------------------
CREATE TABLE archive.prdn_work_status (
    id integer PRIMARY KEY,
    wo_details_id integer NOT NULL,
    stage_code character varying,
    derived_sw_code character varying,
    other_work_code character varying,
    current_status character varying,
    created_by character varying,
    created_dt timestamp without time zone,
    modified_by character varying,
    modified_dt timestamp without time zone
);

-- -----------------------------------------------------------------------------
-- 11. archive.prdn_dates
-- -----------------------------------------------------------------------------
CREATE TABLE archive.prdn_dates (
    id integer PRIMARY KEY,
    sales_order_id integer NOT NULL,
    stage_code character varying,
    date_type character varying,
    planned_date timestamp without time zone,
    actual_date timestamp without time zone,
    created_by character varying,
    created_dt timestamp without time zone,
    modified_by character varying,
    modified_dt timestamp without time zone
);

-- -----------------------------------------------------------------------------
-- 12. archive.rnd_document_requirements
-- -----------------------------------------------------------------------------
CREATE TABLE archive.rnd_document_requirements (
    id integer PRIMARY KEY,
    sales_order_id integer NOT NULL,
    document_type character varying NOT NULL,
    is_not_required boolean NOT NULL DEFAULT false,
    not_required_comments text,
    marked_by character varying,
    marked_dt timestamp without time zone,
    created_dt timestamp without time zone,
    modified_by character varying,
    modified_dt timestamp without time zone
);

-- -----------------------------------------------------------------------------
-- 13. archive.rnd_document_submissions
-- -----------------------------------------------------------------------------
CREATE TABLE archive.rnd_document_submissions (
    id integer PRIMARY KEY,
    sales_order_id integer NOT NULL,
    document_type character varying,
    document_name character varying,
    file_path text,
    file_size bigint,
    file_type character varying,
    submission_date timestamp without time zone,
    revised_date timestamp without time zone,
    revision_number integer DEFAULT 1,
    is_current boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    replaced_by_id integer,
    uploaded_by character varying(100),
    created_dt timestamp without time zone,
    modified_by character varying(100),
    modified_dt timestamp without time zone
);

-- -----------------------------------------------------------------------------
-- 14. archive.sales_chassis_receival_records
-- -----------------------------------------------------------------------------
CREATE TABLE archive.sales_chassis_receival_records (
    id integer PRIMARY KEY,
    sales_order_id integer NOT NULL,
    template_id integer,
    inspection_date date,
    inspection_status character varying,
    inspection_notes text,
    inspector_name character varying,
    field_responses jsonb,
    is_deleted boolean DEFAULT false,
    created_by character varying,
    created_dt timestamp without time zone,
    modified_by character varying,
    modified_dt timestamp without time zone
);

-- -----------------------------------------------------------------------------
-- Indexes for common report queries on archive.prdn_wo_details
-- -----------------------------------------------------------------------------
CREATE INDEX idx_archive_wo_details_wo_no ON archive.prdn_wo_details(wo_no);
CREATE INDEX idx_archive_wo_details_wo_date ON archive.prdn_wo_details(wo_date);
CREATE INDEX idx_archive_wo_details_archived_dt ON archive.prdn_wo_details(archived_dt);

-- Optional: indexes on child tables for report joins
CREATE INDEX idx_archive_work_planning_wo_details_id ON archive.prdn_work_planning(wo_details_id);
CREATE INDEX idx_archive_work_reporting_planning_id ON archive.prdn_work_reporting(planning_id);
CREATE INDEX idx_archive_dates_sales_order_id ON archive.prdn_dates(sales_order_id);
CREATE INDEX idx_archive_rnd_submissions_sales_order_id ON archive.rnd_document_submissions(sales_order_id);

-- Grant read access so the app can list archived WOs (adjust roles to match your project)
-- GRANT USAGE ON SCHEMA archive TO authenticated;
-- GRANT SELECT ON ALL TABLES IN SCHEMA archive TO authenticated;
