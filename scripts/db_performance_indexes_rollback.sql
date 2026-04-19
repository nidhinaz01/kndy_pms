-- =============================================================================
-- Rollback — drop indexes created by db_performance_indexes_migration.sql
--
-- Rules: DROP INDEX CONCURRENTLY also cannot run inside a transaction block.
--        Run ONE statement at a time in Supabase SQL Editor.
-- =============================================================================

DROP INDEX CONCURRENTLY IF EXISTS public.idx_prdn_dates_stage_entry_actual;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_prdn_dates_sales_stage_exit_actual;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_prdn_work_status_stage_wo_not_removed;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_prdn_work_reporting_planning_id_active;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_prdn_work_reporting_from_date_status;

ANALYZE public.prdn_dates;
ANALYZE public.prdn_work_status;
ANALYZE public.prdn_work_reporting;
