import * as XLSX from 'xlsx';
import { formatDdMmmYyyy } from '$lib/utils/reportDateRange';
import type { NonStdOtReportRow } from '../services/nonStdOtReportService';

function isoDatePart(dt: string | null | undefined): string {
  if (dt == null || dt === '') return '';
  return dt.split('T')[0];
}

function formatOtHours(mins: number): string {
  const safe = Number.isFinite(mins) ? mins : 0;
  const h = Math.floor(safe / 60);
  const m = Math.round(safe % 60);
  return `${h} Hr ${m} Min`;
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

export function exportNonStdOtReportExcel(
  rows: NonStdOtReportRow[],
  fromDate: string,
  toDate: string
): void {
  const wb = XLSX.utils.book_new();

  const meta = [
    { Field: 'From date', Value: formatDdMmmYyyy(fromDate) || fromDate },
    { Field: 'To date', Value: formatDdMmmYyyy(toDate) || toDate },
    { Field: 'Row count', Value: rows.length }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meta), 'Summary');

  const detailsRows = rows.map((r) => ({
    'WO no': r.woNo ?? '',
    'PWO no': r.pwoNo ?? '',
    Customer: r.customerName ?? '',
    'Work code': r.workCode ?? '',
    'Work name + details': r.workNameDetails ?? '',
    'Stage code': r.stageCode ?? '',
    'Shift code': r.shiftCode ?? '',
    'Worker name': r.workerName ?? '',
    'Worker ID': r.workerId ?? '',
    Skill: r.skillShort ?? '',
    'Report from date': formatDdMmmYyyy(r.reportFromDate) || r.reportFromDate || '',
    'Report from time': r.reportFromTime ?? '',
    'Report to date': formatDdMmmYyyy(r.reportToDate) || r.reportToDate || '',
    'Report to time': r.reportToTime ?? '',
    'OT minutes': r.overtimeMinutes ?? '',
    'OT amount': r.overtimeAmount ?? '',
    'Report status': r.status ?? '',
    'Completion status': r.completionStatus ?? '',
    'Created by': r.createdBy ?? '',
    'Created dt': r.createdDt ? formatDdMmmYyyy(isoDatePart(r.createdDt)) || r.createdDt : ''
  }));

  const detailsTotalMinutes = rows.reduce((sum, r) => sum + (Number.isFinite(Number(r.overtimeMinutes)) ? Number(r.overtimeMinutes) : 0), 0);
  const detailsTotalValue = rows.reduce((sum, r) => sum + (Number.isFinite(Number(r.overtimeAmount)) ? Number(r.overtimeAmount) : 0), 0);
  detailsRows.push({
    'WO no': 'Total',
    'PWO no': '',
    Customer: '',
    'Work code': '',
    'Work name + details': '',
    'Stage code': '',
    'Shift code': '',
    'Worker name': '',
    'Worker ID': '',
    Skill: '',
    'Report from date': '',
    'Report from time': '',
    'Report to date': '',
    'Report to time': '',
    'OT minutes': detailsTotalMinutes,
    'OT amount': Number(detailsTotalValue.toFixed(2)),
    'Report status': '',
    'Completion status': '',
    'Created by': '',
    'Created dt': ''
  });

  type ConsolidatedCell = { minutes: number; value: number };
  type ConsolidatedRow = { key: string; employeeName: string; byDate: Record<string, ConsolidatedCell> };
  const dates = enumerateDates(fromDate, toDate);
  const byEmp = new Map<string, ConsolidatedRow>();
  for (const r of rows) {
    const employeeCode = (r.workerId || '').trim();
    const employeeName = (r.workerName || '').trim();
    if (!employeeName) continue;
    const key = `${employeeCode}__${employeeName}`;
    if (!byEmp.has(key)) {
      const byDate: Record<string, ConsolidatedCell> = {};
      for (const d of dates) byDate[d] = { minutes: 0, value: 0 };
      byEmp.set(key, { key, employeeName, byDate });
    }
    const dateKey = isoDatePart(r.reportFromDate);
    if (!dateKey || !dates.includes(dateKey)) continue;
    const cell = byEmp.get(key)!.byDate[dateKey];
    cell.minutes += Number.isFinite(Number(r.overtimeMinutes)) ? Number(r.overtimeMinutes) : 0;
    cell.value += Number.isFinite(Number(r.overtimeAmount)) ? Number(r.overtimeAmount) : 0;
  }
  const consolidated = [...byEmp.values()].sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  const consolidatedRowsForExcel: Array<Record<string, string | number>> = [];
  const dayTotals: Record<string, ConsolidatedCell> = {};
  for (const d of dates) dayTotals[d] = { minutes: 0, value: 0 };
  let grandMinutes = 0;
  let grandValue = 0;

  for (const emp of consolidated) {
    const rec: Record<string, string | number> = { 'Employee Name': emp.employeeName };
    let empMinutes = 0;
    let empValue = 0;
    for (const d of dates) {
      const label = formatDdMmmYyyy(d) || d;
      const c = emp.byDate[d] || { minutes: 0, value: 0 };
      rec[`${label} - Time`] = formatOtHours(c.minutes);
      rec[`${label} - Amount`] = Number(c.value.toFixed(2));
      empMinutes += c.minutes;
      empValue += c.value;
      dayTotals[d].minutes += c.minutes;
      dayTotals[d].value += c.value;
    }
    rec['Total - Time'] = formatOtHours(empMinutes);
    rec['Total - Amount'] = Number(empValue.toFixed(2));
    consolidatedRowsForExcel.push(rec);
    grandMinutes += empMinutes;
    grandValue += empValue;
  }

  const totalRec: Record<string, string | number> = { 'Employee Name': 'Total' };
  for (const d of dates) {
    const label = formatDdMmmYyyy(d) || d;
    const c = dayTotals[d];
    totalRec[`${label} - Time`] = formatOtHours(c.minutes);
    totalRec[`${label} - Amount`] = Number(c.value.toFixed(2));
  }
  totalRec['Total - Time'] = formatOtHours(grandMinutes);
  totalRec['Total - Amount'] = Number(grandValue.toFixed(2));
  consolidatedRowsForExcel.push(totalRec);

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(consolidatedRowsForExcel.length ? consolidatedRowsForExcel : [{ 'Employee Name': 'No rows in range' }]),
    'Consolidated'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(detailsRows.length ? detailsRows : [{ 'WO no': '—', 'Worker name': 'No rows in range' }]),
    'Details'
  );

  const pad = (n: number) => String(n).padStart(2, '0');
  const t = new Date();
  const ts = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}_${pad(t.getHours())}-${pad(
    t.getMinutes()
  )}`;
  XLSX.writeFile(wb, `Non-Std-OT-Report_${fromDate}_${toDate}_${ts}.xlsx`);
}
