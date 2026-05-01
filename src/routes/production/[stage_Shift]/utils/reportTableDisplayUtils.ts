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
