/**
 * Standard time minutes aligned with Plan tab (PlanTab column + PlanWork WorkDetailsDisplay):
 * 1) vehicleWorkFlow / std_vehicle_work_flow / vehicle_work_flow — estimated_duration_minutes (std_vehicle_work_flow)
 * 2) Enriched skill_time_standards (batch enrichment)
 * 3) skill_time_standard / skillTimeStandard (per planning row)
 *
 * Returns null when none apply — callers may fall back to derivative-work aggregation (RPC).
 */
export function getEmbeddedStandardTimeMinutes(work: any): number | null {
  const est =
    work?.vehicleWorkFlow?.estimated_duration_minutes ??
    work?.std_vehicle_work_flow?.estimated_duration_minutes ??
    work?.vehicle_work_flow?.estimated_duration_minutes;

  if (typeof est === 'number' && est > 0) {
    return est;
  }

  const sts = work?.skill_time_standards;
  if (sts?.values?.length) {
    const minutes = sts.values.map((v: any) => Number(v.standard_time_minutes) || 0);
    return sts.isUniform ? minutes[0] : Math.max(...minutes);
  }

  const single =
    work?.skill_time_standard?.standard_time_minutes ??
    work?.skillTimeStandard?.standard_time_minutes;
  if (typeof single === 'number') {
    return single;
  }

  return null;
}

/**
 * Standard hours from vehicle workflow only (`estimated_duration_minutes` / 60), rounded to 2 decimals.
 * Does not use skill time standards. Returns null when VWF minutes are missing or invalid.
 */
export function getVehicleWorkFlowStandardTimeHours(work: any): number | null {
  const est =
    work?.vehicleWorkFlow?.estimated_duration_minutes ??
    work?.std_vehicle_work_flow?.estimated_duration_minutes ??
    work?.vehicle_work_flow?.estimated_duration_minutes;
  if (typeof est !== 'number' || !Number.isFinite(est) || est < 0) {
    return null;
  }
  return Math.round((est / 60) * 100) / 100;
}
