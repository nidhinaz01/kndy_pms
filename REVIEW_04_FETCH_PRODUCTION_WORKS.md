# Review 4: fetchProductionWorks Optimization

## Current Implementation Analysis

### File: `src/lib/api/production/productionWorkFetchService.ts`

### Query Flow Breakdown:

#### Step 1: Get Active Work Orders (`getActiveWorkOrders`)
- **Query 1:** Fetch entered work orders (with `prdn_wo_details` join)
- **Query 2:** Fetch exited work orders
- **JavaScript:** Filter to find active (entered but not exited)
- **Returns:** `workOrderMap`, `activeWorkOrderIds`

#### Step 2: Get Work Statuses (`getWorkStatuses`)
- **Query 3:** Fetch work statuses for active work orders
- **JavaScript:** Group by `wo_details_id`, extract unique work codes
- **Returns:** `workStatusMap`, `uniqueDerivedSwCodes`, `uniqueOtherWorkCodes`

#### Step 3: Batch Fetch Work Data (`batchFetchWorkData`)
- **Query 4:** Work types (`mstr_wo_type`) - conditional
- **Query 5:** Work type details (`std_work_type_details` with `std_work_details` join) - conditional
- **Query 6:** Work flow (`std_vehicle_work_flow`) - conditional
- **Query 7:** Skill mappings (`std_work_skill_mapping` with `std_skill_combinations` join) - conditional
- **Query 8:** Added works (`prdn_work_additions`) - conditional
- **Query 9:** Skill combinations (based on added works) - conditional
- **Note:** These run in parallel with `Promise.all()`

#### Step 4: JavaScript Enrichment
- Create lookup maps from fetched data
- Enrich works with all related data
- Handle standard vs non-standard works differently

#### Step 5: Fetch Reporting Data
- **Query 10:** Reporting data for standard works (with joins)
- **Query 11:** Reporting data for non-standard works (with joins)
- **JavaScript:** Map reporting data to works

**Total:** ~11 queries + complex JavaScript processing

---

## Optimization Strategy

### Approach: Database View + Function

Since this involves many joins and complex logic, we'll create:

1. **Database View:** Pre-join all the standard work data
2. **Database Function:** Filter by stage and handle the logic
3. **Keep some JavaScript:** For complex enrichment that's hard to do in SQL

### Why Not Full Database Function?

The enrichment logic is very complex:
- Conditional logic (standard vs non-standard works)
- Dynamic lookups and mappings
- Complex data transformation
- Some logic is better in JavaScript

**Hybrid approach is best:** Database does the heavy lifting (joins, filtering), JavaScript does the complex enrichment.

---

## Proposed Solution

### Option 1: Optimize Active Work Orders (Quick Win)

**Current:**
```typescript
// Query 1: Entered work orders
const entered = await supabase.from('prdn_dates').select(...).eq('date_type', 'entry');

// Query 2: Exited work orders  
const exited = await supabase.from('prdn_dates').select(...).eq('date_type', 'exit');

// JavaScript: Filter active
const active = entered.filter(wo => !exited.includes(wo));
```

**Database Function:**
```sql
CREATE OR REPLACE FUNCTION get_active_work_orders(p_stage VARCHAR)
RETURNS TABLE (
  wo_id INTEGER,
  wo_model VARCHAR,
  wo_no VARCHAR,
  pwo_no VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    wo.id as wo_id,
    wo.wo_model,
    wo.wo_no,
    wo.pwo_no
  FROM prdn_dates entry
  INNER JOIN prdn_wo_details wo ON wo.id = entry.sales_order_id
  WHERE entry.stage_code = p_stage
    AND entry.date_type = 'entry'
    AND entry.actual_date IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM prdn_dates exit
      WHERE exit.sales_order_id = entry.sales_order_id
        AND exit.stage_code = p_stage
        AND exit.date_type = 'exit'
        AND exit.actual_date IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql;
```

**Impact:** 2 queries → 1 query

---

### Option 2: Create Enriched Works View (More Complex)

Create a view that pre-joins all the standard work data:

```sql
CREATE OR REPLACE VIEW production_works_enriched AS
SELECT 
  ws.wo_details_id,
  ws.derived_sw_code,
  ws.other_work_code,
  ws.stage_code,
  ws.current_status,
  wo.wo_no,
  wo.pwo_no,
  wo.wo_model,
  wtd.derived_sw_code,
  wtd.type_description,
  wd.sw_id,
  wd.sw_code,
  wd.sw_name,
  wd.plant_stage,
  wd.sw_type,
  wd.sw_seq_no,
  vwf.sequence_order,
  vwf.estimated_duration_minutes,
  -- ... more fields
FROM prdn_work_status ws
INNER JOIN prdn_wo_details wo ON wo.id = ws.wo_details_id
LEFT JOIN std_work_type_details wtd ON wtd.derived_sw_code = ws.derived_sw_code
LEFT JOIN std_work_details wd ON wd.sw_code = wtd.sw_code
LEFT JOIN std_vehicle_work_flow vwf ON vwf.derived_sw_code = ws.derived_sw_code
-- ... more joins
WHERE ws.is_deleted = false
  AND ws.current_status != 'Removed';
```

Then create a function to filter by stage and active work orders.

**Complexity:** High - many joins, need to handle both standard and non-standard works

---

### Option 3: Hybrid Approach (Recommended)

**Phase 1: Optimize Active Work Orders** (Quick Win)
- Create `get_active_work_orders()` function
- Reduces 2 queries → 1 query

**Phase 2: Optimize Batch Fetching** (Medium)
- Combine some of the batch queries using JOINs
- Reduce 5-6 queries → 2-3 queries

**Phase 3: Keep JavaScript Enrichment** (Complex logic stays in JS)
- The enrichment logic is complex and conditional
- Better to keep it in JavaScript for maintainability

---

## Recommendation: Start with Phase 1

**Create `get_active_work_orders()` function first:**
- ✅ Simple to implement
- ✅ Immediate impact (2 queries → 1)
- ✅ Low risk
- ✅ Can test independently

**Then evaluate Phase 2** based on results.

---

## Implementation Plan

### Step 1: Create `get_active_work_orders()` Function

This will replace the `getActiveWorkOrders()` helper function.

### Step 2: Update TypeScript

Replace the helper function call with RPC call.

### Step 3: Test

Verify active work orders are correctly identified.

### Step 4: Evaluate Next Steps

Based on results, decide if we need Phase 2 (view/function for enriched works).

---

## Questions to Consider

1. **Active Work Orders Logic:**
   - Current: Entered but not exited
   - Is this correct? Any edge cases?

2. **Enrichment Complexity:**
   - The JavaScript enrichment is quite complex
   - Should we keep it in JavaScript or move to database?
   - Trade-off: Performance vs Maintainability

3. **Non-Standard Works:**
   - These come from `prdn_work_additions` table
   - Different structure than standard works
   - How to handle in database view/function?

---

## Decision Needed

**Should we:**
1. ✅ **Start with Phase 1** - Optimize active work orders (simple, quick win)
2. ⚠️ **Or go straight to Phase 2** - Create enriched works view (more complex, bigger impact)
3. ⚠️ **Or keep current approach** - It's already partially optimized with parallel queries

**My Recommendation:** Start with Phase 1 - it's a safe, quick win that we can test immediately.

