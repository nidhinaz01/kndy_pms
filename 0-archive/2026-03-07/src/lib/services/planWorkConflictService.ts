import { supabase } from '$lib/supabaseClient';

export interface WorkerConflict {
  workerId: string;
  worker: any;
  reportConflicts: any[];
  planConflicts: any[];
  reassignmentConflicts: any[];
}

export async function checkWorkerConflicts(
  selectedWorkers: { [key: string]: any },
  fromDate: string,
  fromTime: string,
  toDate: string,
  toTime: string,
  excludePlanIds?: number[] // Plan IDs to exclude from conflict checks (for edit mode)
): Promise<{ hasConflict: boolean; conflictDetails: string }> {
  try {
    const fromDateTime = new Date(`${fromDate}T${fromTime}`);
    const toDateTime = new Date(`${toDate}T${toTime}`);
    
    // Only check workers that are explicitly selected (not null/undefined)
    // Also ensure we have valid worker objects with emp_id
    const assignedWorkers = Object.values(selectedWorkers).filter((worker): worker is any => {
      return worker !== null && worker !== undefined && worker && (worker as any).emp_id;
    });
    
    if (assignedWorkers.length === 0) {
      return { hasConflict: false, conflictDetails: '' };
    }
    
    // Log which workers are being checked for debugging
    const workerNames = assignedWorkers.map(w => (w as any).emp_name || (w as any).emp_id).join(', ');
    console.log(`Checking conflicts for ${assignedWorkers.length} worker(s): ${workerNames}`);

    const conflictPromises = assignedWorkers.map(async (worker) => {
      const workerId = (worker as any).emp_id;
      
      // Double-check that we have a valid worker ID
      if (!workerId) {
        console.warn('Skipping conflict check for worker without emp_id:', worker);
        return { workerId: '', worker, reportConflicts: [], planConflicts: [], reassignmentConflicts: [] };
      }
      
      // Check for stage reassignments that overlap with planned work time
      const { data: stageReassignments, error: reassignmentsError } = await supabase
        .from('prdn_planning_stage_reassignment')
        .select('emp_id, from_stage_code, to_stage_code, from_time, to_time, planning_date, status')
        .eq('emp_id', workerId)
        .eq('planning_date', fromDate)
        .in('status', ['draft', 'pending_approval', 'approved'])
        .eq('is_deleted', false);

      if (reassignmentsError) {
        console.error('Error checking stage reassignments:', reassignmentsError);
      }

      const reassignmentConflicts = (stageReassignments || []).filter((reassignment: any) => {
        if (!reassignment.from_time || !reassignment.to_time) return false;
        const reassignFromDateTime = new Date(`${reassignment.planning_date}T${reassignment.from_time}`);
        const reassignToDateTime = new Date(`${reassignment.planning_date}T${reassignment.to_time}`);
        return (fromDateTime < reassignToDateTime && toDateTime > reassignFromDateTime);
      });
      
      const { data: existingReports, error: reportsError } = await supabase
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
        .eq('is_deleted', false);

      if (reportsError) throw reportsError;

      const { data: existingPlans, error: plansError } = await supabase
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
        .eq('is_deleted', false);

      if (plansError) throw plansError;

      const reportConflicts = existingReports.filter((report: any) => {
        const reportFromDateTime = new Date(`${report.from_date}T${report.from_time}`);
        const reportToDateTime = new Date(`${report.to_date}T${report.to_time}`);
        return (fromDateTime < reportToDateTime && toDateTime > reportFromDateTime);
      });

      // Filter out plans being edited (for edit mode)
      const plansToCheck = excludePlanIds && excludePlanIds.length > 0
        ? existingPlans.filter((plan: any) => !excludePlanIds.includes(plan.id))
        : existingPlans;
      
      const planConflicts = plansToCheck.filter((plan: any) => {
        const planFromDateTime = new Date(`${plan.from_date}T${plan.from_time}`);
        const planToDateTime = new Date(`${plan.to_date}T${plan.to_time}`);
        return (fromDateTime < planToDateTime && toDateTime > planFromDateTime);
      });

      return { workerId, worker, reportConflicts, planConflicts, reassignmentConflicts };
    });

    const conflictResults = await Promise.all(conflictPromises);
    // Filter out any results without valid worker IDs and only include those with actual conflicts
    const workersWithConflicts = conflictResults.filter(result => 
      result.workerId && (result.reportConflicts.length > 0 || result.planConflicts.length > 0 || result.reassignmentConflicts.length > 0)
    );

    if (workersWithConflicts.length > 0) {
      const conflictDetails = workersWithConflicts.map(({ workerId, worker, reportConflicts, planConflicts, reassignmentConflicts }) => {
        const workerName = (worker as any).emp_name || 'Unknown Worker';
        const allConflicts = [...reportConflicts, ...planConflicts];
        
        const workerConflicts = allConflicts.map((conflict: any) => {
          const workName = conflict.prdn_work_planning?.std_work_type_details?.std_work_details?.sw_name || 
                          conflict.std_work_type_details?.std_work_details?.sw_name || 'Unknown Work';
          const workCode = conflict.prdn_work_planning?.std_work_type_details?.derived_sw_code || 
                         conflict.prdn_work_planning?.std_work_type_details?.sw_code ||
                         conflict.std_work_type_details?.derived_sw_code || 
                         conflict.std_work_type_details?.sw_code || 'Unknown';
          const conflictFromTime = new Date(`${conflict.from_date}T${conflict.from_time}`).toLocaleString('en-GB', { 
            day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
          });
          const conflictToTime = new Date(`${conflict.to_date}T${conflict.to_time}`).toLocaleString('en-GB', { 
            day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
          });
          const status = conflict.completion_status ? 'Reported' : 'Planned';
          
          return `  • ${workName} (${workCode}) [${status}]\n    ${conflictFromTime} - ${conflictToTime}`;
        }).join('\n');
        
        // Add stage reassignment conflicts
        const reassignmentConflictDetails = reassignmentConflicts.map((reassignment: any) => {
          const reassignFromTime = new Date(`${reassignment.planning_date}T${reassignment.from_time}`).toLocaleString('en-GB', { 
            day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
          });
          const reassignToTime = new Date(`${reassignment.planning_date}T${reassignment.to_time}`).toLocaleString('en-GB', { 
            day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
          });
          return `  • Stage Reassignment [${reassignment.from_stage_code} → ${reassignment.to_stage_code}]\n    ${reassignFromTime} - ${reassignToTime}`;
        }).join('\n');
        
        const allConflictDetails = workerConflicts + (reassignmentConflictDetails ? (workerConflicts ? '\n' : '') + reassignmentConflictDetails : '');
        
        return `${workerName}:\n${allConflictDetails}`;
      }).join('\n\n');

      const currentFromTime = fromDateTime.toLocaleString('en-GB', { 
        day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
      });
      const currentToTime = toDateTime.toLocaleString('en-GB', { 
        day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
      });

      const checkedWorkerNames = assignedWorkers.map(w => (w as any).emp_name || (w as any).emp_id).join(', ');
      const message = `⚠️ WORKER CONFLICTS DETECTED!\n\nCurrent Planning: ${currentFromTime} - ${currentToTime}\n\nChecked workers: ${checkedWorkerNames}\n\nWorkers with conflicts:\n\n${conflictDetails}`;

      return { hasConflict: true, conflictDetails: message };
    }

    return { hasConflict: false, conflictDetails: '' };
  } catch (error) {
    console.error('Error checking worker conflicts:', error);
    return { hasConflict: false, conflictDetails: '' };
  }
}

