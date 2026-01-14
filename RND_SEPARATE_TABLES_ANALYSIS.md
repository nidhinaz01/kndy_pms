# Separate Tables vs Single Table: Detailed Analysis

## Overview

You're asking whether to create separate tables for each document type (7 tables) vs. using a single table with a `document_type` discriminator column. This is a fundamental database design decision that will impact the entire system.

## Option A: Separate Tables (Table-Per-Type)

### Structure
```sql
-- 7 separate tables, one for each document type
CREATE TABLE rnd_bill_of_material (
    id SERIAL PRIMARY KEY,
    sales_order_id INTEGER NOT NULL REFERENCES prdn_wo_details(id),
    document_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    submission_date TIMESTAMP NOT NULL,
    revised_date TIMESTAMP NULL,
    revision_number INTEGER NOT NULL DEFAULT 1,
    is_current BOOLEAN NOT NULL DEFAULT true,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    replaced_by_id INTEGER NULL REFERENCES rnd_bill_of_material(id),
    uploaded_by VARCHAR(100) NOT NULL,
    created_dt TIMESTAMP NOT NULL DEFAULT NOW(),
    modified_by VARCHAR(100),
    modified_dt TIMESTAMP
);

CREATE TABLE rnd_cutting_profile (
    -- Same structure as above
    replaced_by_id INTEGER NULL REFERENCES rnd_cutting_profile(id),
    ...
);

-- ... and so on for all 7 types
```

### Pros

#### 1. **Type Safety & Data Integrity**
- ✅ **Stronger constraints**: Each table can have type-specific constraints
- ✅ **No invalid types**: Database enforces valid document types at schema level
- ✅ **Type-specific columns**: Can add columns unique to each type without affecting others
  - Example: `rnd_cutting_profile` could have `profile_version` column
  - Example: `rnd_bill_of_material` could have `bom_revision_date` column
- ✅ **Referential integrity**: `replaced_by_id` can only reference same type (enforced by FK)

#### 2. **Query Performance**
- ✅ **Smaller indexes**: Each table has smaller, more focused indexes
- ✅ **Better query plans**: PostgreSQL can optimize queries per table
- ✅ **No type filtering**: Queries don't need `WHERE document_type = 'X'` clauses
- ✅ **Table partitioning potential**: Can partition large tables independently
- ✅ **Index efficiency**: Single-file types can have unique constraints, multi-file types don't

#### 3. **Code Organization**
- ✅ **Type-specific logic**: Each type can have its own service functions
- ✅ **Clearer interfaces**: `uploadBillOfMaterial()` vs `uploadDocument(type, file)`
- ✅ **Type-specific validation**: Can validate differently per type
- ✅ **Easier to understand**: Code structure mirrors data structure

#### 4. **Maintenance & Evolution**
- ✅ **Independent evolution**: Can add columns to one type without affecting others
- ✅ **Type-specific migrations**: Migrations are isolated per type
- ✅ **Easier to deprecate**: Can deprecate a type without touching others
- ✅ **Clear ownership**: Each table has clear purpose

#### 5. **Business Logic Separation**
- ✅ **Different rules per type**: Single-file vs multi-file logic is enforced at DB level
- ✅ **Type-specific workflows**: Can have different approval processes
- ✅ **Independent lifecycle**: Each type can have different retention policies

### Cons

#### 1. **Code Duplication**
- ❌ **Repeated code**: Same CRUD operations for each table
- ❌ **Service layer complexity**: Need generic functions or type-specific functions
- ❌ **UI components**: May need separate components or complex generic ones
- ❌ **Maintenance overhead**: Bug fixes need to be applied to multiple tables

#### 2. **Cross-Type Queries**
- ❌ **Complex aggregations**: "Get all documents for a work order" requires UNION
  ```sql
  SELECT * FROM rnd_bill_of_material WHERE sales_order_id = 123
  UNION ALL
  SELECT * FROM rnd_cutting_profile WHERE sales_order_id = 123
  UNION ALL
  -- ... 5 more UNIONs
  ```
- ❌ **Reporting complexity**: Reports across types are more complex
- ❌ **Search across types**: Need to search all 7 tables
- ❌ **Statistics**: Harder to get aggregate statistics

#### 3. **Schema Changes**
- ❌ **Multiple migrations**: Adding a column requires 7 ALTER TABLE statements
- ❌ **Synchronization risk**: Risk of tables getting out of sync
- ❌ **Migration complexity**: Need to ensure all tables are updated consistently

#### 4. **Storage & Indexes**
- ❌ **More indexes**: Each table needs its own set of indexes
- ❌ **Storage overhead**: More table metadata, though minimal
- ❌ **Index maintenance**: More indexes to maintain and optimize

#### 5. **Application Complexity**
- ❌ **Dynamic table selection**: Need to determine which table to query
- ❌ **Generic service layer**: Need abstraction layer to handle all types
- ❌ **Type mapping**: Need to map document types to table names
- ❌ **Transaction complexity**: Cross-type operations need careful handling

## Option B: Single Table with Type Discriminator

### Structure
```sql
CREATE TABLE rnd_document_submissions (
    id SERIAL PRIMARY KEY,
    sales_order_id INTEGER NOT NULL REFERENCES prdn_wo_details(id),
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
        'Bill of Material', 'Cutting Profile', 'General',
        'Material Checklist', 'Platform Drawing', 'Seat Layout', 'Structure Drawing'
    )),
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
    modified_by VARCHAR(100),
    modified_dt TIMESTAMP
);

-- Unique constraint for single-file types only
CREATE UNIQUE INDEX idx_unique_single_file_document 
    ON rnd_document_submissions(sales_order_id, document_type, is_current) 
    WHERE is_current = true 
      AND is_deleted = false 
      AND document_type IN ('Material Checklist', 'Platform Drawing', 'Seat Layout', 'Structure Drawing');
```

### Pros

#### 1. **Simplicity**
- ✅ **Single source of truth**: All documents in one place
- ✅ **Unified queries**: Easy to query all documents
- ✅ **Simple aggregations**: COUNT, SUM, AVG across all types
- ✅ **Consistent schema**: One schema to maintain

#### 2. **Code Reusability**
- ✅ **Generic functions**: One set of CRUD functions
- ✅ **Shared components**: UI components can be generic
- ✅ **DRY principle**: No code duplication
- ✅ **Easier testing**: Test once, works for all types

#### 3. **Cross-Type Operations**
- ✅ **Easy reporting**: "All documents for work order" is simple
- ✅ **Unified search**: Search across all types easily
- ✅ **Statistics**: Aggregate statistics are straightforward
- ✅ **History tracking**: Unified history view

#### 4. **Schema Evolution**
- ✅ **Single migration**: Add column once, applies to all
- ✅ **Consistent changes**: Schema changes affect all types uniformly
- ✅ **Less risk**: No synchronization issues

#### 5. **Flexibility**
- ✅ **Easy to add types**: Just add to CHECK constraint
- ✅ **Type-agnostic code**: Code doesn't need to know about types
- ✅ **Dynamic type handling**: Can add types without code changes

### Cons

#### 1. **Type Safety**
- ❌ **Runtime validation**: Type checking happens at runtime, not schema level
- ❌ **No type-specific columns**: Can't easily add type-specific fields
- ❌ **Weaker constraints**: Can't enforce type-specific rules easily

#### 2. **Query Performance**
- ❌ **Type filtering overhead**: Always need `WHERE document_type = 'X'`
- ❌ **Larger indexes**: Single table means larger indexes
- ❌ **Less optimal plans**: PostgreSQL may not optimize as well
- ❌ **Index bloat**: All types share same index space

#### 3. **Complex Constraints**
- ❌ **Partial unique indexes**: Need complex WHERE clauses for single-file types
- ❌ **Type-specific rules**: Hard to enforce different rules per type
- ❌ **Constraint complexity**: Unique constraints are more complex

#### 4. **Code Complexity**
- ❌ **Type checking**: Need to check type in application code
- ❌ **Type-specific logic**: Need conditional logic based on type
- ❌ **Validation complexity**: Different validation per type in code

## Hybrid Approach: Single Table + Type-Specific Views

### Structure
```sql
-- Base table
CREATE TABLE rnd_document_submissions (
    -- All common fields
);

-- Type-specific views for convenience
CREATE VIEW rnd_bill_of_material AS
    SELECT * FROM rnd_document_submissions 
    WHERE document_type = 'Bill of Material';

CREATE VIEW rnd_cutting_profile AS
    SELECT * FROM rnd_document_submissions 
    WHERE document_type = 'Cutting Profile';
```

**Pros:**
- Best of both worlds
- Single table for queries
- Type-specific views for convenience

**Cons:**
- Views don't solve the fundamental issues
- Still need type filtering
- Adds complexity without major benefit

## Recommendation: **Single Table with Type Discriminator**

### Why?

1. **Your Use Case**: All document types share the same structure and behavior
   - Same fields (file_path, file_size, etc.)
   - Same revision tracking logic
   - Same history tracking
   - Same upload/download process
   - Only difference: single vs multiple files (handled by unique constraint)

2. **Query Patterns**: You'll likely need cross-type queries
   - "Show all documents for a work order" (common UI requirement)
   - "Get document status summary" (pending/completed tracking)
   - "Search across all document types"
   - These are much easier with a single table

3. **Maintenance**: Single table is easier to maintain
   - One place to fix bugs
   - One place to add features
   - Consistent behavior across types

4. **Code Simplicity**: Generic code is simpler
   - One service layer
   - One set of components
   - Less code to maintain

5. **Future Flexibility**: Easier to add new types
   - Just add to CHECK constraint
   - No new tables to create
   - No new code paths

### When Separate Tables Make Sense

Separate tables would be better if:
- ✅ Types have **fundamentally different structures** (different columns)
- ✅ Types have **completely different business logic**
- ✅ Types are **rarely queried together**
- ✅ Types have **different access patterns** (some read-heavy, some write-heavy)
- ✅ Types need **independent scaling** (partitioning strategies)

**Your case**: All types share the same structure and are frequently queried together, so single table is better.

## Implementation Recommendation

### Single Table with Smart Constraints

```sql
-- Main table
CREATE TABLE rnd_document_submissions (
    id SERIAL PRIMARY KEY,
    sales_order_id INTEGER NOT NULL REFERENCES prdn_wo_details(id),
    document_type VARCHAR(50) NOT NULL,
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
    modified_by VARCHAR(100),
    modified_dt TIMESTAMP,
    
    -- Constraint to ensure valid document types
    CONSTRAINT chk_valid_document_type CHECK (document_type IN (
        'Bill of Material', 'Cutting Profile', 'General',
        'Material Checklist', 'Platform Drawing', 'Seat Layout', 'Structure Drawing'
    ))
);

-- Unique constraint for single-file types only
CREATE UNIQUE INDEX idx_unique_single_file_document 
    ON rnd_document_submissions(sales_order_id, document_type, is_current) 
    WHERE is_current = true 
      AND is_deleted = false 
      AND document_type IN ('Material Checklist', 'Platform Drawing', 'Seat Layout', 'Structure Drawing');

-- Indexes for performance
CREATE INDEX idx_rnd_doc_sales_order_type 
    ON rnd_document_submissions(sales_order_id, document_type);

CREATE INDEX idx_rnd_doc_current_type 
    ON rnd_document_submissions(sales_order_id, document_type, is_current, is_deleted) 
    WHERE is_current = true AND is_deleted = false;
```

### Code Organization

```typescript
// Type-safe constants
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

// Generic service functions
export async function uploadDocument(
  salesOrderId: number,
  documentType: string,
  file: File,
  username: string
): Promise<DocumentSubmission> {
  // Single implementation for all types
  // Handles single-file vs multi-file logic
}
```

## Final Verdict

**Use a Single Table** because:
1. All types share identical structure
2. Cross-type queries are common
3. Easier to maintain and evolve
4. Simpler codebase
5. Better for your specific use case

**Consider Separate Tables** only if:
- Types develop fundamentally different structures
- Types need independent scaling
- Types have completely different access patterns

## Migration Path

If you choose single table:
1. Add `document_type` column to existing table
2. Migrate existing data (general → 'General', stages → decide)
3. Update unique constraints
4. Update application code
5. Remove `stage_code` column (or keep for backward compatibility)

If you choose separate tables:
1. Create 7 new tables
2. Migrate data to appropriate tables
3. Create type-specific service functions
4. Update UI to handle multiple tables
5. Much more complex migration

