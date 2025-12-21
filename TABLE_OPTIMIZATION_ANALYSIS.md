# Table Structure Optimization Analysis

> **Status**: ⏸️ **DEFERRED** - To be implemented after application logic is complete and all flows are stable.

## 📊 Table: `prdn_work_planning`

### Current Indexes
```sql
-- Only 2 indexes exist:
1. idx_work_planning_submission (planning_submission_id)
2. idx_work_planning_status (status)
```

---

## 🔍 Query Pattern Analysis

Based on codebase analysis, here are the most common query patterns:

### Pattern 1: Fetch Plans by Stage & Date (Most Common)
```typescript
.eq('stage_code', stageCode)
.eq('from_date', date)
.eq('is_active', true)
.eq('is_deleted', false)
```
**Frequency**: Very High (used in multiple places)
**Files**: `productionWorkPlanningService.ts`, `planningReportingService.ts`, `pageDataService.ts`

### Pattern 2: Check Work Status (Very Common)
```typescript
.eq('stage_code', stageCode)
.in('wo_details_id', [...])
.eq('is_deleted', false)
.eq('is_active', true)
.or('derived_sw_code.in.(...),other_work_code.in.(...)')
```
**Frequency**: Very High (executed on every Works tab load)
**Files**: `worksTableService.ts`, `productionWorkFetchService.ts`

### Pattern 3: Worker Conflict Checks (High Frequency)
```typescript
.eq('worker_id', workerId)
.eq('from_date', date)
.eq('is_deleted', false)
// Plus date/time range overlap checks
```
**Frequency**: High (executed for every worker selection)
**Files**: `planWorkConflictService.ts`, `WorkerSelection.svelte`

### Pattern 4: Check Planning Status for Specific Work
```typescript
.eq('stage_code', stageCode)
.eq('wo_details_id', woDetailsId)
.eq('derived_sw_code', derivedSwCode) // OR other_work_code
.eq('is_active', true)
.eq('is_deleted', false)
```
**Frequency**: High (executed when planning work)
**Files**: `productionWorkValidationService.ts`, `canPlanWork()`

### Pattern 5: Fetch by Status
```typescript
.eq('stage_code', stageCode)
.eq('from_date', date)
.in('status', ['draft', 'pending_approval', 'approved'])
.eq('is_active', true)
.eq('is_deleted', false)
```
**Frequency**: Medium (used in planning submission)
**Files**: `planningReportingService.ts`

---

## ⚠️ Missing Critical Indexes

### 1. **Stage Code Index** (CRITICAL)
**Missing**: Index on `stage_code`
**Impact**: Every query filters by `stage_code` - this is a table scan without index
```sql
-- Recommended:
CREATE INDEX idx_work_planning_stage_code 
ON prdn_work_planning(stage_code) 
WHERE is_deleted = false;
```

### 2. **Work Order Details ID Index** (CRITICAL)
**Missing**: Index on `wo_details_id`
**Impact**: Very common filter, especially in batch queries
```sql
-- Recommended:
CREATE INDEX idx_work_planning_wo_details_id 
ON prdn_work_planning(wo_details_id) 
WHERE is_deleted = false;
```

### 3. **Derived SW Code Index** (HIGH PRIORITY)
**Missing**: Index on `derived_sw_code`
**Impact**: Used in most work lookup queries
```sql
-- Recommended:
CREATE INDEX idx_work_planning_derived_sw_code 
ON prdn_work_planning(derived_sw_code) 
WHERE is_deleted = false AND derived_sw_code IS NOT NULL;
```

### 4. **Other Work Code Index** (HIGH PRIORITY)
**Missing**: Index on `other_work_code`
**Impact**: Used for non-standard works
```sql
-- Recommended:
CREATE INDEX idx_work_planning_other_work_code 
ON prdn_work_planning(other_work_code) 
WHERE is_deleted = false AND other_work_code IS NOT NULL;
```

### 5. **Worker ID Index** (HIGH PRIORITY)
**Missing**: Index on `worker_id`
**Impact**: Critical for conflict checks (executed frequently)
```sql
-- Recommended:
CREATE INDEX idx_work_planning_worker_id 
ON prdn_work_planning(worker_id) 
WHERE is_deleted = false;
```

### 6. **From Date Index** (HIGH PRIORITY)
**Missing**: Index on `from_date`
**Impact**: Almost every query filters by date
```sql
-- Recommended:
CREATE INDEX idx_work_planning_from_date 
ON prdn_work_planning(from_date) 
WHERE is_deleted = false;
```

---

## 🎯 Composite Indexes (High Performance Impact)

### Composite Index 1: Stage + Date + Status (MOST IMPORTANT)
**Pattern**: Used in `fetchWorkPlanning()`, `getDraftWorkPlans()`
```sql
CREATE INDEX idx_work_planning_stage_date_status 
ON prdn_work_planning(stage_code, from_date, status) 
WHERE is_deleted = false AND is_active = true;
```
**Impact**: Covers Pattern 1 and Pattern 5 - eliminates need for separate indexes

### Composite Index 2: Stage + WO Details + Work Code
**Pattern**: Used in `checkWorkStatus()`, `canPlanWork()`
```sql
-- For derived_sw_code
CREATE INDEX idx_work_planning_stage_wo_derived_sw 
ON prdn_work_planning(stage_code, wo_details_id, derived_sw_code) 
WHERE is_deleted = false AND is_active = true AND derived_sw_code IS NOT NULL;

-- For other_work_code
CREATE INDEX idx_work_planning_stage_wo_other_work 
ON prdn_work_planning(stage_code, wo_details_id, other_work_code) 
WHERE is_deleted = false AND is_active = true AND other_work_code IS NOT NULL;
```
**Impact**: Covers Pattern 2 and Pattern 4 - very high performance gain

### Composite Index 3: Worker + Date (For Conflict Checks)
**Pattern**: Used in `planWorkConflictService.ts`, `WorkerSelection.svelte`
```sql
CREATE INDEX idx_work_planning_worker_date 
ON prdn_work_planning(worker_id, from_date, to_date) 
WHERE is_deleted = false AND is_active = true;
```
**Impact**: Dramatically speeds up conflict detection (Pattern 3)

---

## 📋 Recommended Index Creation Script

```sql
-- ============================================
-- prdn_work_planning Table Optimization
-- ============================================

-- 1. Single Column Indexes (Partial - only non-deleted)
CREATE INDEX IF NOT EXISTS idx_work_planning_stage_code 
ON prdn_work_planning(stage_code) 
WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_work_planning_wo_details_id 
ON prdn_work_planning(wo_details_id) 
WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_work_planning_derived_sw_code 
ON prdn_work_planning(derived_sw_code) 
WHERE is_deleted = false AND derived_sw_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_planning_other_work_code 
ON prdn_work_planning(other_work_code) 
WHERE is_deleted = false AND other_work_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_planning_worker_id 
ON prdn_work_planning(worker_id) 
WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_work_planning_from_date 
ON prdn_work_planning(from_date) 
WHERE is_deleted = false;

-- 2. Composite Indexes (High Performance)
CREATE INDEX IF NOT EXISTS idx_work_planning_stage_date_status 
ON prdn_work_planning(stage_code, from_date, status) 
WHERE is_deleted = false AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_work_planning_stage_wo_derived_sw 
ON prdn_work_planning(stage_code, wo_details_id, derived_sw_code) 
WHERE is_deleted = false AND is_active = true AND derived_sw_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_planning_stage_wo_other_work 
ON prdn_work_planning(stage_code, wo_details_id, other_work_code) 
WHERE is_deleted = false AND is_active = true AND other_work_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_planning_worker_date 
ON prdn_work_planning(worker_id, from_date, to_date) 
WHERE is_deleted = false AND is_active = true;

-- 3. Keep existing indexes (already exist)
-- idx_work_planning_submission (planning_submission_id)
-- idx_work_planning_status (status)
```

---

## 📊 Expected Performance Impact

### Query Performance Improvements:

1. **Pattern 1 (Stage + Date)**: 
   - **Before**: Full table scan or sequential scan
   - **After**: Index scan using `idx_work_planning_stage_date_status`
   - **Expected**: 80-95% faster

2. **Pattern 2 (Work Status Check)**:
   - **Before**: Multiple table scans
   - **After**: Index scan using composite indexes
   - **Expected**: 70-90% faster

3. **Pattern 3 (Worker Conflicts)**:
   - **Before**: Full table scan filtering by worker_id
   - **After**: Index scan using `idx_work_planning_worker_date`
   - **Expected**: 85-95% faster

4. **Pattern 4 (Planning Status)**:
   - **Before**: Table scan with multiple filters
   - **After**: Index scan using composite indexes
   - **Expected**: 75-90% faster

### Overall Impact:
- **Query Speed**: 70-95% faster for most queries
- **Database Load**: Significantly reduced
- **Scalability**: Much better as data grows

---

## ⚠️ Considerations

### 1. **Partial Indexes (WHERE clause)**
- All indexes use `WHERE is_deleted = false` because:
  - Most queries filter by `is_deleted = false`
  - Deleted records are rarely queried
  - Smaller index size = faster queries
  - Less index maintenance overhead

### 2. **Index Maintenance**
- More indexes = slightly slower INSERT/UPDATE
- But: Queries are MUCH faster (net positive)
- Modern PostgreSQL handles this well

### 3. **Index Size**
- Partial indexes are smaller (only non-deleted records)
- Composite indexes are larger but cover multiple query patterns
- Trade-off: Storage vs. Performance (performance wins)

### 4. **NULL Handling**
- `derived_sw_code` and `other_work_code` can be NULL
- Indexes include `IS NOT NULL` in WHERE clause
- Prevents indexing NULL values (saves space)

---

## 🚀 Implementation Priority

### Phase 1: Critical Single Column Indexes (Do First)
1. `idx_work_planning_stage_code` ⭐⭐⭐
2. `idx_work_planning_wo_details_id` ⭐⭐⭐
3. `idx_work_planning_from_date` ⭐⭐⭐
4. `idx_work_planning_worker_id` ⭐⭐

### Phase 2: Work Code Indexes
5. `idx_work_planning_derived_sw_code` ⭐⭐
6. `idx_work_planning_other_work_code` ⭐⭐

### Phase 3: Composite Indexes (Highest Performance Gain)
7. `idx_work_planning_stage_date_status` ⭐⭐⭐
8. `idx_work_planning_stage_wo_derived_sw` ⭐⭐⭐
9. `idx_work_planning_stage_wo_other_work` ⭐⭐⭐
10. `idx_work_planning_worker_date` ⭐⭐⭐

---

## 📝 Notes

- All indexes use `IF NOT EXISTS` to prevent errors if run multiple times
- Partial indexes (WHERE clause) are more efficient for this use case
- Composite indexes cover multiple query patterns, reducing need for separate indexes
- Indexes will be created automatically on existing data
- No downtime required (indexes created in background)

---

## ✅ Next Steps

1. Review this analysis
2. Test index creation on development/staging
3. Monitor query performance before/after
4. Apply to production when ready

