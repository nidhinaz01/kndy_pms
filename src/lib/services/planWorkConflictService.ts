import { supabase } from '$lib/supabaseClient';

export interface WorkerConflict {
  workerId: string;
  worker: any;
  reportConflicts: any[];
  planConflicts: any[];
  reassignmentConflicts: any[];
}

/** One worker + one time window (per skill slot or trainee row). */
export interface WorkerAssignmentInterval {
  worker: any;
  fromDate: string;
  toDate: string;
  fromTime: string;
  toTime: string;
}

export async function checkWorkerConflicts(
  assignments: WorkerAssignmentInterval[],
  excludePlanIds?: number[],
  currentStageCode?: string
): Promise<{ hasConflict: boolean; conflictDetails: string }> {
  try {
    const valid = (assignments || []).filter(
      (a) =>
        a?.worker &&
        (a.worker as any).emp_id &&
        a.fromDate &&
        a.toDate &&
        a.fromTime &&
        a.toTime
    );

    if (valid.length === 0) {
      return { hasConflict: false, conflictDetails: '' };
    }

    const conflictPromises = valid.map(async (assignment) => {
      const worker = assignment.worker;
      const workerId = (worker as any).emp_id;
      const fromDate = assignment.fromDate;
      const toDate = assignment.toDate;
      const fromTime = assignment.fromTime;
      const toTime = assignment.toTime;

      const fromDateTime = new Date(`${fromDate}T${fromTime}`);
      const toDateTime = new Date(`${toDate}T${toTime}`);

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
        if (currentStageCode && reassignment.to_stage_code === currentStageCode) {
          // Reassignment into current stage means worker is available here during this window.
          return false;
        }
        const reassignFromDateTime = new Date(`${reassignment.planning_date}T${reassignment.from_time}`);
        const reassignToDateTime = new Date(`${reassignment.planning_date}T${reassignment.to_time}`);
        return fromDateTime < reassignToDateTime && toDateTime > reassignFromDateTime;
      });

      const { data: existingReports, error: reportsError } = await supabase
        .from('prdn_work_reporting')
        .select(
          `
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
        `
        )
        .eq('worker_id', workerId)
        .eq('is_deleted', false);

      if (reportsError) throw reportsError;

      const { data: existingPlans, error: plansError } = await supabase
        .from('prdn_work_planning')
        .select(
          `
          *,
          std_work_type_details!inner(
            sw_code,
            derived_sw_code,
            std_work_details!inner(
              sw_name
            )
          )
        `
        )
        .eq('worker_id', workerId)
        .eq('is_deleted', false);

      if (plansError) throw plansError;

      const reportConflicts = existingReports.filter((report: any) => {
        const reportFromDateTime = new Date(`${report.from_date}T${report.from_time}`);
        const reportToDateTime = new Date(`${report.to_date}T${report.to_time}`);
        return fromDateTime < reportToDateTime && toDateTime > reportFromDateTime;
      });

      const plansToCheck =
        excludePlanIds && excludePlanIds.length > 0
          ? existingPlans.filter((plan: any) => !excludePlanIds.includes(plan.id))
          : existingPlans;

      const planConflicts = plansToCheck.filter((plan: any) => {
        const planFromDateTime = new Date(`${plan.from_date}T${plan.from_time}`);
        const planToDateTime = new Date(`${plan.to_date}T${plan.to_time}`);
        return fromDateTime < planToDateTime && toDateTime > planFromDateTime;
      });

      return {
        workerId,
        worker,
        fromDate,
        toDate,
        fromTime,
        toTime,
        reportConflicts,
        planConflicts,
        reassignmentConflicts
      };
    });

    const conflictResults = await Promise.all(conflictPromises);
    const workersWithConflicts = conflictResults.filter(
      (result) =>
        result.workerId &&
        (result.reportConflicts.length > 0 ||
          result.planConflicts.length > 0 ||
          result.reassignmentConflicts.length > 0)
    );

    if (workersWithConflicts.length > 0) {
      const conflictDetails = workersWithConflicts
        .map(({ worker, reportConflicts, planConflicts, reassignmentConflicts, fromDate, toDate, fromTime, toTime }) => {
          const workerName = (worker as any).emp_name || 'Unknown Worker';
          const allConflicts = [...reportConflicts, ...planConflicts];

          const workerConflicts = allConflicts
            .map((conflict: any) => {
              const workName =
                conflict.prdn_work_planning?.std_work_type_details?.std_work_details?.sw_name ||
                conflict.std_work_type_details?.std_work_details?.sw_name ||
                'Unknown Work';
              const workCode =
                conflict.prdn_work_planning?.std_work_type_details?.derived_sw_code ||
                conflict.prdn_work_planning?.std_work_type_details?.sw_code ||
                conflict.std_work_type_details?.derived_sw_code ||
                conflict.std_work_type_details?.sw_code ||
                'Unknown';
              const conflictFromTime = new Date(`${conflict.from_date}T${conflict.from_time}`).toLocaleString(
                'en-GB',
                {
                  day: '2-digit',
                  month: 'short',
                  year: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                }
              );
              const conflictToTime = new Date(`${conflict.to_date}T${conflict.to_time}`).toLocaleString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              });
              const status = conflict.completion_status ? 'Reported' : 'Planned';

              return `  • ${workName} (${workCode}) [${status}]\n    ${conflictFromTime} - ${conflictToTime}`;
            })
            .join('\n');

          const reassignmentConflictDetails = reassignmentConflicts
            .map((reassignment: any) => {
              const reassignFromTime = new Date(`${reassignment.planning_date}T${reassignment.from_time}`).toLocaleString(
                'en-GB',
                {
                  day: '2-digit',
                  month: 'short',
                  year: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                }
              );
              const reassignToTime = new Date(`${reassignment.planning_date}T${reassignment.to_time}`).toLocaleString(
                'en-GB',
                {
                  day: '2-digit',
                  month: 'short',
                  year: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                }
              );
              return `  • Stage Reassignment [${reassignment.from_stage_code} → ${reassignment.to_stage_code}]\n    ${reassignFromTime} - ${reassignToTime}`;
            })
            .join('\n');

          const allConflictDetails =
            workerConflicts + (reassignmentConflictDetails ? (workerConflicts ? '\n' : '') + reassignmentConflictDetails : '');

          const intervalFrom = new Date(`${fromDate}T${fromTime}`).toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
          const intervalTo = new Date(`${toDate}T${toTime}`).toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });

          return `${workerName} (this row: ${intervalFrom} - ${intervalTo}):\n${allConflictDetails}`;
        })
        .join('\n\n');

      const message = `⚠️ WORKER CONFLICTS DETECTED!\n\nWorkers with conflicts:\n\n${conflictDetails}`;

      return { hasConflict: true, conflictDetails: message };
    }

    return { hasConflict: false, conflictDetails: '' };
  } catch (error) {
    console.error('Error checking worker conflicts:', error);
    return { hasConflict: false, conflictDetails: '' };
  }
}
