import { supabase } from '$lib/supabaseClient';

export interface WorkOrderListItem {
  id: number;
  wo_no: string | null;
}

export interface ArchivedWorkOrder {
  id: number;
  wo_no: string | null;
  wo_type: string | null;
  wo_model: string | null;
  wo_date: string | null;
  wo_delivery: string | null;
  archived_by: string | null;
  archived_dt: string | null;
}

export interface ArchiveResult {
  success: boolean;
  wo_no?: string;
  error?: string;
  /** RND document storage paths to delete from bucket (freed after archive) */
  file_paths?: string[];
}

/**
 * Fetch all work orders from public.prdn_wo_details (for archive selection).
 * No filtering; archived WOs are no longer in this table.
 */
export async function fetchWorkOrdersForArchive(): Promise<WorkOrderListItem[]> {
  const { data, error } = await supabase
    .from('prdn_wo_details')
    .select('id, wo_no')
    .order('id', { ascending: false });

  if (error) {
    console.error('Error fetching work orders for archive:', error);
    throw error;
  }
  return (data ?? []) as WorkOrderListItem[];
}

/**
 * Fetch archived work orders via RPC (reads from archive schema server-side).
 * Use this so the client does not need direct access to the archive schema.
 */
export async function fetchArchivedWorkOrders(): Promise<ArchivedWorkOrder[]> {
  const { data, error } = await supabase.rpc('get_archived_work_orders');

  if (error) {
    console.error('Error fetching archived work orders:', error);
    throw error;
  }
  return (data ?? []) as ArchivedWorkOrder[];
}

/**
 * Delete RND document files from storage (bucket rnd-documents).
 * Can pass exact paths, or a folder prefix (e.g. "33") to list and remove all objects under it.
 * Requires admin session.
 */
export async function deleteRndStoragePaths(paths: string[]): Promise<{ success: boolean; error?: string }>;
export async function deleteRndStoragePaths(paths: string[], prefixFallback: string): Promise<{ success: boolean; error?: string }>;
export async function deleteRndStoragePaths(
  paths: string[],
  prefixFallback?: string
): Promise<{ success: boolean; error?: string }> {
  const hasPaths = paths && paths.length > 0;
  const hasPrefix = typeof prefixFallback === 'string' && prefixFallback.trim().length > 0;
  if (!hasPaths && !hasPrefix) return { success: true };

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { success: false, error: 'Not authenticated' };
  }

  const requestBody = hasPaths ? { paths } : { prefix: prefixFallback!.trim() };
  const res = await fetch('/api/archive/delete-rnd-storage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify(requestBody)
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: body?.error ?? `HTTP ${res.status}` };
  }
  return { success: true };
}

/**
 * Archive one work order (moves from public to archive in a single transaction).
 * Calls Postgres function public.archive_work_order.
 * If the function returns file_paths, deletes those objects from rnd-documents bucket to free storage.
 */
export async function archiveWorkOrder(
  woDetailsId: number,
  archivedBy: string
): Promise<ArchiveResult> {
  const { data, error } = await supabase.rpc('archive_work_order', {
    p_wo_details_id: woDetailsId,
    p_archived_by: archivedBy
  });

  if (error) {
    console.error('Error archiving work order:', error);
    return { success: false, error: error.message };
  }

  const result = data as ArchiveResult | null;
  if (!result || typeof result !== 'object' || !('success' in result)) {
    return { success: false, error: 'Unexpected response from archive_work_order' };
  }

  if (!result.success) {
    return result;
  }

  // Normalize file_paths (RPC may return array or undefined; ensure we have string[])
  let paths: string[] = [];
  if (Array.isArray(result.file_paths)) {
    paths = result.file_paths.filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
  }

  if (paths.length > 0) {
    const deleteResult = await deleteRndStoragePaths(paths);
    if (!deleteResult.success) {
      console.warn('Archive succeeded but RND storage delete failed:', deleteResult.error);
      result.error = result.error
        ? `${result.error}; storage delete failed: ${deleteResult.error}`
        : `Storage delete failed: ${deleteResult.error}`;
    }
  } else {
    // Fallback: delete by folder prefix (e.g. "33") so bucket is freed even if DB didn't return paths
    const deleteResult = await deleteRndStoragePaths([], String(woDetailsId));
    if (!deleteResult.success) {
      console.warn('Archive succeeded but RND storage delete (by prefix) failed:', deleteResult.error);
      result.error = result.error
        ? `${result.error}; storage delete failed: ${deleteResult.error}`
        : `Storage delete failed: ${deleteResult.error}`;
    }
  }

  return result;
}
