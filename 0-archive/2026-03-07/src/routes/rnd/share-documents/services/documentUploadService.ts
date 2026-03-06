import { supabase } from '$lib/supabaseClient';
import { 
  DOCUMENT_TYPES, 
  ALL_DOCUMENT_TYPES, 
  isSingleFileType, 
  isMultiFileType,
  normalizeDocumentType,
  type DocumentType 
} from '../constants/documentTypes';

export interface DocumentSubmission {
  id: number;
  sales_order_id: number;
  document_type: string | null;
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

export interface DocumentRequirement {
  id: number;
  sales_order_id: number;
  document_type: string;
  is_not_required: boolean;
  not_required_comments: string | null;
  marked_by: string;
  marked_dt: string;
  created_dt: string;
  modified_by: string | null;
  modified_dt: string | null;
}

export interface DocumentStatus {
  document_type: string;
  status: 'uploaded' | 'not_required' | 'pending';
  document_id?: number;
  file_path?: string;
  document_name?: string;
  submission_date?: string;
  revision_number?: number;
  uploaded_by?: string;
  not_required_comments?: string;
  not_required_marked_by?: string;
  not_required_marked_dt?: string;
  documents?: DocumentSubmission[]; // For multi-file types
}

export interface WorkOrderDocumentGroup {
  sales_order_id: number;
  wo_no: string;
  pwo_no: string | null;
  wo_model: string;
  customer_name: string | null;
  wo_date: string;
  documents: DocumentSubmission[];
}

/**
 * Upload a document (replaces old uploadStageDocument and uploadGeneralDocument)
 */
export async function uploadDocument(
  salesOrderId: number,
  documentType: string,
  file: File,
  username: string
): Promise<DocumentSubmission> {
  const now = new Date().toISOString();
  const normalizedType = normalizeDocumentType(documentType);
  
  if (!normalizedType) {
    throw new Error('Invalid document type');
  }
  
  // Validate document type
  if (!ALL_DOCUMENT_TYPES.includes(normalizedType as DocumentType)) {
    throw new Error(`Invalid document type: ${documentType}`);
  }
  
  // 1. Upload file to Supabase Storage
  const timestamp = Date.now();
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  // Storage path: {sales_order_id}/{document_type}/{timestamp}_{filename}
  const sanitizedDocType = normalizedType.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `${salesOrderId}/${sanitizedDocType}/${timestamp}_${sanitizedFileName}`;
  
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
  
  // 2. For single-file types, check if there's a current document
  let existingDoc: { id: number; revision_number: number } | null = null;
  let revisionNumber = 1;
  
  if (isSingleFileType(normalizedType)) {
    const { data: existing, error: checkError } = await supabase
      .from('rnd_document_submissions')
      .select('id, revision_number')
      .eq('sales_order_id', salesOrderId)
      .eq('document_type', normalizedType)
      .eq('is_current', true)
      .eq('is_deleted', false)
      .maybeSingle();
    
    if (checkError && checkError.code !== 'PGRST116') {
      await supabase.storage.from('rnd-documents').remove([filePath]);
      throw new Error(`Failed to check existing document: ${checkError.message}`);
    }
    
    existingDoc = existing;
    revisionNumber = existing ? existing.revision_number + 1 : 1;
    
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
        await supabase.storage.from('rnd-documents').remove([filePath]);
        throw new Error(`Failed to update existing document: ${updateError.message}`);
      }
    }
  }
  
  // 4. Insert new document
  const { data: newDoc, error: insertError } = await supabase
    .from('rnd_document_submissions')
    .insert({
      sales_order_id: salesOrderId,
      document_type: normalizedType,
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
    await supabase.storage.from('rnd-documents').remove([filePath]);
    throw new Error(`Failed to save document record: ${insertError.message}`);
  }
  
  // 5. Remove "Not Required" status if it exists
  await removeNotRequiredStatus(salesOrderId, normalizedType);
  
  // 6. Check if all documents are completed and update actual_date if so
  await updateRndDocumentsActualDate(salesOrderId, username);
  
  return newDoc;
}

/**
 * Mark a document as "Not Required"
 */
export async function markAsNotRequired(
  salesOrderId: number,
  documentType: string,
  comments: string,
  username: string
): Promise<DocumentRequirement> {
  const normalizedType = normalizeDocumentType(documentType);
  
  if (!normalizedType) {
    throw new Error('Invalid document type');
  }
  
  if (!comments || !comments.trim()) {
    throw new Error('Comments are required when marking document as not required');
  }
  
  // Validate document type
  if (!ALL_DOCUMENT_TYPES.includes(normalizedType as DocumentType)) {
    throw new Error(`Invalid document type: ${documentType}`);
  }
  
  const now = new Date().toISOString();
  
  // Insert or update requirement
  const { data: requirement, error } = await supabase
    .from('rnd_document_requirements')
    .upsert({
      sales_order_id: salesOrderId,
      document_type: normalizedType,
      is_not_required: true,
      not_required_comments: comments.trim(),
      marked_by: username,
      marked_dt: now,
      modified_by: username,
      modified_dt: now
    }, {
      onConflict: 'sales_order_id,document_type'
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to mark document as not required: ${error.message}`);
  }
  
  // Check if all documents are completed and update actual_date if so
  await updateRndDocumentsActualDate(salesOrderId, username);
  
  return requirement;
}

/**
 * Remove "Not Required" status
 */
export async function removeNotRequiredStatus(
  salesOrderId: number,
  documentType: string,
  username?: string
): Promise<void> {
  const normalizedType = normalizeDocumentType(documentType);
  
  if (!normalizedType) return;
  
  const { error } = await supabase
    .from('rnd_document_requirements')
    .delete()
    .eq('sales_order_id', salesOrderId)
    .eq('document_type', normalizedType);
  
  if (error) {
    console.error('Failed to remove not required status:', error);
    // Don't throw - this is not critical
    return;
  }
  
  // If username is provided, check if all documents are still completed and update actual_date if needed
  if (username) {
    await updateRndDocumentsActualDate(salesOrderId, username);
  }
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
    .select('sales_order_id, document_type, is_current')
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
  
  // 3. For single-file types, if it was current, check if there are other current documents
  if (doc.document_type && isSingleFileType(doc.document_type) && doc.is_current) {
    const { data: otherDocs, error: checkError } = await supabase
      .from('rnd_document_submissions')
      .select('id')
      .eq('sales_order_id', doc.sales_order_id)
      .eq('document_type', doc.document_type)
      .eq('is_current', true)
      .eq('is_deleted', false);
    
    if (checkError) {
      throw new Error(`Failed to check other documents: ${checkError.message}`);
    }
    
    // If no current documents, the status will be "pending" (no action needed)
  }
  
  // 4. Check if all documents are still completed and update actual_date if needed
  await updateRndDocumentsActualDate(doc.sales_order_id, username);
}

/**
 * Get document history for a document type
 */
export async function getDocumentHistory(
  salesOrderId: number,
  documentType: string
): Promise<DocumentHistory[]> {
  const normalizedType = normalizeDocumentType(documentType);
  
  if (!normalizedType) {
    throw new Error('Invalid document type');
  }
  
  const { data, error } = await supabase
    .from('rnd_document_submissions')
    .select('*')
    .eq('sales_order_id', salesOrderId)
    .eq('document_type', normalizedType)
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
 * Get all documents for a work order, organized by document type
 */
export async function getWorkOrderDocuments(
  salesOrderId: number
): Promise<Map<string, DocumentSubmission[]>> {
  const { data, error } = await supabase
    .from('rnd_document_submissions')
    .select('*')
    .eq('sales_order_id', salesOrderId)
    .eq('is_deleted', false)
    .order('submission_date', { ascending: false });
  
  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }
  
  const documentsByType = new Map<string, DocumentSubmission[]>();
  
  (data || []).forEach((doc: any) => {
    // Map snake_case to camelCase for consistency
    const mappedDoc: DocumentSubmission = {
      id: doc.id,
      sales_order_id: doc.sales_order_id,
      document_type: doc.document_type,
      document_name: doc.document_name,
      file_path: doc.file_path,
      file_size: doc.file_size,
      file_type: doc.file_type,
      submission_date: doc.submission_date,
      revised_date: doc.revised_date,
      revision_number: doc.revision_number,
      is_current: doc.is_current !== undefined ? doc.is_current : true,
      is_deleted: doc.is_deleted !== undefined ? doc.is_deleted : false,
      replaced_by_id: doc.replaced_by_id,
      uploaded_by: doc.uploaded_by,
      created_dt: doc.created_dt,
      modified_by: doc.modified_by,
      modified_dt: doc.modified_dt
    };
    
    if (mappedDoc.document_type) {
      const normalizedType = normalizeDocumentType(mappedDoc.document_type);
      if (normalizedType) {
        if (!documentsByType.has(normalizedType)) {
          documentsByType.set(normalizedType, []);
        }
        
        // For single-file types, only keep current document
        // For multi-file types, keep all documents
        if (isSingleFileType(normalizedType)) {
          if (mappedDoc.is_current) {
            documentsByType.set(normalizedType, [mappedDoc]);
          }
        } else {
          documentsByType.get(normalizedType)!.push(mappedDoc);
        }
      }
    }
  });
  
  return documentsByType;
}

/**
 * Get document status for all document types for a work order
 */
export async function getDocumentStatuses(
  salesOrderId: number
): Promise<DocumentStatus[]> {
  // Get all documents
  const documentsByType = await getWorkOrderDocuments(salesOrderId);
  
  // Get all requirements
  const { data: requirements, error: reqError } = await supabase
    .from('rnd_document_requirements')
    .select('*')
    .eq('sales_order_id', salesOrderId);
  
  if (reqError) {
    console.error('Failed to fetch requirements:', reqError);
  }
  
  const requirementsMap = new Map<string, DocumentRequirement>();
  (requirements || []).forEach(req => {
    const normalizedType = normalizeDocumentType(req.document_type);
    if (normalizedType) {
      requirementsMap.set(normalizedType, req);
    }
  });
  
  // Build status for each document type
  const statuses: DocumentStatus[] = [];
  
  for (const documentType of ALL_DOCUMENT_TYPES) {
    const documents = documentsByType.get(documentType) || [];
    const requirement = requirementsMap.get(documentType);
    
    let status: 'uploaded' | 'not_required' | 'pending';
    if (documents.length > 0) {
      status = 'uploaded';
    } else if (requirement?.is_not_required) {
      status = 'not_required';
    } else {
      status = 'pending';
    }
    
    const statusObj: DocumentStatus = {
      document_type: documentType,
      status,
      // Always include documents array when status is uploaded
      documents: documents.length > 0 ? documents : undefined
    };
    
    if (documents.length > 0) {
      // For single-file types, use the first (and only) document
      // For multi-file types, prefer current document, otherwise first
      const currentDoc = isSingleFileType(documentType) 
        ? documents[0] 
        : documents.find(d => d.is_current) || documents[0];
      
      if (currentDoc) {
        statusObj.document_id = currentDoc.id;
        statusObj.file_path = currentDoc.file_path;
        statusObj.document_name = currentDoc.document_name;
        statusObj.submission_date = currentDoc.submission_date;
        statusObj.revision_number = currentDoc.revision_number;
        statusObj.uploaded_by = currentDoc.uploaded_by;
      }
      
      // Ensure documents array is always set when we have documents
      statusObj.documents = documents;
    }
    
    if (requirement?.is_not_required) {
      statusObj.not_required_comments = requirement.not_required_comments;
      statusObj.not_required_marked_by = requirement.marked_by;
      statusObj.not_required_marked_dt = requirement.marked_dt;
    }
    
    statuses.push(statusObj);
  }
  
  return statuses;
}

/**
 * Check if all documents are completed (uploaded or marked as not required) for a work order
 */
export async function areAllDocumentsCompleted(salesOrderId: number): Promise<boolean> {
  const statuses = await getDocumentStatuses(salesOrderId);
  return statuses.every(status => status.status !== 'pending');
}

/**
 * Update actual_date in prdn_dates for rnd_documents when all documents are completed
 * If not all documents are completed, clears the actual_date
 */
async function updateRndDocumentsActualDate(salesOrderId: number, username: string): Promise<void> {
  try {
    // Check if all documents are completed
    const allCompleted = await areAllDocumentsCompleted(salesOrderId);
    
    // Get current timestamp
    const { getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const now = getCurrentTimestamp();
    
    // Update actual_date for rnd_documents row (with stage_code = null)
    const { error } = await supabase
      .from('prdn_dates')
      .update({
        actual_date: allCompleted ? now : null,
        modified_by: username,
        modified_dt: now
      })
      .eq('sales_order_id', salesOrderId)
      .eq('date_type', 'rnd_documents')
      .is('stage_code', null);
    
    if (error) {
      console.error('Failed to update rnd_documents actual_date:', error);
      // Don't throw - this is not critical for the upload/not-required operation
    } else {
      if (allCompleted) {
        console.log(`✅ Updated rnd_documents actual_date for work order ${salesOrderId}`);
      } else {
        console.log(`✅ Cleared rnd_documents actual_date for work order ${salesOrderId} (not all documents completed)`);
      }
    }
  } catch (error) {
    console.error('Error updating rnd_documents actual_date:', error);
    // Don't throw - this is not critical for the upload/not-required operation
  }
}

/**
 * Batch fetch documents for multiple work orders
 * Returns a map of work order ID -> documents by type
 */
export async function getBatchWorkOrderDocuments(
  salesOrderIds: number[]
): Promise<Map<number, Map<string, DocumentSubmission[]>>> {
  if (salesOrderIds.length === 0) {
    return new Map();
  }
  
  const { data, error } = await supabase
    .from('rnd_document_submissions')
    .select('*')
    .in('sales_order_id', salesOrderIds)
    .eq('is_deleted', false)
    .order('submission_date', { ascending: false });
  
  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }
  
  // Group by work order, then by document type
  const result = new Map<number, Map<string, DocumentSubmission[]>>();
  
  // Initialize maps for all work orders
  salesOrderIds.forEach(id => {
    result.set(id, new Map());
  });
  
  (data || []).forEach((doc: any) => {
    // Map snake_case to camelCase for consistency
    const mappedDoc: DocumentSubmission = {
      id: doc.id,
      sales_order_id: doc.sales_order_id,
      document_type: doc.document_type,
      document_name: doc.document_name,
      file_path: doc.file_path,
      file_size: doc.file_size,
      file_type: doc.file_type,
      submission_date: doc.submission_date,
      revised_date: doc.revised_date,
      revision_number: doc.revision_number,
      is_current: doc.is_current !== undefined ? doc.is_current : true,
      is_deleted: doc.is_deleted !== undefined ? doc.is_deleted : false,
      replaced_by_id: doc.replaced_by_id,
      uploaded_by: doc.uploaded_by,
      created_dt: doc.created_dt,
      modified_by: doc.modified_by,
      modified_dt: doc.modified_dt
    };
    
    if (mappedDoc.document_type && mappedDoc.sales_order_id) {
      const normalizedType = normalizeDocumentType(mappedDoc.document_type);
      if (normalizedType) {
        const woMap = result.get(mappedDoc.sales_order_id);
        if (woMap) {
          if (!woMap.has(normalizedType)) {
            woMap.set(normalizedType, []);
          }
          
          // For single-file types, only keep current document
          // For multi-file types, keep all documents
          if (isSingleFileType(normalizedType)) {
            if (mappedDoc.is_current) {
              woMap.set(normalizedType, [mappedDoc]);
            }
          } else {
            woMap.get(normalizedType)!.push(mappedDoc);
          }
        }
      }
    }
  });
  
  return result;
}

/**
 * Batch fetch document statuses for multiple work orders
 * This is much more efficient than calling getDocumentStatuses for each work order
 */
export async function getBatchDocumentStatuses(
  salesOrderIds: number[]
): Promise<Map<number, DocumentStatus[]>> {
  if (salesOrderIds.length === 0) {
    return new Map();
  }
  
  // Batch fetch all documents and requirements
  const [documentsByWorkOrder, { data: requirements, error: reqError }] = await Promise.all([
    getBatchWorkOrderDocuments(salesOrderIds),
    supabase
      .from('rnd_document_requirements')
      .select('*')
      .in('sales_order_id', salesOrderIds)
  ]);
  
  if (reqError) {
    console.error('Failed to fetch requirements:', reqError);
  }
  
  // Group requirements by work order and document type
  const requirementsByWorkOrder = new Map<number, Map<string, DocumentRequirement>>();
  
  // Initialize maps for all work orders
  salesOrderIds.forEach(id => {
    requirementsByWorkOrder.set(id, new Map());
  });
  
  (requirements || []).forEach((req: any) => {
    const normalizedType = normalizeDocumentType(req.document_type);
    if (normalizedType && req.sales_order_id) {
      const woMap = requirementsByWorkOrder.get(req.sales_order_id);
      if (woMap) {
        woMap.set(normalizedType, {
          id: req.id,
          sales_order_id: req.sales_order_id,
          document_type: req.document_type,
          is_not_required: req.is_not_required,
          not_required_comments: req.not_required_comments,
          marked_by: req.marked_by,
          marked_dt: req.marked_dt,
          created_dt: req.created_dt,
          modified_by: req.modified_by,
          modified_dt: req.modified_dt
        });
      }
    }
  });
  
  // Build statuses for each work order
  const result = new Map<number, DocumentStatus[]>();
  
  salesOrderIds.forEach(salesOrderId => {
    const documentsByType = documentsByWorkOrder.get(salesOrderId) || new Map();
    const requirementsMap = requirementsByWorkOrder.get(salesOrderId) || new Map();
    
    const statuses: DocumentStatus[] = [];
    
    for (const documentType of ALL_DOCUMENT_TYPES) {
      const documents = documentsByType.get(documentType) || [];
      const requirement = requirementsMap.get(documentType);
      
      let status: 'uploaded' | 'not_required' | 'pending';
      if (documents.length > 0) {
        status = 'uploaded';
      } else if (requirement?.is_not_required) {
        status = 'not_required';
      } else {
        status = 'pending';
      }
      
      const statusObj: DocumentStatus = {
        document_type: documentType,
        status,
        documents: documents.length > 0 ? documents : undefined
      };
      
      if (documents.length > 0) {
        // For single-file types, use the first (and only) document
        // For multi-file types, prefer current document, otherwise first
        const currentDoc = isSingleFileType(documentType) 
          ? documents[0] 
          : documents.find(d => d.is_current) || documents[0];
        
        if (currentDoc) {
          statusObj.document_id = currentDoc.id;
          statusObj.file_path = currentDoc.file_path;
          statusObj.document_name = currentDoc.document_name;
          statusObj.submission_date = currentDoc.submission_date;
          statusObj.revision_number = currentDoc.revision_number;
          statusObj.uploaded_by = currentDoc.uploaded_by;
        }
        
        statusObj.documents = documents;
      }
      
      if (requirement?.is_not_required) {
        statusObj.not_required_comments = requirement.not_required_comments;
        statusObj.not_required_marked_by = requirement.marked_by;
        statusObj.not_required_marked_dt = requirement.marked_dt;
      }
      
      statuses.push(statusObj);
    }
    
    result.set(salesOrderId, statuses);
  });
  
  return result;
}

/**
 * Get download URL for a document
 */
export async function getDocumentDownloadUrl(filePath: string): Promise<string> {
  if (!filePath) {
    throw new Error('File path is required');
  }
  
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

/**
 * @deprecated Use uploadDocument instead
 */
export async function uploadStageDocument(
  salesOrderId: number,
  stageCode: string,
  file: File,
  username: string
): Promise<DocumentSubmission> {
  console.warn('uploadStageDocument is deprecated. Use uploadDocument instead.');
  // This won't work with new system, but kept for backward compatibility
  throw new Error('uploadStageDocument is deprecated. Please use uploadDocument with document_type instead.');
}

/**
 * @deprecated Use uploadDocument instead
 */
export async function uploadGeneralDocument(
  salesOrderId: number,
  file: File,
  username: string
): Promise<DocumentSubmission> {
  console.warn('uploadGeneralDocument is deprecated. Use uploadDocument instead.');
  return uploadDocument(salesOrderId, DOCUMENT_TYPES.GENERAL, file, username);
}

/**
 * Get all documents for a specific document type, grouped by work order
 */
export async function getDocumentsByDocumentType(
  documentType: string
): Promise<WorkOrderDocumentGroup[]> {
  const normalizedType = normalizeDocumentType(documentType);
  
  if (!normalizedType) {
    throw new Error('Invalid document type');
  }
  
  // Fetch all documents of this type
  const { data: documents, error: docError } = await supabase
    .from('rnd_document_submissions')
    .select('*')
    .eq('document_type', normalizedType)
    .eq('is_deleted', false)
    .order('submission_date', { ascending: false });
  
  if (docError) {
    throw new Error(`Failed to fetch documents: ${docError.message}`);
  }
  
  if (!documents || documents.length === 0) {
    return [];
  }
  
  // Get unique sales_order_ids
  const salesOrderIds = [...new Set(documents.map(doc => doc.sales_order_id))];
  
  // Fetch work order details
  const { data: workOrders, error: woError } = await supabase
    .from('prdn_wo_details')
    .select('id, wo_no, pwo_no, wo_model, customer_name, wo_date')
    .in('id', salesOrderIds);
  
  if (woError) {
    throw new Error(`Failed to fetch work orders: ${woError.message}`);
  }
  
  // Create a map of work order details
  const workOrderMap = new Map(
    (workOrders || []).map(wo => [wo.id, wo])
  );
  
  // Group documents by sales_order_id
  const documentsByWorkOrder = new Map<number, DocumentSubmission[]>();
  
  (documents || []).forEach((doc: any) => {
    // Map snake_case to camelCase
    const mappedDoc: DocumentSubmission = {
      id: doc.id,
      sales_order_id: doc.sales_order_id,
      document_type: doc.document_type,
      document_name: doc.document_name,
      file_path: doc.file_path,
      file_size: doc.file_size,
      file_type: doc.file_type,
      submission_date: doc.submission_date,
      revised_date: doc.revised_date,
      revision_number: doc.revision_number,
      is_current: doc.is_current !== undefined ? doc.is_current : true,
      is_deleted: doc.is_deleted !== undefined ? doc.is_deleted : false,
      replaced_by_id: doc.replaced_by_id,
      uploaded_by: doc.uploaded_by,
      created_dt: doc.created_dt,
      modified_by: doc.modified_by,
      modified_dt: doc.modified_dt
    };
    
    if (!documentsByWorkOrder.has(mappedDoc.sales_order_id)) {
      documentsByWorkOrder.set(mappedDoc.sales_order_id, []);
    }
    
    // For single-file types, only include current documents
    // For multi-file types, include all documents
    if (isSingleFileType(normalizedType)) {
      if (mappedDoc.is_current) {
        documentsByWorkOrder.set(mappedDoc.sales_order_id, [mappedDoc]);
      }
    } else {
      documentsByWorkOrder.get(mappedDoc.sales_order_id)!.push(mappedDoc);
    }
  });
  
  // Build WorkOrderDocumentGroup array
  const groups: WorkOrderDocumentGroup[] = [];
  
  documentsByWorkOrder.forEach((docs, salesOrderId) => {
    const workOrder = workOrderMap.get(salesOrderId);
    if (workOrder && docs.length > 0) {
      groups.push({
        sales_order_id: salesOrderId,
        wo_no: workOrder.wo_no || '',
        pwo_no: workOrder.pwo_no,
        wo_model: workOrder.wo_model || '',
        customer_name: workOrder.customer_name,
        wo_date: workOrder.wo_date || '',
        documents: docs
      });
    }
  });
  
  // Sort by wo_no
  groups.sort((a, b) => (a.wo_no || '').localeCompare(b.wo_no || ''));
  
  return groups;
}
