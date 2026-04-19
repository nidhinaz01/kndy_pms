-- =============================================================================
-- Production context: extract DDL-related metadata (Postgres / Supabase)
-- Schema: public  (change nspname / schemaname if you use another schema)
-- =============================================================================
-- 
-- Why two parts?
--   * Function source: use Part 1 (pg_get_functiondef) in the SQL editor.
--   * Table CREATE TABLE + constraints + RLS as exact DDL: use Part 0 (pg_dump);
--     core PostgreSQL does not expose full "CREATE TABLE" in one system view.
-- =============================================================================


-- =============================================================================
-- Part 0 — Full table/object DDL (recommended; run in terminal, not in editor)
-- =============================================================================
-- Replace connection values. Example (all production-checklist tables + public schema only):
--
--   pg_dump "postgres://USER:PASSWORD@HOST:PORT/DATABASE" \
--     --schema=public --schema-only --no-owner --no-acl \
--     -t public.hr_attendance \
--     -t public.hr_daily_shift_schedule \
--     -t public.hr_emp \
--     -t public.hr_shift_break_master \
--     -t public.hr_shift_master \
--     -t public.mstr_wo_type \
--     -t public.prdn_planning_manpower \
--     -t public.prdn_planning_stage_reassignment \
--     -t public.prdn_planning_submissions \
--     -t public.prdn_reporting_manpower \
--     -t public.prdn_reporting_stage_reassignment \
--     -t public.prdn_reporting_submissions \
--     -t public.prdn_wo_details \
--     -t public.prdn_work_additions \
--     -t public.prdn_work_planning \
--     -t public.prdn_work_reporting \
--     -t public.prdn_work_removals \
--     -t public.prdn_work_status \
--     -t public.std_skill_combinations \
--     -t public.std_skill_time_standards \
--     -t public.std_vehicle_work_flow \
--     -t public.std_work_details \
--     -t public.std_work_skill_mapping \
--     -t public.std_work_type_details \
--     -f production_tables_schema.sql
--
-- To include the two functions in the same file, add:
--     -f -  2>/dev/null  (or use a second pg_dump with)
--   For functions only, use Part 1 below, or:
--   pg_dump ... -F p --schema-only -n public -N '' -T 'public.*'  (not ideal)
--   Simplest: run Part 1 in SQL for functions; pg_dump for tables.
-- =============================================================================


-- =============================================================================
-- Part 1 — Function definitions (run in Supabase SQL editor or psql; copy result)
-- =============================================================================
SELECT
  n.nspname   AS schema_name,
  p.proname   AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  l.lanname   AS language,
  pg_get_functiondef(p.oid) AS ddl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
LEFT JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND p.proname IN (
    'get_active_work_orders',
    'get_work_statuses_with_codes'
  )
ORDER BY p.proname,
         pg_get_function_identity_arguments(p.oid);


-- =============================================================================
-- Part 2 — Index DDL (CREATE INDEX statements as stored)
-- =============================================================================
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef AS ddl
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'hr_attendance',
    'hr_daily_shift_schedule',
    'hr_emp',
    'hr_shift_break_master',
    'hr_shift_master',
    'mstr_wo_type',
    'prdn_planning_manpower',
    'prdn_planning_stage_reassignment',
    'prdn_planning_submissions',
    'prdn_reporting_manpower',
    'prdn_reporting_stage_reassignment',
    'prdn_reporting_submissions',
    'prdn_wo_details',
    'prdn_work_additions',
    'prdn_work_planning',
    'prdn_work_reporting',
    'prdn_work_removals',
    'prdn_work_status',
    'std_skill_combinations',
    'std_skill_time_standards',
    'std_vehicle_work_flow',
    'std_work_details',
    'std_work_skill_mapping',
    'std_work_type_details'
  )
ORDER BY tablename, indexname;


-- =============================================================================
-- Part 3 — RLS policies (metadata; not full CREATE POLICY DDL without pg_dump)
-- =============================================================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'hr_attendance',
    'hr_daily_shift_schedule',
    'hr_emp',
    'hr_shift_break_master',
    'hr_shift_master',
    'mstr_wo_type',
    'prdn_planning_manpower',
    'prdn_planning_stage_reassignment',
    'prdn_planning_submissions',
    'prdn_reporting_manpower',
    'prdn_reporting_stage_reassignment',
    'prdn_reporting_submissions',
    'prdn_wo_details',
    'prdn_work_additions',
    'prdn_work_planning',
    'prdn_work_reporting',
    'prdn_work_removals',
    'prdn_work_status',
    'std_skill_combinations',
    'std_skill_time_standards',
    'std_vehicle_work_flow',
    'std_work_details',
    'std_work_skill_mapping',
    'std_work_type_details'
  )
ORDER BY tablename, policyname;


-- =============================================================================
-- Part 4 — Triggers on these tables (names + definition of trigger functions)
-- =============================================================================
SELECT
  n.nspname AS table_schema,
  c.relname AS table_name,
  t.tgname AS trigger_name,
  pg_get_triggerdef(t.oid, true) AS trigger_ddl
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal
  AND n.nspname = 'public'
  AND c.relname IN (
    'hr_attendance',
    'hr_daily_shift_schedule',
    'hr_emp',
    'hr_shift_break_master',
    'hr_shift_master',
    'mstr_wo_type',
    'prdn_planning_manpower',
    'prdn_planning_stage_reassignment',
    'prdn_planning_submissions',
    'prdn_reporting_manpower',
    'prdn_reporting_stage_reassignment',
    'prdn_reporting_submissions',
    'prdn_wo_details',
    'prdn_work_additions',
    'prdn_work_planning',
    'prdn_work_reporting',
    'prdn_work_removals',
    'prdn_work_status',
    'std_skill_combinations',
    'std_skill_time_standards',
    'std_vehicle_work_flow',
    'std_work_details',
    'std_work_skill_mapping',
    'std_work_type_details'
  )
ORDER BY c.relname, t.tgname;


-- Trigger function bodies referenced by triggers on those tables (optional helper)
WITH tr AS (
  SELECT DISTINCT t.tgfoid AS func_oid
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE NOT t.tgisinternal
    AND n.nspname = 'public'
    AND c.relname IN (
      'hr_attendance',
      'hr_daily_shift_schedule',
      'hr_emp',
      'hr_shift_break_master',
      'hr_shift_master',
      'mstr_wo_type',
      'prdn_planning_manpower',
      'prdn_planning_stage_reassignment',
      'prdn_planning_submissions',
      'prdn_reporting_manpower',
      'prdn_reporting_stage_reassignment',
      'prdn_reporting_submissions',
      'prdn_wo_details',
      'prdn_work_additions',
      'prdn_work_planning',
      'prdn_work_reporting',
      'prdn_work_removals',
      'prdn_work_status',
      'std_skill_combinations',
      'std_skill_time_standards',
      'std_vehicle_work_flow',
      'std_work_details',
      'std_work_skill_mapping',
      'std_work_type_details'
    )
)
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_functiondef(p.oid) AS ddl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN tr ON tr.func_oid = p.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;
