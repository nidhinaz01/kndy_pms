import * as XLSX from 'xlsx';
import { formatDdMmmYyyy } from '$lib/utils/reportDateRange';
import type { OtReportRow } from '../services/otReportService';

function isoDatePart(dt: string | null | undefined): string {
  if (dt == null || dt === '') return '';
  return dt.split('T')[0];
}

export function exportOtReportExcel(rows: OtReportRow[], fromDate: string, toDate: string): void {
  const wb = XLSX.utils.book_new();

  const meta = [
    { Field: 'From date', Value: formatDdMmmYyyy(fromDate) || fromDate },
    { Field: 'To date', Value: formatDdMmmYyyy(toDate) || toDate },
    { Field: 'Row count', Value: rows.length }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meta), 'Summary');

  const data = rows.map((r) => ({
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

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(data.length ? data : [{ 'WO no': '—', 'Worker name': 'No rows in range' }]),
    'Overtime'
  );

  const pad = (n: number) => String(n).padStart(2, '0');
  const t = new Date();
  const ts = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}_${pad(t.getHours())}-${pad(t.getMinutes())}`;
  XLSX.writeFile(wb, `OT-Report_${fromDate}_${toDate}_${ts}.xlsx`);
}
