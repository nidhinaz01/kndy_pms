-- =============================================================================
-- STEP B — Optional performance indexes for production workloads
--
-- IMPORTANT (PostgreSQL):
--   * CREATE INDEX CONCURRENTLY cannot run inside a BEGIN/COMMIT transaction.
--   * In Supabase SQL Editor: run EACH statement SEPARATELY (one query at a time).
--   * If one fails, fix the reason, then continue with the rest.
--
-- ORDER:
--   1) Run STEP A diagnostics (db_performance_diagnose.sql) once on staging.
--   2) Apply indexes below during low-traffic window (first time may take minutes).
--   3) Run ANALYZE (section at bottom).
--   4) Re-run EXPLAIN from STEP A — expect "Index" / lower buffers vs seq scans.
--
-- ROLLBACK: see db_performance_indexes_rollback.sql (DROP INDEX CONCURRENTLY).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- B1. prdn_dates — supports get_active_work_orders outer path
--     Filter: stage_code + date_type='entry' + actual_date IS NOT NULL + sales_order_id
-- -----------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prdn_dates_stage_entry_actual
ON public.prdn_dates (stage_code, sales_order_id)
WHERE date_type = 'entry' AND actual_date IS NOT NULL;


-- -----------------------------------------------------------------------------
-- B2. prdn_dates — supports NOT EXISTS exit anti-join in get_active_work_orders
--     Lookup: sales_order_id + stage_code + exit with actual_date set
-- -----------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prdn_dates_sales_stage_exit_actual
ON public.prdn_dates (sales_order_id, stage_code)
WHERE date_type = 'exit' AND actual_date IS NOT NULL;


-- -----------------------------------------------------------------------------
-- B3. prdn_work_status — supports get_work_statuses_with_codes (all three SELECTs)
--     Filter: stage_code + wo_details_id + current_status <> 'Removed'
-- -----------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prdn_work_status_stage_wo_not_removed
ON public.prdn_work_status (stage_code, wo_details_id)
WHERE current_status <> 'Removed';


-- -----------------------------------------------------------------------------
-- B4. prdn_work_reporting — supports IN(planning_id, ...) and joins from planning
-- -----------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prdn_work_reporting_planning_id_active
ON public.prdn_work_reporting (planning_id)
WHERE is_deleted = false;


-- -----------------------------------------------------------------------------
-- B5. prdn_work_reporting — optional: tab/report filters by date + status
--     Add only if EXPLAIN shows seq scan on this pattern in your environment.
--     You can COMMENT OUT this block initially and enable after A3 shows need.
-- -----------------------------------------------------------------------------
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prdn_work_reporting_from_date_status
-- ON public.prdn_work_reporting (from_date, status)
-- WHERE is_deleted = false;


-- =============================================================================
-- STEP C — Refresh planner statistics after new indexes
-- =============================================================================
ANALYZE public.prdn_dates;
ANALYZE public.prdn_work_status;
ANALYZE public.prdn_work_reporting;
