/**
 * Shared validation for report date ranges (from / to).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Inclusive max span: 3 calendar months from fromDate (approximated as 93 days). */
const MAX_RANGE_DAYS = 93;

export function firstDayOfMonthIso(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export function todayIsoLocal(d: Date = new Date()): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function parseIsoDate(s: string): Date | null {
  const part = s.split('T')[0];
  const [y, m, d] = part.split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

export interface DateRangeValidation {
  ok: boolean;
  error?: string;
  fromDate?: string;
  toDate?: string;
}

/**
 * Validates from/to for reports:
 * - both parseable
 * - from <= to
 * - to <= today (local)
 * - span <= MAX_RANGE_DAYS (inclusive)
 */
export function validateReportDateRange(fromDate: string, toDate: string): DateRangeValidation {
  const from = fromDate?.split('T')[0]?.trim();
  const to = toDate?.split('T')[0]?.trim();
  if (!from || !to) {
    return { ok: false, error: 'From date and to date are required.' };
  }
  const dFrom = parseIsoDate(from);
  const dTo = parseIsoDate(to);
  if (!dFrom || !dTo) {
    return { ok: false, error: 'Invalid date format. Use a valid calendar date.' };
  }
  if (dFrom > dTo) {
    return { ok: false, error: 'From date must be on or before to date.' };
  }
  const today = parseIsoDate(todayIsoLocal())!;
  if (dTo > today) {
    return { ok: false, error: 'To date cannot be after today.' };
  }
  const days = Math.floor((dTo.getTime() - dFrom.getTime()) / MS_PER_DAY) + 1;
  if (days > MAX_RANGE_DAYS) {
    return {
      ok: false,
      error: `Date range cannot exceed ${MAX_RANGE_DAYS} days (about three months). Narrow the range and try again.`
    };
  }
  return { ok: true, fromDate: from, toDate: to };
}

/** Range [from, to] overlaps [aStart, aEnd] inclusive (ISO yyyy-mm-dd strings). */
export function isoRangesOverlap(from: string, to: string, aStart: string, aEnd: string): boolean {
  return aStart <= to && aEnd >= from;
}

/** Every calendar ISO date from `fromIso` through `toIso` inclusive (yyyy-mm-dd). Empty if invalid or from > to. */
export function eachIsoDateInclusive(fromIso: string, toIso: string): string[] {
  const from = fromIso.split('T')[0];
  const to = toIso.split('T')[0];
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  if (!fy || !fm || !fd || !ty || !tm || !td) return [];
  const d0 = new Date(fy, fm - 1, fd);
  const d1 = new Date(ty, tm - 1, td);
  if (d0 > d1) return [];
  const out: string[] = [];
  for (let t = d0.getTime(); t <= d1.getTime(); t += MS_PER_DAY) {
    const d = new Date(t);
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    );
  }
  return out;
}

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

/** Display dates as 01-Apr-2026 (dd-MMM-yyyy). Empty string if missing/invalid. */
export function formatDdMmmYyyy(isoDate: string | null | undefined): string {
  if (isoDate == null || isoDate === '') return '';
  const s = isoDate.split('T')[0];
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return s;
  const mon = MONTH_SHORT[m - 1] ?? String(m);
  return `${String(d).padStart(2, '0')}-${mon}-${y}`;
}
