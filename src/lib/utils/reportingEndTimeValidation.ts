/**
 * Reporting-only: when the reporting end date is **today** (local calendar),
 * the end datetime must not be after "now". Planning / draft plans do not use this.
 */

function getLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeDateInput(dateRaw: string | undefined): string {
  if (!dateRaw || typeof dateRaw !== 'string') return '';
  return dateRaw.split('T')[0].trim();
}

/**
 * Parse local end instant from YYYY-MM-DD + HH:MM[:SS].
 */
function parseLocalEndDateTime(dateYYYYMMDD: string, timeHHMM: string): Date | null {
  const dp = dateYYYYMMDD.split('-').map((x) => Number(x));
  if (dp.length !== 3 || dp.some((n) => Number.isNaN(n))) return null;
  const parts = timeHHMM.trim().split(':').map((x) => Number(x));
  const hh = parts[0] ?? 0;
  const mm = parts[1] ?? 0;
  const ss = parts[2] ?? 0;
  if ([hh, mm, ss].some((n) => Number.isNaN(n))) return null;
  return new Date(dp[0], dp[1] - 1, dp[2], hh, mm, ss, 0);
}

/**
 * @returns Error message if invalid; `null` if OK or rule does not apply (not today / missing parts).
 */
export function reportingEndMustNotBeAfterNow(
  toDateRaw: string | undefined,
  toTimeRaw: string | undefined
): string | null {
  const toDate = normalizeDateInput(toDateRaw);
  const toTime = (toTimeRaw && String(toTimeRaw).trim()) || '';
  if (!toDate || !toTime) return null;

  const todayLocal = getLocalDateString(new Date());
  if (toDate !== todayLocal) return null;

  const end = parseLocalEndDateTime(toDate, toTime);
  if (!end || Number.isNaN(end.getTime())) return null;

  const now = new Date();
  if (end.getTime() > now.getTime()) {
    return 'End time cannot be after the current time when reporting for today.';
  }

  return null;
}
