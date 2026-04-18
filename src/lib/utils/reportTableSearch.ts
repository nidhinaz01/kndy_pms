/**
 * Client-side filter for generated report tables: case-insensitive match anywhere
 * in the row’s serialized data (all fields and nested objects like `cells`).
 */

export function reportRowMatchesSearch(query: string, record: unknown): boolean {
  const t = query.trim();
  if (!t) return true;
  try {
    return JSON.stringify(record ?? {}).toLowerCase().includes(t.toLowerCase());
  } catch {
    return String(record ?? '').toLowerCase().includes(t.toLowerCase());
  }
}
