import { supabase } from '$lib/supabaseClient';
import { fetchProductionEmployees } from '$lib/api/production';

import { fetchConfiguredStageShifts, type StageShiftPair } from './dashboardDataService';

export interface CentralReasonMetrics {
  reason: string;
  workOrderCount: number;
  minutesTotal: number;
}

export interface CentralLevelMetrics {
  // Manpower
  manpowerTotal: number;
  manpowerPlannedAttendance: number;
  manpowerReportedAttendance: number;

  // Work orders / works (planned + reported)
  workOrdersPlanned: number;
  worksPlanned: number;

  workOrdersReported: number;
  worksReported: number;

  // Lost time (reported)
  workOrdersReportedWithoutLostTime: number;
  workOrdersReportedWithLostTime: number;
  lostTimeMinutesTotal: number;

  // Reasons (top)
  lostTimeReasonsTop: CentralReasonMetrics[];
}

export interface CentralShiftMetrics extends CentralLevelMetrics {
  stageCode: string;
  shiftCode: string;
  plantCode: string;
}

export interface CentralStageNode {
  stageCode: string;
  plantCode: string;
  totals: CentralLevelMetrics;
  shifts: CentralShiftMetrics[];
}

export interface CentralPlantNode {
  plantCode: string;
  totals: CentralLevelMetrics;
  stages: CentralStageNode[];
}

export interface CentralProductionDashboardMetrics {
  selectedDate: string;
  totals: CentralLevelMetrics;
  plants: CentralPlantNode[];
}

function derivePlantFromStage(stageCode: string): string {
  const s = (stageCode || '').toUpperCase().trim();
  // Stage codes look like:
  // - P1S2
  // - P1AC
  // - P2S2 (etc.)
  // Plant should be only the leading "P<number>" portion.
  const m = s.match(/^P(\d+)/);
  if (m?.[0]) return m[0];
  return s;
}

function toNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function makeKey(workCode: string, woDetailsId: unknown) {
  const wo = woDetailsId === null || woDetailsId === undefined || woDetailsId === '' ? 'unknown' : String(woDetailsId);
  return `${workCode}_${wo}`;
}

function emptyLevelMetrics(): CentralLevelMetrics {
  return {
    manpowerTotal: 0,
    manpowerPlannedAttendance: 0,
    manpowerReportedAttendance: 0,
    workOrdersPlanned: 0,
    worksPlanned: 0,
    workOrdersReported: 0,
    worksReported: 0,
    workOrdersReportedWithoutLostTime: 0,
    workOrdersReportedWithLostTime: 0,
    lostTimeMinutesTotal: 0,
    lostTimeReasonsTop: []
  };
}

function addLevelMetrics(a: CentralLevelMetrics, b: CentralLevelMetrics): CentralLevelMetrics {
  return {
    manpowerTotal: a.manpowerTotal + b.manpowerTotal,
    manpowerPlannedAttendance: a.manpowerPlannedAttendance + b.manpowerPlannedAttendance,
    manpowerReportedAttendance: a.manpowerReportedAttendance + b.manpowerReportedAttendance,
    workOrdersPlanned: a.workOrdersPlanned + b.workOrdersPlanned,
    worksPlanned: a.worksPlanned + b.worksPlanned,
    workOrdersReported: a.workOrdersReported + b.workOrdersReported,
    worksReported: a.worksReported + b.worksReported,
    workOrdersReportedWithoutLostTime: a.workOrdersReportedWithoutLostTime + b.workOrdersReportedWithoutLostTime,
    workOrdersReportedWithLostTime: a.workOrdersReportedWithLostTime + b.workOrdersReportedWithLostTime,
    lostTimeMinutesTotal: a.lostTimeMinutesTotal + b.lostTimeMinutesTotal,
    lostTimeReasonsTop: []
  };
}

function mergeTopReasons(shifts: CentralShiftMetrics[], limit = 5): CentralReasonMetrics[] {
  const map = new Map<string, { workOrderCount: number; minutesTotal: number }>();
  for (const s of shifts) {
    for (const r of s.lostTimeReasonsTop || []) {
      const cur = map.get(r.reason) || { workOrderCount: 0, minutesTotal: 0 };
      cur.workOrderCount += r.workOrderCount;
      cur.minutesTotal += r.minutesTotal;
      map.set(r.reason, cur);
    }
  }
  const merged = Array.from(map.entries()).map(([reason, v]) => ({
    reason,
    workOrderCount: v.workOrderCount,
    minutesTotal: v.minutesTotal
  }));
  merged.sort((x, y) => y.workOrderCount - x.workOrderCount || y.minutesTotal - x.minutesTotal);
  return merged.slice(0, limit);
}

async function fetchWorkerShiftMap(workerIds: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(workerIds.filter(Boolean)));
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase
    .from('hr_emp')
    .select('emp_id, shift_code')
    .in('emp_id', unique)
    .eq('is_active', true)
    .eq('is_deleted', false);

  if (error) throw error;
  const map = new Map<string, string>();
  (data || []).forEach((row: any) => {
    if (row.emp_id && row.shift_code) map.set(String(row.emp_id), String(row.shift_code));
  });
  return map;
}

async function fetchPlannedWorksByStage(stageCode: string, dateStr: string): Promise<any[]> {
  // Planned = include draft + pending + approved (manager view).
  const { data, error } = await supabase
    .from('prdn_work_planning')
    .select('worker_id, wo_details_id, derived_sw_code, other_work_code')
    .eq('stage_code', stageCode)
    .eq('from_date', dateStr)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .in('status', ['draft', 'pending_approval', 'approved']);

  if (error) throw error;
  return data || [];
}

async function fetchReportedWorksByStage(
  stageCode: string,
  dateStr: string,
  includeLtDetails: boolean
): Promise<any[]> {
  // Reported = approved reporting for the selected date.
  const { data, error } = await supabase
    .from('prdn_work_reporting')
    .select(
      includeLtDetails
        ? `
          worker_id,
          lt_minutes_total,
          lt_details,
          prdn_work_planning!inner(
            wo_details_id,
            derived_sw_code,
            other_work_code
          )
        `
        : `
          worker_id,
          lt_minutes_total,
          prdn_work_planning!inner(
            wo_details_id,
            derived_sw_code,
            other_work_code
          )
        `
    )
    .eq('status', 'approved')
    .eq('is_deleted', false)
    .gte('from_date', dateStr)
    .lte('from_date', dateStr)
    .eq('prdn_work_planning.stage_code', stageCode);

  if (error) throw error;
  return data || [];
}

function buildPlannedMetricsByShift(
  plannedRows: any[],
  workerShiftMap: Map<string, string>,
  shiftsToKeep: Set<string>
) {
  const workOrdersPlannedByShift = new Map<string, Set<string | number>>();
  const worksPlannedByShift = new Map<string, Set<string>>();

  for (const row of plannedRows || []) {
    const workerId = row.worker_id ? String(row.worker_id) : '';
    const shiftCode = workerShiftMap.get(workerId);
    if (!shiftCode) continue;
    if (!shiftsToKeep.has(shiftCode)) continue;

    const woDetailsId = row.wo_details_id ?? null;
    const workCode = (row.other_work_code || row.derived_sw_code || 'unknown') as string;
    const workGroupKey = makeKey(workCode, woDetailsId);

    if (!workOrdersPlannedByShift.has(shiftCode)) workOrdersPlannedByShift.set(shiftCode, new Set());
    if (!worksPlannedByShift.has(shiftCode)) worksPlannedByShift.set(shiftCode, new Set());

    workOrdersPlannedByShift.get(shiftCode)!.add(String(woDetailsId ?? 'unknown'));
    worksPlannedByShift.get(shiftCode)!.add(workGroupKey);
  }

  const out = new Map<string, { workOrdersPlanned: number; worksPlanned: number }>();
  for (const shiftCode of shiftsToKeep) {
    out.set(shiftCode, {
      workOrdersPlanned: workOrdersPlannedByShift.get(shiftCode)?.size || 0,
      worksPlanned: worksPlannedByShift.get(shiftCode)?.size || 0
    });
  }
  return out;
}

function buildReportedMetricsByShift(
  reportedRows: any[],
  workerShiftMap: Map<string, string>,
  shiftsToKeep: Set<string>,
  collectLostTimeReasons: boolean
) {
  const workOrdersReportedByShift = new Map<string, Set<string | number>>();
  const worksReportedByShift = new Map<string, Set<string>>();

  // workOrderId -> { minutesTotal, reasonsSet }
  const lostTimeByShift = new Map<
    string,
    Map<string, { minutesTotal: number; reasonsSet: Set<string> }>
  >();

  for (const row of reportedRows || []) {
    const workerId = row.worker_id ? String(row.worker_id) : '';
    const shiftCode = workerShiftMap.get(workerId);
    if (!shiftCode) continue;
    if (!shiftsToKeep.has(shiftCode)) continue;

    const planning = row.prdn_work_planning || {};
    const woDetailsId = planning.wo_details_id ?? null;
    const workCode = (planning.other_work_code || planning.derived_sw_code || 'unknown') as string;

    if (!workOrdersReportedByShift.has(shiftCode)) workOrdersReportedByShift.set(shiftCode, new Set());
    if (!worksReportedByShift.has(shiftCode)) worksReportedByShift.set(shiftCode, new Set());
    if (!lostTimeByShift.has(shiftCode)) lostTimeByShift.set(shiftCode, new Map());

    const woKey = String(woDetailsId ?? 'unknown');
    const workGroupKey = makeKey(workCode, woDetailsId);
    workOrdersReportedByShift.get(shiftCode)!.add(woKey);
    worksReportedByShift.get(shiftCode)!.add(workGroupKey);

    if (!lostTimeByShift.get(shiftCode)!.has(woKey)) {
      lostTimeByShift.get(shiftCode)!.set(woKey, { minutesTotal: 0, reasonsSet: new Set() });
    }

    const entry = lostTimeByShift.get(shiftCode)!.get(woKey)!;
    const ltMinutes = toNumber(row.lt_minutes_total);
    entry.minutesTotal += ltMinutes;

    if (collectLostTimeReasons) {
      // Collect reasons from lt_details array
      const ltDetails = row.lt_details;
      if (Array.isArray(ltDetails)) {
        for (const lt of ltDetails) {
          const minutes = toNumber(lt?.lt_minutes);
          const reason = (lt?.lt_reason || lt?.reason || '').toString();
          if (reason) {
            // If a reason exists, keep it; manager wants "their reasons".
            // Even if minutes is 0, it might still carry reason meaning.
            entry.reasonsSet.add(reason);
          } else if (minutes > 0) {
            entry.reasonsSet.add('N/A');
          }
        }
      }
    }
  }

  const out = new Map<
    string,
    {
      workOrdersReported: number;
      worksReported: number;
      workOrdersReportedWithoutLostTime: number;
      workOrdersReportedWithLostTime: number;
      lostTimeMinutesTotal: number;
      lostTimeReasonsTop: CentralReasonMetrics[];
    }
  >();

  for (const shiftCode of shiftsToKeep) {
    const workOrdersReported = workOrdersReportedByShift.get(shiftCode)?.size || 0;
    const worksReported = worksReportedByShift.get(shiftCode)?.size || 0;

    const lostMap = lostTimeByShift.get(shiftCode) || new Map();
    let withLostTime = 0;
    let withoutLostTime = workOrdersReported;
    let lostTimeMinutesTotal = 0;

    const reasonAgg = collectLostTimeReasons
      ? new Map<string, { workOrderCount: number; minutesTotal: number }>()
      : new Map<string, { workOrderCount: number; minutesTotal: number }>();

    for (const [woKey, v] of lostMap.entries()) {
      lostTimeMinutesTotal += v.minutesTotal;
      const hasLost = v.minutesTotal > 0;
      if (hasLost) {
        withLostTime += 1;
        withoutLostTime -= 1;
      }
      if (collectLostTimeReasons) {
        for (const reason of v.reasonsSet.values()) {
          const cur = reasonAgg.get(reason) || { workOrderCount: 0, minutesTotal: 0 };
          cur.workOrderCount += 1;
          cur.minutesTotal += v.minutesTotal;
          reasonAgg.set(reason, cur);
        }
      }
    }

    let topReasons: CentralReasonMetrics[] = [];
    if (collectLostTimeReasons) {
      const reasonsArr = Array.from(reasonAgg.entries()).map(([reason, v]) => ({
        reason,
        workOrderCount: v.workOrderCount,
        minutesTotal: v.minutesTotal
      }));
      reasonsArr.sort(
        (a, b) => b.workOrderCount - a.workOrderCount || b.minutesTotal - a.minutesTotal
      );
      topReasons = reasonsArr.slice(0, 5);
    }

    out.set(shiftCode, {
      workOrdersReported,
      worksReported,
      workOrdersReportedWithoutLostTime: Math.max(0, withoutLostTime),
      workOrdersReportedWithLostTime: withLostTime,
      lostTimeMinutesTotal,
      lostTimeReasonsTop: topReasons
    });
  }

  return out;
}

async function buildShiftMetricsForStage(
  stageCode: string,
  dateStr: string,
  stageShiftsForStage: StageShiftPair[],
  collectLostTimeReasons: boolean
): Promise<CentralShiftMetrics[]> {
  const shiftsToKeep = new Set(stageShiftsForStage.map(p => String(p.shiftCode)));

  // Manpower: do stage-wide fetch once, then split by shift_code.
  const plannedEmployees = await fetchProductionEmployees(stageCode, dateStr, 'planning');
  const reportedEmployees = await fetchProductionEmployees(stageCode, dateStr, 'reporting');

  const plannedEmployeesByShift = new Map<string, any[]>();
  const reportedEmployeesByShift = new Map<string, any[]>();

  for (const emp of plannedEmployees || []) {
    const shiftCode = (emp as any).shift_code ? String((emp as any).shift_code) : '';
    if (!shiftCode || !shiftsToKeep.has(shiftCode)) continue;
    if (!plannedEmployeesByShift.has(shiftCode)) plannedEmployeesByShift.set(shiftCode, []);
    plannedEmployeesByShift.get(shiftCode)!.push(emp as any);
  }

  for (const emp of reportedEmployees || []) {
    const shiftCode = (emp as any).shift_code ? String((emp as any).shift_code) : '';
    if (!shiftCode || !shiftsToKeep.has(shiftCode)) continue;
    if (!reportedEmployeesByShift.has(shiftCode)) reportedEmployeesByShift.set(shiftCode, []);
    reportedEmployeesByShift.get(shiftCode)!.push(emp as any);
  }

  // Work planning (stage-wide)
  const plannedWorksRows = await fetchPlannedWorksByStage(stageCode, dateStr);
  const plannedWorkerIds = Array.from(new Set((plannedWorksRows || []).map((r: any) => r.worker_id).filter(Boolean))).map(String);
  const plannedWorkerShiftMap = await fetchWorkerShiftMap(plannedWorkerIds);
  const plannedMetricsByShift = buildPlannedMetricsByShift(plannedWorksRows, plannedWorkerShiftMap, shiftsToKeep);

  // Work reporting (stage-wide)
  const reportedWorksRows = await fetchReportedWorksByStage(stageCode, dateStr, collectLostTimeReasons);
  const reportedWorkerIds = Array.from(new Set((reportedWorksRows || []).map((r: any) => r.worker_id).filter(Boolean))).map(String);
  const reportedWorkerShiftMap = await fetchWorkerShiftMap(reportedWorkerIds);
  const reportedMetricsByShift = buildReportedMetricsByShift(
    reportedWorksRows,
    reportedWorkerShiftMap,
    shiftsToKeep,
    collectLostTimeReasons
  );

  // Build final shift metrics for shifts configured for that stage.
  const out: CentralShiftMetrics[] = [];

  for (const shiftCode of shiftsToKeep.values()) {
    const plantCode = derivePlantFromStage(stageCode);

    const plannedShiftEmps = plannedEmployeesByShift.get(shiftCode) || [];
    const reportedShiftEmps = reportedEmployeesByShift.get(shiftCode) || [];

    const manpowerTotal = plannedShiftEmps.length;
    const manpowerPlannedAttendance = plannedShiftEmps.filter(e => (e as any).planned_hours !== undefined).length;
    const manpowerReportedAttendance = reportedShiftEmps.filter(e => (e as any).actual_hours !== undefined).length;

    const plannedWorks = plannedMetricsByShift.get(shiftCode) || { workOrdersPlanned: 0, worksPlanned: 0 };
    const reportedWorks = reportedMetricsByShift.get(shiftCode) || {
      workOrdersReported: 0,
      worksReported: 0,
      workOrdersReportedWithoutLostTime: 0,
      workOrdersReportedWithLostTime: 0,
      lostTimeMinutesTotal: 0,
      lostTimeReasonsTop: []
    };

    out.push({
      stageCode,
      shiftCode,
      plantCode,
      manpowerTotal,
      manpowerPlannedAttendance,
      manpowerReportedAttendance,
      workOrdersPlanned: plannedWorks.workOrdersPlanned,
      worksPlanned: plannedWorks.worksPlanned,
      workOrdersReported: reportedWorks.workOrdersReported,
      worksReported: reportedWorks.worksReported,
      workOrdersReportedWithoutLostTime: reportedWorks.workOrdersReportedWithoutLostTime,
      workOrdersReportedWithLostTime: reportedWorks.workOrdersReportedWithLostTime,
      lostTimeMinutesTotal: reportedWorks.lostTimeMinutesTotal,
      lostTimeReasonsTop: reportedWorks.lostTimeReasonsTop
    });
  }

  return out;
}

export async function fetchCentralProductionDashboardMetrics(selectedDate: string): Promise<CentralProductionDashboardMetrics> {
  const dateStr = (selectedDate || '').split('T')[0];

  // Configuration for what appears in the dashboard.
  const stageShifts = await fetchConfiguredStageShifts();
  const stageCodes = Array.from(new Set(stageShifts.map(p => p.stageCode)));

  // Build shift metrics stage-by-stage.
  const shiftMetricsByStage = new Map<string, CentralShiftMetrics[]>();

  for (const stageCode of stageCodes) {
    const stageShiftsForStage = stageShifts.filter(p => p.stageCode === stageCode);
    const shiftMetrics = await buildShiftMetricsForStage(stageCode, dateStr, stageShiftsForStage, false);
    shiftMetricsByStage.set(stageCode, shiftMetrics);
  }

  // Build tree: Plant -> Stage -> Shift
  const plantMap = new Map<string, CentralPlantNode>();
  const productionTotals = emptyLevelMetrics();

  for (const stageCode of stageCodes) {
    const plantCode = derivePlantFromStage(stageCode);
    const shiftMetrics = shiftMetricsByStage.get(stageCode) || [];

    let stageTotals = emptyLevelMetrics();
    stageTotals.lostTimeReasonsTop = [];

    for (const sh of shiftMetrics) stageTotals = addLevelMetrics(stageTotals, sh);
    // Reasons are loaded on-demand for the selected shift to keep the dashboard fast.
    stageTotals.lostTimeReasonsTop = [];

    const stageNode: CentralStageNode = {
      stageCode,
      plantCode,
      totals: stageTotals,
      shifts: shiftMetrics
    };

    if (!plantMap.has(plantCode)) {
      plantMap.set(plantCode, {
        plantCode,
        totals: emptyLevelMetrics(),
        stages: []
      });
    }
    plantMap.get(plantCode)!.stages.push(stageNode);

    // Aggregate production totals
    // Note: lostTimeReasonsTop aggregated later from all shifts.
    productionTotals.manpowerTotal += stageTotals.manpowerTotal;
    productionTotals.manpowerPlannedAttendance += stageTotals.manpowerPlannedAttendance;
    productionTotals.manpowerReportedAttendance += stageTotals.manpowerReportedAttendance;
    productionTotals.workOrdersPlanned += stageTotals.workOrdersPlanned;
    productionTotals.worksPlanned += stageTotals.worksPlanned;
    productionTotals.workOrdersReported += stageTotals.workOrdersReported;
    productionTotals.worksReported += stageTotals.worksReported;
    productionTotals.workOrdersReportedWithoutLostTime += stageTotals.workOrdersReportedWithoutLostTime;
    productionTotals.workOrdersReportedWithLostTime += stageTotals.workOrdersReportedWithLostTime;
    productionTotals.lostTimeMinutesTotal += stageTotals.lostTimeMinutesTotal;
  }

  // Finalize plant totals from stage totals and compute reason tops from all shift nodes.
  for (const plantNode of plantMap.values()) {
    let plantTotals = emptyLevelMetrics();
    const allShifts: CentralShiftMetrics[] = [];
    for (const st of plantNode.stages) {
      plantTotals = addLevelMetrics(plantTotals, st.totals);
      allShifts.push(...st.shifts);
    }
    plantTotals.lostTimeReasonsTop = [];
    plantNode.totals = plantTotals;
  }

  // Compute production top reasons from all shift nodes.
  const allShifts: CentralShiftMetrics[] = [];
  for (const stageCode of stageCodes) {
    allShifts.push(...(shiftMetricsByStage.get(stageCode) || []));
  }
  productionTotals.lostTimeReasonsTop = [];

  // Sort: plants by code, stages by code, shifts by shiftCode
  const plants = Array.from(plantMap.values()).sort((a, b) => a.plantCode.localeCompare(b.plantCode));
  for (const plant of plants) {
    plant.stages.sort((a, b) => a.stageCode.localeCompare(b.stageCode));
    for (const st of plant.stages) st.shifts.sort((a, b) => a.shiftCode.localeCompare(b.shiftCode));
  }

  return {
    selectedDate: dateStr,
    totals: productionTotals,
    plants
  };
}

export async function fetchLostTimeReasonsForStageShift(
  stageCode: string,
  shiftCode: string,
  selectedDate: string,
  limit = 5
): Promise<CentralReasonMetrics[]> {
  const dateStr = (selectedDate || '').split('T')[0];

  // Fetch reported rows with LT details for this stage/date only.
  const reportedWorksRows = await fetchReportedWorksByStage(stageCode, dateStr, true);

  const reportedWorkerIds = Array.from(
    new Set((reportedWorksRows || []).map((r: any) => r.worker_id).filter(Boolean))
  ).map(String);

  const reportedWorkerShiftMap = await fetchWorkerShiftMap(reportedWorkerIds);

  const shiftsToKeep = new Set<string>([shiftCode]);
  const metricsByShift = buildReportedMetricsByShift(
    reportedWorksRows,
    reportedWorkerShiftMap,
    shiftsToKeep,
    true
  );

  // Find the shift object and return top reasons.
  const shiftMetrics = (metricsByShift as unknown as Map<string, any>).get(shiftCode);
  const reasons = (shiftMetrics?.lostTimeReasonsTop || []) as CentralReasonMetrics[];
  return reasons.slice(0, limit);
}

