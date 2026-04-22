import * as XLSX from 'xlsx';
import { formatDdMmmYyyy } from '$lib/utils/reportDateRange';
import type { COffReportRow } from '../services/cOffReportService';

function isoDatePart(dt: string | null | undefined): string {
  if (dt == null || dt === '') return '';
  return dt.split('T')[0];
}

export function exportCOffReportExcel(rows: COffReportRow[], fromDate: string, toDate: string): void {
  const wb = XLSX.utils.book_new();

  const meta = [
    { Field: 'From date', Value: formatDdMmmYyyy(fromDate) || fromDate },
    { Field: 'To date', Value: formatDdMmmYyyy(toDate) || toDate },
    { Field: 'Row count', Value: rows.length }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meta), 'Summary');

  const data = rows.map((r) => ({
    'Employee ID': r.empId ?? '',
    'Employee name': r.empName ?? '',
    Skill: r.skillShort ?? '',
    'Stage code': r.stageCode ?? '',
    'Shift code': r.shiftCode ?? '',
    'Attendance status': r.attendanceStatus ?? '',
    'Record status': r.recordStatus ?? '',
    'Attendance window from': formatDdMmmYyyy(r.windowFrom) || r.windowFrom || '',
    'Attendance window to': formatDdMmmYyyy(r.windowTo) || r.windowTo || '',
    'Attendance from time': r.attendanceFromTime ?? '',
    'Attendance to time': r.attendanceToTime ?? '',
    'Actual hours': r.actualHours ?? '',
    'C-Off value (days)': r.cOffValue ?? '',
    'C-Off from date': formatDdMmmYyyy(r.cOffFromDate) || r.cOffFromDate || '',
    'C-Off from time': r.cOffFromTime ?? '',
    'C-Off to date': formatDdMmmYyyy(r.cOffToDate) || r.cOffToDate || '',
    'C-Off to time': r.cOffToTime ?? '',
    Notes: r.notes ?? '',
    'Created by': r.createdBy ?? '',
    'Created dt': r.createdDt ? formatDdMmmYyyy(isoDatePart(r.createdDt)) || r.createdDt : '',
    'Modified dt': r.modifiedDt ? formatDdMmmYyyy(isoDatePart(r.modifiedDt)) || r.modifiedDt : ''
  }));

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(data.length ? data : [{ 'Employee name': 'No rows in range' }]),
    'C-Off'
  );

  const pad = (n: number) => String(n).padStart(2, '0');
  const t = new Date();
  const ts = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}_${pad(t.getHours())}-${pad(t.getMinutes())}`;
  XLSX.writeFile(wb, `C-Off-Report_${fromDate}_${toDate}_${ts}.xlsx`);
}
