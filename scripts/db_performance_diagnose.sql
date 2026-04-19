-- =============================================================================
-- STEP A — Diagnostics (run before db_performance_indexes_migration.sql)
--
-- Stage codes, work-order ids, and planning ids are derived from live data via
-- CTEs — no placeholders. If a CTE resolves to empty (empty database), plans
-- may scan with 0 matching rows; that is still a valid planner check.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- A1. Approximate row counts (sanity check)
-- -----------------------------------------------------------------------------
SELECT 'prdn_dates'::text AS tbl, COUNT(*) FROM prdn_dates
UNION ALL SELECT 'prdn_work_status', COUNT(*) FROM prdn_work_status
UNION ALL SELECT 'prdn_work_reporting', COUNT(*) FROM prdn_work_reporting;


-- -----------------------------------------------------------------------------
-- A2. Rough selectivity on prdn_dates (helps justify partial indexes)
-- -----------------------------------------------------------------------------
SELECT date_type, COUNT(*) AS rows
FROM prdn_dates
GROUP BY date_type
ORDER BY rows DESC;

SELECT COUNT(*) AS entry_rows_with_actual
FROM prdn_dates
WHERE date_type = 'entry' AND actual_date IS NOT NULL;

SELECT COUNT(*) AS exit_rows_with_actual
FROM prdn_dates
WHERE date_type = 'exit' AND actual_date IS NOT NULL;


-- -----------------------------------------------------------------------------
-- A3. Same query shape as get_active_work_orders — EXPLAIN only
--
-- chosen_stage: prefers the stage with the most entry rows that have
-- actual_date set, then falls back to busiest stage in prdn_work_status,
-- then any stage in prdn_dates.
-- -----------------------------------------------------------------------------
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
WITH chosen_stage AS (
  SELECT COALESCE(
    (
      SELECT d.stage_code
      FROM prdn_dates d
      WHERE d.date_type = 'entry'
        AND d.actual_date IS NOT NULL
      GROUP BY d.stage_code
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ),
    (
      SELECT s.stage_code
      FROM prdn_work_status s
      WHERE s.current_status <> 'Removed'
      GROUP BY s.stage_code
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ),
    (SELECT stage_code FROM prdn_dates LIMIT 1)
  ) AS stage_code
)
SELECT DISTINCT
  wo.id AS wo_id,
  wo.wo_model,
  wo.wo_no,
  wo.pwo_no
FROM prdn_dates entry
INNER JOIN prdn_wo_details wo ON wo.id = entry.sales_order_id
CROSS JOIN chosen_stage cs
WHERE entry.stage_code = cs.stage_code
  AND entry.date_type = 'entry'
  AND entry.actual_date IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM prdn_dates exit
    WHERE exit.sales_order_id = entry.sales_order_id
      AND exit.stage_code = entry.stage_code
      AND exit.date_type = 'exit'
      AND exit.actual_date IS NOT NULL
  )
ORDER BY wo.id;


-- -----------------------------------------------------------------------------
-- A4. prdn_work_status filter pattern (same as RPC get_work_statuses_with_codes)
--
-- Uses the same chosen_stage logic. wo_details_ids: up to 50 distinct ids
-- already present for that stage and not Removed.
-- -----------------------------------------------------------------------------
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
WITH chosen_stage AS (
  SELECT COALESCE(
    (
      SELECT d.stage_code
      FROM prdn_dates d
      WHERE d.date_type = 'entry'
        AND d.actual_date IS NOT NULL
      GROUP BY d.stage_code
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ),
    (
      SELECT s.stage_code
      FROM prdn_work_status s
      WHERE s.current_status <> 'Removed'
      GROUP BY s.stage_code
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ),
    (SELECT stage_code FROM prdn_dates LIMIT 1)
  ) AS stage_code
),
wo_sample AS (
  SELECT DISTINCT ws_inner.wo_details_id
  FROM prdn_work_status ws_inner
  INNER JOIN chosen_stage cs ON ws_inner.stage_code = cs.stage_code
  WHERE ws_inner.current_status <> 'Removed'
    AND cs.stage_code IS NOT NULL
  LIMIT 50
)
SELECT COUNT(*)
FROM prdn_work_status ws
INNER JOIN chosen_stage cs ON ws.stage_code = cs.stage_code
WHERE cs.stage_code IS NOT NULL
  AND ws.current_status <> 'Removed'
  AND ws.wo_details_id IN (SELECT wo_details_id FROM wo_sample);


-- -----------------------------------------------------------------------------
-- A5. prdn_work_reporting by planning_id (heavy app path)
--
-- Planning ids: up to 15 distinct ids from reporting (non-deleted), merged with
-- latest planning table ids so the sample is non-empty when reporting is sparse.
-- -----------------------------------------------------------------------------
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
WITH chosen_planning_ids AS (
  SELECT DISTINCT id
  FROM (
    SELECT r.planning_id AS id
    FROM prdn_work_reporting r
    WHERE r.planning_id IS NOT NULL
      AND r.is_deleted = false
    UNION ALL
    SELECT p.id
    FROM prdn_work_planning p
  ) u
  ORDER BY id DESC
  LIMIT 15
)
SELECT r.id,
       r.planning_id,
       r.status
FROM prdn_work_reporting r
WHERE r.is_deleted = false
  AND r.planning_id IN (SELECT id FROM chosen_planning_ids);
