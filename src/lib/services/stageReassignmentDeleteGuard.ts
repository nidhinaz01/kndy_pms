import { supabase } from '$lib/supabaseClient';

function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = String(timeStr || '0:0').split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Same-day interval overlap as Plan Work / planning validation: overlap counts, exact adjacency does not.
 */
export function wallClockIntervalsOverlap(
  aFrom: string,
  aTo: string,
  bFrom: string,
  bTo: string
): boolean {
  const aStart = timeToMinutes(aFrom);
  let aEnd = timeToMinutes(aTo);
  const bStart = timeToMinutes(bFrom);
  let bEnd = timeToMinutes(bTo);
  if (aEnd < aStart) aEnd += 24 * 60;
  if (bEnd < bStart) bEnd += 24 * 60;
  const hasOverlap = aStart < bEnd && aEnd > bStart;
  const isAdjacent = aEnd === bStart || bEnd === aStart;
  return hasOverlap && !isAdjacent;
}

export type ReassignmentWindow = {
  empId: string;
  toStageCode: string;
  shiftCode: string;
  planningDate: string;
  fromTime: string;
  toTime: string;
};

const LOG = 'stageReassignmentDeleteGuard';

function sameDay(d: string): string {
  return String(d || '').split('T')[0];
}

/**
 * Wall-clock segment of an activity on a given calendar day when the activity may span multiple dates.
 */
function effectiveTimeSegmentOnDate(
  spanFrom: string,
  spanTo: string,
  fromTime: string | null | undefined,
  toTime: string | null | undefined,
  dateStr: string
): { from: string; to: string } | null {
  const f = sameDay(spanFrom);
  const t = sameDay(spanTo);
  if (!f || !t || dateStr < f || dateStr > t) return null;

  if (f === t && f === dateStr) {
    if (fromTime && toTime) return { from: fromTime, to: toTime };
    return null;
  }
  if (f === dateStr && t > dateStr) {
    if (fromTime) return { from: fromTime, to: '23:59' };
    return { from: '00:00', to: '23:59' };
  }
  if (f < dateStr && t === dateStr) {
    if (toTime) return { from: '00:00', to: toTime };
    return { from: '00:00', to: '23:59' };
  }
  if (f < dateStr && t > dateStr) {
    return { from: '00:00', to: '23:59' };
  }
  return null;
}

function windowParamsOk(w: ReassignmentWindow, dateStr: string): w is ReassignmentWindow & { empId: string } {
  return !!(w.empId && w.toStageCode && w.shiftCode && dateStr && w.fromTime && w.toTime);
}

/**
 * If the worker has draft / active `prdn_work_planning` on the destination stage/shift/date
 * whose time window overlaps the reassignment window, deletion must be blocked.
 */
export async function getDestinationPlanningConflictMessage(w: ReassignmentWindow): Promise<string | null> {
  const dateStr = sameDay(w.planningDate);
  if (!windowParamsOk(w, dateStr)) {
    return null;
  }

  const { data: plans, error } = await supabase
    .from('prdn_work_planning')
    .select('id, from_time, to_time')
    .eq('worker_id', w.empId)
    .eq('stage_code', w.toStageCode)
    .eq('shift_code', w.shiftCode)
    .eq('from_date', dateStr)
    .eq('is_deleted', false)
    .eq('is_active', true)
    .in('status', ['draft', 'pending_approval', 'approved']);

  if (error) {
    console.error(LOG, error);
    return 'Unable to verify planned work on the destination stage. Please try again.';
  }

  const conflicting = (plans || []).filter(
    (p: { from_time?: string; to_time?: string }) =>
      p.from_time &&
      p.to_time &&
      wallClockIntervalsOverlap(w.fromTime, w.toTime, p.from_time, p.to_time)
  );

  if (conflicting.length === 0) return null;

  return (
    `Cannot delete this reassignment: this worker has planned work on ${w.toStageCode} during this period ` +
    `(${conflicting.length} active plan record(s) overlap the reassignment time). ` +
    `Remove or reschedule that work on the destination stage first.`
  );
}

type WorkReportRow = {
  from_date: string;
  to_date: string;
  from_time?: string | null;
  to_time?: string | null;
  hours_worked_today?: number | null;
  prdn_work_planning?: { stage_code?: string; shift_code?: string } | null;
};

/**
 * If the worker has `prdn_work_reporting` (Report tab / work reported) on the destination stage
 * for the same date window, with a time range that overlaps the reassignment, block delete.
 */
export async function getDestinationReportedWorkConflictMessage(w: ReassignmentWindow): Promise<string | null> {
  const dateStr = sameDay(w.planningDate);
  if (!windowParamsOk(w, dateStr)) {
    return null;
  }

  const { data: reports, error } = await supabase
    .from('prdn_work_reporting')
    .select(
      `
      id,
      from_date,
      to_date,
      from_time,
      to_time,
      hours_worked_today,
      prdn_work_planning!inner(
        stage_code,
        shift_code
      )
    `
    )
    .eq('worker_id', w.empId)
    .eq('is_deleted', false)
    .in('status', ['draft', 'pending_approval', 'approved'])
    .lte('from_date', dateStr)
    .gte('to_date', dateStr)
    .eq('prdn_work_planning.stage_code', w.toStageCode)
    .eq('prdn_work_planning.shift_code', w.shiftCode);

  if (error) {
    console.error(LOG, 'reported work', error);
    return 'Unable to verify reported work on the destination stage. Please try again.';
  }

  const rows = (reports || []) as WorkReportRow[];
  const conflicting: WorkReportRow[] = [];

  for (const r of rows) {
    const seg = effectiveTimeSegmentOnDate(
      r.from_date,
      r.to_date,
      r.from_time,
      r.to_time,
      dateStr
    );
    if (seg) {
      if (wallClockIntervalsOverlap(w.fromTime, w.toTime, seg.from, seg.to)) {
        conflicting.push(r);
      }
    } else if ((r.hours_worked_today || 0) > 0 && sameDay(r.from_date) <= dateStr && sameDay(r.to_date) >= dateStr) {
      /** Time range missing but hours recorded on a span that includes this day — block. */
      conflicting.push(r);
    }
  }

  if (conflicting.length === 0) return null;

  return (
    `Cannot delete this reassignment: this worker has reported work on ${w.toStageCode} during this period ` +
    `(${conflicting.length} work report(s) overlap the reassignment time). ` +
    `Remove or adjust those reports on the destination stage first.`
  );
}

type ManpowerReportRow = {
  reporting_from_date: string;
  reporting_to_date: string;
  attendance_status?: string | null;
  from_time?: string | null;
  to_time?: string | null;
  actual_hours?: number | null;
};

/**
 * If the worker has Manpower Report (`prdn_reporting_manpower`) on the destination stage for this date
 * (present, with times or hours) overlapping the reassignment window, block delete.
 */
export async function getDestinationManpowerReportingConflictMessage(
  w: ReassignmentWindow
): Promise<string | null> {
  const dateStr = sameDay(w.planningDate);
  if (!windowParamsOk(w, dateStr)) {
    return null;
  }

  const { data: rows, error } = await supabase
    .from('prdn_reporting_manpower')
    .select(
      'reporting_from_date, reporting_to_date, attendance_status, from_time, to_time, actual_hours, status'
    )
    .eq('emp_id', w.empId)
    .eq('stage_code', w.toStageCode)
    .eq('shift_code', w.shiftCode)
    .eq('is_deleted', false)
    .in('status', ['draft', 'pending_approval', 'approved'])
    .lte('reporting_from_date', dateStr)
    .gte('reporting_to_date', dateStr);

  if (error) {
    console.error(LOG, 'manpower report', error);
    return 'Unable to verify manpower reporting on the destination stage. Please try again.';
  }

  const conflicting: ManpowerReportRow[] = [];

  for (const r of (rows || []) as ManpowerReportRow[]) {
    if (r.attendance_status !== 'present') continue;

    const seg = effectiveTimeSegmentOnDate(
      r.reporting_from_date,
      r.reporting_to_date,
      r.from_time,
      r.to_time,
      dateStr
    );
    if (seg) {
      if (wallClockIntervalsOverlap(w.fromTime, w.toTime, seg.from, seg.to)) {
        conflicting.push(r);
      }
    } else if ((r.actual_hours || 0) > 0) {
      conflicting.push(r);
    }
  }

  if (conflicting.length === 0) return null;

  return (
    `Cannot delete this reassignment: this worker has Manpower Report data on ${w.toStageCode} for this period ` +
    `(${conflicting.length} reporting record(s) overlap the reassignment time). ` +
    `Clear or adjust that reporting on the destination stage first.`
  );
}

/**
 * Full delete guard: destination planning, reported work, and manpower report on destination.
 */
export async function getStageReassignmentDeleteBlockMessage(w: ReassignmentWindow): Promise<string | null> {
  const planning = await getDestinationPlanningConflictMessage(w);
  if (planning) return planning;
  const reported = await getDestinationReportedWorkConflictMessage(w);
  if (reported) return reported;
  return getDestinationManpowerReportingConflictMessage(w);
}
