/**
 * Document Type Constants
 * 
 * Document types in alphabetical order (General kept at last in UI)
 */

export const DOCUMENT_TYPES = {
  BILL_OF_MATERIAL: 'Bill of Material',
  CUTTING_PROFILE: 'Cutting Profile',
  GENERAL: 'General',
  MATERIAL_CHECKLIST: 'Material Checklist',
  PLATFORM_DRAWING: 'Platform Drawing',
  SEAT_LAYOUT: 'Seat Layout',
  STRUCTURE_DRAWING: 'Structure Drawing'
} as const;

export type DocumentType = typeof DOCUMENT_TYPES[keyof typeof DOCUMENT_TYPES];

/**
 * Single-file document types (only one document allowed per work order)
 */
export const SINGLE_FILE_TYPES: readonly DocumentType[] = [
  DOCUMENT_TYPES.MATERIAL_CHECKLIST,
  DOCUMENT_TYPES.PLATFORM_DRAWING,
  DOCUMENT_TYPES.SEAT_LAYOUT,
  DOCUMENT_TYPES.STRUCTURE_DRAWING
] as const;

/**
 * Multi-file document types (multiple documents allowed per work order)
 */
export const MULTI_FILE_TYPES: readonly DocumentType[] = [
  DOCUMENT_TYPES.BILL_OF_MATERIAL,
  DOCUMENT_TYPES.CUTTING_PROFILE,
  DOCUMENT_TYPES.GENERAL
] as const;

/**
 * All document types in alphabetical order (General at last)
 */
export const ALL_DOCUMENT_TYPES: readonly DocumentType[] = [
  DOCUMENT_TYPES.BILL_OF_MATERIAL,
  DOCUMENT_TYPES.CUTTING_PROFILE,
  DOCUMENT_TYPES.MATERIAL_CHECKLIST,
  DOCUMENT_TYPES.PLATFORM_DRAWING,
  DOCUMENT_TYPES.SEAT_LAYOUT,
  DOCUMENT_TYPES.STRUCTURE_DRAWING,
  DOCUMENT_TYPES.GENERAL
] as const;

/**
 * Check if a document type allows multiple files
 */
export function isMultiFileType(documentType: string): boolean {
  return MULTI_FILE_TYPES.includes(documentType as DocumentType);
}

/**
 * Check if a document type allows only single file
 */
export function isSingleFileType(documentType: string): boolean {
  return SINGLE_FILE_TYPES.includes(documentType as DocumentType);
}

/**
 * Normalize document type (trim and handle case-insensitive matching)
 */
export function normalizeDocumentType(documentType: string | null | undefined): string | null {
  if (!documentType) return null;
  const normalized = documentType.trim();
  if (!normalized) return null;
  
  // Find matching type (case-insensitive)
  const found = ALL_DOCUMENT_TYPES.find(
    type => type.toLowerCase() === normalized.toLowerCase()
  );
  
  return found || normalized;
}

