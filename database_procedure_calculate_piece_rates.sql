-- =============================================================================
-- Procedure: calculate_piece_rates
-- =============================================================================
-- Calculates piece rate columns for approved work reports that have not yet
-- been calculated. Only processes groups (wo_details_id, derived_sw_code,
-- sc_required) where at least one report has completion_status = 'C'.
-- Updates only rows where pr_calculated_dt IS NULL.
-- Call via: SELECT * FROM public.calculate_piece_rates();
-- Or from Supabase: supabase.rpc('calculate_piece_rates')
-- =============================================================================

-- Returns rate_per_hour effective on p_work_date (date-only: wef_date <= date and wet_date null or >= date).
CREATE OR REPLACE FUNCTION public.get_skill_rate_effective(
  p_skill_short text,
  p_work_date date,
  p_work_time time default '00:00:00'::time
)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT h.rate_per_hour::numeric
  FROM public.hr_skill_master h
  WHERE h.skill_short = p_skill_short
    AND h.is_deleted = false
    AND h.is_active = true
    AND h.wef_date <= p_work_date
    AND (h.wet_date IS NULL OR h.wet_date >= p_work_date)
  ORDER BY h.wef_date DESC, h.wef_time DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_working_days_in_month(p_work_date date)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT extract(day from (date_trunc('month', p_work_date) + interval '1 month' - interval '1 day'))::integer
    - COALESCE((
        SELECT count(*)::integer
        FROM public.plan_holidays ph
        WHERE ph.dt_year = extract(year from p_work_date)::smallint
          AND trim(ph.dt_month) = trim(to_char(p_work_date, 'Month'))
          AND ph.is_active = true
          AND ph.is_deleted = false
      ), 0);
$$;

CREATE OR REPLACE FUNCTION public.calculate_piece_rates()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  v_updated_count integer := 0;
  v_pr_type varchar(2);
  v_pr_std_time integer;
  v_pr_rate_work numeric(10,2);
  v_pr_rate_worker numeric(10,2);
  v_pr_pow numeric(5,4);
  v_pr_amount numeric(10,2);
  v_total_hours numeric;
  v_worker_skill text;
  v_worker_rate numeric;
  v_work_rate numeric;
  v_salary numeric;
  v_working_days integer;
  v_calc_dt timestamptz := now();
  v_modified_by text := 'piece_rate_procedure';
BEGIN
  -- Process each report that: is approved, in a group with at least one C, and not yet calculated
  FOR rec IN
    WITH eligible_groups AS (
      SELECT DISTINCT p.wo_details_id, p.derived_sw_code, p.sc_required
      FROM public.prdn_work_reporting r
      JOIN public.prdn_work_planning p ON p.id = r.planning_id AND p.is_deleted = false AND p.is_active = true
      WHERE r.status = 'approved'
        AND r.completion_status = 'C'
        AND r.is_deleted = false
        AND r.is_active = true
    ),
    reports_to_update AS (
      SELECT r.id, r.planning_id, r.worker_id, r.from_date, r.from_time, r.hours_worked_today,
             p.wo_details_id, p.derived_sw_code, p.sc_required, p.other_work_code, p.wsm_id
      FROM public.prdn_work_reporting r
      JOIN public.prdn_work_planning p ON p.id = r.planning_id AND p.is_deleted = false AND p.is_active = true
      JOIN eligible_groups g ON g.wo_details_id = p.wo_details_id
        AND (g.derived_sw_code IS NOT DISTINCT FROM p.derived_sw_code)
        AND g.sc_required = p.sc_required
      WHERE r.status = 'approved'
        AND r.completion_status IN ('C', 'NC')
        AND r.is_deleted = false
        AND r.is_active = true
        AND r.pr_calculated_dt IS NULL
        AND r.worker_id IS NOT NULL
    )
    SELECT * FROM reports_to_update
  LOOP
    BEGIN
      v_pr_type := NULL;
      v_pr_std_time := NULL;
      v_pr_rate_work := NULL;
      v_pr_rate_worker := NULL;
      v_pr_pow := NULL;
      v_pr_amount := NULL;
      v_worker_rate := NULL;
      v_work_rate := NULL;

      -- 1) pr_type: SL if other_work_code set; else PR only if worker's skill has rate_per_hour > 0 (no fallback)
      IF rec.other_work_code IS NOT NULL THEN
        v_pr_type := 'SL';
      ELSE
        v_worker_skill := (SELECT e.skill_short FROM public.hr_emp e WHERE e.emp_id = rec.worker_id AND e.is_deleted = false AND e.is_active = true LIMIT 1);
        v_worker_rate := public.get_skill_rate_effective(v_worker_skill, rec.from_date, COALESCE(rec.from_time, '00:00:00'::time));
        IF v_worker_rate IS NOT NULL AND v_worker_rate > 0 THEN
          v_pr_type := 'PR';
        ELSE
          v_pr_type := 'SL';
        END IF;
      END IF;

      -- 2) pr_std_time (only for PR)
      IF v_pr_type = 'SL' THEN
        v_pr_std_time := NULL;
      ELSE
        SELECT sts.standard_time_minutes INTO v_pr_std_time
        FROM public.std_skill_time_standards sts
        WHERE sts.wsm_id = rec.wsm_id
          AND sts.skill_short = rec.sc_required
          AND sts.is_deleted = false
          AND sts.is_active = true
        LIMIT 1;
      END IF;

      -- 3) pr_rate_work and pr_rate_worker
      IF v_pr_type = 'SL' THEN
        v_pr_rate_work := 0;
        v_working_days := public.get_working_days_in_month(rec.from_date);
        IF v_working_days IS NULL OR v_working_days <= 0 THEN
          v_pr_rate_worker := NULL;
        ELSE
          SELECT e.salary INTO v_salary
          FROM public.hr_emp e
          WHERE e.emp_id = rec.worker_id AND e.is_deleted = false AND e.is_active = true
          LIMIT 1;
          v_pr_rate_worker := CASE WHEN v_salary IS NOT NULL THEN round((v_salary / v_working_days)::numeric, 2) ELSE NULL END;
        END IF;
      ELSE
        -- PR: amount per piece = rate_per_hour * (std_time_minutes/60)
        v_work_rate := public.get_skill_rate_effective(rec.sc_required, rec.from_date, COALESCE(rec.from_time, '00:00:00'::time));
        v_worker_skill := (SELECT e.skill_short FROM public.hr_emp e WHERE e.emp_id = rec.worker_id AND e.is_deleted = false AND e.is_active = true LIMIT 1);
        v_worker_rate := public.get_skill_rate_effective(v_worker_skill, rec.from_date, COALESCE(rec.from_time, '00:00:00'::time));
        IF v_pr_std_time IS NOT NULL AND v_pr_std_time > 0 THEN
          v_pr_rate_work := round((COALESCE(v_work_rate, 0) * v_pr_std_time / 60.0)::numeric, 2);
          v_pr_rate_worker := round((COALESCE(v_worker_rate, 0) * v_pr_std_time / 60.0)::numeric, 2);
        ELSE
          v_pr_rate_work := NULL;
          v_pr_rate_worker := NULL;
        END IF;
      END IF;

      -- 4) pr_pow
      IF v_pr_type = 'SL' THEN
        v_pr_pow := LEAST(COALESCE(rec.hours_worked_today, 0) / 8.0, 1.0);
      ELSE
        SELECT COALESCE(SUM(r2.hours_worked_today), 0) INTO v_total_hours
        FROM public.prdn_work_reporting r2
        JOIN public.prdn_work_planning p2 ON p2.id = r2.planning_id AND p2.is_deleted = false AND p2.is_active = true
        WHERE p2.wo_details_id = rec.wo_details_id
          AND (p2.derived_sw_code IS NOT DISTINCT FROM rec.derived_sw_code)
          AND p2.sc_required = rec.sc_required
          AND r2.status = 'approved'
          AND r2.is_deleted = false
          AND r2.is_active = true;
        IF v_total_hours IS NULL OR v_total_hours <= 0 THEN
          v_pr_pow := NULL;
        ELSE
          v_pr_pow := round((COALESCE(rec.hours_worked_today, 0) / v_total_hours)::numeric, 4);
        END IF;
      END IF;

      -- 5) pr_amount
      IF v_pr_type = 'SL' THEN
        v_pr_amount := round((COALESCE(v_pr_pow, 0) * COALESCE(v_pr_rate_worker, 0))::numeric, 2);
      ELSE
        v_pr_amount := round((COALESCE(v_pr_pow, 0) * LEAST(COALESCE(v_pr_rate_work, 0), COALESCE(v_pr_rate_worker, 0)))::numeric, 2);
      END IF;

      UPDATE public.prdn_work_reporting
      SET
        pr_type = v_pr_type,
        pr_std_time = v_pr_std_time,
        pr_rate_work = v_pr_rate_work,
        pr_rate_worker = v_pr_rate_worker,
        pr_pow = v_pr_pow,
        pr_amount = v_pr_amount,
        pr_calculated_dt = v_calc_dt,
        modified_by = v_modified_by,
        modified_dt = v_calc_dt
      WHERE id = rec.id;

      v_updated_count := v_updated_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        -- Log and continue with next row (optional: raise to abort)
        RAISE WARNING 'calculate_piece_rates: report id % failed: %', rec.id, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count,
    'calculated_at', v_calc_dt
  );
END;
$$;

COMMENT ON FUNCTION public.calculate_piece_rates() IS 'Calculates piece rate columns for approved reports with pr_calculated_dt IS NULL. Run via cron or Supabase UI.';
COMMENT ON FUNCTION public.get_skill_rate_effective(text, date, time) IS 'Returns rate_per_hour from hr_skill_master effective on the given date/time.';
COMMENT ON FUNCTION public.get_working_days_in_month(date) IS 'Returns working days in the month (days in month minus plan_holidays count).';
