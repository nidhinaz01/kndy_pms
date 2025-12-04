# Batch Helper Functions - Two Approaches

## Question: Will batch helper functions call database functions?

**Answer: No, not necessarily. There are two approaches:**

---

## Approach 1: TypeScript Batch Helpers (Recommended - Simpler) ✅

**No database functions needed!** Just use Supabase's `.in()` operator to batch queries.

### Current Code (N+1 Problem):
```typescript
// ❌ One query per employee
const attendancePromises = productionEmployees.map(async (emp) => {
  const { data } = await supabase
    .from('hr_attendance')
    .select('attendance_status')
    .eq('emp_id', emp.emp_id)  // Individual query
    .eq('attendance_date', date)
    .maybeSingle();
});
```

### Batch Helper (TypeScript Only):
```typescript
// ✅ One query for all employees
export async function getEmployeeAttendanceBatch(
  empIds: string[],
  date: string,
  stage: string
): Promise<Map<string, string | null>> {
  const { data, error } = await supabase
    .from('hr_attendance')
    .select('emp_id, attendance_status')
    .in('emp_id', empIds)  // Batch query - no database function needed!
    .eq('attendance_date', date)
    .eq('stage_code', stage)
    .eq('is_deleted', false);

  if (error) throw error;

  const map = new Map<string, string | null>();
  (data || []).forEach(att => {
    map.set(att.emp_id, att.attendance_status);
  });
  return map;
}
```

**Benefits:**
- ✅ No database functions needed
- ✅ Simple to implement
- ✅ Uses standard Supabase queries
- ✅ Easy to test and debug
- ✅ Still reduces 154 queries → 5 queries

**Usage:**
```typescript
// Instead of N queries, just one batch query
const empIds = productionEmployees.map(emp => emp.emp_id);
const attendanceMap = await getEmployeeAttendanceBatch(empIds, date, stage);

// Then map to employees
const employeesWithAttendance = productionEmployees.map(emp => ({
  ...emp,
  attendance_status: attendanceMap.get(emp.emp_id) || null
}));
```

---

## Approach 2: Database Functions (More Complex)

**Create PostgreSQL functions that handle batching in the database.**

### Database Function:
```sql
CREATE OR REPLACE FUNCTION get_employee_attendance_batch(
  p_emp_ids VARCHAR[],
  p_date DATE,
  p_stage VARCHAR
)
RETURNS TABLE (
  emp_id VARCHAR,
  attendance_status VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.emp_id,
    a.attendance_status
  FROM hr_attendance a
  WHERE a.emp_id = ANY(p_emp_ids)
    AND a.attendance_date = p_date
    AND a.stage_code = p_stage
    AND a.is_deleted = false;
END;
$$ LANGUAGE plpgsql;
```

### TypeScript Call:
```typescript
export async function getEmployeeAttendanceBatch(
  empIds: string[],
  date: string,
  stage: string
): Promise<Map<string, string | null>> {
  const { data, error } = await supabase.rpc('get_employee_attendance_batch', {
    p_emp_ids: empIds,
    p_date: date,
    p_stage: stage
  });

  if (error) throw error;

  const map = new Map<string, string | null>();
  (data || []).forEach(att => {
    map.set(att.emp_id, att.attendance_status);
  });
  return map;
}
```

**Benefits:**
- ✅ Database handles the query optimization
- ✅ Can add complex logic in database
- ✅ Potentially faster for very large datasets

**Drawbacks:**
- ❌ Requires database migration
- ❌ More complex to implement
- ❌ Harder to test and debug
- ❌ Overkill for simple batch queries

---

## Comparison

| Aspect | TypeScript Batch Helpers | Database Functions |
|--------|-------------------------|---------------------|
| **Complexity** | Low ✅ | Medium-High |
| **Implementation Time** | 1-2 hours | 3-4 hours |
| **Database Migration** | Not needed ✅ | Required |
| **Testing** | Easy ✅ | More complex |
| **Performance** | Good (uses `.in()`) | Slightly better |
| **Maintainability** | Easy ✅ | More complex |
| **Query Reduction** | 154 → 5 queries ✅ | 154 → 1 query |

---

## Recommendation: TypeScript Batch Helpers ✅

**Why:**
1. ✅ **Much simpler** - No database functions needed
2. ✅ **Faster to implement** - Can do it now
3. ✅ **Still huge performance gain** - 97% query reduction
4. ✅ **Easier to maintain** - Standard TypeScript code
5. ✅ **Easier to test** - No database setup needed

**The `.in()` operator in Supabase already batches the query efficiently!**

---

## Implementation Plan

### Step 1: Create TypeScript Batch Helper Functions

**File:** `src/lib/api/production/productionEmployeeBatchHelpers.ts`

```typescript
import { supabase } from '$lib/supabaseClient';

// Batch fetch attendance for all employees
export async function getEmployeeAttendanceBatch(
  empIds: string[],
  date: string,
  stage: string
): Promise<Map<string, string | null>> {
  if (empIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('hr_attendance')
    .select('emp_id, attendance_status')
    .in('emp_id', empIds)
    .eq('attendance_date', date)
    .eq('stage_code', stage)
    .eq('is_deleted', false);

  if (error) throw error;

  const map = new Map<string, string | null>();
  (data || []).forEach(att => {
    map.set(att.emp_id, att.attendance_status);
  });
  return map;
}

// Batch fetch current stages for all employees
export async function getEmployeeCurrentStagesBatch(
  empIds: string[],
  date: string
): Promise<Map<string, string | null>> {
  if (empIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('hr_stage_reassignment')
    .select('emp_id, to_stage_code')
    .in('emp_id', empIds)
    .eq('reassignment_date', date)
    .eq('is_deleted', false)
    .order('created_dt', { ascending: false });

  if (error) throw error;

  // Get the latest reassignment for each employee
  const map = new Map<string, string | null>();
  const seen = new Set<string>();
  
  (data || []).forEach(reassign => {
    if (!seen.has(reassign.emp_id)) {
      map.set(reassign.emp_id, reassign.to_stage_code);
      seen.add(reassign.emp_id);
    }
  });
  
  return map;
}

// Batch fetch stage journeys for all employees
export async function getEmployeeStageJourneysBatch(
  empIds: string[],
  date: string
): Promise<Map<string, Array<{
  from_stage: string;
  to_stage: string;
  reassigned_at: string;
  from_time: string;
  to_time: string;
  reason?: string;
  reassigned_by: string;
}>>> {
  if (empIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('hr_stage_reassignment')
    .select(`
      emp_id,
      from_stage_code,
      to_stage_code,
      created_dt,
      from_time,
      to_time,
      reason,
      reassigned_by
    `)
    .in('emp_id', empIds)
    .eq('reassignment_date', date)
    .eq('is_deleted', false)
    .order('created_dt', { ascending: true });

  if (error) throw error;

  const map = new Map<string, any[]>();
  (data || []).forEach(reassign => {
    if (!map.has(reassign.emp_id)) {
      map.set(reassign.emp_id, []);
    }
    map.get(reassign.emp_id)!.push({
      from_stage: reassign.from_stage_code,
      to_stage: reassign.to_stage_code,
      reassigned_at: reassign.created_dt,
      from_time: reassign.from_time,
      to_time: reassign.to_time,
      reason: reassign.reason,
      reassigned_by: reassign.reassigned_by
    });
  });
  
  return map;
}
```

### Step 2: Update fetchProductionEmployees

Replace the N+1 queries with batch calls:

```typescript
// Before: N+1 queries
const attendancePromises = productionEmployees.map(async (emp) => {
  // Individual queries...
});

// After: Batch queries
const empIds = productionEmployees.map(emp => emp.emp_id);
const [attendanceMap, currentStagesMap, stageJourneysMap] = await Promise.all([
  getEmployeeAttendanceBatch(empIds, date, stage),
  getEmployeeCurrentStagesBatch(empIds, date),
  getEmployeeStageJourneysBatch(empIds, date)
]);

const employeesWithAttendance = productionEmployees.map(emp => ({
  ...emp,
  attendance_status: attendanceMap.get(emp.emp_id) || null,
  current_stage: currentStagesMap.get(emp.emp_id) || emp.current_stage,
  stage_journey: stageJourneysMap.get(emp.emp_id) || [],
  // ... calculate transfer hours
}));
```

---

## Summary

**Answer:** No, batch helper functions don't need to call database functions. 

**Recommended approach:** Use TypeScript batch helpers with Supabase's `.in()` operator. This:
- ✅ Doesn't require database functions
- ✅ Still provides 97% query reduction
- ✅ Much simpler to implement
- ✅ Easier to maintain

**Database functions are optional** and only needed if you want to add complex logic or optimize further.

