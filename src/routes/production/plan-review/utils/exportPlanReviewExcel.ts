import * as XLSX from 'xlsx';
import { groupPlannedWorks } from '../../[stage_Shift]/utils/planTabUtils';
import { formatTime, calculateBreakTimeInRange } from '../../[stage_Shift]/utils/timeUtils';
import { formatManpowerAttendanceLong } from '$lib/utils/manpowerAttendanceStatus';
import { getWorkDisplayCode, getWorkDisplayName } from '$lib/utils/workDisplayUtils';

function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTimeString(timeStr: string): string {
  try {
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, seconds || 0);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch {
    return timeStr;
  }
}

function numCell(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '';
}

export interface PlanReviewExcelContext {
  planningDate: string;
  stageCode: string;
  shiftCode: string;
  submission: { stage_code?: string; shift_code?: string } | null;
  shiftBreakTimes: Array<{ start_time: string; end_time: string }>;
}

function manpowerRowsForExcel(manpowerPlanData: any[], ctx: PlanReviewExcelContext): Record<string, unknown>[] {
  const sorted = [...(manpowerPlanData || [])].sort((a, b) => {
    const na = (a?.hr_emp?.emp_name || a?.emp_id || '').toString().toLowerCase();
    const nb = (b?.hr_emp?.emp_name || b?.emp_id || '').toString().toLowerCase();
    return na.localeCompare(nb, undefined, { sensitivity: 'base' });
  });

  return sorted.map((plan: any) => {
    const re = !!(plan?.from_stage_code && plan?.to_stage_code);
    const sh = (plan?.shift_code || ctx.submission?.shift_code || '').trim();
    const seg = (stage: string) => (stage && sh ? `${stage}-${sh}` : stage || sh || '—');
    const stageStr = re
      ? `${seg(plan.from_stage_code)} → ${seg(plan.to_stage_code)}`
      : seg(plan?.stage_code || ctx.submission?.stage_code || '');
    const attendanceStr = re
      ? `Reassigned · ${plan.from_time || ''}-${plan.to_time || ''}`
      : formatManpowerAttendanceLong(plan?.attendance_status);

    return {
      Employee: plan.hr_emp?.emp_name || 'N/A',
      Stage: stageStr,
      Attendance: attendanceStr,
      'PLANNED HOURS': re ? '—' : numCell(plan.actual_hours ?? plan.planned_hours),
      'OT Hours': re ? '—' : numCell(plan.ot_hours),
      'C-Off Hours': re ? '—' : numCell(plan.c_off_value)
    };
  });
}

function worksRowsForExcel(
  worksPlanData: any[],
  shiftBreakTimes: Array<{ start_time: string; end_time: string }>
): Record<string, unknown>[] {
  const groupedPlannedWorks = groupPlannedWorks(worksPlanData || []);
  const rows: Record<string, unknown>[] = [];

  Object.values(groupedPlannedWorks).forEach((group: any) => {
    group.items.forEach((work: any, index: number) => {
      const workCode = getWorkDisplayCode(work) || 'N/A';
      const fullWorkName = getWorkDisplayName(work) || 'N/A';

      let plannedHours = work.planned_hours || 0;
      if (plannedHours === 0 && work.from_time && work.to_time) {
        const fromMinutes = timeToMinutes(work.from_time);
        const toMinutes = timeToMinutes(work.to_time);
        const breakTime = calculateBreakTimeInRange(work.from_time, work.to_time, shiftBreakTimes);
        plannedHours = (toMinutes - fromMinutes - breakTime) / 60;
      }

      const standardTimeMinutes =
        work.vehicleWorkFlow?.estimated_duration_minutes || work.skillTimeStandard?.standard_time_minutes || 0;
      const standardTime = standardTimeMinutes > 0 ? formatTime(standardTimeMinutes / 60) : 'N/A';

      rows.push({
        'Work Order Number': index === 0 ? work.prdn_wo_details?.wo_no || 'N/A' : '',
        'Pre Work Order Number': index === 0 ? work.prdn_wo_details?.pwo_no || 'N/A' : '',
        'Work Code': index === 0 ? workCode : '',
        'Work Name': index === 0 ? fullWorkName : '',
        'Skill Competency': work.std_work_skill_mapping?.sc_name || work.sc_required || 'N/A',
        'Standard Time': index === 0 ? standardTime : '',
        Worker: work.hr_emp?.emp_name || 'N/A',
        SC: work.hr_emp?.skill_short || 'N/A',
        'Time Worked Till Date': formatTime((work.time_worked_till_date || 0) / 60),
        'From Time': work.from_time ? formatTimeString(work.from_time) : 'N/A',
        'To Time': work.to_time ? formatTimeString(work.to_time) : 'N/A',
        'Planned Hours': formatTime(plannedHours)
      });
    });
  });

  return rows;
}

export function exportPlanReviewExcel(
  worksPlanData: any[],
  manpowerPlanData: any[],
  ctx: PlanReviewExcelContext
): void {
  try {
    const manRows = manpowerRowsForExcel(manpowerPlanData, ctx);
    const manpowerWs = XLSX.utils.json_to_sheet(
      manRows.length > 0
        ? manRows
        : [{ Employee: '(No data)', Stage: '', Attendance: '', 'PLANNED HOURS': '', 'OT Hours': '', 'C-Off Hours': '' }]
    );
    manpowerWs['!cols'] = [{ wch: 28 }, { wch: 28 }, { wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];

    const worksData = worksRowsForExcel(worksPlanData, ctx.shiftBreakTimes);
    const worksWs = XLSX.utils.json_to_sheet(
      worksData.length > 0
        ? worksData
        : [
            {
              'Work Order Number': '(No data)',
              'Pre Work Order Number': '',
              'Work Code': '',
              'Work Name': '',
              'Skill Competency': '',
              'Standard Time': '',
              Worker: '',
              SC: '',
              'Time Worked Till Date': '',
              'From Time': '',
              'To Time': '',
              'Planned Hours': ''
            }
          ]
    );
    worksWs['!cols'] = [
      { wch: 18 },
      { wch: 20 },
      { wch: 14 },
      { wch: 48 },
      { wch: 22 },
      { wch: 14 },
      { wch: 22 },
      { wch: 10 },
      { wch: 22 },
      { wch: 12 },
      { wch: 12 },
      { wch: 16 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, manpowerWs, 'Manpower');
    XLSX.utils.book_append_sheet(wb, worksWs, 'Works');

    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const sanitize = (s: string) => String(s || '').replace(/[/\\:<>?"|*]/g, '-').trim();
    const dateLabel = (() => {
      try {
        return new Date(ctx.planningDate).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      } catch {
        return ctx.planningDate;
      }
    })();
    const filename = `Plan-Review_${sanitize(ctx.stageCode)}_${sanitize(ctx.shiftCode)}_${dateLabel}_${ts}.xlsx`;
    XLSX.writeFile(wb, filename);
  } catch (error) {
    console.error('exportPlanReviewExcel:', error);
    alert('Error generating Excel file. Please try again.');
  }
}
