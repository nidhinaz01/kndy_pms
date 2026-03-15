-- =============================================================================
-- Export piece-rate debug data for ONE worker_id
-- =============================================================================
-- 1. Replace 'EA738' with your worker_id in ALL 6 SELECTs below (search for EA738).
-- 2. Run the whole script. You will get 6 result sets (one per table).
-- 3. Export or copy each result set to share for procedure verification.
-- =============================================================================

-- =============================================================================
-- 1. prdn_work_reporting (all rows for this worker)
-- =============================================================================
SELECT
  id,
  planning_id,
  worker_id,
  from_date,
  from_time,
  to_date,
  to_time,
  hours_worked_till_date,
  hours_worked_today,
  completion_status,
  status,
  pr_type,
  pr_std_time,
  pr_rate_work,
  pr_rate_worker,
  pr_pow,
  pr_amount,
  pr_calculated_dt,
  is_active,
  is_deleted,
  created_by,
  created_dt,
  modified_by,
  modified_dt
FROM public.prdn_work_reporting
WHERE worker_id = 'EA738'  -- <<< CHANGE THIS to your worker_id
  AND is_deleted = false
ORDER BY from_date, from_time;

-- =============================================================================
-- 2. prdn_work_planning (rows linked by planning_id from the reporting rows above)
-- =============================================================================
SELECT p.*
FROM public.prdn_work_planning p
WHERE p.id IN (
  SELECT planning_id
  FROM public.prdn_work_reporting
  WHERE worker_id = 'EA738'  -- <<< CHANGE THIS to your worker_id
    AND is_deleted = false
)
ORDER BY p.id;

-- =============================================================================
-- 3. hr_emp (this worker)
-- =============================================================================
SELECT *
FROM public.hr_emp
WHERE emp_id = 'EA738'  -- <<< CHANGE THIS to your worker_id
  AND is_deleted = false;

-- =============================================================================
-- 4. hr_skill_master (rates for this worker's skill + sc_required from their plans)
-- =============================================================================
SELECT h.*
FROM public.hr_skill_master h
WHERE h.skill_short IN (
  SELECT e.skill_short FROM public.hr_emp e WHERE e.emp_id = 'EA738' AND e.is_deleted = false
  UNION
  SELECT DISTINCT p.sc_required
  FROM public.prdn_work_planning p
  WHERE p.id IN (
    SELECT planning_id FROM public.prdn_work_reporting
    WHERE worker_id = 'EA738' AND is_deleted = false
  )
)
  AND h.is_deleted = false
ORDER BY h.skill_short, h.wef_date DESC;

-- =============================================================================
-- 5. std_skill_time_standards (for wsm_id from this worker's planning rows)
-- =============================================================================
SELECT sts.*
FROM public.std_skill_time_standards sts
WHERE sts.wsm_id IN (
  SELECT DISTINCT p.wsm_id
  FROM public.prdn_work_planning p
  WHERE p.id IN (
    SELECT planning_id FROM public.prdn_work_reporting
    WHERE worker_id = 'EA738' AND is_deleted = false
  )
    AND p.wsm_id IS NOT NULL
)
  AND sts.is_deleted = false
  AND sts.is_active = true
ORDER BY sts.wsm_id, sts.skill_short;

-- =============================================================================
-- 6. plan_holidays (for months in this worker's report from_date)
-- =============================================================================
SELECT ph.*
FROM public.plan_holidays ph
WHERE (ph.dt_year, trim(ph.dt_month)) IN (
  SELECT
    extract(YEAR FROM r.from_date)::smallint,
    trim(to_char(r.from_date, 'Month'))
  FROM public.prdn_work_reporting r
  WHERE r.worker_id = 'EA738'  -- <<< CHANGE THIS to your worker_id
    AND r.is_deleted = false
)
  AND ph.is_deleted = false
ORDER BY ph.dt_year, ph.dt_month, ph.dt_day;

-- =============================================================================
-- END: Run all 6 queries; replace 'EA738' with your worker_id in each.
-- =============================================================================
