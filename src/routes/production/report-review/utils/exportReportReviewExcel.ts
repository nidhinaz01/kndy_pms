import * as XLSX from 'xlsx';
import { groupReportWorks } from '../../[stage_Shift]/utils/planTabUtils';
import { formatTime } from '../../[stage_Shift]/utils/timeUtils';
import { formatManpowerAttendanceLong } from '$lib/utils/manpowerAttendanceStatus';
import { getWorkDisplayCode, getWorkDisplayName } from '$lib/utils/workDisplayUtils';

function numCell(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '';
}

export interface ReportReviewExcelContext {
  reportingDate: string;
  stageCode: string;
  shiftCode: string;
  submission: { stage_code?: string; shift_code?: string } | null;
}

function manpowerRowsForExcel(manpowerReportData: any[], ctx: ReportReviewExcelContext): Record<string, unknown>[] {
  const sorted = [...(manpowerReportData || [])].sort((a, b) => {
    const na = (a?.hr_emp?.emp_name || a?.emp_id || '').toString().toLowerCase();
    const nb = (b?.hr_emp?.emp_name || b?.emp_id || '').toString().toLowerCase();
    return na.localeCompare(nb, undefined, { sensitivity: 'base' });
  });

  return sorted.map((report: any) => {
    const re = !!(report?.from_stage_code && report?.to_stage_code);
    const sh = (report?.shift_code || ctx.submission?.shift_code || '').trim();
    const seg = (stage: string) => (stage && sh ? `${stage}-${sh}` : stage || sh || '—');
    const stageStr = re
      ? `${seg(report.from_stage_code)} → ${seg(report.to_stage_code)}`
      : seg(report?.stage_code || ctx.submission?.stage_code || '');
    const attendanceStr = re
      ? `Reassigned · ${report.from_time || ''}-${report.to_time || ''}`
      : formatManpowerAttendanceLong(report?.attendance_status);

    const ltnpDisplay =
      report.ltnp_hours != null && report.ltnp_hours > 0 ? report.ltnp_hours : report.calculated_ltnp_hours;

    return {
      Employee: report.hr_emp?.emp_name || 'N/A',
      Stage: stageStr,
      Attendance: attendanceStr,
      'Reported Hours': re ? '—' : numCell(report.actual_hours),
      'OT Hours': re ? '—' : numCell(report.ot_hours),
      'C-Off Hours': re ? '—' : numCell(report.c_off_value),
      'LTP Hours': numCell(report.ltp_hours),
      'LTNP Hours': numCell(ltnpDisplay)
    };
  });
}

function worksRowsForExcel(worksReportData: any[]): Record<string, unknown>[] {
  const groupedReportWorks = groupReportWorks(worksReportData || []);
  const rows: Record<string, unknown>[] = [];

  Object.values(groupedReportWorks).forEach((group: any) => {
    group.items.forEach((report: any, index: number) => {
      const planning = report.prdn_work_planning;

      const workCode =
        index === 0
          ? getWorkDisplayCode(planning) || 'N/A'
          : '';

      const workName =
        index === 0
          ? getWorkDisplayName({ ...report, ...planning, prdn_work_planning: planning }) || 'N/A'
          : '';

      const standardTime =
        index === 0
          ? report.vehicleWorkFlow?.estimated_duration_minutes
            ? formatTime(report.vehicleWorkFlow.estimated_duration_minutes / 60)
            : report.skillTimeStandard?.standard_time_minutes
              ? formatTime(report.skillTimeStandard.standard_time_minutes / 60)
              : 'N/A'
          : '';

      const ltDetails =
        report.lt_details && Array.isArray(report.lt_details) && report.lt_details.length > 0
          ? report.lt_details
              .map(
                (lt: any) =>
                  `${lt.lt_minutes} min - ${lt.lt_reason} (${lt.is_lt_payable ? 'Payable' : 'Non-Payable'})`
              )
              .join('; ')
          : '';

      rows.push({
        'Work Order Number': index === 0 ? group.woNo || 'N/A' : '',
        'Pre Work Order Number': index === 0 ? group.pwoNo || 'N/A' : '',
        'Work Code': workCode,
        'Work Name': index === 0 ? workName : '',
        'Skill Competency': report.skillMapping?.sc_name || planning?.sc_required || 'N/A',
        'Standard Time': standardTime,
        Worker: planning?.hr_emp?.emp_name || 'N/A',
        SC: planning?.hr_emp?.skill_short || 'N/A',
        'Time Worked Till Date': formatTime(report.hours_worked_till_date || 0),
        'From Time': report.from_time || 'N/A',
        'To Time': report.to_time || 'N/A',
        'Hours Worked': formatTime(report.hours_worked_today || 0),
        'Total Hours Worked': formatTime(
          (report.hours_worked_till_date || 0) + (report.hours_worked_today || 0)
        ),
        'OT Hours':
          report.overtime_minutes && report.overtime_minutes > 0
            ? formatTime((report.overtime_minutes || 0) / 60)
            : '-',
        'Lost Time (minutes)': report.lt_minutes_total || 0,
        'Lost Time Details': ltDetails,
        Status:
          report.completion_status === 'C'
            ? 'Completed'
            : report.completion_status === 'NC'
              ? 'Not Completed'
              : 'Unknown',
        'Reported On': report.created_dt
          ? new Date(report.created_dt).toLocaleString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })
          : 'N/A'
      });
    });
  });

  return rows;
}

export function exportReportReviewExcel(
  worksReportData: any[],
  manpowerReportData: any[],
  ctx: ReportReviewExcelContext
): void {
  try {
    const manRows = manpowerRowsForExcel(manpowerReportData, ctx);
    const manpowerWs = XLSX.utils.json_to_sheet(
      manRows.length > 0
        ? manRows
        : [
            {
              Employee: '(No data)',
              Stage: '',
              Attendance: '',
              'Reported Hours': '',
              'OT Hours': '',
              'C-Off Hours': '',
              'LTP Hours': '',
              'LTNP Hours': ''
            }
          ]
    );
    manpowerWs['!cols'] = [
      { wch: 28 },
      { wch: 28 },
      { wch: 24 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 }
    ];

    const worksData = worksRowsForExcel(worksReportData);
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
              'Hours Worked': '',
              'Total Hours Worked': '',
              'OT Hours': '',
              'Lost Time (minutes)': '',
              'Lost Time Details': '',
              Status: '',
              'Reported On': ''
            }
          ]
    );
    worksWs['!cols'] = [
      { wch: 16 },
      { wch: 18 },
      { wch: 14 },
      { wch: 44 },
      { wch: 22 },
      { wch: 14 },
      { wch: 22 },
      { wch: 10 },
      { wch: 22 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 18 },
      { wch: 14 },
      { wch: 44 },
      { wch: 14 },
      { wch: 22 }
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
        return new Date(ctx.reportingDate).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      } catch {
        return ctx.reportingDate;
      }
    })();
    const filename = `Report-Review_${sanitize(ctx.stageCode)}_${sanitize(ctx.shiftCode)}_${dateLabel}_${ts}.xlsx`;
    XLSX.writeFile(wb, filename);
  } catch (error) {
    console.error('exportReportReviewExcel:', error);
    alert('Error generating Excel file. Please try again.');
  }
}
