# Next Optimization Priority

## ✅ Completed Optimizations

1. **Statistics Calculations** - `getWorkOrderStatistics`
   - ✅ Database function created
   - ✅ TypeScript updated
   - **Impact:** 2 queries → 1 query, ~99% data transfer reduction

2. **Time Calculation Functions** - `calculateTotalTimeForMapping`, `getDetailedTimeBreakdownForDerivativeWork`
   - ✅ Database functions created
   - ✅ TypeScript updated
   - **Impact:** 2 queries → 1 query, ~67% code reduction

3. **Complex Data Fetching** - `fetchProductionEmployees`
   - ✅ Optimized with JOINs
   - ✅ N+1 problem fixed
   - **Impact:** 154 queries → 4 queries (97% reduction!)

---

## 🎯 Next Optimization Opportunities

### Option 1: Other Statistics Functions (Quick Wins) ⭐ **RECOMMENDED**

**Similar pattern to what we just did - easy to implement!**

#### 1. `getWorkOrderStageOrderStats`
- **File:** `src/lib/api/planning/planningWorkOrderStageOrderService.ts:109`
- **Current:** Fetches all records, then counts/groups in JavaScript
- **Pattern:** Same as `getWorkOrderStatistics` (we know how to do this!)
- **Impact:** Medium (used in planning workflows)

#### 2. `getProductionPlanStats`
- **File:** `src/lib/api/planning/planningProductionPlanService.ts:105`
- **Current:** 2 queries, then calculates in JavaScript
- **Pattern:** Similar to statistics functions
- **Impact:** Medium (used in production planning)

#### 3. `getHolidayStats`
- **File:** `src/lib/api/planning/planningHolidayService.ts:84`
- **Current:** Fetches all holidays, then groups/counts in JavaScript
- **Pattern:** Same as other statistics functions
- **Impact:** Low-Medium (used in holiday management)

**Why this is best next:**
- ✅ **Same pattern** - We've done this before
- ✅ **Quick to implement** - Can do all 3 in one go
- ✅ **Low risk** - Similar to what we already tested
- ✅ **Good practice** - Reinforces the pattern

**Estimated time:** 1-2 hours for all 3

---

### Option 2: Optimize `fetchProductionWorks` (More Complex)

**File:** `src/lib/api/production/productionWorkFetchService.ts`

**Current Issues:**
- 10-12 sequential queries
- Complex JavaScript enrichment
- Multiple helper functions

**Complexity:** High
- Many joins and business logic
- Already uses some parallelization
- Would require database views or complex functions

**Impact:** High (used daily in production)
**Time:** 3-4 hours (more complex)

---

### Option 3: Import Functions (Low Priority)

**Status:** Skipped for now
- Used infrequently
- High complexity
- Lower priority

---

## Recommendation: Option 1 - Other Statistics Functions ⭐

**Why:**
1. ✅ **Quick wins** - Same pattern we've mastered
2. ✅ **Low risk** - Similar to what we already did
3. ✅ **Good momentum** - Build on success
4. ✅ **Can batch** - Do all 3 together

**Implementation Plan:**
1. Create database function for `getWorkOrderStageOrderStats`
2. Create database function for `getProductionPlanStats`
3. Create database function for `getHolidayStats`
4. Update all 3 TypeScript functions
5. Test all 3

**After this, we can tackle `fetchProductionWorks` which is more complex.**

---

## Summary

**Next Optimization:** Other Statistics Functions (3 functions)
- `getWorkOrderStageOrderStats`
- `getProductionPlanStats`
- `getHolidayStats`

**Why:** Quick wins, same pattern, low risk, good impact

**After that:** `fetchProductionWorks` (more complex, but high impact)

