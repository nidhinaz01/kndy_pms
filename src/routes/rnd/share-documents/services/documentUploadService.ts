import { supabase } from '$lib/supabaseClient';

export interface DocumentSubmission {
  id: number;
  sales_order_id: number;
  stage_code: string | null;
  document_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  submission_date: string;
  revised_date: string | null;
  revision_number: number;
  is_current: boolean;
  is_deleted: boolean;
  replaced_by_id: number | null;
  uploaded_by: string;
  created_dt: string;
  modified_by: string | null;
  modified_dt: string | null;
}

export interface DocumentHistory extends DocumentSubmission {
  replaced_by?: DocumentSubmission;
}

/**
 * Upload a stage-specific document
 */
export async function uploadStageDocument(
  salesOrderId: number,
  stageCode: string,
  file: File,
  username: string
): Promise<DocumentSubmission> {
  const now = new Date().toISOString();
  
  // 1. Upload file to Supabase Storage
  const timestamp = Date.now();
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `${salesOrderId}/${stageCode}/${timestamp}_${sanitizedFileName}`;
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('rnd-documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });
  
  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    throw new Error(`Failed to upload file: ${uploadError.message}`);
  }
  
  // 2. Check if there's a current document for this stage
  const { data: existingDoc, error: checkError } = await supabase
    .from('rnd_document_submissions')
    .select('id, revision_number')
    .eq('sales_order_id', salesOrderId)
    .eq('stage_code', stageCode)
    .eq('is_current', true)
    .eq('is_deleted', false)
    .maybeSingle();
  
  if (checkError && checkError.code !== 'PGRST116') {
    throw new Error(`Failed to check existing document: ${checkError.message}`);
  }
  
  const revisionNumber = existingDoc ? existingDoc.revision_number + 1 : 1;
  
  // 3. If replacing, mark old as revised
  if (existingDoc) {
    const { error: updateError } = await supabase
      .from('rnd_document_submissions')
      .update({
        is_current: false,
        revised_date: now,
        modified_by: username,
        modified_dt: now
      })
      .eq('id', existingDoc.id);
    
    if (updateError) {
      // Try to delete the uploaded file if database update fails
      await supabase.storage.from('rnd-documents').remove([filePath]);
      throw new Error(`Failed to update existing document: ${updateError.message}`);
    }
  }
  
  // 4. Insert new document
  const { data: newDoc, error: insertError } = await supabase
    .from('rnd_document_submissions')
    .insert({
      sales_order_id: salesOrderId,
      stage_code: stageCode,
      document_name: file.name,
      file_path: filePath,
      file_size: file.size,
      file_type: file.type,
      submission_date: now,
      revision_number: revisionNumber,
      is_current: true,
      replaced_by_id: existingDoc?.id || null,
      uploaded_by: username
    })
    .select()
    .single();
  
  if (insertError) {
    // Try to delete the uploaded file if database insert fails
    await supabase.storage.from('rnd-documents').remove([filePath]);
    throw new Error(`Failed to save document record: ${insertError.message}`);
  }
  
  // 5. Update or create prdn_dates entry
  const { data: existingDate, error: dateCheckError } = await supabase
    .from('prdn_dates')
    .select('id')
    .eq('sales_order_id', salesOrderId)
    .eq('date_type', 'rnd_documents')
    .eq('stage_code', stageCode)
    .maybeSingle();
  
  if (dateCheckError && dateCheckError.code !== 'PGRST116') {
    throw new Error(`Failed to check prdn_dates: ${dateCheckError.message}`);
  }
  
  if (existingDate) {
    // Update existing
    const { error: updateDateError } = await supabase
      .from('prdn_dates')
      .update({
        actual_date: now,
        modified_by: username,
        modified_dt: now
      })
      .eq('id', existingDate.id);
    
    if (updateDateError) {
      throw new Error(`Failed to update prdn_dates: ${updateDateError.message}`);
    }
  } else {
    // Create new (shouldn't happen if entry plan creates them, but handle it)
    const { error: createDateError } = await supabase
      .from('prdn_dates')
      .insert({
        sales_order_id: salesOrderId,
        stage_code: stageCode,
        date_type: 'rnd_documents',
        planned_date: null, // Should be set during entry plan, but allow null for now
        actual_date: now,
        created_by: username,
        created_dt: now,
        modified_by: username,
        modified_dt: now
      });
    
    if (createDateError) {
      throw new Error(`Failed to create prdn_dates entry: ${createDateError.message}`);
    }
  }
  
  return newDoc;
}

/**
 * Upload a general document (not stage-specific)
 */
export async function uploadGeneralDocument(
  salesOrderId: number,
  file: File,
  username: string
): Promise<DocumentSubmission> {
  const now = new Date().toISOString();
  
  // 1. Upload file to Supabase Storage
  const timestamp = Date.now();
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `${salesOrderId}/general/${timestamp}_${sanitizedFileName}`;
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('rnd-documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });
  
  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    throw new Error(`Failed to upload file: ${uploadError.message}`);
  }
  
  // 2. Insert document (no revision tracking, no prdn_dates update)
  const { data: newDoc, error: insertError } = await supabase
    .from('rnd_document_submissions')
    .insert({
      sales_order_id: salesOrderId,
      stage_code: null, // General document
      document_name: file.name,
      file_path: filePath,
      file_size: file.size,
      file_type: file.type,
      submission_date: now,
      revision_number: 1,
      is_current: true, // Always true for general docs
      uploaded_by: username
    })
    .select()
    .single();
  
  if (insertError) {
    // Try to delete the uploaded file if database insert fails
    await supabase.storage.from('rnd-documents').remove([filePath]);
    throw new Error(`Failed to save document record: ${insertError.message}`);
  }
  
  return newDoc;
}

/**
 * Delete a document (soft delete)
 */
export async function deleteDocument(
  documentId: number,
  username: string
): Promise<void> {
  const now = new Date().toISOString();
  
  // 1. Get document info
  const { data: doc, error: fetchError } = await supabase
    .from('rnd_document_submissions')
    .select('sales_order_id, stage_code, is_current')
    .eq('id', documentId)
    .single();
  
  if (fetchError) {
    throw new Error(`Failed to fetch document: ${fetchError.message}`);
  }
  
  if (!doc) {
    throw new Error('Document not found');
  }
  
  // 2. Soft delete document
  const { error: deleteError } = await supabase
    .from('rnd_document_submissions')
    .update({
      is_deleted: true,
      is_current: false,
      modified_by: username,
      modified_dt: now
    })
    .eq('id', documentId);
  
  if (deleteError) {
    throw new Error(`Failed to delete document: ${deleteError.message}`);
  }
  
  // 3. If it's a stage-specific current document, check if there are other current documents
  // and update prdn_dates accordingly
  if (doc.stage_code && doc.is_current) {
    const { data: otherDocs, error: checkError } = await supabase
      .from('rnd_document_submissions')
      .select('id')
      .eq('sales_order_id', doc.sales_order_id)
      .eq('stage_code', doc.stage_code)
      .eq('is_current', true)
      .eq('is_deleted', false);
    
    if (checkError) {
      throw new Error(`Failed to check other documents: ${checkError.message}`);
    }
    
    // If no current documents, set actual_date to null
    if (!otherDocs || otherDocs.length === 0) {
      const { error: updateDateError } = await supabase
        .from('prdn_dates')
        .update({
          actual_date: null,
          modified_by: username,
          modified_dt: now
        })
        .eq('sales_order_id', doc.sales_order_id)
        .eq('stage_code', doc.stage_code)
        .eq('date_type', 'rnd_documents');
      
      if (updateDateError) {
        throw new Error(`Failed to update prdn_dates: ${updateDateError.message}`);
      }
    }
  }
}

/**
 * Get document history for a stage-specific document
 */
export async function getDocumentHistory(
  salesOrderId: number,
  stageCode: string
): Promise<DocumentHistory[]> {
  const { data, error } = await supabase
    .from('rnd_document_submissions')
    .select('*')
    .eq('sales_order_id', salesOrderId)
    .eq('stage_code', stageCode)
    .eq('is_deleted', false)
    .order('revision_number', { ascending: false });
  
  if (error) {
    throw new Error(`Failed to fetch document history: ${error.message}`);
  }
  
  // Get replaced_by information for each document
  const historyWithReplacedBy = await Promise.all(
    (data || []).map(async (doc) => {
      if (doc.replaced_by_id) {
        const { data: replacedBy } = await supabase
          .from('rnd_document_submissions')
          .select('*')
          .eq('id', doc.replaced_by_id)
          .single();
        
        return { ...doc, replaced_by: replacedBy || undefined };
      }
      return doc;
    })
  );
  
  return historyWithReplacedBy;
}

/**
 * Get all documents for a work order (stage-specific and general)
 */
export async function getWorkOrderDocuments(
  salesOrderId: number
): Promise<{
  stageDocuments: Map<string, DocumentSubmission>;
  generalDocuments: DocumentSubmission[];
}> {
  const { data, error } = await supabase
    .from('rnd_document_submissions')
    .select('*')
    .eq('sales_order_id', salesOrderId)
    .eq('is_deleted', false)
    .order('submission_date', { ascending: false });
  
  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }
  
  const stageDocuments = new Map<string, DocumentSubmission>();
  const generalDocuments: DocumentSubmission[] = [];
  
  (data || []).forEach((doc) => {
    if (doc.stage_code) {
      // Only keep the current document for each stage
      if (doc.is_current) {
        stageDocuments.set(doc.stage_code, doc);
      }
    } else {
      generalDocuments.push(doc);
    }
  });
  
  return { stageDocuments, generalDocuments };
}

/**
 * Get download URL for a document
 */
export async function getDocumentDownloadUrl(filePath: string): Promise<string> {
  if (!filePath) {
    throw new Error('File path is required');
  }
  
  // Ensure file path is a string and clean it
  const cleanPath = String(filePath).trim();
  if (!cleanPath) {
    throw new Error('File path is empty');
  }
  
  const { data, error } = await supabase.storage
    .from('rnd-documents')
    .createSignedUrl(cleanPath, 3600); // 1 hour expiry
  
  if (error) {
    throw new Error(`Failed to create download URL: ${error.message}`);
  }
  
  if (!data || !data.signedUrl) {
    throw new Error('No signed URL returned from storage');
  }
  
  return data.signedUrl;
}

export interface WorkOrderDocumentGroup {
  sales_order_id: number;
  wo_no: string;
  pwo_no: string | null;
  wo_model: string;
  customer_name: string | null;
  documents: DocumentSubmission[];
}

/**
 * Get all documents for a specific stage code (across all work orders)
 * Returns documents grouped by work order with work order details
 */
export async function getDocumentsByStageCode(
  stageCode: string
): Promise<WorkOrderDocumentGroup[]> {
  const { data, error } = await supabase
    .from('rnd_document_submissions')
    .select('*')
    .eq('stage_code', stageCode)
    .eq('is_deleted', false)
    .eq('is_current', true) // Only get current versions
    .order('submission_date', { ascending: false });
  
  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }
  
  if (!data || data.length === 0) {
    return [];
  }
  
  // Get unique sales_order_ids
  const salesOrderIds = [...new Set(data.map(doc => doc.sales_order_id))];
  
  // Fetch work order details
  const { data: workOrders, error: woError } = await supabase
    .from('prdn_wo_details')
    .select('id, wo_no, pwo_no, wo_model, customer_name')
    .in('id', salesOrderIds);
  
  if (woError) {
    throw new Error(`Failed to fetch work order details: ${woError.message}`);
  }
  
  // Create a map of sales_order_id to work order details
  const workOrderMap = new Map<number, {
    wo_no: string;
    pwo_no: string | null;
    wo_model: string;
    customer_name: string | null;
  }>();
  
  (workOrders || []).forEach(wo => {
    workOrderMap.set(wo.id, {
      wo_no: wo.wo_no,
      pwo_no: wo.pwo_no,
      wo_model: wo.wo_model,
      customer_name: wo.customer_name
    });
  });
  
  // Group documents by sales_order_id
  const documentsByWorkOrder = new Map<number, DocumentSubmission[]>();
  
  data.forEach((doc: any) => {
    // Ensure proper data mapping - Supabase returns snake_case
    const filePath = doc.file_path || doc.filePath || doc['file_path'] || '';
    
    const mappedDoc: DocumentSubmission = {
      id: doc.id,
      sales_order_id: doc.sales_order_id,
      stage_code: doc.stage_code,
      document_name: doc.document_name || doc.documentName || '',
      file_path: filePath,
      file_size: doc.file_size !== undefined && doc.file_size !== null ? doc.file_size : (doc.fileSize || 0),
      file_type: doc.file_type || doc.fileType || '',
      submission_date: doc.submission_date || doc.submissionDate || '',
      revised_date: doc.revised_date || doc.revisedDate || null,
      revision_number: doc.revision_number !== undefined && doc.revision_number !== null ? doc.revision_number : (doc.revisionNumber || 1),
      is_current: doc.is_current !== undefined ? doc.is_current : (doc.isCurrent ?? true),
      is_deleted: doc.is_deleted !== undefined ? doc.is_deleted : (doc.isDeleted ?? false),
      replaced_by_id: doc.replaced_by_id || doc.replacedById || null,
      uploaded_by: doc.uploaded_by || doc.uploadedBy || '',
      created_dt: doc.created_dt || doc.createdDt || '',
      modified_by: doc.modified_by || doc.modifiedBy || null,
      modified_dt: doc.modified_dt || doc.modifiedDt || null
    };
    
    const salesOrderId = mappedDoc.sales_order_id;
    if (!documentsByWorkOrder.has(salesOrderId)) {
      documentsByWorkOrder.set(salesOrderId, []);
    }
    documentsByWorkOrder.get(salesOrderId)!.push(mappedDoc);
  });
  
  // Combine into result array
  const result: WorkOrderDocumentGroup[] = [];
  
  documentsByWorkOrder.forEach((documents, salesOrderId) => {
    const woDetails = workOrderMap.get(salesOrderId);
    if (woDetails) {
      result.push({
        sales_order_id: salesOrderId,
        wo_no: woDetails.wo_no,
        pwo_no: woDetails.pwo_no,
        wo_model: woDetails.wo_model,
        customer_name: woDetails.customer_name,
        documents: documents
      });
    }
  });
  
  // Sort by WO number
  result.sort((a, b) => a.wo_no.localeCompare(b.wo_no));
  
  return result;
}

