import * as XLSX from 'xlsx';
import type { ManhourPivotReport } from '../services/manhourReportService';
import { formatDdMmmYyyy } from '$lib/utils/reportDateRange';

export function exportManhourReportExcel(
  report: ManhourPivotReport,
  fromDate: string,
  toDate: string,
  selectedStage: string
): void {
  const wb = XLSX.utils.book_new();

  const meta = [
    { Field: 'Stage', Value: selectedStage },
    { Field: 'From date', Value: formatDdMmmYyyy(fromDate) || fromDate },
    { Field: 'To date', Value: formatDdMmmYyyy(toDate) || toDate },
    { Field: 'Row count', Value: report.rows.length }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meta), 'Summary');

  const dateLabels = report.dates.map((d) => formatDdMmmYyyy(d));
  const detailsRows = report.rows.map((r) => {
    const row: Record<string, string | number> = {
      Employee: r.workerName ?? '',
      'Worker ID': r.workerId,
      Skill: r.skillShort ?? ''
    };
    for (let i = 0; i < report.dates.length; i++) {
      const iso = report.dates[i];
      const label = dateLabels[i];
      row[label] = Number((r.cells[iso] ?? 0).toFixed(2));
    }
    row.Total = Number(r.totalHours.toFixed(2));
    return row;
  });

  const totalRow: Record<string, string | number> = { Employee: 'Total', 'Worker ID': '', Skill: '' };
  let grandTotal = 0;
  for (let i = 0; i < report.dates.length; i++) {
    const iso = report.dates[i];
    const label = dateLabels[i];
    const dayTotal = report.rows.reduce((sum, r) => sum + (r.cells[iso] ?? 0), 0);
    totalRow[label] = Number(dayTotal.toFixed(2));
    grandTotal += dayTotal;
  }
  totalRow.Total = Number(grandTotal.toFixed(2));
  detailsRows.push(totalRow);

  type SkillConsolidatedRow = { skillShort: string; byDate: Record<string, number>; total: number };
  const grouped = new Map<string, SkillConsolidatedRow>();
  for (const r of report.rows) {
    const skill = (r.skillShort || 'Unspecified').trim() || 'Unspecified';
    if (!grouped.has(skill)) {
      const byDate: Record<string, number> = {};
      for (const d of report.dates) byDate[d] = 0;
      grouped.set(skill, { skillShort: skill, byDate, total: 0 });
    }
    const row = grouped.get(skill)!;
    for (const d of report.dates) {
      const v = r.cells[d] ?? 0;
      row.byDate[d] += v;
      row.total += v;
    }
  }
  const consolidatedRows = [...grouped.values()].sort((a, b) => a.skillShort.localeCompare(b.skillShort));
  const consolidatedExcelRows = consolidatedRows.map((r) => {
    const row: Record<string, string | number> = { Skill: r.skillShort };
    for (let i = 0; i < report.dates.length; i++) {
      const iso = report.dates[i];
      const label = dateLabels[i];
      row[label] = Number((r.byDate[iso] ?? 0).toFixed(2));
    }
    row.Total = Number(r.total.toFixed(2));
    return row;
  });
  const consolidatedTotalRow: Record<string, string | number> = { Skill: 'Total' };
  let consolidatedGrandTotal = 0;
  for (let i = 0; i < report.dates.length; i++) {
    const iso = report.dates[i];
    const label = dateLabels[i];
    const dayTotal = consolidatedRows.reduce((sum, r) => sum + (r.byDate[iso] ?? 0), 0);
    consolidatedTotalRow[label] = Number(dayTotal.toFixed(2));
    consolidatedGrandTotal += dayTotal;
  }
  consolidatedTotalRow.Total = Number(consolidatedGrandTotal.toFixed(2));
  consolidatedExcelRows.push(consolidatedTotalRow);

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(consolidatedExcelRows.length ? consolidatedExcelRows : [{ Skill: 'No rows in range' }]),
    'Consolidated'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(detailsRows.length ? detailsRows : [{ Employee: 'No rows in range' }]),
    'Details'
  );

  const pad = (n: number) => String(n).padStart(2, '0');
  const t = new Date();
  const ts = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}_${pad(t.getHours())}-${pad(t.getMinutes())}`;
  XLSX.writeFile(wb, `Manhour-Report_${fromDate}_${toDate}_${ts}.xlsx`);
}
