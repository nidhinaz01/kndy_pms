# Review 2: Time Calculation Functions

## Overview
Two functions that calculate time totals/breakdowns by fetching data and processing in JavaScript.

---

## Function 1: `calculateTotalTimeForMapping`

### Current Implementation

**File:** `src/lib/api/stdSkillTimeStandards.ts` (lines 242-259)

```typescript
export async function calculateTotalTimeForMapping(wsm_id: number): Promise<number> {
  const { data, error } = await supabase
    .from('std_skill_time_standards')
    .select('standard_time_minutes')
    .eq('wsm_id', wsm_id)
    .eq('is_deleted', false)
    .eq('is_active', true);
  
  const totalMinutes = data?.reduce((sum, item) => sum + item.standard_time_minutes, 0) || 0;
  return totalMinutes;
}
```

### Issues:
1. ❌ **Fetches all records** when only sum is needed
2. ❌ **JavaScript reduce** instead of SQL SUM
3. ❌ **Transfers unnecessary data** over network

### Usage:
- Currently used in: Not directly called (may be used internally)
- Impact: Low-Medium (simple calculation, but inefficient)

---

## Function 2: `getDetailedTimeBreakdownForDerivativeWork` ⭐ **HIGH PRIORITY**

### Current Implementation

**File:** `src/lib/api/stdSkillTimeStandards.ts` (lines 262-337)

```typescript
export async function getDetailedTimeBreakdownForDerivativeWork(derived_sw_code: string) {
  // Query 1: Get all work-skill mappings
  const { data: mappings } = await supabase
    .from('std_work_skill_mapping')
    .select('wsm_id')
    .eq('derived_sw_code', derived_sw_code);
  
  // Query 2: Get all skill time standards for these mappings
  const wsmIds = mappings.map(m => m.wsm_id);
  const { data: timeStandards } = await supabase
    .from('std_skill_time_standards')
    .select('standard_time_minutes, skill_order')
    .in('wsm_id', wsmIds);
  
  // JavaScript: Group by skill_order, find max per order
  const orderGroups = new Map<number, number>();
  timeStandards.forEach(item => {
    const order = item.skill_order;
    const currentMax = orderGroups.get(order) || 0;
    orderGroups.set(order, Math.max(currentMax, item.standard_time_minutes));
  });
  
  // Sum the maximum time for each order
  const totalMinutes = Array.from(orderGroups.values())
    .reduce((sum, maxTime) => sum + maxTime, 0);
  
  // Create breakdown array
  const breakdown = timeStandards.map(item => ({
    skillOrder: item.skill_order,
    minutes: item.standard_time_minutes,
    // ...
  }));
  
  return { totalMinutes, breakdown, isUniform: true };
}
```

### Issues:
1. ❌ **Two sequential queries** (mappings → time standards)
2. ❌ **Complex JavaScript grouping** (Map operations, max calculations)
3. ❌ **Fetches all time standards** when only aggregated data needed
4. ❌ **Multiple iterations** over data (forEach, map, reduce)

### Usage:
- **Used in 4 places:**
  1. `src/lib/services/multiSkillReportService.ts:53`
  2. `src/lib/services/reportWorkService.ts:51`
  3. `src/lib/components/standards/ImportVehicleWorkFlowModal.svelte:170`
  4. `src/lib/components/standards/AddVehicleWorkFlowModal.svelte:93`
- **Impact:** High - Used in production planning and reporting workflows

---

## Proposed Database Function Solutions

### Solution 1: `calculate_total_time_for_mapping`

**Simple SUM aggregation:**

```sql
CREATE OR REPLACE FUNCTION calculate_total_time_for_mapping(p_wsm_id INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(standard_time_minutes), 0)
    FROM std_skill_time_standards
    WHERE wsm_id = p_wsm_id
      AND is_deleted = false
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql;
```

**Benefits:**
- ✅ Single query
- ✅ Database does the sum
- ✅ No data transfer (only returns integer)

---

### Solution 2: `get_time_breakdown_for_derivative_work` ⭐

**Complex calculation with grouping:**

```sql
CREATE OR REPLACE FUNCTION get_time_breakdown_for_derivative_work(
  p_derived_sw_code VARCHAR
)
RETURNS JSONB AS $$
DECLARE
  v_total_minutes INTEGER;
  v_breakdown JSONB;
  v_is_uniform BOOLEAN;
BEGIN
  -- Calculate total minutes by grouping by skill_order and taking max per order
  WITH order_max_times AS (
    SELECT 
      sts.skill_order,
      MAX(sts.standard_time_minutes) as max_time
    FROM std_work_skill_mapping wsm
    INNER JOIN std_skill_time_standards sts ON sts.wsm_id = wsm.wsm_id
    WHERE wsm.derived_sw_code = p_derived_sw_code
      AND wsm.is_deleted = false
      AND wsm.is_active = true
      AND sts.is_deleted = false
      AND sts.is_active = true
    GROUP BY sts.skill_order
  ),
  breakdown_data AS (
    SELECT 
      sts.skill_order,
      sts.standard_time_minutes as minutes,
      -- Add skill name if available (join with skill master if needed)
      1 as manpower_required -- Default, can be enhanced
    FROM std_work_skill_mapping wsm
    INNER JOIN std_skill_time_standards sts ON sts.wsm_id = wsm.wsm_id
    WHERE wsm.derived_sw_code = p_derived_sw_code
      AND wsm.is_deleted = false
      AND wsm.is_active = true
      AND sts.is_deleted = false
      AND sts.is_active = true
    ORDER BY sts.skill_order
  )
  SELECT 
    COALESCE(SUM(max_time), 0),
    jsonb_agg(
      jsonb_build_object(
        'skillOrder', skill_order,
        'minutes', minutes,
        'skillName', 'Skill ' || skill_order::TEXT,
        'manpowerRequired', manpower_required
      )
    )
  INTO v_total_minutes, v_breakdown
  FROM order_max_times
  CROSS JOIN LATERAL (
    SELECT skill_order, minutes, manpower_required
    FROM breakdown_data
    WHERE breakdown_data.skill_order = order_max_times.skill_order
    LIMIT 1
  ) bd;
  
  -- Check if uniform (all mappings have same total time)
  -- This would require comparing totals per mapping, simplified here
  v_is_uniform := true;
  
  RETURN jsonb_build_object(
    'totalMinutes', v_total_minutes,
    'breakdown', COALESCE(v_breakdown, '[]'::jsonb),
    'isUniform', v_is_uniform
  );
END;
$$ LANGUAGE plpgsql;
```

**Benefits:**
- ✅ **Single query** instead of 2 sequential queries
- ✅ **Database does grouping** (GROUP BY, MAX)
- ✅ **No JavaScript iterations** (Map, forEach, reduce)
- ✅ **Minimal data transfer** (only aggregated results)
- ✅ **Better performance** especially with many mappings

---

## Updated TypeScript Implementation

### Function 1: `calculateTotalTimeForMapping`

```typescript
export async function calculateTotalTimeForMapping(wsm_id: number): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('calculate_total_time_for_mapping', {
      p_wsm_id: wsm_id
    });

    if (error) throw error;
    return data as number;
  } catch (error) {
    console.error('Error calculating total time for mapping:', error);
    throw error;
  }
}
```

**Code Reduction:** ~15 lines → ~10 lines (33% reduction)

---

### Function 2: `getDetailedTimeBreakdownForDerivativeWork`

```typescript
export async function getDetailedTimeBreakdownForDerivativeWork(
  derived_sw_code: string
): Promise<{
  totalMinutes: number;
  breakdown: any[];
  isUniform: boolean;
}> {
  try {
    const { data, error } = await supabase.rpc('get_time_breakdown_for_derivative_work', {
      p_derived_sw_code: derived_sw_code
    });

    if (error) throw error;

    const result = data as {
      totalMinutes: number;
      breakdown: Array<{
        skillOrder: number;
        minutes: number;
        skillName: string;
        manpowerRequired: number;
      }>;
      isUniform: boolean;
    };

    return result;
  } catch (error) {
    console.error('Error getting detailed time breakdown for derivative work:', error);
    throw error;
  }
}
```

**Code Reduction:** ~75 lines → ~25 lines (67% reduction)

---

## Performance Comparison

### Scenario: Derivative work with 10 mappings, 50 time standards

**Current Approach:**
1. Query 1: Fetch 10 mappings → 10 rows
2. Query 2: Fetch 50 time standards → 50 rows × 2 columns = 100 data points
3. JavaScript: 
   - Map to extract wsm_ids
   - forEach to group by skill_order
   - Map to find max per order
   - Reduce to sum totals
   - Map to create breakdown
4. **Total:** 2 queries, ~100 data points, 5 JS operations

**Database Function Approach:**
1. Query 1: RPC call → Returns JSONB with aggregated results (~10-20 data points)
2. **Total:** 1 query, ~15 data points, 0 JS operations

**Estimated Performance Improvement:**
- **Data Transfer:** ~85% reduction (100 → 15 points)
- **Network Round Trips:** 50% reduction (2 → 1)
- **Processing Time:** Significant reduction (database aggregation vs JS operations)

---

## Migration Steps

### Step 1: Create Database Functions
```bash
# Create migration file with both functions
psql -d your_database -f database_migration_time_calculations.sql
```

### Step 2: Update TypeScript Functions
Update both functions in `src/lib/api/stdSkillTimeStandards.ts` to use `supabase.rpc()`.

### Step 3: Test
1. Test `calculateTotalTimeForMapping` with various wsm_id values
2. Test `getDetailedTimeBreakdownForDerivativeWork` with various derived_sw_code values
3. Verify results match current implementation in all 4 usage locations:
   - Multi-skill report service
   - Report work service
   - Import vehicle work flow modal
   - Add vehicle work flow modal

### Step 4: Deploy
- Deploy database migration first
- Then deploy updated TypeScript code
- Monitor for any issues

---

## Questions to Consider

1. **Breakdown Structure:**
   - Current breakdown includes `skillName: 'Skill ${skill_order}'` - is this sufficient?
   - Do we need actual skill names from skill master table?

2. **isUniform Calculation:**
   - Current implementation always returns `true`
   - Should we implement proper uniformity check in database function?

3. **Error Handling:**
   - Should function return empty breakdown or error for invalid derived_sw_code?

4. **Backward Compatibility:**
   - ✅ Function signatures remain the same
   - ✅ Return types remain the same
   - ✅ No changes needed in calling code

---

## Decision Needed

**Should we proceed with:**
1. ✅ Creating both database functions?
2. ✅ Updating both TypeScript implementations?
3. ✅ Testing approach?
4. ✅ Any concerns or modifications needed?

**Priority:** Function 2 (`getDetailedTimeBreakdownForDerivativeWork`) is higher priority due to:
- More complex logic
- More usage locations
- Greater performance impact

