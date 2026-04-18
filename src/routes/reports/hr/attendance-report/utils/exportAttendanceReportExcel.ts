import * as XLSX from 'xlsx';
import type { AttendancePivotReport } from '../services/attendanceReportService';
import { formatDdMmmYyyy } from '$lib/utils/reportDateRange';

export function exportAttendanceReportExcel(report: AttendancePivotReport, fromDate: string, toDate: string): void {
  const dateLabels = report.dates.map((d) => formatDdMmmYyyy(d));
  const data = report.rows.map((r) => {
    const row: Record<string, string> = {
      Shift: r.shiftCode ?? '',
      Stage: r.stageCode ?? '',
      Employee: r.empName ?? '',
      'Emp ID': r.empId ?? '',
      Skill: r.skillShort ?? ''
    };
    for (let i = 0; i < report.dates.length; i++) {
      const iso = report.dates[i];
      const label = dateLabels[i];
      row[label] = r.cells[iso] ?? '';
    }
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 24 }, { wch: 14 }, { wch: 10 }, ...report.dates.map(() => ({ wch: 8 }))];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

  const safeFrom = fromDate.split('T')[0].replace(/-/g, '');
  const safeTo = toDate.split('T')[0].replace(/-/g, '');
  XLSX.writeFile(wb, `attendance-report_${safeFrom}_${safeTo}.xlsx`);
}
