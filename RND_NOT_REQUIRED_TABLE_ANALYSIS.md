# "Not Required" Tracking: Separate Table vs Main Table Columns

## The Question

If we're using a **single table** approach for document types, why do we need a **separate table** for "Not Required" status? Shouldn't we just add columns to the main table?

## Two Approaches

### Option 1: Separate Table (`rnd_document_requirements`)

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

-- Main table only has actual documents
CREATE TABLE rnd_document_submissions (
    -- Only actual document records
    -- No "not required" records here
);
```

### Option 2: Columns in Main Table

```sql
CREATE TABLE rnd_document_submissions (
    id SERIAL PRIMARY KEY,
    sales_order_id INTEGER NOT NULL REFERENCES prdn_wo_details(id),
    document_type VARCHAR(50) NOT NULL,
    
    -- Document fields (NULL when not required)
    document_name VARCHAR(255) NULL,
    file_path TEXT NULL,
    file_size BIGINT NULL,
    file_type VARCHAR(100) NULL,
    
    -- Not Required fields
    is_not_required BOOLEAN NOT NULL DEFAULT FALSE,
    not_required_comments TEXT NULL,
    marked_not_required_by VARCHAR(100) NULL,
    marked_not_required_dt TIMESTAMP NULL,
    
    -- Standard fields
    submission_date TIMESTAMP NULL,
    revised_date TIMESTAMP NULL,
    revision_number INTEGER NOT NULL DEFAULT 1,
    is_current BOOLEAN NOT NULL DEFAULT true,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    replaced_by_id INTEGER NULL REFERENCES rnd_document_submissions(id),
    uploaded_by VARCHAR(100) NULL,
    created_dt TIMESTAMP NOT NULL DEFAULT NOW(),
    modified_by VARCHAR(100),
    modified_dt TIMESTAMP,
    
    -- Constraint: Either document OR not required, but not both
    CONSTRAINT chk_document_or_not_required CHECK (
        (is_not_required = true AND file_path IS NULL) OR
        (is_not_required = false AND file_path IS NOT NULL)
    )
);
```

## Detailed Comparison

### Option 1: Separate Table

#### Pros

1. **Conceptual Clarity**
   - ✅ Clear separation: Requirements vs. Actual Documents
   - ✅ `rnd_document_submissions` only contains actual documents
   - ✅ No "fake" document records (records without files)
   - ✅ Easier to understand: "This table has documents, that table has requirements"

2. **Data Integrity**
   - ✅ No NULL file fields in document table
   - ✅ Document table always has valid file data
   - ✅ Requirements table is lightweight (just status + comments)
   - ✅ Can't accidentally query documents and get "not required" records

3. **Query Simplicity**
   - ✅ "Get all documents" = `SELECT * FROM rnd_document_submissions` (no filtering needed)
   - ✅ "Get all requirements" = `SELECT * FROM rnd_document_requirements`
   - ✅ No need to filter out "not required" records when querying documents

4. **Index Efficiency**
   - ✅ Document table indexes don't include "not required" records
   - ✅ Smaller, more focused indexes
   - ✅ Better query performance for document queries

5. **Business Logic**
   - ✅ Requirements and documents are separate concerns
   - ✅ Can mark as "not required" without creating a document record
   - ✅ Can change from "not required" to "uploaded" by creating document record
   - ✅ Clear lifecycle: Requirement → Document (or Requirement → Not Required)

#### Cons

1. **Query Complexity**
   - ❌ Need JOIN to get complete picture: "Show all document statuses"
   - ❌ More complex queries for status overview
   - ❌ Need to handle LEFT JOIN for missing requirements

2. **Data Synchronization**
   - ❌ Need to ensure consistency between tables
   - ❌ What if document exists but requirement says "not required"?
   - ❌ Need application logic to keep them in sync

3. **Transaction Complexity**
   - ❌ Changing from "not required" to "uploaded" requires two operations
   - ❌ Need to delete requirement and create document (or update both)

### Option 2: Columns in Main Table

#### Pros

1. **Simplicity**
   - ✅ Everything in one place
   - ✅ Single source of truth
   - ✅ No JOINs needed for status overview
   - ✅ Simpler queries: "Get all document statuses" = one query

2. **Atomic Operations**
   - ✅ Change from "not required" to "uploaded" = single UPDATE
   - ✅ No need to coordinate between tables
   - ✅ Single transaction

3. **Unified View**
   - ✅ One query shows everything: documents + not required
   - ✅ Easy to get status: `SELECT document_type, is_not_required, file_path FROM ...`
   - ✅ Natural ordering: all statuses together

4. **Less Code**
   - ✅ One service layer
   - ✅ One set of queries
   - ✅ No synchronization logic needed

#### Cons

1. **Conceptual Confusion**
   - ❌ Table contains "documents" but also "not documents"
   - ❌ NULL file fields for "not required" records
   - ❌ Need to filter `WHERE file_path IS NOT NULL` for actual documents
   - ❌ Can accidentally treat "not required" as a document

2. **Data Integrity**
   - ❌ Many NULL fields for "not required" records
   - ❌ Need CHECK constraint to ensure consistency
   - ❌ Risk of inconsistent data (not required but has file_path?)

3. **Query Complexity**
   - ❌ Always need to filter: `WHERE is_not_required = false` for documents
   - ❌ Or: `WHERE file_path IS NOT NULL`
   - ❌ More complex WHERE clauses

4. **Index Bloat**
   - ❌ Indexes include "not required" records
   - ❌ Less efficient for document-only queries
   - ❌ Need filtered indexes for performance

5. **Business Logic**
   - ❌ Mixing concerns: documents and requirements in same table
   - ❌ Harder to reason about: "Is this a document or a requirement?"

## Real-World Usage Patterns

### Common Queries

1. **"Show all documents for a work order"**
   - Option 1: `SELECT * FROM rnd_document_submissions WHERE sales_order_id = X`
   - Option 2: `SELECT * FROM rnd_document_submissions WHERE sales_order_id = X AND is_not_required = false`
   - **Winner: Option 1** (simpler, no filter needed)

2. **"Show document status overview (all types)"**
   - Option 1: 
     ```sql
     SELECT 
       dt.document_type,
       CASE WHEN d.id IS NOT NULL THEN 'Uploaded' 
            WHEN r.is_not_required THEN 'Not Required'
            ELSE 'Pending' END as status
     FROM (VALUES ('Bill of Material'), ('Cutting Profile'), ...) dt(document_type)
     LEFT JOIN rnd_document_submissions d ON ...
     LEFT JOIN rnd_document_requirements r ON ...
     ```
   - Option 2: 
     ```sql
     SELECT document_type, 
            CASE WHEN file_path IS NOT NULL THEN 'Uploaded'
                 WHEN is_not_required THEN 'Not Required'
                 ELSE 'Pending' END as status
     FROM rnd_document_submissions
     WHERE sales_order_id = X
     ```
   - **Winner: Option 2** (simpler query)

3. **"Get all pending documents (need upload)"**
   - Option 1: Need to check both tables (documents that don't exist + requirements that aren't "not required")
   - Option 2: `SELECT * FROM rnd_document_submissions WHERE is_not_required = false AND file_path IS NULL`
   - **Winner: Option 2** (but this query doesn't make sense - if no file, why is there a record?)

## The Key Insight

**"Not Required" is NOT a document - it's a requirement status.**

Think about it:
- A document is: a file that was uploaded
- "Not Required" is: a decision that no document is needed
- These are fundamentally different things

However, for **UI purposes**, you want to show:
- ✅ Uploaded (has file)
- ❌ Not Required (marked as not needed)
- ⏳ Pending (neither uploaded nor marked as not required)

## Recommendation: **Hybrid Approach**

### Best of Both Worlds

Use **separate table** for requirements, but make it easy to query together:

```sql
-- Requirements table (lightweight)
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

-- Documents table (only actual documents)
CREATE TABLE rnd_document_submissions (
    -- Only actual document records
    -- No "not required" records
);

-- View for easy querying
CREATE VIEW rnd_document_status AS
SELECT 
    COALESCE(d.sales_order_id, r.sales_order_id) as sales_order_id,
    COALESCE(d.document_type, r.document_type) as document_type,
    CASE 
        WHEN d.id IS NOT NULL THEN 'uploaded'
        WHEN r.is_not_required THEN 'not_required'
        ELSE 'pending'
    END as status,
    d.id as document_id,
    d.file_path,
    r.not_required_comments,
    r.marked_by as not_required_marked_by,
    r.marked_dt as not_required_marked_dt
FROM (
    SELECT DISTINCT sales_order_id, document_type 
    FROM rnd_document_submissions
    UNION
    SELECT DISTINCT sales_order_id, document_type 
    FROM rnd_document_requirements
) all_types
LEFT JOIN rnd_document_submissions d 
    ON d.sales_order_id = all_types.sales_order_id 
    AND d.document_type = all_types.document_type
    AND d.is_current = true 
    AND d.is_deleted = false
LEFT JOIN rnd_document_requirements r 
    ON r.sales_order_id = all_types.sales_order_id 
    AND r.document_type = all_types.document_type;
```

**Benefits:**
- ✅ Clear separation of concerns
- ✅ Document table only has actual documents
- ✅ Easy to query via view
- ✅ Best performance for document queries
- ✅ Clean data model

## Alternative: Single Table with Smart Design

If you really want single table, make it work well:

```sql
CREATE TABLE rnd_document_submissions (
    id SERIAL PRIMARY KEY,
    sales_order_id INTEGER NOT NULL REFERENCES prdn_wo_details(id),
    document_type VARCHAR(50) NOT NULL,
    
    -- Document fields (NULL when not required)
    document_name VARCHAR(255) NULL,
    file_path TEXT NULL,
    file_size BIGINT NULL,
    file_type VARCHAR(100) NULL,
    
    -- Not Required fields
    is_not_required BOOLEAN NOT NULL DEFAULT FALSE,
    not_required_comments TEXT NULL,
    marked_not_required_by VARCHAR(100) NULL,
    marked_not_required_dt TIMESTAMP NULL,
    
    -- Standard fields
    submission_date TIMESTAMP NULL,
    is_current BOOLEAN NOT NULL DEFAULT true,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    uploaded_by VARCHAR(100) NULL,
    created_dt TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Constraint: Must have either file OR be marked not required
    CONSTRAINT chk_has_file_or_not_required CHECK (
        (file_path IS NOT NULL AND is_not_required = false) OR
        (file_path IS NULL AND is_not_required = true)
    )
);

-- Filtered index for actual documents only
CREATE INDEX idx_rnd_doc_actual_documents 
    ON rnd_document_submissions(sales_order_id, document_type) 
    WHERE file_path IS NOT NULL AND is_not_required = false;

-- Filtered index for not required
CREATE INDEX idx_rnd_doc_not_required 
    ON rnd_document_submissions(sales_order_id, document_type) 
    WHERE is_not_required = true;
```

## Final Recommendation

**Use Separate Table** because:

1. **Conceptual Clarity**: Requirements ≠ Documents
2. **Data Integrity**: Document table only has actual documents
3. **Query Performance**: No need to filter "not required" from document queries
4. **Maintainability**: Clear separation of concerns
5. **Future Flexibility**: Can add requirement-specific fields without affecting documents

**But** make it easy to query together with a view or service layer abstraction.

The slight complexity of JOINs is worth it for the cleaner data model and better performance.

