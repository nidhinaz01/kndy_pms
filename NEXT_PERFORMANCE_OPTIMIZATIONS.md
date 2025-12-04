# Next Performance Optimizations - Analysis

## Current Status

### ✅ Already Optimized:
1. **Statistics Calculations** - 4 functions moved to database
2. **Time Calculations** - 2 functions moved to database  
3. **fetchProductionEmployees** - N+1 problem fixed (154 queries → 4 queries)
4. **fetchProductionWorks** - First 2 steps optimized (3 queries → 2 RPC calls)

---

## Remaining Opportunities in `fetchProductionWorks`

### Current State After Optimization:
- ✅ Step 1: Active work orders (2 queries → 1 RPC)
- ✅ Step 2: Work statuses (1 query → 1 RPC)
- ⚠️ Step 3: Batch fetch work data (5-6 parallel queries)
- ⚠️ Step 4: Reporting data (2 queries)
- ⚠️ Step 5: JavaScript enrichment (kept in JS)

**Total Remaining:** ~7-8 queries

---

## Opportunity 1: Combine Reporting Data Queries ⭐ **QUICK WIN**

### Current Implementation:
```typescript
// Query 1: Standard works
if (standardWorkCodes.length > 0) {
  queryPromises.push(
    supabase.from('prdn_work_reporting')
      .select(...)
      .in('prdn_work_planning.derived_sw_code', standardWorkCodes)
  );
}

// Query 2: Non-standard works
if (nonStandardWorkCodes.length > 0) {
  queryPromises.push(
    supabase.from('prdn_work_reporting')
      .select(...)
      .in('prdn_work_planning.other_work_code', nonStandardWorkCodes)
  );
}
```

### Optimization: Single Query with OR Condition
```typescript
// Combined query
const { data } = await supabase
  .from('prdn_work_reporting')
  .select(baseSelect)
  .eq('prdn_work_planning.stage_code', stage)
  .in('prdn_work_planning.wo_details_id', allWoIds)
  .or(`prdn_work_planning.derived_sw_code.in.(${standardWorkCodes.join(',')}),prdn_work_planning.other_work_code.in.(${nonStandardWorkCodes.join(',')})`)
  .eq('is_deleted', false);
```

**Impact:** 2 queries → 1 query (50% reduction)  
**Complexity:** Low  
**Risk:** Low

---

## Opportunity 2: Optimize Batch Fetch Work Data ⭐ **HIGH IMPACT**

### Current Implementation:
```typescript
// 5-6 parallel queries
const [
  workTypesData,        // Query 1
  workTypeDetailsData,  // Query 2 (with join)
  workFlowData,         // Query 3
  skillMappingsData,    // Query 4 (with join)
  addedWorksData        // Query 5
] = await Promise.all([...]);

// Then conditional query 6
const skillCombinationsData = await supabase.from('std_skill_combinations')...
```

### Optimization: Database Function with All Joins
```sql
CREATE OR REPLACE FUNCTION get_work_data_batch(
  p_stage_code VARCHAR,
  p_derived_sw_codes VARCHAR[],
  p_other_work_codes VARCHAR[],
  p_wo_models VARCHAR[],
  p_wo_ids INTEGER[]
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'workTypes', (
      SELECT jsonb_agg(row_to_json(wt))
      FROM mstr_wo_type wt
      WHERE wt.wo_type_name = ANY(p_wo_models)
    ),
    'workTypeDetails', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'derived_sw_code', wtd.derived_sw_code,
          'type_description', wtd.type_description,
          'std_work_details', row_to_json(wd)
        )
      )
      FROM std_work_type_details wtd
      INNER JOIN std_work_details wd ON wd.sw_code = wtd.sw_code
      WHERE wtd.derived_sw_code = ANY(p_derived_sw_codes)
        AND wtd.is_active = true
        AND wtd.is_deleted = false
    ),
    'workFlows', (
      SELECT jsonb_agg(row_to_json(wf))
      FROM std_vehicle_work_flow wf
      WHERE wf.derived_sw_code = ANY(p_derived_sw_codes)
        AND wf.is_active = true
        AND wf.is_deleted = false
    ),
    'skillMappings', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'wsm_id', wsm.wsm_id,
          'derived_sw_code', wsm.derived_sw_code,
          'sc_name', wsm.sc_name,
          'std_skill_combinations', row_to_json(sc)
        )
      )
      FROM std_work_skill_mapping wsm
      INNER JOIN std_skill_combinations sc ON sc.sc_name = wsm.sc_name
      WHERE wsm.derived_sw_code = ANY(p_derived_sw_codes)
        AND wsm.is_active = true
        AND wsm.is_deleted = false
    ),
    'addedWorks', (
      SELECT jsonb_agg(row_to_json(aw))
      FROM prdn_work_additions aw
      WHERE aw.stage_code = p_stage_code
        AND aw.wo_details_id = ANY(p_wo_ids)
        AND aw.other_work_code = ANY(p_other_work_codes)
    )
  )
  INTO result;

  -- Get skill combinations for added works
  WITH added_work_scs AS (
    SELECT DISTINCT other_work_sc
    FROM prdn_work_additions
    WHERE stage_code = p_stage_code
      AND wo_details_id = ANY(p_wo_ids)
      AND other_work_code = ANY(p_other_work_codes)
      AND other_work_sc IS NOT NULL
  )
  SELECT jsonb_agg(row_to_json(sc))
  INTO result['skillCombinations']
  FROM std_skill_combinations sc
  WHERE sc.sc_name IN (SELECT other_work_sc FROM added_work_scs);

  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

**Impact:** 5-6 queries → 1 RPC call (83-100% reduction)  
**Complexity:** Medium  
**Risk:** Medium (needs thorough testing)

---

## Opportunity 3: Import Functions (Lower Priority)

### Current Pattern:
- Loop through records
- Check existence one by one
- Insert one by one

### Optimization:
- Batch existence check
- Bulk insert with validation

**Impact:** High (for imports)  
**Complexity:** High  
**Risk:** High  
**Frequency:** Low (imports are infrequent)

**Recommendation:** Defer - focus on daily-use functions first

---

## Opportunity 4: Aggregation Calculations

### Examples:
- `calculateTotals` in `manpowerTableUtils.ts`
- Excel/PDF export statistics

**Impact:** Medium  
**Complexity:** Low-Medium  
**Frequency:** Medium (used in reports)

**Recommendation:** Good candidate, but lower priority than fetchProductionWorks

---

## Recommended Next Steps

### Phase 1: Quick Win (Opportunity 1) ⭐ **DO THIS FIRST**
**Combine Reporting Data Queries**
- ✅ Simple to implement
- ✅ Low risk
- ✅ Immediate 50% reduction (2 queries → 1)
- ✅ No database function needed (just combine Supabase queries)

**Estimated Time:** 15-30 minutes  
**Impact:** 2 queries → 1 query

---

### Phase 2: High Impact (Opportunity 2) ⭐ **BIGGEST IMPACT**
**Optimize Batch Fetch Work Data**
- ⚠️ More complex
- ⚠️ Requires database function
- ✅ Biggest impact (5-6 queries → 1 RPC)
- ✅ Significant performance improvement

**Estimated Time:** 1-2 hours  
**Impact:** 5-6 queries → 1 RPC call

---

### Phase 3: Other Optimizations (Lower Priority)
- Import functions (when needed)
- Aggregation calculations (as needed)
- Sequence generation (low impact)

---

## Performance Impact Summary

### Current `fetchProductionWorks`:
- **Before all optimizations:** ~11 queries
- **After Phase 1 (active work orders + work statuses):** ~8 queries
- **After Phase 1 + Opportunity 1 (reporting data):** ~7 queries
- **After Phase 1 + Opportunity 1 + Opportunity 2 (batch fetch):** ~2 queries

**Total Reduction:** ~82% (11 queries → 2 queries)

---

## Decision Matrix

| Opportunity | Impact | Complexity | Risk | Priority |
|-------------|--------|------------|------|----------|
| **1. Combine Reporting Queries** | Medium | Low | Low | ⭐⭐⭐ **HIGH** |
| **2. Optimize Batch Fetch** | High | Medium | Medium | ⭐⭐⭐ **HIGH** |
| **3. Import Functions** | High | High | High | ⭐ Low |
| **4. Aggregations** | Medium | Low-Medium | Low | ⭐⭐ Medium |

---

## Recommendation

**Start with Opportunity 1** (Combine Reporting Queries):
- Quick win
- Low risk
- Immediate impact
- No database function needed

**Then do Opportunity 2** (Optimize Batch Fetch):
- Biggest impact
- Requires database function
- More testing needed

This will bring `fetchProductionWorks` from ~11 queries down to ~2 queries - an **82% reduction**!

