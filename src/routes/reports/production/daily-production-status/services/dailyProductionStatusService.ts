/**
 * Daily Production Status report: MTD working days, targets, plant entry/exit (prdn_dates),
 * and per-stage WO entry/exit lists for the period month-start → selected date.
 *
 * By-stage rows use every stage from sys_data_elements (de_name = 'Plant-Stage'); stages with no
 * movements show 0 / —. Any stage_code in prdn_dates not in that list is appended at the end.
 */

import { supabase } from '$lib/supabaseClient';
import { calculateWorkingDays } from '$lib/api/holidays';
import { getApplicablePlanForDate } from '$lib/api/productionPlanService';
import { fetchAvailableStages } from '$lib/api/production/productionShiftService';

const PAGE_SIZE = 1000;

/** Plants shown in the summary matrix: entry at first line stage (PnS1), exit at last line stage in plant. */
const PLANT_ROWS: ReadonlyArray<{ plantLabel: string; prefix: string }> = [
  { plantLabel: 'P1', prefix: 'P1' },
  { plantLabel: 'P2', prefix: 'P2' },
  { plantLabel: 'P3', prefix: 'P3' }
];

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
] as const;

/** Display dates as 01-Apr-2026 (dd-MMM-yyyy). */
export function formatDdMmmYyyy(isoDate: string): string {
  const s = isoDate.split('T')[0];
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return s;
  const mon = MONTH_SHORT[m - 1] ?? String(m);
  return `${String(d).padStart(2, '0')}-${mon}-${y}`;
}

export interface DayStageMovement {
  entryCount: number;
  entryWoNumbers: string[];
  exitCount: number;
  exitWoNumbers: string[];
}

export interface StageByDateRow {
  stageCode: string;
  /** One cell per calendar day in `datesInPeriod` (same order). */
  byDay: DayStageMovement[];
}

export interface DailyProductionStatusReport {
  asOfDate: string;
  periodStart: string;
  workingDaysCompleted: number;
  dailyEntryTarget: number | null;
  periodTarget: number | null;
  plantMatrix: Array<{
    plantLabel: string;
    /** Stage where "Entered" distinct WOs are counted (always PnS1). */
    entryStageCode: string;
    /** Stage where "Exited" distinct WOs are counted (last PnS* for the plant). */
    exitStageCode: string;
    entriesCount: number;
    exitsCount: number;
  }>;
  /** Inclusive calendar days from month start through as-of date (YYYY-MM-DD). */
  datesInPeriod: string[];
  stageBreakdownByDate: StageByDateRow[];
}

function parseLocalDate(isoDate: string): Date {
  const s = isoDate.split('T')[0];
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

/** Every calendar day from start through end inclusive (YYYY-MM-DD). */
function enumerateCalendarDates(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  let d = parseLocalDate(startIso);
  const endD = parseLocalDate(endIso);
  while (d <= endD) {
    out.push(toIsoDate(d));
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
  return out;
}

function monthStartStr(isoDate: string): string {
  const s = isoDate.split('T')[0];
  const [y, m] = s.split('-');
  return `${y}-${m}-01`;
}

function actualDateKey(raw: string | null | undefined): string | null {
  if (raw == null || raw === '') return null;
  return String(raw).split('T')[0];
}

function sortWoNumbers(a: string, b: string): number {
  const na = parseInt(a.replace(/\D/g, ''), 10);
  const nb = parseInt(b.replace(/\D/g, ''), 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return a.localeCompare(b, undefined, { numeric: true });
}

function sortStageCodes(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

/** Stages PnS* from master and/or movements (deduped, sorted). */
function stagesForPlantPrefix(
  prefix: string,
  masterStages: string[],
  movementRows: Array<{ stage_code: string }>
): string[] {
  const re = new RegExp(`^${prefix}S\\d+$`, 'i');
  const set = new Set<string>();
  for (const s of masterStages) {
    if (re.test(s)) set.add(s);
  }
  for (const r of movementRows) {
    if (re.test(r.stage_code)) set.add(r.stage_code);
  }
  return [...set].sort(sortStageCodes);
}

/** Entry count stage: always PnS1 (first line) for that plant. */
function entryStageCodeForPlant(prefix: string): string {
  return `${prefix}S1`;
}

/** Exit count stage: last PnS* for the plant (e.g. P1S4, P2S4); P3 has only P3S1 so entry and exit align. */
function exitStageCodeForPlant(prefix: string, sortedPlantStages: string[]): string {
  if (sortedPlantStages.length === 0) return `${prefix}S1`;
  return sortedPlantStages[sortedPlantStages.length - 1]!;
}

async function fetchPrdnMovementsRaw(periodStart: string, asOfDate: string) {
  const out: Array<{
    stage_code: string;
    date_type: string;
    sales_order_id: number;
    actual_date: string;
    wo_no: string | null;
  }> = [];

  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from('prdn_dates')
      .select(
        `
        stage_code,
        date_type,
        sales_order_id,
        actual_date,
        prdn_wo_details(wo_no)
      `
      )
      .in('date_type', ['entry', 'exit'])
      .not('actual_date', 'is', null)
      .gte('actual_date', `${periodStart}T00:00:00`)
      .lte('actual_date', `${asOfDate}T23:59:59.999`)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    const page = data || [];
    for (const row of page as any[]) {
      const wo = row.prdn_wo_details;
      const woNo = Array.isArray(wo) ? wo[0]?.wo_no : wo?.wo_no;
      out.push({
        stage_code: row.stage_code,
        date_type: row.date_type,
        sales_order_id: row.sales_order_id,
        actual_date: row.actual_date,
        wo_no: woNo ?? null
      });
    }

    hasMore = page.length === PAGE_SIZE;
    offset += PAGE_SIZE;
  }

  return out.filter((r) => {
    const key = actualDateKey(r.actual_date);
    if (!key) return false;
    return key >= periodStart && key <= asOfDate;
  });
}

export async function loadDailyProductionStatusReport(asOfDate: string): Promise<DailyProductionStatusReport> {
  const dateStr = asOfDate.split('T')[0];
  const periodStart = monthStartStr(dateStr);
  const endD = parseLocalDate(dateStr);
  const startD = parseLocalDate(periodStart);

  const workingDaysCompleted = await calculateWorkingDays(startD, endD);

  const planForDate = await getApplicablePlanForDate(dateStr);
  const dailyEntryTarget =
    planForDate != null && planForDate.ppd_count != null ? Number(planForDate.ppd_count) : null;
  const periodTarget =
    dailyEntryTarget != null ? Math.round(dailyEntryTarget * workingDaysCompleted * 100) / 100 : null;

  const [rows, plantStagesFromMaster] = await Promise.all([
    fetchPrdnMovementsRaw(periodStart, dateStr),
    fetchAvailableStages()
  ]);

  const plantMatrix = PLANT_ROWS.map(({ plantLabel, prefix }) => {
    const plantStages = stagesForPlantPrefix(prefix, plantStagesFromMaster, rows);
    const entryStageCode = entryStageCodeForPlant(prefix);
    const exitStageCode = exitStageCodeForPlant(prefix, plantStages);

    const entryIds = new Set<number>();
    const exitIds = new Set<number>();
    for (const r of rows) {
      if (r.date_type === 'entry' && r.stage_code === entryStageCode) entryIds.add(r.sales_order_id);
      else if (r.date_type === 'exit' && r.stage_code === exitStageCode) exitIds.add(r.sales_order_id);
    }
    return {
      plantLabel,
      entryStageCode,
      exitStageCode,
      entriesCount: entryIds.size,
      exitsCount: exitIds.size
    };
  });

  const datesInPeriod = enumerateCalendarDates(periodStart, dateStr);

  /** Key: `${stage}|${yyyy-mm-dd}|entry|exit` → sales_order_id → WO label */
  const dayBuckets = new Map<string, Map<number, string>>();
  for (const r of rows) {
    const dk = actualDateKey(r.actual_date);
    if (!dk) continue;
    if (r.date_type !== 'entry' && r.date_type !== 'exit') continue;
    const key = `${r.stage_code}|${dk}|${r.date_type}`;
    if (!dayBuckets.has(key)) dayBuckets.set(key, new Map());
    const m = dayBuckets.get(key)!;
    const label = r.wo_no || `WO#${r.sales_order_id}`;
    m.set(r.sales_order_id, label);
  }

  const canonicalSet = new Set(plantStagesFromMaster);
  const orphanStages = [...new Set(rows.map((r) => r.stage_code).filter((s): s is string => Boolean(s)))]
    .filter((s) => !canonicalSet.has(s))
    .sort(sortStageCodes);
  const allStageCodes = [...plantStagesFromMaster, ...orphanStages];

  const stageBreakdownByDate: StageByDateRow[] = allStageCodes.map((stageCode) => ({
    stageCode,
    byDay: datesInPeriod.map((d) => {
      const entryMap = dayBuckets.get(`${stageCode}|${d}|entry`) ?? new Map<number, string>();
      const exitMap = dayBuckets.get(`${stageCode}|${d}|exit`) ?? new Map<number, string>();
      const entryWoNumbers = [...new Set(entryMap.values())].sort(sortWoNumbers);
      const exitWoNumbers = [...new Set(exitMap.values())].sort(sortWoNumbers);
      return {
        entryCount: entryWoNumbers.length,
        entryWoNumbers,
        exitCount: exitWoNumbers.length,
        exitWoNumbers
      };
    })
  }));

  return {
    asOfDate: dateStr,
    periodStart,
    workingDaysCompleted,
    dailyEntryTarget,
    periodTarget,
    plantMatrix,
    datesInPeriod,
    stageBreakdownByDate
  };
}
