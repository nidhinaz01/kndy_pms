# Review 3: Complex Data Fetching Functions

## Overview
Two critical functions used daily in production workflows that make multiple sequential queries and perform complex data enrichment in JavaScript.

---

## Function 1: `fetchProductionWorks` ⚠️ **COMPLEX**

### Current Implementation

**File:** `src/lib/api/production/productionWorkFetchService.ts`

**Query Flow:**
1. `getActiveWorkOrders()` → 2 queries (entered + exited work orders)
2. `getWorkStatuses()` → 1 query (work statuses)
3. `batchFetchWorkData()` → 5-6 parallel queries:
   - Work types
   - Work type details
   - Work flow
   - Skill mappings
   - Added works
   - Skill combinations (conditional)
4. Reporting data → 2 queries (standard + non-standard works)
5. JavaScript enrichment → Multiple Map operations, joins, filtering

**Total:** ~10-12 database queries + complex JavaScript processing

### Issues:
1. ❌ **Multiple sequential queries** (can't all be parallelized)
2. ❌ **Complex JavaScript enrichment** (joins, maps, filtering)
3. ❌ **Large data transfer** (fetches all related data, then filters in JS)
4. ❌ **Hard to optimize** (complex business logic)

### Usage:
- **Used in:** `src/routes/production/plant1/p1s2-general/+page.svelte`
- **Frequency:** Daily (production planning workflow)
- **Impact:** High - affects daily operations

---

## Function 2: `fetchProductionEmployees` ⚠️ **N+1 QUERY PROBLEM**

### Current Implementation

**File:** `src/lib/api/production/productionEmployeeFetchService.ts`

**Query Flow:**
1. Shift schedules → 1 query
2. Employees → 1 query
3. Work planning → 1 query
4. Work reporting → 1 query
5. **N+1 Problem:** For each employee:
   - Attendance query (1 per employee)
   - `getEmployeeCurrentStage()` → Additional queries
   - `getEmployeeStageJourney()` → Additional queries

**Total:** 4 + (N × 3) queries where N = number of employees

**Example:** 50 employees = 4 + 150 = **154 queries!**

### Issues:
1. ❌ **Severe N+1 query problem** (queries per employee)
2. ❌ **Sequential processing** (can't parallelize all)
3. ❌ **Large number of round trips** (especially with many employees)
4. ❌ **Performance degrades linearly** with employee count

### Usage:
- **Used in:** `src/routes/production/plant1/p1s2-general/+page.svelte`
- **Frequency:** Daily (manpower management)
- **Impact:** Very High - major performance bottleneck

---

## Optimization Strategy

### Approach 1: **Database Views** (Recommended for fetchProductionWorks)

Create materialized views or regular views that pre-join the data:

```sql
-- View for enriched production works
CREATE OR REPLACE VIEW production_works_enriched AS
SELECT 
  ws.wo_details_id,
  ws.derived_sw_code,
  ws.other_work_code,
  ws.stage_code,
  ws.current_status,
  wo.wo_no,
  wo.wo_model,
  wtd.derived_sw_code,
  wtd.type_description,
  wd.sw_name,
  -- ... all joined fields
FROM prdn_work_status ws
JOIN prdn_wo_details wo ON wo.id = ws.wo_details_id
LEFT JOIN std_work_type_details wtd ON wtd.derived_sw_code = ws.derived_sw_code
LEFT JOIN std_work_details wd ON wd.sw_code = wtd.sw_code
-- ... other joins
WHERE ws.is_deleted = false;

-- Then use function to filter
CREATE OR REPLACE FUNCTION fetch_production_works(
  p_stage VARCHAR,
  p_date DATE
)
RETURNS TABLE (...) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM production_works_enriched
  WHERE stage_code = p_stage
    AND -- date filters
  ORDER BY ...;
END;
$$ LANGUAGE plpgsql;
```

**Benefits:**
- ✅ Single query instead of 10-12
- ✅ Database handles joins efficiently
- ✅ Can use indexes
- ✅ Reduces data transfer

**Complexity:** Medium (requires understanding all joins)

---

### Approach 2: **Batch Queries** (Recommended for fetchProductionEmployees)

Fix the N+1 problem by batching queries:

```sql
-- Batch fetch attendance for all employees
CREATE OR REPLACE FUNCTION fetch_employee_attendance_batch(
  p_emp_ids VARCHAR[],
  p_date DATE,
  p_stage VARCHAR
)
RETURNS TABLE (
  emp_id VARCHAR,
  attendance_status VARCHAR,
  current_stage VARCHAR,
  stage_journey JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.emp_id,
    a.attendance_status,
    -- Calculate current stage
    -- Get stage journey
  FROM hr_attendance a
  WHERE a.emp_id = ANY(p_emp_ids)
    AND a.attendance_date = p_date
    AND a.stage_code = p_stage
    AND a.is_deleted = false;
END;
$$ LANGUAGE plpgsql;
```

**Benefits:**
- ✅ Reduces 154 queries → ~5 queries (for 50 employees)
- ✅ ~97% reduction in queries
- ✅ Much simpler than full database function
- ✅ Can implement incrementally

**Complexity:** Low-Medium (easier than full rewrite)

---

## Recommended Implementation Plan

### Phase 1: Fix N+1 Problem (fetchProductionEmployees) ⭐ **HIGH PRIORITY**

**Why first:**
- Biggest performance issue (154 queries → 5 queries)
- Easier to implement
- Immediate impact

**Steps:**
1. Create batch attendance function
2. Create batch stage journey function
3. Update TypeScript to use batch queries
4. Test with various employee counts

**Estimated Impact:**
- 50 employees: 154 queries → 5 queries (97% reduction)
- 100 employees: 304 queries → 5 queries (98% reduction)

---

### Phase 2: Optimize fetchProductionWorks (Lower Priority)

**Why second:**
- More complex (many joins, business logic)
- Already uses some parallelization
- Less severe performance issue

**Steps:**
1. Create database view for enriched works
2. Create function to filter by stage/date
3. Update TypeScript to use single query
4. Test thoroughly (complex business logic)

**Estimated Impact:**
- 10-12 queries → 1 query (90% reduction)
- Reduced data transfer
- Better performance

---

## Quick Win: Fix N+1 in fetchProductionEmployees

### Current Code (N+1 Problem):
```typescript
const attendancePromises = productionEmployees.map(async (emp) => {
  // Query 1: Attendance (PER EMPLOYEE)
  const { data: attendanceData } = await supabase
    .from('hr_attendance')
    .select('attendance_status')
    .eq('emp_id', emp.emp_id) // ❌ One query per employee
    .eq('attendance_date', date)
    .eq('stage_code', emp.current_stage)
    .eq('is_deleted', false)
    .maybeSingle();

  // Query 2: Current stage (PER EMPLOYEE)
  const currentStage = await getEmployeeCurrentStage(emp.emp_id, date);
  
  // Query 3: Stage journey (PER EMPLOYEE)
  const stageJourney = await getEmployeeStageJourney(emp.emp_id, date);
});
```

### Optimized Code (Batch Queries):
```typescript
// Batch fetch all attendance at once
const empIds = productionEmployees.map(emp => emp.emp_id);
const { data: allAttendance } = await supabase
  .from('hr_attendance')
  .select('emp_id, attendance_status, stage_code')
  .in('emp_id', empIds) // ✅ One query for all employees
  .eq('attendance_date', date)
  .eq('is_deleted', false);

// Batch fetch all stage journeys
const allStageJourneys = await getEmployeeStageJourneysBatch(empIds, date);
const allCurrentStages = await getEmployeeCurrentStagesBatch(empIds, date);

// Map results to employees
const attendanceMap = new Map(allAttendance.map(a => [a.emp_id, a]));
const journeyMap = new Map(allStageJourneys.map(j => [j.emp_id, j]));
const stageMap = new Map(allCurrentStages.map(s => [s.emp_id, s]));

const employeesWithAttendance = productionEmployees.map(emp => ({
  ...emp,
  attendance_status: attendanceMap.get(emp.emp_id)?.attendance_status || null,
  stage_journey: journeyMap.get(emp.emp_id) || [],
  current_stage: stageMap.get(emp.emp_id) || emp.current_stage,
  // ... calculate transfer hours
}));
```

**Impact:**
- 50 employees: 154 queries → 5 queries
- **97% reduction in queries!**

---

## Decision Needed

**Should we:**
1. ✅ **Start with Phase 1** (Fix N+1 in fetchProductionEmployees)?
   - High impact, easier implementation
   - Can show immediate results

2. ⚠️ **Or tackle fetchProductionWorks first?**
   - More complex, but also high impact
   - Requires more planning

3. ⚠️ **Or create batch helper functions first?**
   - Quick win without database functions
   - Can implement in TypeScript

**My Recommendation:** Start with Phase 1 - Fix N+1 problem in `fetchProductionEmployees`. It's the biggest performance issue and easier to fix.

