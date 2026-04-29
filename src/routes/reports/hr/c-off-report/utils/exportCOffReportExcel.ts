import * as XLSX from 'xlsx';
import { formatDdMmmYyyy } from '$lib/utils/reportDateRange';
import type { COffReportRow } from '../services/cOffReportService';

function isoDatePart(dt: string | null | undefined): string {
  if (dt == null || dt === '') return '';
  return dt.split('T')[0];
}

function enumerateDates(startIso: string, endIso: string): string[] {
  const [sy, sm, sd] = startIso.split('-').map(Number);
  const [ey, em, ed] = endIso.split('-').map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return [];
  const out: string[] = [];
  let d = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  while (d <= end) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    out.push(`${y}-${m}-${day}`);
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
  return out;
}

export function exportCOffReportExcel(rows: COffReportRow[], fromDate: string, toDate: string, selectedStage?: string): void {
  const wb = XLSX.utils.book_new();

  const meta = [
    { Field: 'Stage', Value: selectedStage ?? '' },
    { Field: 'From date', Value: formatDdMmmYyyy(fromDate) || fromDate },
    { Field: 'To date', Value: formatDdMmmYyyy(toDate) || toDate },
    { Field: 'Row count', Value: rows.length }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meta), 'Summary');

  const detailsRows = rows.map((r) => ({
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
  const detailsTotalCOff = rows.reduce((sum, r) => sum + (Number.isFinite(Number(r.cOffValue)) ? Number(r.cOffValue) : 0), 0);
  detailsRows.push({
    'Employee ID': '',
    'Employee name': 'Total',
    Skill: '',
    'Stage code': '',
    'Shift code': '',
    'Attendance status': '',
    'Record status': '',
    'Attendance window from': '',
    'Attendance window to': '',
    'Attendance from time': '',
    'Attendance to time': '',
    'Actual hours': '',
    'C-Off value (days)': Number(detailsTotalCOff.toFixed(2)),
    'C-Off from date': '',
    'C-Off from time': '',
    'C-Off to date': '',
    'C-Off to time': '',
    Notes: '',
    'Created by': '',
    'Created dt': '',
    'Modified dt': ''
  });

  type ConsolidatedRow = { key: string; employeeName: string; byDate: Record<string, number> };
  const dates = enumerateDates(fromDate, toDate);
  const byEmp = new Map<string, ConsolidatedRow>();
  for (const r of rows) {
    const employeeCode = (r.empId || '').trim();
    const employeeName = (r.empName || '').trim();
    if (!employeeName) continue;
    const key = `${employeeCode}__${employeeName}`;
    if (!byEmp.has(key)) {
      const byDate: Record<string, number> = {};
      for (const d of dates) byDate[d] = 0;
      byEmp.set(key, { key, employeeName, byDate });
    }
    const dateKey = isoDatePart(r.windowFrom);
    if (!dateKey || !dates.includes(dateKey)) continue;
    byEmp.get(key)!.byDate[dateKey] += Number.isFinite(Number(r.cOffValue)) ? Number(r.cOffValue) : 0;
  }
  const consolidatedRows = [...byEmp.values()].sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  const consolidatedForExcel: Array<Record<string, string | number>> = [];
  const dayTotals: Record<string, number> = {};
  for (const d of dates) dayTotals[d] = 0;
  let grandTotal = 0;

  for (const emp of consolidatedRows) {
    const rec: Record<string, string | number> = { 'Employee Name': emp.employeeName };
    let empTotal = 0;
    for (const d of dates) {
      const label = formatDdMmmYyyy(d) || d;
      const value = emp.byDate[d] ?? 0;
      rec[label] = Number(value.toFixed(2));
      empTotal += value;
      dayTotals[d] += value;
    }
    rec['Total C-Off (d)'] = Number(empTotal.toFixed(2));
    consolidatedForExcel.push(rec);
    grandTotal += empTotal;
  }
  const totalRec: Record<string, string | number> = { 'Employee Name': 'Total' };
  for (const d of dates) {
    const label = formatDdMmmYyyy(d) || d;
    totalRec[label] = Number((dayTotals[d] ?? 0).toFixed(2));
  }
  totalRec['Total C-Off (d)'] = Number(grandTotal.toFixed(2));
  consolidatedForExcel.push(totalRec);

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(consolidatedForExcel.length ? consolidatedForExcel : [{ 'Employee Name': 'No rows in range' }]),
    'Consolidated'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(detailsRows.length ? detailsRows : [{ 'Employee name': 'No rows in range' }]),
    'Details'
  );

  const pad = (n: number) => String(n).padStart(2, '0');
  const t = new Date();
  const ts = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}_${pad(t.getHours())}-${pad(t.getMinutes())}`;
  XLSX.writeFile(wb, `C-Off-Report_${fromDate}_${toDate}_${ts}.xlsx`);
}
