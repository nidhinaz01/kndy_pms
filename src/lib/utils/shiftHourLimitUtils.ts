import { supabase } from '$lib/supabaseClient';
import { cOffNetWorkHours } from '$lib/utils/cOffWindowUtils';

const SHIFT_HOUR_LIMIT_DE_NAME = 'Shift Hour Limit';

/** Tolerance for C‑Off/OT balance vs net hours − shift hour limit (must match server-side expectations). */
export const MANPOWER_COFF_OT_BALANCE_EPS = 0.06;

/** Notes required when actual (net) hours are below nominal full shift (UI + API reporting). */
export const MANPOWER_REPORT_NOTES_FULL_SHIFT_EPS = 0.01;

/**
 * Standard workday cap (hours) from sys_data_elements — used with net attendance (after breaks)
 * so that (net − limit) = C‑Off net hours + OT hours.
 */
export async function getShiftHourLimitHours(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('sys_data_elements')
      .select('de_value')
      .eq('de_name', SHIFT_HOUR_LIMIT_DE_NAME)
      .maybeSingle();

    if (error || data?.de_value == null || data.de_value === '') {
      return 8;
    }
    const n = parseFloat(String(data.de_value).trim());
    return Number.isFinite(n) && n > 0 ? n : 8;
  } catch {
    return 8;
  }
}

/**
 * Net attendance hours D (after breaks), shift hour limit L from DB, discrete C‑Off hours from c_off_value,
 * and entered OT hours must satisfy: D − L = c_off_hours + ot_hours (when D > L).
 * When D ≤ L, C‑Off and OT must both be zero.
 */
export function validateManpowerOtCoffBalance(
  netHours: number | null | undefined,
  shiftHourLimit: number,
  cOffValue: number,
  otHours: number | null | undefined
): { ok: true } | { ok: false; message: string } {
  if (netHours == null || !Number.isFinite(netHours)) {
    return { ok: false, message: 'Net attendance hours are missing or invalid.' };
  }
  if (!Number.isFinite(shiftHourLimit) || shiftHourLimit <= 0) {
    return { ok: false, message: 'Shift hour limit is invalid.' };
  }

  const ot = otHours != null && Number.isFinite(otHours) ? Math.max(0, Number(otHours)) : 0;
  const rawC = cOffValue != null && Number.isFinite(Number(cOffValue)) ? Number(cOffValue) : 0;
  const allowedC = [0, 0.5, 1, 1.5];
  const cVal = allowedC.includes(rawC) ? rawC : 0;
  const coff = cOffNetWorkHours(cVal);

  const excess = netHours - shiftHourLimit;

  if (excess <= MANPOWER_COFF_OT_BALANCE_EPS) {
    if (coff > MANPOWER_COFF_OT_BALANCE_EPS || ot > MANPOWER_COFF_OT_BALANCE_EPS) {
      return {
        ok: false,
        message:
          'C‑Off and OT apply only when net attendance (after breaks) is greater than the shift hour limit.'
      };
    }
    return { ok: true };
  }

  if (coff > excess + MANPOWER_COFF_OT_BALANCE_EPS) {
    return {
      ok: false,
      message: `C‑Off is ${coff} h but excess above the shift hour limit is only ${excess.toFixed(2)} h. Reduce C‑Off or extend attendance.`
    };
  }

  if (Math.abs(excess - coff - ot) > MANPOWER_COFF_OT_BALANCE_EPS) {
    return {
      ok: false,
      message: `Net attendance after breaks is ${netHours.toFixed(2)} h. Limit is ${shiftHourLimit.toFixed(2)} h, so excess is ${excess.toFixed(2)} h. C‑Off (${coff} h) + OT (${ot.toFixed(2)} h) must equal ${excess.toFixed(2)} h.`
    };
  }

  return { ok: true };
}
