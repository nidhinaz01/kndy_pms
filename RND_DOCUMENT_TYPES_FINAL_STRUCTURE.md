# R&D Document Types - Final Database Structure

## Overview

The system now uses:
- **Single table** (`rnd_document_submissions`) for all document types
- **Separate table** (`rnd_document_requirements`) for "Not Required" tracking
- **View** (`rnd_document_status`) for easy status queries

## Database Schema

### Main Table: `rnd_document_submissions`

Stores actual document files (only uploaded documents).

```sql
CREATE TABLE rnd_document_submissions (
    id SERIAL PRIMARY KEY,
    sales_order_id INTEGER NOT NULL REFERENCES prdn_wo_details(id),
    document_type VARCHAR(50) NULL,  -- Document type (see list below)
    document_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    submission_date TIMESTAMP NOT NULL,
    revised_date TIMESTAMP NULL,
    revision_number INTEGER NOT NULL DEFAULT 1,
    is_current BOOLEAN NOT NULL DEFAULT true,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    replaced_by_id INTEGER NULL REFERENCES rnd_document_submissions(id),
    uploaded_by VARCHAR(100) NOT NULL,
    created_dt TIMESTAMP NOT NULL DEFAULT NOW(),
    modified_by VARCHAR(100) NULL,
    modified_dt TIMESTAMP NULL
);
```

**Constraints:**
- `document_type` must be one of the valid types (or NULL for legacy data)
- `file_path` must be provided (documents must have files)
- Unique constraint for single-file types (one current document per type per work order)

### Requirements Table: `rnd_document_requirements`

Tracks "Not Required" status and comments.

```sql
CREATE TABLE rnd_document_requirements (
    id SERIAL PRIMARY KEY,
    sales_order_id INTEGER NOT NULL REFERENCES prdn_wo_details(id),
    document_type VARCHAR(50) NOT NULL,
    is_not_required BOOLEAN NOT NULL DEFAULT FALSE,
    not_required_comments TEXT NULL,
    marked_by VARCHAR(100) NOT NULL,
    marked_dt TIMESTAMP NOT NULL DEFAULT NOW(),
    created_dt TIMESTAMP NOT NULL DEFAULT NOW(),
    modified_by VARCHAR(100) NULL,
    modified_dt TIMESTAMP NULL,
    UNIQUE(sales_order_id, document_type)
);
```

**Constraints:**
- One requirement record per document type per work order
- `not_required_comments` is mandatory when `is_not_required = true`
- Valid document types enforced

## Document Types

### Single-File Types (one document per work order)
1. **Material Checklist**
2. **Platform Drawing**
3. **Seat Layout**
4. **Structure Drawing**

### Multi-File Types (multiple documents allowed)
1. **Bill of Material**
2. **Cutting Profile**
3. **General** (keep at last in UI)

## Status View: `rnd_document_status`

Unified view showing document status for easy querying.

**Status Values:**
- `uploaded` - Document has been uploaded
- `not_required` - Document marked as not required
- `pending` - Neither uploaded nor marked as not required

**Usage:**
```sql
-- Get all document statuses for a work order
SELECT * FROM rnd_document_status 
WHERE sales_order_id = 123
ORDER BY document_type;

-- Get specific document type status
SELECT * FROM rnd_document_status 
WHERE sales_order_id = 123 
  AND document_type = 'Structure Drawing';
```

## Indexes

### Main Table Indexes
- `idx_rnd_doc_submissions_sales_order` - Sales order lookup
- `idx_rnd_doc_submissions_document_type` - Document type queries
- `idx_rnd_doc_submissions_current_type` - Current documents by type
- `idx_rnd_doc_submissions_replaced_by` - Revision tracking
- `idx_unique_current_single_file_document` - Unique constraint for single-file types

### Requirements Table Indexes
- `idx_rnd_doc_requirements_sales_order` - Sales order lookup
- `idx_rnd_doc_requirements_type` - Document type queries
- `idx_rnd_doc_requirements_not_required` - Filtered index for not required

## Common Queries

### 1. Get All Documents for a Work Order
```sql
SELECT * FROM rnd_document_submissions
WHERE sales_order_id = 123
  AND is_deleted = false
  AND is_current = true
ORDER BY document_type;
```

### 2. Get Document Status Overview
```sql
SELECT * FROM rnd_document_status
WHERE sales_order_id = 123
ORDER BY document_type;
```

### 3. Get "Not Required" Documents
```sql
SELECT * FROM rnd_document_requirements
WHERE sales_order_id = 123
  AND is_not_required = true;
```

### 4. Get Pending Documents (need upload or mark as not required)
```sql
SELECT 
    wo.id as sales_order_id,
    dt.document_type
FROM prdn_wo_details wo
CROSS JOIN (
    VALUES 
        ('Bill of Material'),
        ('Cutting Profile'),
        ('General'),
        ('Material Checklist'),
        ('Platform Drawing'),
        ('Seat Layout'),
        ('Structure Drawing')
) dt(document_type)
LEFT JOIN rnd_document_submissions d 
    ON d.sales_order_id = wo.id 
    AND LOWER(TRIM(d.document_type)) = LOWER(TRIM(dt.document_type))
    AND d.is_current = true 
    AND d.is_deleted = false
LEFT JOIN rnd_document_requirements r 
    ON r.sales_order_id = wo.id 
    AND LOWER(TRIM(r.document_type)) = LOWER(TRIM(dt.document_type))
WHERE wo.id = 123
  AND d.id IS NULL  -- No document uploaded
  AND (r.id IS NULL OR r.is_not_required = false);  -- Not marked as not required
```

### 5. Mark Document as "Not Required"
```sql
INSERT INTO rnd_document_requirements (
    sales_order_id,
    document_type,
    is_not_required,
    not_required_comments,
    marked_by
) VALUES (
    123,
    'Structure Drawing',
    true,
    'This work order does not require structure drawing as it is a standard model.',
    'username'
)
ON CONFLICT (sales_order_id, document_type) 
DO UPDATE SET
    is_not_required = true,
    not_required_comments = EXCLUDED.not_required_comments,
    marked_by = EXCLUDED.marked_by,
    marked_dt = NOW(),
    modified_by = EXCLUDED.marked_by,
    modified_dt = NOW();
```

### 6. Upload Document (Single-File Type)
```sql
-- Check if document already exists
SELECT id, revision_number 
FROM rnd_document_submissions
WHERE sales_order_id = 123
  AND LOWER(TRIM(document_type)) = 'structure drawing'
  AND is_current = true
  AND is_deleted = false;

-- If exists, mark old as not current
UPDATE rnd_document_submissions
SET is_current = false,
    revised_date = NOW(),
    modified_by = 'username',
    modified_dt = NOW()
WHERE id = <existing_id>;

-- Insert new document
INSERT INTO rnd_document_submissions (
    sales_order_id,
    document_type,
    document_name,
    file_path,
    file_size,
    file_type,
    submission_date,
    revision_number,
    is_current,
    uploaded_by,
    replaced_by_id
) VALUES (
    123,
    'Structure Drawing',
    'structure_drawing_v2.pdf',
    '123/Structure Drawing/1234567890_structure_drawing_v2.pdf',
    1024000,
    'application/pdf',
    NOW(),
    2,  -- Increment from previous
    true,
    'username',
    <previous_id>  -- Link to previous version
);

-- Remove "Not Required" status if it exists
DELETE FROM rnd_document_requirements
WHERE sales_order_id = 123
  AND LOWER(TRIM(document_type)) = 'structure drawing';
```

### 7. Upload Document (Multi-File Type)
```sql
-- Multi-file types don't need to check for existing documents
-- Just insert new document
INSERT INTO rnd_document_submissions (
    sales_order_id,
    document_type,
    document_name,
    file_path,
    file_size,
    file_type,
    submission_date,
    revision_number,
    is_current,
    uploaded_by
) VALUES (
    123,
    'Bill of Material',
    'bom_part1.pdf',
    '123/Bill of Material/1234567890_bom_part1.pdf',
    512000,
    'application/pdf',
    NOW(),
    1,
    true,
    'username'
);
```

## Application Code Structure

### Type Constants
```typescript
export const DOCUMENT_TYPES = {
  BILL_OF_MATERIAL: 'Bill of Material',
  CUTTING_PROFILE: 'Cutting Profile',
  GENERAL: 'General',
  MATERIAL_CHECKLIST: 'Material Checklist',
  PLATFORM_DRAWING: 'Platform Drawing',
  SEAT_LAYOUT: 'Seat Layout',
  STRUCTURE_DRAWING: 'Structure Drawing'
} as const;

export const SINGLE_FILE_TYPES = [
  DOCUMENT_TYPES.MATERIAL_CHECKLIST,
  DOCUMENT_TYPES.PLATFORM_DRAWING,
  DOCUMENT_TYPES.SEAT_LAYOUT,
  DOCUMENT_TYPES.STRUCTURE_DRAWING
] as const;

export const MULTI_FILE_TYPES = [
  DOCUMENT_TYPES.BILL_OF_MATERIAL,
  DOCUMENT_TYPES.CUTTING_PROFILE,
  DOCUMENT_TYPES.GENERAL
] as const;
```

### Service Functions Needed
1. `uploadDocument(salesOrderId, documentType, file, username)` - Upload document
2. `markAsNotRequired(salesOrderId, documentType, comments, username)` - Mark as not required
3. `getDocumentStatus(salesOrderId, documentType)` - Get status
4. `getAllDocumentStatuses(salesOrderId)` - Get all statuses
5. `deleteDocument(documentId, username)` - Delete document
6. `getDocumentHistory(salesOrderId, documentType)` - Get revision history

## Migration Notes

1. **Existing Data**: The table has been truncated, so no migration of old data needed
2. **Document Type Values**: Use exact values as listed (case-insensitive matching in constraints)
3. **Storage Paths**: Update storage paths to use `document_type` instead of `stage_code`
   - Old: `{sales_order_id}/{stage_code}/{timestamp}_{filename}`
   - New: `{sales_order_id}/{document_type}/{timestamp}_{filename}`

## Next Steps

1. ✅ Database schema complete
2. ⏳ Update application code (TypeScript interfaces, services)
3. ⏳ Update UI components (upload modal, status display)
4. ⏳ Update storage paths
5. ⏳ Test document upload (single and multi-file)
6. ⏳ Test "Not Required" functionality
7. ⏳ Test revision tracking

