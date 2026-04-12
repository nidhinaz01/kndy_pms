import { calculateBreakTimeInMinutes } from '$lib/utils/breakTimeUtils';

/** Net work hours represented by C-Off value (same as UI: 0.5→4h, 1→8h, 1.5→12h). */
export function cOffNetWorkHours(offValue: number): number {
  if (offValue === 0.5) return 4;
  if (offValue === 1) return 8;
  if (offValue === 1.5) return 12;
  return 0;
}

/**
 * Calendar end of C-Off window: net work minutes from `fromTime`, plus shift breaks
 * that fall inside the wall-clock span (same idea as attendance hours minus breaks).
 */
export function computeCOffToEndWithBreaks(
  fromDate: string,
  fromTime: string,
  offValue: number,
  shiftBreaks: Array<{ start_time: string; end_time: string }>
): { toDate: string; toTime: string } {
  const workMinutes = cOffNetWorkHours(offValue) * 60;
  const fd = fromDate?.trim() || '';
  const ft = fromTime?.trim() || '';
  if (!fd || !ft || workMinutes <= 0) {
    return { toDate: fd, toTime: ft };
  }
  const [y, mo, d] = fd.split('-').map(Number);
  const [hh, mmRaw] = ft.split(':');
  const hhNum = parseInt(hh, 10);
  const mmNum = parseInt(mmRaw ?? '0', 10);
  if (!y || !mo || !d || Number.isNaN(hhNum)) {
    return { toDate: fd, toTime: ft };
  }
  const start = new Date(y, mo - 1, d, hhNum, Number.isNaN(mmNum) ? 0 : mmNum, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  const hm = (dt: Date) => `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;

  const breaks = shiftBreaks || [];
  if (!breaks.length) {
    const end = new Date(start.getTime() + workMinutes * 60000);
    return {
      toDate: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
      toTime: hm(end)
    };
  }

  let wallMinutes = workMinutes;
  for (let i = 0; i < 30; i++) {
    const end = new Date(start.getTime() + wallMinutes * 60000);
    const fromHM = hm(start);
    const toHM = hm(end);
    const breakMin = calculateBreakTimeInMinutes(fromHM, toHM, breaks);
    const net = wallMinutes - breakMin;
    const delta = workMinutes - net;
    if (Math.abs(delta) < 0.5) {
      return {
        toDate: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
        toTime: hm(end)
      };
    }
    wallMinutes += delta;
    if (wallMinutes > workMinutes + 720) break;
    if (wallMinutes < workMinutes) wallMinutes = workMinutes;
  }

  const end = new Date(start.getTime() + wallMinutes * 60000);
  return {
    toDate: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
    toTime: hm(end)
  };
}
