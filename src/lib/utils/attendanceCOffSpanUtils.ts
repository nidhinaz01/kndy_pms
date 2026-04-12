/**
 * Ensure C-Off from/to wall-clock window lies fully inside attendance from/to window.
 * Net attendance hours (excluding breaks) must be exactly 4, 8, or 12 for any C-Off.
 */

/** Net attendance hours (break-excluded) — only these values may coexist with C-Off. */
export const ALLOWED_NET_ATTENDANCE_HOURS_FOR_COFF = [4, 8, 12] as const;

const NET_HOURS_EPS = 0.08;

export function isNetAttendanceHoursEligibleForCoff(netHours: number | null | undefined): boolean {
  if (netHours == null || !Number.isFinite(netHours)) return false;
  return ALLOWED_NET_ATTENDANCE_HOURS_FOR_COFF.some(h => Math.abs(netHours - h) <= NET_HOURS_EPS);
}

export function validateNetHoursForCoffAllow(
  netHours: number | null | undefined
): { ok: true } | { ok: false; message: string } {
  if (!isNetAttendanceHoursEligibleForCoff(netHours)) {
    const display =
      netHours == null || !Number.isFinite(netHours) ? '—' : `${Number(netHours).toFixed(2)}h`;
    return {
      ok: false,
      message: `C-Off is only allowed when attendance (excluding breaks) is exactly 4, 8, or 12 hours. Current: ${display}.`
    };
  }
  return { ok: true };
}

export type AttendanceCOffSpanInput = {
  attendanceFromDate: string;
  attendanceToDate: string;
  attendanceFromTime: string;
  attendanceToTime: string;
  cOffFromDate: string;
  cOffFromTime: string;
  cOffToDate: string;
  cOffToTime: string;
};

function normalizeDate(d: string | null | undefined): string {
  return (d || '').split('T')[0].trim();
}

function normalizeTime(t: string | null | undefined): string {
  if (t == null || t === '') return '';
  return String(t).trim().substring(0, 5);
}

export function parseWallDateTimeMs(dateStr: string, timeStr: string): number | null {
  const d = normalizeDate(dateStr);
  const t = normalizeTime(timeStr);
  if (!d || !t) return null;
  const hm = t.length === 5 ? `${t}:00` : t;
  const ms = new Date(`${d}T${hm}`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Attendance wall window [startMs, endMs] from explicit dates + times.
 * If from/to dates are the same and end clock is not after start clock, end is treated as next calendar day (overnight).
 */
export function getAttendanceWallWindowMs(input: {
  attendanceFromDate: string;
  attendanceToDate: string;
  attendanceFromTime: string;
  attendanceToTime: string;
}): { startMs: number; endMs: number } | null {
  const fromD = normalizeDate(input.attendanceFromDate);
  const toD = normalizeDate(input.attendanceToDate) || fromD;
  const fromT = normalizeTime(input.attendanceFromTime);
  const toT = normalizeTime(input.attendanceToTime);
  if (!fromD || !fromT || !toT) return null;

  const startMs = parseWallDateTimeMs(fromD, fromT);
  if (startMs == null) return null;

  let endMs = parseWallDateTimeMs(toD, toT);
  if (endMs == null) return null;

  if (endMs <= startMs && fromD === toD) {
    const base = new Date(`${fromD}T00:00:00`);
    base.setDate(base.getDate() + 1);
    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, '0');
    const day = String(base.getDate()).padStart(2, '0');
    endMs = parseWallDateTimeMs(`${y}-${m}-${day}`, toT);
    if (endMs == null) return null;
  }

  if (endMs < startMs) return null;
  return { startMs, endMs };
}

function getCOffWallWindowMs(input: AttendanceCOffSpanInput): { startMs: number; endMs: number } | null {
  const cfD = normalizeDate(input.cOffFromDate);
  const ctD = normalizeDate(input.cOffToDate) || cfD;
  const cfT = normalizeTime(input.cOffFromTime);
  const ctT = normalizeTime(input.cOffToTime);
  if (!cfD || !ctD || !cfT || !ctT) return null;

  let startMs = parseWallDateTimeMs(cfD, cfT);
  let endMs = parseWallDateTimeMs(ctD, ctT);
  if (startMs == null || endMs == null) return null;

  if (endMs <= startMs && cfD === ctD) {
    const base = new Date(`${cfD}T00:00:00`);
    base.setDate(base.getDate() + 1);
    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, '0');
    const day = String(base.getDate()).padStart(2, '0');
    endMs = parseWallDateTimeMs(`${y}-${m}-${day}`, ctT);
    if (endMs == null) return null;
  }

  if (endMs < startMs) return null;
  return { startMs, endMs };
}

/**
 * When C-Off value > 0, C-Off window must be fully inside attendance window (inclusive).
 * When value is 0, returns ok.
 */
export function validateCOffWithinAttendanceWindow(
  cOffValue: number,
  input: AttendanceCOffSpanInput
): { ok: true } | { ok: false; message: string } {
  if (!Number.isFinite(cOffValue) || cOffValue <= 0) {
    return { ok: true };
  }

  const att = getAttendanceWallWindowMs({
    attendanceFromDate: input.attendanceFromDate,
    attendanceToDate: input.attendanceToDate,
    attendanceFromTime: input.attendanceFromTime,
    attendanceToTime: input.attendanceToTime
  });
  if (!att) {
    return {
      ok: false,
      message:
        'Set valid attendance from/to date and time before saving C-Off. C-Off must lie entirely within that attendance span.'
    };
  }

  const coff = getCOffWallWindowMs(input);
  if (!coff) {
    return {
      ok: false,
      message:
        'C-Off: enter valid From and To date/time. The C-Off period must lie entirely within attendance from/to date and time.'
    };
  }

  if (coff.startMs < att.startMs || coff.endMs > att.endMs) {
    return {
      ok: false,
      message:
        'C-Off must fall entirely within attendance from/to date and time. Extend attendance (e.g. shift end) so it covers the full C-Off window, or move C-Off times inside attendance.'
    };
  }

  return { ok: true };
}
