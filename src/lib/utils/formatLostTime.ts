/**
 * Format lost time details (lt_details array) for display.
 * Used by piece-rate and other report views.
 */
export function formatLostTimeDetails(ltDetails: any[] | null): string {
  if (!ltDetails || !Array.isArray(ltDetails) || ltDetails.length === 0) {
    return '';
  }

  return ltDetails
    .map((lt: any, index: number) => {
      const ltNumber = index + 1;
      const minutes = lt.lt_minutes || 0;
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const timeStr = `${hours} Hr ${mins} Min`;
      const payableStr = lt.is_lt_payable ? 'P' : 'NP';
      const reason = lt.lt_reason || lt.reason || 'N/A';
      return `LT${ltNumber}: ${timeStr} (${payableStr}-${reason})`;
    })
    .join('; ');
}
