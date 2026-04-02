import * as XLSX from 'xlsx';
import {
  formatDdMmmYyyy,
  type DailyProductionStatusReport
} from '../services/dailyProductionStatusService';

export function exportDailyProductionStatusExcel(report: DailyProductionStatusReport): void {
  const wb = XLSX.utils.book_new();

  const summaryRows: Record<string, string | number>[] = [
    { Field: 'Report through date', Value: formatDdMmmYyyy(report.asOfDate) },
    {
      Field: 'Period (month to date)',
      Value: `${formatDdMmmYyyy(report.periodStart)} → ${formatDdMmmYyyy(report.asOfDate)}`
    },
    { Field: 'Working days completed', Value: report.workingDaysCompleted },
    {
      Field: 'Daily entry target (vehicles/day)',
      Value: report.dailyEntryTarget ?? '—'
    },
    { Field: 'Target (daily × working days)', Value: report.periodTarget ?? '—' }
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  const plantRows = report.plantMatrix.map((p) => ({
    Plant: p.plantLabel,
    'Entry stage': p.entryStageCode,
    'Exit stage': p.exitStageCode,
    Entered: p.entriesCount,
    Exited: p.exitsCount
  }));

  const wsPlants = XLSX.utils.json_to_sheet(
    plantRows.length > 0
      ? plantRows
      : [{ Plant: '—', 'Entry stage': '—', 'Exit stage': '—', Entered: 0, Exited: 0 }]
  );
  XLSX.utils.book_append_sheet(wb, wsPlants, 'Plants');

  const header: (string | number)[] = ['Stage'];
  for (const d of report.datesInPeriod) {
    const label = formatDdMmmYyyy(d);
    header.push(
      `${label} Entry count`,
      `${label} Entry WO nos.`,
      `${label} Exit count`,
      `${label} Exit WO nos.`
    );
  }

  const stageAoa: (string | number)[][] = [header];
  if (report.stageBreakdownByDate.length === 0) {
    const emptyRow: (string | number)[] = new Array(header.length).fill('');
    emptyRow[0] = 'No movements in period';
    stageAoa.push(emptyRow);
  } else {
    for (const s of report.stageBreakdownByDate) {
      const row: (string | number)[] = [s.stageCode];
      for (const day of s.byDay) {
        row.push(
          day.entryCount,
          day.entryWoNumbers.join(', '),
          day.exitCount,
          day.exitWoNumbers.join(', ')
        );
      }
      stageAoa.push(row);
    }
  }

  const wsStages = XLSX.utils.aoa_to_sheet(stageAoa);
  XLSX.utils.book_append_sheet(wb, wsStages, 'By stage');

  const pad = (n: number) => String(n).padStart(2, '0');
  const t = new Date();
  const ts = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}_${pad(t.getHours())}-${pad(t.getMinutes())}`;
  XLSX.writeFile(wb, `Daily-Production-Status-${report.asOfDate}-${ts}.xlsx`);
}
