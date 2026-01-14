# Stage Reassignment Analysis

## Summary
Analysis of how employee stage reassignments are handled in Manpower Plan and Manpower Report tabs.

## Issues Found

### 1. ❌ **ATTENDANCE FETCHING ISSUE** (Critical)

**Problem:**
- When an employee from P2S2 is reassigned to P2S4, their attendance might be recorded with `stage_code = 'P2S2'` (if marked before reassignment) or `stage_code = 'P2S4'` (if marked after reassignment).
- The attendance query in `fetchProductionEmployees` filters by `stage_code = stage` (the stage being queried).
- **Result**: If attendance was marked in P2S2, it won't be found when querying P2S4, and vice versa.

**Location:** `src/lib/api/production/productionEmployeeFetchService.ts` lines 299-330

**Current Code:**
```typescript
if (mode === 'planning') {
  attendanceQuery = supabase
    .from('prdn_planning_manpower')
    .select('emp_id, attendance_status')
    .in('emp_id', employeeIds)
    .eq('planning_date', date)
    .eq('stage_code', stage)  // ❌ Only checks current stage
    .in('status', ['draft', 'pending_approval', 'approved'])
    .eq('is_deleted', false);
}
```

**Fix Required:**
- For employees reassigned TO the stage, also check attendance in their original stage.
- For employees in the original stage, also check attendance in stages they're reassigned TO.
- OR: Remove the `stage_code` filter and rely on `emp_id` and date only (since attendance is per employee, not per stage).

### 2. ✅ **"TO OTHER STAGE" AND "FROM OTHER STAGE" HOURS** (Working Correctly)

**Status:** The calculation logic is correct.

**Location:** `src/lib/api/production/productionEmployeeUtils.ts` lines 1-27

**How it works:**
- `calculateStageTransferHours` is called with `stage` (the stage being queried) and `stageJourney` (all reassignments for the employee).
- For P2S2 (source stage):
  - If `from_stage === 'P2S2' && to_stage !== 'P2S2'` → adds to `toOtherStageHours` ✅
- For P2S4 (destination stage):
  - If `from_stage !== 'P2S4' && to_stage === 'P2S4'` → adds to `fromOtherStageHours` ✅

**Example:**
- Employee from P2S2 reassigned to P2S4 from 9am to 10am (1 hour)
- In P2S2: `toOtherStageHours = 1h` ✅
- In P2S4: `fromOtherStageHours = 1h` ✅

### 3. ⚠️ **EMPLOYEE INCLUSION** (Partially Working)

**Status:** Employees reassigned TO a stage ARE included, but with potential issues.

**Location:** `src/lib/api/production/productionEmployeeFetchService.ts` lines 89-157

**What's Working:**
- Employees reassigned TO the stage are fetched (lines 89-123)
- They are added to the employee list (line 157)
- Reassignment data is fetched for all employees (lines 340-374)

**Potential Issues:**
1. **Attendance not found** (see Issue #1)
2. **Work planning/reporting** might be filtered by `stage_code`, which could exclude work done in the original stage

## Recommended Fixes

### Fix 1: Attendance Query

**Option A (Recommended):** Remove `stage_code` filter for attendance queries, since attendance is per employee per date, not per stage.

```typescript
if (mode === 'planning') {
  attendanceQuery = supabase
    .from('prdn_planning_manpower')
    .select('emp_id, attendance_status')
    .in('emp_id', employeeIds)
    .eq('planning_date', date)
    // .eq('stage_code', stage)  // ❌ Remove this line
    .in('status', ['draft', 'pending_approval', 'approved'])
    .eq('is_deleted', false);
}
```

**Option B:** Check attendance in both original stage and destination stage for reassigned employees.

```typescript
// Get all stages where employees might have attendance
const allStages = new Set([stage]);
reassignedEmployeeIds.forEach(empId => {
  const emp = employees.find(e => e.emp_id === empId);
  if (emp?.stage) allStages.add(emp.stage);
});

// Query attendance for all relevant stages
attendanceQuery = supabase
  .from('prdn_planning_manpower')
  .select('emp_id, attendance_status')
  .in('emp_id', employeeIds)
  .eq('planning_date', date)
  .in('stage_code', Array.from(allStages))  // Check all relevant stages
  .in('status', ['draft', 'pending_approval', 'approved'])
  .eq('is_deleted', false);
```

### Fix 2: Work Planning/Reporting Queries (No Change Needed)

**Status:** ✅ Work planning/reporting queries are correct.

**Reasoning:**
- Work is tied to a specific stage (`stage_code` in `prdn_work_planning`).
- Work done in P2S2 should show in P2S2's tab.
- Work done in P2S4 should show in P2S4's tab.
- This is different from attendance, which is per employee per date (not per stage).

**Conclusion:** No changes needed for work planning/reporting queries.

## Testing Checklist

- [ ] Employee from P2S2 reassigned to P2S4 appears in P2S4's Manpower Plan tab
- [ ] Employee's attendance status is shown correctly in P2S4 (even if marked in P2S2)
- [ ] "To Other Stage" hours shown correctly in P2S2
- [ ] "From Other Stage" hours shown correctly in P2S4
- [ ] Employee's work planning/reporting hours are shown correctly
- [ ] Employee can be marked as present/absent in P2S4
- [ ] Employee's stage journey is displayed correctly

## Files Modified

1. ✅ `src/lib/api/production/productionEmployeeFetchService.ts`
   - Lines 299-336: Fixed attendance query (removed `stage_code` filter)
   - Lines 338-350: Added duplicate attendance handling (takes most recent if multiple records exist)

## Implementation Status

✅ **FIXED**: Attendance query now fetches attendance for employees regardless of which stage it was marked in.

**Changes Made:**
1. Removed `.eq('stage_code', stage)` filter from all three attendance queries (planning, reporting, current)
2. Added logic to handle duplicate attendance records (if an employee was marked in multiple stages, takes the most recent)

**Result:**
- Employees reassigned between stages will now show their attendance status correctly in both stages
- "To Other Stage" and "From Other Stage" hours were already working correctly
- Employees reassigned TO a stage are already included in the employee list
