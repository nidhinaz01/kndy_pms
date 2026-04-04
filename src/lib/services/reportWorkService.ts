import { supabase } from '$lib/supabaseClient';
import { fetchActiveLostTimeReasons } from '$lib/api/lostTimeReasons';
import { getDetailedTimeBreakdownForDerivativeWork } from '$lib/api/stdSkillTimeStandards';
import type { LostTimeReason } from '$lib/api/lostTimeReasons';
import {
  normalizeReportDate,
  getEmpIdsReassignedIntoStage,
  fetchPresentHrEmpRowsForIds
} from './reportStageWorkerInclusion';

const PAGE_SIZE = 1000;

export async function loadWorkers(stageCode: string, fromDate: string, shiftCode?: string): Promise<any[]> {
  if (!stageCode || !fromDate) return [];
  
  try {
    const dateStr = normalizeReportDate(fromDate);
    const allRows: any[] = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      let q = supabase
        .from('hr_emp')
        .select(`
          emp_id,
          emp_name,
          skill_short,
          stage,
          hr_attendance!inner(
            attendance_status
          )
        `)
        .eq('stage', stageCode)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .eq('hr_attendance.attendance_date', dateStr)
        .eq('hr_attendance.attendance_status', 'present')
        .eq('hr_attendance.is_deleted', false)
        .order('emp_id')
        .range(offset, offset + PAGE_SIZE - 1);
      if (shiftCode) {
        q = q.eq('shift_code', shiftCode);
      }
      const { data, error } = await q;

      if (error) {
        console.error('Error loading present workers:', error);
        return [];
      }
      const page = data || [];
      allRows.push(...page);
      hasMore = page.length === PAGE_SIZE;
      offset += PAGE_SIZE;
    }

    const byId = new Map<string, any>();
    allRows.forEach((row) => {
      if (row.emp_id) byId.set(row.emp_id, row);
    });

    const reassignedIds = await getEmpIdsReassignedIntoStage(stageCode, dateStr, shiftCode);
    const missing = [...reassignedIds].filter((id) => !byId.has(id));
    if (missing.length > 0) {
      const extra = await fetchPresentHrEmpRowsForIds(missing, dateStr, shiftCode);
      extra.forEach((row) => {
        if (row.emp_id && !byId.has(row.emp_id)) byId.set(row.emp_id, row);
      });
    }

    return Array.from(byId.values()).sort((a, b) =>
      String(a.emp_id || '').localeCompare(String(b.emp_id || ''))
    );
  } catch (error) {
    console.error('Error loading present workers:', error);
    return [];
  }
}

export async function loadStandardTime(plannedWork: any): Promise<number> {
  const derivedWorkCode = plannedWork?.derived_sw_code || 
                         plannedWork?.std_work_type_details?.derived_sw_code ||
                         plannedWork?.std_work_type_details?.sw_code;
  
  if (!derivedWorkCode) {
    console.log('❌ No derived work code found in planned work');
    return 0;
  }
  
  try {
    const timeBreakdown = await getDetailedTimeBreakdownForDerivativeWork(derivedWorkCode);
    return timeBreakdown.totalMinutes;
  } catch (error) {
    console.error('Error loading standard time:', error);
    return 0;
  }
}

export async function loadLostTimeReasons(): Promise<LostTimeReason[]> {
  try {
    const reasons = await fetchActiveLostTimeReasons();
    console.log(`📋 Loaded ${reasons.length} lost time reasons`);
    return reasons;
  } catch (error) {
    console.error('Error loading lost time reasons:', error);
    // Fallback to empty array
    return [];
  }
}

export async function loadEmployeeSalary(workerId: string): Promise<number> {
  if (!workerId) return 0;

  try {
    const { data, error } = await supabase
      .from('hr_emp')
      .select('salary')
      .eq('emp_id', workerId)
      .single();

    if (error) throw error;
    return data?.salary || 0;
  } catch (error) {
    console.error('Error loading employee salary:', error);
    return 0;
  }
}

export async function checkWorkerConflict(
  workerId: string,
  fromDate: string,
  fromTime: string,
  toDate: string,
  toTime: string,
  excludeReportId?: number
): Promise<{ hasConflict: boolean; hasReportConflict: boolean; message: string }> {
  console.log('🔍 checkWorkerConflict CALLED with:', {
    workerId,
    fromDate,
    fromTime,
    toDate,
    toTime,
    excludeReportId
  });
  
  if (!workerId || !fromDate || !fromTime || !toDate || !toTime) {
    console.log('❌ checkWorkerConflict: Missing required parameters');
    return { hasConflict: false, hasReportConflict: false, message: '' };
  }

  try {
    const fromDateTime = new Date(`${fromDate}T${fromTime}`);
    const toDateTime = new Date(`${toDate}T${toTime}`);
    
    // Check existing work reports on the SAME DATE (irrespective of stage/shift)
    // Format dates to YYYY-MM-DD for comparison
    const fromDateStr = typeof fromDate === 'string' ? fromDate.split('T')[0] : fromDate;
    
    console.log('🔍 checkWorkerConflict: Formatted date string:', fromDateStr);
    
    const existingReports: any[] = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      let reportsQuery = supabase
        .from('prdn_work_reporting')
        .select(`
          *,
          prdn_work_planning!inner(
            *,
            std_work_type_details!inner(
              sw_code,
              derived_sw_code,
              std_work_details!inner(
                sw_name
              )
            )
          )
        `)
        .eq('worker_id', workerId)
        .eq('is_deleted', false)
        .eq('from_date', fromDateStr)
        .order('id')
        .range(offset, offset + PAGE_SIZE - 1);
      if (excludeReportId) {
        reportsQuery = reportsQuery.neq('id', excludeReportId);
      }
      const { data: page, error: reportsError } = await reportsQuery;
      if (reportsError) {
        console.error('❌ checkWorkerConflict: Query error:', reportsError);
        throw reportsError;
      }
      const rows = page || [];
      existingReports.push(...rows);
      hasMore = rows.length === PAGE_SIZE;
      offset += PAGE_SIZE;
    }
    
    console.log('🔍 checkWorkerConflict: Executing query for reports...');
    console.log(`🔍 checkWorkerConflict: Checking worker ${workerId} for date ${fromDateStr}`);
    console.log(`🔍 Found ${existingReports.length} existing reports on same date`);
    if (existingReports.length > 0) {
      console.log('🔍 Existing reports:', existingReports.map((r: any) => ({
        id: r.id,
        worker_id: r.worker_id,
        from_date: r.from_date,
        from_time: r.from_time,
        to_date: r.to_date,
        to_time: r.to_time,
        status: r.status
      })));
    } else {
      console.log('⚠️ checkWorkerConflict: No existing reports found - this might be the issue!');
    }

    // Check existing work planning (paginated)
    const existingPlans: any[] = [];
    offset = 0;
    hasMore = true;
    while (hasMore) {
      const { data: plansPage, error: plansError } = await supabase
        .from('prdn_work_planning')
        .select(`
          *,
          std_work_type_details!inner(
            sw_code,
            derived_sw_code,
            std_work_details!inner(
              sw_name
            )
          )
        `)
        .eq('worker_id', workerId)
        .eq('is_deleted', false)
        .order('id')
        .range(offset, offset + PAGE_SIZE - 1);

      if (plansError) throw plansError;
      const rows = plansPage || [];
      existingPlans.push(...rows);
      hasMore = rows.length === PAGE_SIZE;
      offset += PAGE_SIZE;
    }

    // Check for time conflicts in reports on the same date
    console.log('🔍 checkWorkerConflict: Checking time overlaps...');
    console.log(`🔍 New report time range: ${fromTime} - ${toTime} on ${fromDateStr}`);
    
    const reportConflicts = existingReports?.filter((report: any) => {
      // Ensure we're comparing times on the same date
      const reportFromDateStr = typeof report.from_date === 'string' ? report.from_date.split('T')[0] : report.from_date;
      
      console.log(`🔍 Comparing with report ${report.id}: ${report.from_time}-${report.to_time} on ${reportFromDateStr}`);
      
      // Only check conflicts if on the same date
      if (reportFromDateStr !== fromDateStr) {
        console.log(`⚠️ Date mismatch: report date ${reportFromDateStr} !== new date ${fromDateStr}`);
        return false;
      }
      
      const reportFromDateTime = new Date(`${report.from_date}T${report.from_time}`);
      const reportToDateTime = new Date(`${report.to_date}T${report.to_time}`);
      
      console.log(`🔍 Time comparison:`, {
        newFrom: fromDateTime.toISOString(),
        newTo: toDateTime.toISOString(),
        existingFrom: reportFromDateTime.toISOString(),
        existingTo: reportToDateTime.toISOString()
      });
      
      // Check if time ranges overlap (excluding adjacent slots)
      // Two ranges overlap if: start1 < end2 && end1 > start2
      const hasOverlap = fromDateTime < reportToDateTime && toDateTime > reportFromDateTime;
      
      console.log(`🔍 Overlap check: ${fromDateTime.toISOString()} < ${reportToDateTime.toISOString()} = ${fromDateTime < reportToDateTime}, ${toDateTime.toISOString()} > ${reportFromDateTime.toISOString()} = ${toDateTime > reportFromDateTime}, Result: ${hasOverlap}`);
      
      if (hasOverlap) {
        console.log(`⚠️ Report conflict detected: Existing report ${report.id} (${report.from_time}-${report.to_time}) overlaps with new report (${fromTime}-${toTime})`);
      }
      
      return hasOverlap;
    }) || [];
    
    console.log(`🔍 Found ${reportConflicts.length} report conflicts`);

    // Check for time conflicts in planning
    const planConflicts = existingPlans?.filter((plan: any) => {
      const planFromDateTime = new Date(`${plan.from_date}T${plan.from_time}`);
      const planToDateTime = new Date(`${plan.to_date}T${plan.to_time}`);
      return (fromDateTime < planToDateTime && toDateTime > planFromDateTime);
    }) || [];

    // If there are report conflicts, BLOCK (cannot proceed)
    if (reportConflicts.length > 0) {
      const conflictDetails = reportConflicts.map((conflict: any) => {
        const workName = conflict.prdn_work_planning?.std_work_type_details?.std_work_details?.sw_name || 'Unknown Work';
        const workCode = conflict.prdn_work_planning?.std_work_type_details?.derived_sw_code || 
                       conflict.prdn_work_planning?.std_work_type_details?.sw_code || 'Unknown';
        const conflictFromTime = new Date(`${conflict.from_date}T${conflict.from_time}`).toLocaleString('en-GB', { 
          day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
        });
        const conflictToTime = new Date(`${conflict.to_date}T${conflict.to_time}`).toLocaleString('en-GB', { 
          day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
        });
        
        return `  • ${workName} (${workCode}) [Reported]\n    ${conflictFromTime} - ${conflictToTime}`;
      }).join('\n');

      const currentFromTime = fromDateTime.toLocaleString('en-GB', { 
        day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
      });
      const currentToTime = toDateTime.toLocaleString('en-GB', { 
        day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
      });

      const message = `❌ REPORTING BLOCKED!\n\nWorker has already been reported for an overlapping time period on the same date.\n\nCurrent Reporting: ${currentFromTime} - ${currentToTime}\n\nExisting Reports:\n\n${conflictDetails}\n\nA worker cannot be reported for overlapping time periods on the same date. Please adjust the reporting time.`;

      return { hasConflict: true, hasReportConflict: true, message };
    }

    // If there are only plan conflicts, WARN (can proceed with confirmation)
    if (planConflicts.length > 0) {
      const conflictDetails = planConflicts.map((conflict: any) => {
        const workName = conflict.std_work_type_details?.std_work_details?.sw_name || 'Unknown Work';
        const workCode = conflict.std_work_type_details?.derived_sw_code || 
                       conflict.std_work_type_details?.sw_code || 'Unknown';
        const conflictFromTime = new Date(`${conflict.from_date}T${conflict.from_time}`).toLocaleString('en-GB', { 
          day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
        });
        const conflictToTime = new Date(`${conflict.to_date}T${conflict.to_time}`).toLocaleString('en-GB', { 
          day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
        });
        
        return `  • ${workName} (${workCode}) [Planned]\n    ${conflictFromTime} - ${conflictToTime}`;
      }).join('\n');

      const currentFromTime = fromDateTime.toLocaleString('en-GB', { 
        day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
      });
      const currentToTime = toDateTime.toLocaleString('en-GB', { 
        day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
      });

      const message = `⚠️ WORKER CONFLICTS DETECTED!\n\nCurrent Reporting: ${currentFromTime} - ${currentToTime}\n\nConflicts:\n\n${conflictDetails}\n\nDo you want to proceed anyway?`;

      return { hasConflict: true, hasReportConflict: false, message };
    }

    return { hasConflict: false, hasReportConflict: false, message: '' };
  } catch (error) {
    console.error('Error checking worker conflicts:', error);
    return { hasConflict: false, hasReportConflict: false, message: '' };
  }
}

