import { fetchHolidaysByYear } from '$lib/api/holidays';
import { cOffNetWorkHours } from '$lib/utils/cOffWindowUtils';
import type { ManpowerCOffSave, ManpowerOTSave } from '$lib/api/production/productionTypes';

export const HOLIDAY_ATTENDANCE_EPS = 0.06;

/** True when `dateStr` (YYYY-MM-DD) matches an active holiday row for that year (`plan_holidays.dt_value`). */
export async function isDatePlanHoliday(dateInput: string): Promise<boolean> {
  const dayStr = String(dateInput || '').split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayStr)) return false;
  const y = parseInt(dayStr.slice(0, 4), 10);
  if (!Number.isFinite(y)) return false;
  try {
    const holidays = await fetchHolidaysByYear(y);
    return holidays.some((h) => h.dt_value === dayStr);
  } catch {
    return false;
  }
}

export type HolidayOtCoffBand = 'under4' | '4to8' | '8to12' | '12plus';

/** Radio choice for holiday OT / C‑Off split (single & bulk modals). */
export type HolidaySplitChoice = 'all_ot' | 'coff_half' | 'coff_full' | 'coff_onehalf';

export function holidayEffectiveBand(effectiveHours: number): HolidayOtCoffBand {
  if (effectiveHours < 4) return 'under4';
  if (effectiveHours < 8) return '4to8';
  if (effectiveHours < 12) return '8to12';
  return '12plus';
}

/**
 * Validates C‑Off / OT for a holiday: effective net hours must equal C‑Off net hours + OT hours,
 * and the C‑Off tier must be allowed for the effective-time band.
 */
export function validateHolidayManpowerOtCoff(
  effectiveHours: number | null | undefined,
  cOff?: ManpowerCOffSave | null,
  otSave?: ManpowerOTSave | null
): { ok: true } | { ok: false; message: string } {
  if (effectiveHours == null || !Number.isFinite(effectiveHours) || effectiveHours <= 0) {
    return { ok: false, message: 'Effective time must be greater than zero on holidays.' };
  }

  const E = effectiveHours;
  const rawCv = cOff?.cOffValue != null ? Number(cOff.cOffValue) : 0;
  const cv = [0, 0.5, 1, 1.5].includes(rawCv) ? rawCv : 0;
  const coff = cOffNetWorkHours(cv);
  const otH =
    otSave?.otHours != null && Number.isFinite(Number(otSave.otHours))
      ? Math.max(0, Number(otSave.otHours))
      : 0;

  if (Math.abs(E - coff - otH) > HOLIDAY_ATTENDANCE_EPS) {
    return {
      ok: false,
      message: `Holiday attendance: effective time is ${E.toFixed(2)} h; C‑Off (${coff} h) + OT (${otH.toFixed(2)} h) must equal ${E.toFixed(2)} h.`
    };
  }

  const band = holidayEffectiveBand(E);

  if (band === 'under4') {
    if (coff > HOLIDAY_ATTENDANCE_EPS) {
      return { ok: false, message: 'For less than 4 hours effective time on a holiday, enter overtime only (no C‑Off).' };
    }
    return { ok: true };
  }

  if (band === '4to8') {
    if (coff > HOLIDAY_ATTENDANCE_EPS && Math.abs(cv - 0.5) > 0.01) {
      return { ok: false, message: 'For 4–8 hours effective on a holiday, C‑Off may only be 0 or 0.5 day (4 h).' };
    }
    return { ok: true };
  }

  if (band === '8to12') {
    if (coff > HOLIDAY_ATTENDANCE_EPS && Math.abs(cv - 1) > 0.01) {
      return { ok: false, message: 'For 8–12 hours effective on a holiday, C‑Off may only be 0 or 1 day (8 h).' };
    }
    return { ok: true };
  }

  // 12+ hours effective
  if (coff > HOLIDAY_ATTENDANCE_EPS && Math.abs(cv - 1.5) > 0.01) {
    return {
      ok: false,
      message: 'For 12 or more hours effective on a holiday, C‑Off may only be 0 or 1.5 days (12 h).'
    };
  }
  return { ok: true };
}
