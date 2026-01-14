# R&D Document Type Migration Proposal

## Current System Analysis

### Current Structure
- **Documents tracked by `stage_code`** (e.g., P1S1, P1S2, etc.)
- **`stage_code = NULL`** for general documents
- **Unique constraint**: Only one current document per stage
- **Revision tracking**: Already implemented via `revision_number`, `is_current`, `replaced_by_id`
- **File history**: Tracked through `replaced_by_id` relationship
- **Integration with planning**: `prdn_dates` table tracks planned/actual document release dates per stage

### Current Document Types
- Stage-specific documents (one per stage)
- General documents (multiple allowed, no revision tracking)

## New Requirements

### Document Types (in alphabetical order, General last)
1. **Bill of Material** - Multiple files allowed
2. **Cutting Profile** - Multiple files allowed  
3. **General** - Multiple files allowed (keep at last)
4. **Material Checklist** - Single file only
5. **Platform Drawing** - Single file only
6. **Seat Layout** - Single file only
7. **Structure Drawing** - Single file only

### New Features Required
- **"Not Required" status** with mandatory comments
- **File history tracking** (already exists, verify it works)
- **Multiple file uploads** for: Bill of Material, Cutting Profile, General
- **Single file upload** for: Material Checklist, Platform Drawing, Seat Layout, Structure Drawing

## Database Schema Changes Proposal

### Option 1: Repurpose `stage_code` to `document_type` (Recommended)

**Pros:**
- Clean migration path
- No need for backward compatibility
- Simpler queries

**Cons:**
- Need to migrate existing data
- Need to update all references

**Changes:**
1. Add new column `document_type` VARCHAR(50) NULL
2. Add new column `is_not_required` BOOLEAN DEFAULT FALSE
3. Add new column `not_required_comments` TEXT NULL
4. Migrate existing data:
   - General documents: `document_type = 'General'`
   - Stage documents: Decide if we keep them or migrate
5. Update unique index to work with document types:
   - Single-file types: One current document per type
   - Multi-file types: Multiple current documents allowed
6. Keep `stage_code` for backward compatibility OR remove it after migration

### Option 2: Add `document_type` alongside `stage_code`

**Pros:**
- Backward compatible
- Can support both old and new system during transition

**Cons:**
- More complex queries
- Need to handle both systems
- More maintenance

## Recommended Approach: Option 1 with Migration

### Step 1: Add New Columns
```sql
ALTER TABLE rnd_document_submissions 
  ADD COLUMN document_type VARCHAR(50) NULL,
  ADD COLUMN is_not_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN not_required_comments TEXT NULL;
```

### Step 2: Document Type Values
```sql
-- Document types (in order):
-- 'Bill of Material' - multiple files
-- 'Cutting Profile' - multiple files
-- 'General' - multiple files (last)
-- 'Material Checklist' - single file
-- 'Platform Drawing' - single file
-- 'Seat Layout' - single file
-- 'Structure Drawing' - single file
```

### Step 3: Update Unique Index
```sql
-- Drop old unique index
DROP INDEX IF EXISTS idx_unique_current_stage_document;

-- Create new unique index for single-file document types
-- Only one current document per type for single-file types
CREATE UNIQUE INDEX idx_unique_current_single_file_document 
  ON rnd_document_submissions(sales_order_id, document_type, is_current) 
  WHERE is_current = true 
    AND is_deleted = false 
    AND document_type IN ('Material Checklist', 'Platform Drawing', 'Seat Layout', 'Structure Drawing');

-- Multi-file types (Bill of Material, Cutting Profile, General) don't need unique constraint
-- They can have multiple current documents
```

### Step 4: Update Indexes
```sql
-- Update indexes to use document_type instead of stage_code
CREATE INDEX idx_rnd_doc_submissions_document_type 
  ON rnd_document_submissions(sales_order_id, document_type);

CREATE INDEX idx_rnd_doc_submissions_current_type 
  ON rnd_document_submissions(sales_order_id, document_type, is_current, is_deleted) 
  WHERE is_current = true AND is_deleted = false;
```

### Step 5: Migration Script for Existing Data
```sql
-- Migrate existing general documents
UPDATE rnd_document_submissions 
SET document_type = 'General'
WHERE stage_code IS NULL;

-- For stage-specific documents, decide:
-- Option A: Keep them as-is (if needed for backward compatibility)
-- Option B: Convert to a specific document type or mark for deletion
-- Option C: Archive them separately
```

## File History Tracking

**Current Implementation:**
- ✅ `revision_number` - tracks revision sequence
- ✅ `is_current` - marks current version
- ✅ `replaced_by_id` - links to new version
- ✅ `revised_date` - timestamp of revision

**Verification Needed:**
- Ensure history works for document types (not just stages)
- Update queries to use `document_type` instead of `stage_code`
- Test revision tracking for multi-file types

## "Not Required" Feature

**Implementation:**
- When marking as "Not Required":
  - Set `is_not_required = TRUE`
  - Require `not_required_comments` to be filled
  - Don't create document submission record (or create a special record)
  - Track who marked it and when

**Alternative Approach:**
- Create a separate table `rnd_document_requirements`:
  ```sql
  CREATE TABLE rnd_document_requirements (
    id SERIAL PRIMARY KEY,
    sales_order_id INTEGER NOT NULL REFERENCES prdn_wo_details(id),
    document_type VARCHAR(50) NOT NULL,
    is_not_required BOOLEAN NOT NULL DEFAULT FALSE,
    not_required_comments TEXT NULL,
    marked_by VARCHAR(100) NOT NULL,
    marked_dt TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(sales_order_id, document_type)
  );
  ```

**Recommendation:** Use the separate table approach for cleaner separation of concerns.

## Integration with Planning System

**Current:** `prdn_dates` tracks planned/actual document release dates per stage

**Question:** Do we still need `prdn_dates` entries for document types?
- If yes: Update to use `document_type` instead of `stage_code`
- If no: Remove the dependency or create new tracking mechanism

## Questions to Resolve

1. **What to do with existing stage-based documents?**
   - Migrate to document types?
   - Keep for backward compatibility?
   - Archive separately?

2. **Do we still need `prdn_dates` entries for document types?**
   - Or is document submission date sufficient?

3. **Storage path structure:**
   - Current: `{sales_order_id}/{stage_code}/{timestamp}_{filename}`
   - New: `{sales_order_id}/{document_type}/{timestamp}_{filename}`?

4. **Should "Not Required" be tracked in main table or separate table?**
   - Recommendation: Separate table for cleaner design

## Recommended Database Migration Script

See `database_migration_rnd_document_types.sql` (to be created)

