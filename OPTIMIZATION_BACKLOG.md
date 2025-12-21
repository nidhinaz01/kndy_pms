# Performance Optimization Backlog

> **Note**: These optimizations are deferred until application logic is complete and all flows are stable.

---

## 🎯 High-Impact Optimizations (Deferred)

### 1. Database Index Optimization ⭐⭐⭐
**Status**: ⏸️ Deferred  
**Priority**: High  
**Impact**: 70-95% query performance improvement

**Current State:**
- `prdn_work_planning` table has only 2 indexes
- Missing critical indexes on frequently queried columns
- Queries performing full table scans

**Proposed Solution:**
- Add 6 single-column indexes (stage_code, wo_details_id, from_date, worker_id, derived_sw_code, other_work_code)
- Add 4 composite indexes for common query patterns
- Use partial indexes (WHERE is_deleted = false) for efficiency

**Expected Impact:**
- 70-95% faster queries
- Significantly reduced database load
- Better scalability

**Documentation**: See `TABLE_OPTIMIZATION_ANALYSIS.md` and `database_migration_prdn_work_planning_indexes.sql`

**When to Implement:**
- ✅ After all application logic is complete
- ✅ After all flows are tested and stable
- ✅ When ready to optimize performance

---

### 2. Batch Fetch Work Data Optimization ⭐⭐⭐
**Status**: ⏸️ Deferred  
**Priority**: High  
**Impact**: 88-90% query reduction (8-9 queries → 1 query)

**Current State:**
- `batchFetchWorkData()` executes 8-9 queries per call
- Executed multiple times per user session
- ~250-600ms execution time

**Proposed Solution:**
- Create `get_work_data_batch()` PostgreSQL function
- Combine all queries into single RPC call
- Expected: 50-60% faster execution

**Documentation**: See `BATCH_FETCH_QUERIES_ANALYSIS.md` for complete details

**When to Implement:**
- ✅ After all application logic is complete
- ✅ After all flows are tested and stable
- ✅ When ready to optimize performance

---

### 3. Component Re-render Optimization ⭐⭐
**Status**: ⏸️ Deferred  
**Priority**: Medium  
**Impact**: Fewer unnecessary API calls

**Current State:**
- `WorksTable` re-checks status on every data change
- `checkPlanningStatus()` and `checkWorkStatus()` called unnecessarily

**Proposed Solution:**
- Add memoization to prevent redundant status checks
- Only check when data actually changes

**When to Implement:**
- After batch fetch optimization (if needed)
- If performance issues are noticed

---

### 4. Code Splitting ⭐
**Status**: ⏸️ Deferred  
**Priority**: Low  
**Impact**: Faster initial page load

**Current State:**
- All production code in one bundle
- 24,450 lines of code

**Proposed Solution:**
- Lazy load modals and heavy components
- Split by route/tab

**When to Implement:**
- If bundle size becomes an issue
- If initial load time is a concern

---

## 📊 Current Performance Status

### ✅ Already Optimized:
1. **fetchProductionEmployees**: 154 queries → 4 queries (97% reduction) ✅
2. **fetchProductionWorks (Phase 1)**: 3 queries → 2 RPC calls (33% reduction) ✅
3. **fetchProductionWorks (Phase 2)**: 2 queries → 1 query (50% reduction) ✅
4. **Statistics Functions**: Moved to database (4 functions) ✅
5. **Time Calculations**: Moved to database (2 functions) ✅

### ⏸️ Deferred Optimizations:
1. **Database Indexes**: Add 10 indexes to `prdn_work_planning` (70-95% query speed improvement)
2. **Batch Fetch Work Data**: 8-9 queries → 1 query (88-90% reduction)
3. **Component Re-renders**: Add memoization
4. **Code Splitting**: Lazy load components

---

## 🎯 Implementation Priority (When Ready)

1. **First**: Complete all application logic and flows
2. **Second**: Test and stabilize all functionality
3. **Third**: Add database indexes (quick win, high impact, low risk)
4. **Fourth**: Implement batch fetch optimization (high impact)
5. **Fifth**: Monitor and optimize component re-renders if needed
6. **Sixth**: Consider code splitting if bundle size is an issue

---

## 📝 Notes

- Current performance is acceptable for development/testing
- Optimization can wait until functionality is complete
- All optimization plans are documented and ready to implement
- Focus on completing application logic first

