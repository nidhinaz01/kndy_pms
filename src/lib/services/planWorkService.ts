import { supabase } from '$lib/supabaseClient';
import type { Worker, WorkContinuation, ShiftInfo } from '$lib/types/planWork';
import { attendanceIsAbsent } from '$lib/utils/manpowerAttendanceStatus';
import { getEmbeddedStandardTimeMinutes } from '$lib/utils/standardTimeFromWork';

const PAGE_SIZE = 1000;

/**
 * Employees marked absent (informed/uninformed, or legacy `absent`) in Manpower Draft for this
 * stage/shift/date. Not listed here => treat as present or not yet marked — both stay selectable in Plan Work.
 */
export async function getEmpIdsAbsentInPlanningManpowerDraft(
  stageCode: string,
  shiftCode: string,
  planningDate: string
): Promise<Set<string>> {
  if (!stageCode || !shiftCode || !planningDate) return new Set();

  try {
    const { data, error } = await supabase
      .from('prdn_planning_manpower')
      .select('emp_id, attendance_status')
      .eq('stage_code', stageCode)
      .eq('shift_code', shiftCode)
      .lte('planning_from_date', planningDate)
      .gte('planning_to_date', planningDate)
      .eq('status', 'draft')
      .eq('is_deleted', false);

    if (error) {
      console.error('getEmpIdsAbsentInPlanningManpowerDraft:', error);
      return new Set();
    }

    const absent = new Set<string>();
    for (const row of data || []) {
      const id = row?.emp_id != null ? String(row.emp_id) : '';
      if (id && attendanceIsAbsent(row.attendance_status)) {
        absent.add(id);
      }
    }
    return absent;
  } catch (e) {
    console.error('getEmpIdsAbsentInPlanningManpowerDraft:', e);
    return new Set();
  }
}

export async function loadWorkers(stageCode: string): Promise<Worker[]> {
  if (!stageCode) return [];
  
  try {
    const allRows: Worker[] = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from('hr_emp')
        .select('emp_id, emp_name, skill_short, stage')
        .eq('stage', stageCode)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('emp_id')
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        console.error('Error loading workers:', error);
        return [];
      }
      const page = data || [];
      allRows.push(...(page as Worker[]));
      hasMore = page.length === PAGE_SIZE;
      offset += PAGE_SIZE;
    }
    const workers = allRows;
    
    // Debug: Log workers with missing names
    const workersWithMissingNames = workers.filter(w => !w.emp_name || w.emp_name.trim() === '');
    if (workersWithMissingNames.length > 0) {
      console.warn(`⚠️ loadWorkers: Found ${workersWithMissingNames.length} workers with missing names:`, 
        workersWithMissingNames.map(w => ({ emp_id: w.emp_id, emp_name: w.emp_name, skill_short: w.skill_short }))
      );
    }
    
    // Filter out workers with missing names and log them
    const validWorkers = workers.filter(w => w.emp_name && w.emp_name.trim() !== '');
    if (validWorkers.length < workers.length) {
      console.warn(`⚠️ loadWorkers: Filtered out ${workers.length - validWorkers.length} workers with missing names`);
    }
    
    console.log(`✅ loadWorkers: Loaded ${validWorkers.length} workers for stage ${stageCode}`);
    
    return validWorkers;
  } catch (error) {
    console.error('Error loading workers:', error);
    return [];
  }
}

export async function loadWorkContinuation(
  work: any,
  stageCode: string,
  selectedDate: string
): Promise<WorkContinuation> {
  if (!work) {
    return {
      hasPreviousWork: false,
      timeWorkedTillDate: 0,
      remainingTime: 0,
      previousReports: []
    };
  }

  try {
    const derivedSwCode = work.std_work_type_details?.derived_sw_code || work.sw_code;
    const isNonStandardWork = work.is_added_work || !work.std_work_type_details?.derived_sw_code;
    const otherWorkCode = isNonStandardWork ? (work.sw_code || null) : null;
    const woDetailsId = work.wo_details_id || work.prdn_wo_details_id;

    if (!woDetailsId || (!derivedSwCode && !otherWorkCode)) {
      return {
        hasPreviousWork: false,
        timeWorkedTillDate: 0,
        remainingTime: 0,
        previousReports: []
      };
    }

    // prdn_work_reporting doesn't have stage_code directly - need to join with prdn_work_planning
    let query = supabase
      .from('prdn_work_reporting')
      .select(`
        *,
        prdn_work_planning!inner(
          stage_code,
          wo_details_id,
          derived_sw_code,
          other_work_code
        )
      `)
      .eq('prdn_work_planning.stage_code', stageCode)
      .eq('prdn_work_planning.wo_details_id', woDetailsId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .lt('from_date', selectedDate);

    if (derivedSwCode) {
      query = query.eq('prdn_work_planning.derived_sw_code', derivedSwCode);
    } else if (otherWorkCode) {
      query = query.eq('prdn_work_planning.other_work_code', otherWorkCode);
    }

    const { data: reports, error } = await query.order('from_date', { ascending: false });

    if (error) {
      console.error('Error loading work continuation:', error);
      return {
        hasPreviousWork: false,
        timeWorkedTillDate: 0,
        remainingTime: 0,
        previousReports: []
      };
    }

    const previousReports = reports || [];
    const timeWorkedTillDate = previousReports.reduce((sum, report) => {
      return sum + (report.hours_worked_till_date || 0);
    }, 0);

    const estimatedDurationMinutes = getEmbeddedStandardTimeMinutes(work) ?? 0;
    const estimatedDurationHours = estimatedDurationMinutes / 60;
    const remainingTime = Math.max(0, estimatedDurationHours - timeWorkedTillDate);

    return {
      hasPreviousWork: previousReports.length > 0,
      timeWorkedTillDate,
      remainingTime,
      previousReports
    };
  } catch (error) {
    console.error('Error loading work continuation:', error);
    return {
      hasPreviousWork: false,
      timeWorkedTillDate: 0,
      remainingTime: 0,
      previousReports: []
    };
  }
}

export async function loadExistingPlans(
  work: any,
  stageCode: string,
  selectedDate: string
): Promise<any[]> {
  if (!work) return [];

  try {
    const derivedSwCode = work.std_work_type_details?.derived_sw_code || work.sw_code;
    const isNonStandardWork = work.is_added_work || !work.std_work_type_details?.derived_sw_code;
    const otherWorkCode = isNonStandardWork ? (work.sw_code || null) : null;
    const woDetailsId = work.wo_details_id || work.prdn_wo_details_id;

    if (!woDetailsId || (!derivedSwCode && !otherWorkCode)) {
      return [];
    }

    let query = supabase
      .from('prdn_work_planning')
      .select(`
        *,
        hr_emp(
          emp_id,
          emp_name
        )
      `)
      .eq('stage_code', stageCode)
      .eq('wo_details_id', woDetailsId)
      .eq('from_date', selectedDate)
      .eq('is_active', true)
      .eq('is_deleted', false);

    if (derivedSwCode) {
      query = query.eq('derived_sw_code', derivedSwCode);
    } else if (otherWorkCode) {
      query = query.eq('other_work_code', otherWorkCode);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading existing plans:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error loading existing plans:', error);
    return [];
  }
}

export async function loadShiftInfo(stageCode: string): Promise<ShiftInfo | null> {
  if (!stageCode) return null;

  try {
    // Get shifts associated with this stage from hr_shift_stage_master
    const { fetchShiftsForStage } = await import('$lib/api/hrShiftStageMaster');
    const allowedShiftCodes = await fetchShiftsForStage(stageCode);
    
    if (!allowedShiftCodes || allowedShiftCodes.length === 0) {
      console.warn(`No shifts configured for stage ${stageCode}`);
      return null;
    }

    // Get the first shift from hr_shift_master using the shift codes
    const { data, error } = await supabase
      .from('hr_shift_master')
      .select('*')
      .in('shift_code', allowedShiftCodes)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error loading shift info:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      hr_shift_master: data
    };
  } catch (error) {
    console.error('Error loading shift info:', error);
    return null;
  }
}

export async function checkAlternativeSkillCombinations(
  work: any,
  stageCode: string
): Promise<{ hasConflict: boolean; details: string }> {
  if (!work || !work.skill_mappings || work.skill_mappings.length <= 1) {
    return { hasConflict: false, details: '' };
  }

  const woDetailsId = work.wo_details_id || work.prdn_wo_details_id;
  const isNonStandardWork = work.is_added_work === true || !work.std_work_type_details?.derived_sw_code;
  const derivedSwCode = isNonStandardWork ? null : (work.std_work_type_details?.derived_sw_code || null);
  const otherWorkCode = isNonStandardWork ? (work.sw_code || null) : null;
  
  if (!woDetailsId || (!derivedSwCode && !otherWorkCode)) {
    return { hasConflict: false, details: '' };
  }

  try {
    let planningQuery = supabase
      .from('prdn_work_planning')
      .select(`
        *,
        prdn_work_reporting!left(
          id,
          is_deleted
        )
      `)
      .eq('wo_details_id', woDetailsId)
      .eq('stage_code', stageCode)
      .eq('is_active', true)
      .eq('is_deleted', false);

    // Filter by work code (either derived_sw_code or other_work_code)
    if (derivedSwCode && otherWorkCode) {
      planningQuery = planningQuery.or(`derived_sw_code.eq.${derivedSwCode},other_work_code.eq.${otherWorkCode}`);
    } else if (derivedSwCode) {
      planningQuery = planningQuery.eq('derived_sw_code', derivedSwCode);
    } else if (otherWorkCode) {
      planningQuery = planningQuery.eq('other_work_code', otherWorkCode);
    }

    const { data: existingPlans, error } = await planningQuery;

    if (error) {
      console.error('Error checking alternative combinations:', error);
      return { hasConflict: false, details: '' };
    }

    if (!existingPlans || existingPlans.length === 0) {
      return { hasConflict: false, details: '' };
    }

    const uncompletedPlans = existingPlans.filter(plan => {
      const reports = plan.prdn_work_reporting || [];
      const activeReports = reports.filter((r: any) => !r.is_deleted);
      return activeReports.length === 0;
    });

    if (uncompletedPlans.length > 0) {
      const conflictingScNames = uncompletedPlans.map((plan: any) => plan.sc_required).filter(Boolean);
      
      if (conflictingScNames.length > 0) {
        return {
          hasConflict: true,
          details: `This work has alternative skill combinations that have been planned but not completed:\n\n${conflictingScNames.join('\n')}\n\nOnce an alternative is planned and not completed, other alternatives cannot be planned.`
        };
      }
    }

    return { hasConflict: false, details: '' };
  } catch (error) {
    console.error('Error checking alternative combinations:', error);
    return { hasConflict: false, details: '' };
  }
}

