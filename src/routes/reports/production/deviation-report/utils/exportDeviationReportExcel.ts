import * as XLSX from 'xlsx';
import { formatDdMmmYyyy } from '$lib/utils/reportDateRange';
import type { DeviationReportRow } from '../services/deviationReportService';

export function exportDeviationReportExcel(
  rows: DeviationReportRow[],
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

  const data = rows.map((r) => ({
    'Stage code': r.stageCode ?? '',
    'Shift code': r.shiftCode ?? '',
    Date: formatDdMmmYyyy(r.dateIso) || r.dateIso || '',
    'Context (Plan vs Report)': r.rowContext,
    'Deviation ID': r.deviationId,
    'Deviation type': r.deviationType,
    Reason: r.reason,
    'Work order no': r.woNo ?? '',
    'PWO no': r.pwoNo ?? '',
    Customer: r.customerName ?? '',
    'Work code': r.workCode ?? '',
    'Work name + details': r.workNameDetails ?? '',
    'Std work skill competency': r.skillCompetency ?? '',
    'Std time': r.stdTimeDisplay ?? '',
    'Worker ID': r.workerId ?? '',
    'Worker name': r.workerName ?? '',
    Skill: r.skillShort ?? '',
    'Derived SW code': r.derivedSwCode ?? '',
    'Other work code': r.otherWorkCode ?? '',
    'Report status': r.reportStatus ?? '',
    'Completion status': r.completionStatus ?? '',
    'Created by': r.createdBy ?? '',
    'Created dt': r.createdDt ?? '',
    'Modified by': r.modifiedBy ?? '',
    'Modified dt': r.modifiedDt ?? ''
  }));

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(data.length ? data : [{ Reason: 'No rows in range' }]),
    'Deviations'
  );

  const pad = (n: number) => String(n).padStart(2, '0');
  const t = new Date();
  const ts = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}_${pad(t.getHours())}-${pad(t.getMinutes())}`;
  XLSX.writeFile(wb, `Deviation-Report_${fromDate}_${toDate}_${ts}.xlsx`);
}
