import { supabase } from '$lib/supabaseClient';
import { getBatchDocumentStatuses, type DocumentStatus } from './documentUploadService';

export interface DocumentRelease {
  id: string;
  sales_order_id: number;
  wo_no: string;
  pwo_no: string | null;
  wo_model: string;
  customer_name: string | null;
  wo_date: string;
  documentStatuses: DocumentStatus[];
  allDocumentsCompleted: boolean;
  hasAnyDocument: boolean;
  hasPendingDocuments: boolean;
}

/**
 * Load document releases for all work orders
 * Shows work orders with their document statuses
 * 
 * OPTIMIZED: Uses batch queries instead of N+1 queries
 * - 1 query for work orders
 * - 1 query for all documents
 * - 1 query for all requirements
 * Total: 3 queries regardless of work order count
 */
export async function loadDocumentReleases(): Promise<DocumentRelease[]> {
  try {
    // Get all work orders that might need documents
    const { data: workOrders, error: woError } = await supabase
      .from('prdn_wo_details')
      .select('id, wo_no, pwo_no, wo_model, customer_name, wo_date')
      .order('wo_no', { ascending: true });
    
    if (woError) {
      console.error('Database error loading work orders:', woError);
      return [];
    }
    
    if (!workOrders || workOrders.length === 0) {
      return [];
    }
    
    // Extract work order IDs
    const workOrderIds = workOrders.map(wo => wo.id);
    
    // Batch fetch all document statuses in one go
    // This replaces N individual queries with 2 batch queries (documents + requirements)
    const statusMap = await getBatchDocumentStatuses(workOrderIds);
    
    // Build document releases
    const releases: DocumentRelease[] = workOrders.map(wo => {
      const statuses = statusMap.get(wo.id) || [];
      
      // Calculate completion status
      const allCompleted = statuses.every(s => 
        s.status === 'uploaded' || s.status === 'not_required'
      );
      
      const hasAny = statuses.some(s => s.status === 'uploaded');
      const hasPending = statuses.some(s => s.status === 'pending');
      
      return {
        id: wo.id.toString(),
        sales_order_id: wo.id,
        wo_no: wo.wo_no,
        pwo_no: wo.pwo_no,
        wo_model: wo.wo_model,
        customer_name: wo.customer_name,
        wo_date: wo.wo_date,
        documentStatuses: statuses,
        allDocumentsCompleted: allCompleted,
        hasAnyDocument: hasAny,
        hasPendingDocuments: hasPending
      };
    });
    
    return releases;
  } catch (error) {
    console.error('Error loading document releases:', error);
    return [];
  }
}

/**
 * @deprecated This function is no longer used with document types
 */
export async function saveDocumentSubmission(
  salesOrderId: string,
  submissionDate: string,
  username: string | null
): Promise<void> {
  console.warn('saveDocumentSubmission is deprecated. This function is no longer used with document types.');
  // No-op - this was for prdn_dates which we're not using anymore
}
