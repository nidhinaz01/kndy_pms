-- =============================================================================
-- Cron job: run piece rate calculation daily at midnight (00:00)
-- =============================================================================
-- Prerequisites:
-- 1. Run database_migration_piece_rate_pr_rate_work_worker.sql
-- 2. Run database_procedure_calculate_piece_rates.sql
-- 3. Enable pg_cron in Supabase: Database → Extensions → pg_cron
-- =============================================================================

-- Enable pg_cron (if not already). In Supabase dashboard you may enable via Extensions.
-- CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Schedule: every day at 00:00 (midnight) server time
-- Cron expression: minute hour day-of-month month day-of-week
-- '0 0 * * *' = 0 min, 0 hour, every day, every month, every day of week
SELECT cron.schedule(
  'piece_rate_calculation_daily',
  '0 0 * * *',
  $$SELECT public.calculate_piece_rates()$$
);

-- =============================================================================
-- Useful commands (run in SQL editor)
-- =============================================================================
-- List scheduled jobs:
--   SELECT * FROM cron.job;
--
-- Run manually (without waiting for cron):
--   SELECT public.calculate_piece_rates();
--
-- Unschedule (to disable the cron):
--   SELECT cron.unschedule('piece_rate_calculation_daily');
--
-- View recent runs:
--   SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'piece_rate_calculation_daily') ORDER BY start_time DESC LIMIT 10;
-- =============================================================================
