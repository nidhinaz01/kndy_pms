import * as XLSX from 'xlsx';
import { formatDdMmmYyyy } from '$lib/utils/reportDateRange';
import type { LostTimeReportRow } from '../services/lostTimeReportService';

function isoDatePart(dt: string | null | undefined): string {
  if (dt == null || dt === '') return '';
  return dt.split('T')[0];
}

export function exportLostTimeReportExcel(
  rows: LostTimeReportRow[],
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

  const data = rows.map((r) => {
    const dateLine = [formatDdMmmYyyy(r.reportFromDate) || r.reportFromDate || '', r.reportFromTime ?? '']
      .filter(Boolean)
      .join(' ')
      .trim();
    return {
    'Shift code': r.shiftCode ?? '',
    'Stage code': r.stageCode ?? '',
    Date: dateLine,
    'WO no': r.woNo ?? '',
    'PWO no': r.pwoNo ?? '',
    Customer: r.customerName ?? '',
    'Work code': r.workCode ?? '',
    'Work name + details': r.workNameDetails ?? '',
    'Std work skill competency': r.skillCompetency ?? '',
    'Std time': r.stdTimeDisplay ?? '',
    'Worker name': r.workerName ?? '',
    'Worker ID': r.workerId ?? '',
    Skill: r.skillShort ?? '',
    'Report to date': formatDdMmmYyyy(r.reportToDate) || r.reportToDate || '',
    'Report to time': r.reportToTime ?? '',
    'LT minutes (line)': r.ltMinutesLine ?? '',
    'LT reason (line)': r.ltReason ?? '',
    'LT payable (line)': r.isLtPayable === null ? '' : r.isLtPayable ? 'Yes' : 'No',
    'LT value (line)': r.ltValue ?? '',
    'LT minutes total (report)': r.ltMinutesTotal ?? '',
    'LT comments': r.ltComments ?? '',
    'Report status': r.status ?? '',
    'Completion status': r.completionStatus ?? '',
    'Created by': r.createdBy ?? '',
    'Created dt': r.createdDt ? formatDdMmmYyyy(isoDatePart(r.createdDt)) || r.createdDt : '',
    'Modified by': r.modifiedBy ?? '',
    'Modified dt': r.modifiedDt ? formatDdMmmYyyy(isoDatePart(r.modifiedDt)) || r.modifiedDt : ''
  };
  });

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(data.length ? data : [{ 'Shift code': '—', 'LT reason (line)': 'No rows in range' }]),
    'Lost time'
  );

  const pad = (n: number) => String(n).padStart(2, '0');
  const t = new Date();
  const ts = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}_${pad(t.getHours())}-${pad(t.getMinutes())}`;
  XLSX.writeFile(wb, `Lost-Time-Report_${fromDate}_${toDate}_${ts}.xlsx`);
}
