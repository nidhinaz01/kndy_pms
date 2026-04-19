/**
 * Narrow viewports (phones / tablets): iframe PDF blobs are unreliable; use open-in-new-tab / download instead.
 */
export function prefersExternalPdfOpen(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(max-width: 1023px)').matches;
  } catch {
    return false;
  }
}
