import { supabase } from '$lib/supabaseClient';
import { getWorkOrderDocuments } from './documentUploadService';

export interface DocumentReleaseStage {
  stage_code: string;
  planned_date: string;
  actual_date: string | null;
  hasDocument: boolean;
  documentName?: string;
  submissionDate?: string;
  revisionNumber?: number;
}

export interface DocumentRelease {
  id: string;
  sales_order_id: number;
  wo_no: string;
  pwo_no: string | null;
  wo_model: string;
  customer_name: string | null;
  wo_date: string;
  stages: DocumentReleaseStage[];
  allStagesCompleted: boolean;
  hasAnyDocument: boolean;
}

/**
 * Load document releases with stage-specific information
 */
export async function loadDocumentReleases(): Promise<DocumentRelease[]> {
  try {
    // Load all rnd_documents entries (stage-specific)
    const { data: datesData, error: datesError } = await supabase
      .from('prdn_dates')
      .select(`
        *,
        prdn_wo_details!inner(
          id,
          wo_no,
          pwo_no,
          wo_model,
          customer_name,
          wo_date
        )
      `)
      .eq('date_type', 'rnd_documents')
      .not('planned_date', 'is', null)
      .not('stage_code', 'is', null)
      .order('planned_date', { ascending: true });

    if (datesError) {
      console.error('Database error loading document releases:', datesError);
      return [];
    }

    // Group by work order
    const workOrderMap = new Map<number, DocumentRelease>();
    const woTypeMap = new Map<string, string[]>(); // Cache stage orders by WO type
    
    for (const dateEntry of datesData || []) {
      const woId = dateEntry.sales_order_id;
      const woDetails = dateEntry.prdn_wo_details;
      
      if (!workOrderMap.has(woId)) {
        // Get stages for this work order type (with caching)
        let stageCodes: string[] = [];
        if (woTypeMap.has(woDetails.wo_model)) {
          stageCodes = woTypeMap.get(woDetails.wo_model)!;
        } else {
          const { data: stageOrders } = await supabase
            .from('plan_wo_stage_order')
            .select('plant_stage')
            .eq('wo_type_name', woDetails.wo_model)
            .order('order_no', { ascending: true });
          
          stageCodes = (stageOrders || []).map(stage => stage.plant_stage);
          woTypeMap.set(woDetails.wo_model, stageCodes);
        }
        
        const stages: DocumentReleaseStage[] = stageCodes.map(stageCode => ({
          stage_code: stageCode,
          planned_date: '',
          actual_date: null,
          hasDocument: false
        }));
        
        workOrderMap.set(woId, {
          id: woId.toString(),
          sales_order_id: woId,
          wo_no: woDetails.wo_no,
          pwo_no: woDetails.pwo_no,
          wo_model: woDetails.wo_model,
          customer_name: woDetails.customer_name,
          wo_date: woDetails.wo_date,
          stages: stages,
          allStagesCompleted: false,
          hasAnyDocument: false
        });
      }
      
      const workOrder = workOrderMap.get(woId)!;
      const stageIndex = workOrder.stages.findIndex(s => s.stage_code === dateEntry.stage_code);
      
      if (stageIndex >= 0) {
        workOrder.stages[stageIndex].planned_date = dateEntry.planned_date;
        workOrder.stages[stageIndex].actual_date = dateEntry.actual_date;
      }
    }
    
    // Load document submissions for all work orders (batch)
    const workOrderIds = Array.from(workOrderMap.keys());
    
    // Load all documents in parallel
    const documentPromises = workOrderIds.map(async (woId) => {
      try {
        const { stageDocuments } = await getWorkOrderDocuments(woId);
        return { woId, stageDocuments };
      } catch (error) {
        console.error(`Error loading documents for work order ${woId}:`, error);
        return { woId, stageDocuments: new Map<string, DocumentSubmission>() };
      }
    });
    
    const documentResults = await Promise.all(documentPromises);
    
    // Update work orders with document data
    for (const { woId, stageDocuments } of documentResults) {
      const workOrder = workOrderMap.get(woId);
      if (!workOrder) continue;
      
      // Update stage information with document data
      workOrder.stages.forEach(stage => {
        const doc = stageDocuments.get(stage.stage_code);
        if (doc) {
          stage.hasDocument = true;
          stage.documentName = doc.document_name;
          stage.submissionDate = doc.submission_date;
          stage.revisionNumber = doc.revision_number;
        }
      });
      
      // Calculate completion status
      workOrder.hasAnyDocument = stageDocuments.size > 0;
      workOrder.allStagesCompleted = workOrder.stages.every(s => s.hasDocument && s.actual_date !== null);
    }
    
    return Array.from(workOrderMap.values());
  } catch (error) {
    console.error('Error loading document releases:', error);
    return [];
  }
}

/**
 * @deprecated Use documentUploadService.uploadStageDocument instead
 * This function is kept for backward compatibility but should not be used
 */
export async function saveDocumentSubmission(
  salesOrderId: string,
  submissionDate: string,
  username: string | null
): Promise<void> {
  console.warn('saveDocumentSubmission is deprecated. Use documentUploadService.uploadStageDocument instead.');
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('prdn_dates')
    .update({
      actual_date: submissionDate,
      modified_by: username,
      modified_dt: now
    })
    .eq('sales_order_id', salesOrderId)
    .eq('date_type', 'rnd_documents')
    .not('stage_code', 'is', null);

  if (error) throw error;
}

