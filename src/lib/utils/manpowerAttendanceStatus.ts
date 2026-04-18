/**
 * Manpower Plan / Report attendance codes (prdn_*_manpower.attendance_status).
 * Legacy DB value `absent` is treated as absent_informed until migration runs.
 */

export type ManpowerAttendanceStatus =
  | 'present'
  | 'absent_informed'
  | 'absent_uninformed';

export function normalizeManpowerAttendanceStatus(
  raw: string | null | undefined
): ManpowerAttendanceStatus | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim().toLowerCase();
  if (s === 'present') return 'present';
  if (s === 'absent_uninformed') return 'absent_uninformed';
  if (s === 'absent_informed' || s === 'absent') return 'absent_informed';
  return null;
}

export function attendanceIsPresent(status: string | null | undefined): boolean {
  return normalizeManpowerAttendanceStatus(status) === 'present';
}

/** Informed or uninformed absence (including legacy `absent`). */
export function attendanceIsAbsent(status: string | null | undefined): boolean {
  const n = normalizeManpowerAttendanceStatus(status);
  return n === 'absent_informed' || n === 'absent_uninformed';
}

export function attendanceIsAbsentUninformed(status: string | null | undefined): boolean {
  return normalizeManpowerAttendanceStatus(status) === 'absent_uninformed';
}

/** Same behaviour as former `status === 'absent'` for clearing hours / C-off / OT. */
export function attendanceClearsPlanReportFields(status: string | null | undefined): boolean {
  return !attendanceIsPresent(status);
}

/** Review / PDF compact letter codes */
export function formatManpowerAttendanceShort(status: string | null | undefined): string {
  const n = normalizeManpowerAttendanceStatus(status);
  if (n === 'present') return 'P';
  if (n === 'absent_informed') return 'A(I)';
  if (n === 'absent_uninformed') return 'A(U)';
  return '—';
}

/** Excel / readable labels */
export function formatManpowerAttendanceLong(status: string | null | undefined): string {
  const n = normalizeManpowerAttendanceStatus(status);
  if (n === 'present') return 'Present';
  if (n === 'absent_informed') return 'Absent (Informed)';
  if (n === 'absent_uninformed') return 'Absent (Uninformed)';
  return status ? String(status) : '';
}
