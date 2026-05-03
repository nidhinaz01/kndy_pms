import { formatTime } from './timeUtils';

export function formatDateDdMmYy(value: string | null | undefined): string {
  if (!value) return 'N/A';
  const datePart = String(value).split('T')[0];
  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year.slice(-2)}`;
}

export function formatTimeWithoutSeconds(value: string | null | undefined): string {
  if (!value) return 'N/A';
  const timePart = String(value).split('T').pop() || '';
  const parts = timePart.split(':');
  if (parts.length < 2) return value;
  return `${parts[0]}:${parts[1]}`;
}

/** `std_work_skill_mapping` from Supabase may be object or single-element array */
export function stdMappingScNameFromPlanning(planning: any): string | null {
  const mapping = planning?.std_work_skill_mapping;
  if (!mapping) return null;
  const row = Array.isArray(mapping) ? mapping[0] : mapping;
  const name = row?.sc_name;
  if (name == null || String(name).trim() === '') return null;
  return String(name).trim();
}

/**
 * Grouped row for Plan/Draft Plan parity: standard → first planning row with `wsm_id` uses mapping `sc_name`;
 * non-standard → `workAdditionData.other_work_sc` on enriched report rows.
 */
export function getGroupedSkillsRequiredForReports(group: { items?: any[] }): string {
  const items = group.items || [];
  if (items.length === 0) return 'N/A';
  const isNonStandard = items.some((r) => Boolean(r?.prdn_work_planning?.other_work_code));
  if (isNonStandard) {
    for (const r of items) {
      const sc = r?.workAdditionData?.other_work_sc;
      if (sc != null && String(sc).trim() !== '') return String(sc).trim();
    }
    return 'N/A';
  }
  for (const r of items) {
    const p = r?.prdn_work_planning;
    if (!p || p.wsm_id == null || p.wsm_id === '') continue;
    const name = stdMappingScNameFromPlanning(p);
    if (name) return name;
  }
  return 'N/A';
}

/** Skill slot for one report row (planning competency). */
export function planningScRequiredForReportRow(report: any): string {
  const p = report?.prdn_work_planning;
  const sc = p?.sc_required;
  if (sc != null && String(sc).trim() !== '') return String(sc).trim();
  const fallback = report?.reporting_hr_emp?.skill_short;
  if (fallback != null && String(fallback).trim() !== '') return String(fallback).trim();
  return 'N/A';
}

/** HoursWorked block: remaining minutes — show 0h for zero; N/A only when missing. */
export function formatRemainingTimeMinutesDisplay(remainingMinutes: number | null | undefined): string {
  if (remainingMinutes === null || remainingMinutes === undefined) return 'N/A';
  return formatTime((Number(remainingMinutes) || 0) / 60);
}

/**
 * Standard duration (decimal hours) for one report row: `prdn_work_planning.std_time_hours`,
 * then enriched VWF minutes, then skill standard (same priority as Plan / Draft Plan).
 */
export function reportRowStandardTimeHours(report: any): number | null {
  if (!report) return null;
  const p = report.prdn_work_planning;
  const raw = p?.std_time_hours;
  if (raw != null && raw !== '' && Number.isFinite(Number(raw))) {
    return Number(raw);
  }
  const vwf = report?.vehicleWorkFlow?.estimated_duration_minutes;
  if (typeof vwf === 'number' && Number.isFinite(vwf) && vwf > 0) {
    return vwf / 60;
  }
  const skill = report?.skillTimeStandard?.standard_time_minutes;
  if (typeof skill === 'number' && Number.isFinite(skill) && skill > 0) {
    return skill / 60;
  }
  return null;
}

/** One grouped-work cell: standard time from first report row (same group shares work). */
export function formatReportGroupStandardTimeCell(firstReport: any): string {
  const h = reportRowStandardTimeHours(firstReport);
  return h != null && Number.isFinite(h) ? formatTime(h) : 'N/A';
}

export function reportGroupMaxHoursWorkedTillDate(group: { items?: any[] }): number {
  const items = group.items || [];
  const vals = items.map((r: any) => Number(r?.hours_worked_till_date) || 0);
  return vals.length ? Math.max(...vals) : 0;
}

export function reportGroupMaxHoursWorkedToday(group: { items?: any[] }): number {
  const items = group.items || [];
  const vals = items.map((r: any) => Number(r?.hours_worked_today) || 0);
  return vals.length ? Math.max(...vals) : 0;
}

export function reportGroupMaxTotalHoursWorkedTillPlusToday(group: { items?: any[] }): number {
  const items = group.items || [];
  const vals = items.map(
    (r: any) => (Number(r?.hours_worked_till_date) || 0) + (Number(r?.hours_worked_today) || 0)
  );
  return vals.length ? Math.max(...vals) : 0;
}

/**
 * Per grouped work: `std_time` (first row) − max(`hours_worked_till_date`) across rows.
 * `null` when standard hours cannot be resolved (show N/A).
 */
export function reportGroupRemainingHoursStdMinusMaxTill(group: { items?: any[] }): number | null {
  const items = group.items || [];
  if (items.length === 0) return null;
  const stdH = reportRowStandardTimeHours(items[0]);
  if (stdH == null || !Number.isFinite(stdH)) return null;
  const maxTill = reportGroupMaxHoursWorkedTillDate(group);
  return Math.max(0, stdH - maxTill);
}

export function formatReportGroupRemainingDisplay(group: { items?: any[] }): string {
  const rem = reportGroupRemainingHoursStdMinusMaxTill(group);
  return rem == null ? 'N/A' : formatTime(rem);
}
