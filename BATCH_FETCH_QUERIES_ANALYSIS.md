# Batch Fetch Work Data - Query Analysis & Optimization

> **Status**: ⏸️ **DEFERRED** - To be implemented after application logic is complete and all flows are stable.

## 📍 When Are These Queries Executed?

### Execution Triggers:
1. **Initial Page Load** - When user opens production page
2. **Works Tab Activation** - When user clicks "Works" tab
3. **Date Change** - When user selects a different date
4. **Stage/Shift Change** - When user navigates to different stage-shift
5. **After Work Operations**:
   - After adding a work (`handleWorkAdded`)
   - After removing a work (`handleWorkRemoved`)
   - After planning work (`handlePlanSave`)
   - After reporting work (`handleReportSave`)
   - After cancelling work (`handleCancelWork`)
6. **Manual Refresh** - When user clicks refresh button
7. **Route Navigation** - When navigating back to production page

**Frequency**: Very High - Executed multiple times per user session

---

## 🔍 Current Query Breakdown

### Location: `src/lib/api/production/productionWorkFetchHelpers.ts`
### Function: `batchFetchWorkData()`

The function executes **6-7 queries** (some are 2-step) in parallel using `Promise.all()`:

#### Query 1: Work Types
```typescript
supabase
  .from('mstr_wo_type')
  .select('*')
  .in('wo_type_name', Array.from(uniqueWoModels))
```
**Purpose**: Get work order type information (wo_type_name, etc.)
**Condition**: Only if `uniqueWoModels.size > 0`
**Tables**: `mstr_wo_type`
**Join**: None

---

#### Query 2: Work Type Details (with Join)
```typescript
supabase
  .from('std_work_type_details')
  .select(`*, std_work_details!inner(*)`)
  .in('derived_sw_code', Array.from(uniqueDerivedSwCodes))
  .eq('is_active', true)
  .eq('is_deleted', false)
```
**Purpose**: Get work type details with work details joined
**Condition**: Only if `uniqueDerivedSwCodes.size > 0`
**Tables**: `std_work_type_details` + `std_work_details` (INNER JOIN)
**Join**: `std_work_details!inner(*)`

---

#### Query 3: Vehicle Work Flow (2-Step Query)
```typescript
// Step 1: Get wo_type_ids
supabase
  .from('mstr_wo_type')
  .select('id')
  .in('wo_type_name', Array.from(uniqueWoModels))

// Step 2: Get work flows
supabase
  .from('std_vehicle_work_flow')
  .select('*')
  .in('derived_sw_code', Array.from(uniqueDerivedSwCodes))
  .in('wo_type_id', woTypeIds)
  .eq('is_active', true)
  .eq('is_deleted', false)
```
**Purpose**: Get vehicle work flow information
**Condition**: Only if both `uniqueWoModels.size > 0` AND `uniqueDerivedSwCodes.size > 0`
**Tables**: `mstr_wo_type` + `std_vehicle_work_flow`
**Join**: None (but requires 2 queries)
**Issue**: ⚠️ **2-step query** - Could be optimized with a single query using JOIN

---

#### Query 4: Skill Mappings (with Join)
```typescript
supabase
  .from('std_work_skill_mapping')
  .select(`wsm_id, derived_sw_code, sc_name, std_skill_combinations!inner(sc_id, sc_name, manpower_required, skill_combination)`)
  .in('derived_sw_code', Array.from(uniqueDerivedSwCodes))
  .eq('is_active', true)
  .eq('is_deleted', false)
```
**Purpose**: Get skill mappings with skill combinations joined
**Condition**: Only if `uniqueDerivedSwCodes.size > 0`
**Tables**: `std_work_skill_mapping` + `std_skill_combinations` (INNER JOIN)
**Join**: `std_skill_combinations!inner(...)`

---

#### Query 5: Skill Time Standards (2-Step Query)
```typescript
// Step 1: Get wsm_ids
supabase
  .from('std_work_skill_mapping')
  .select('wsm_id')
  .in('derived_sw_code', Array.from(uniqueDerivedSwCodes))
  .eq('is_active', true)
  .eq('is_deleted', false)

// Step 2: Get time standards
supabase
  .from('std_skill_time_standards')
  .select('wsm_id, skill_short, standard_time_minutes, skill_order')
  .in('wsm_id', wsmIds)
  .eq('is_active', true)
  .eq('is_deleted', false)
  .order('wsm_id, skill_order')
```
**Purpose**: Get skill time standards for fallback calculations
**Condition**: Only if `uniqueDerivedSwCodes.size > 0`
**Tables**: `std_work_skill_mapping` + `std_skill_time_standards`
**Join**: None (but requires 2 queries)
**Issue**: ⚠️ **2-step query** - Could be optimized with a single query using JOIN

---

#### Query 6: Added Works
```typescript
supabase
  .from('prdn_work_additions')
  .select('*')
  .eq('stage_code', stage)
  .in('wo_details_id', Array.from(workStatusMap.keys()))
  .in('other_work_code', Array.from(uniqueOtherWorkCodes))
```
**Purpose**: Get non-standard works (added works)
**Condition**: Only if `uniqueOtherWorkCodes.size > 0`
**Tables**: `prdn_work_additions`
**Join**: None

---

#### Query 7: Skill Combinations (for Added Works)
```typescript
// Executed AFTER Query 6 completes
const scNames = [...new Set((addedWorksData || []).map((aw: any) => aw.other_work_sc).filter(Boolean))];
supabase
  .from('std_skill_combinations')
  .select('*')
  .in('sc_name', scNames)
```
**Purpose**: Get skill combinations for non-standard works
**Condition**: Only if `scNames.length > 0` (depends on Query 6)
**Tables**: `std_skill_combinations`
**Join**: None
**Issue**: ⚠️ **Sequential dependency** - Can't run in parallel with Query 6

---

## 📊 Current Performance

### Query Count:
- **Parallel Queries**: 6 (using `Promise.all()`)
- **Sequential Queries**: 1 (Query 7 depends on Query 6)
- **2-Step Queries**: 2 (Query 3 and Query 5)
- **Total Database Round Trips**: **8-9 queries**

### Execution Time:
- **Parallel queries**: ~200-500ms (depending on data size)
- **Sequential query**: ~50-100ms
- **Total**: ~250-600ms per execution

### Frequency Impact:
- Executed **multiple times per session**
- Each execution = 8-9 database round trips
- **High network overhead**

---

## 🎯 Optimization Strategy

### Goal: Reduce 8-9 queries → 1-2 queries (88-90% reduction)

---

## 💡 Proposed Solution: Database Function

### Create: `get_work_data_batch()` PostgreSQL Function

This function will:
1. Accept parameters: `p_stage_code`, `p_derived_sw_codes[]`, `p_other_work_codes[]`, `p_wo_models[]`, `p_wo_ids[]`
2. Perform all joins in a single query or minimal queries
3. Return structured JSON with all needed data

### Benefits:
- ✅ **Single database round trip** instead of 8-9
- ✅ **Database handles joins efficiently** (optimized by PostgreSQL)
- ✅ **Reduced network latency**
- ✅ **Better query planning** (database can optimize entire query)
- ✅ **Atomic operation** (all data fetched consistently)

---

## 📝 Implementation Plan

### Step 1: Create Database Function

```sql
CREATE OR REPLACE FUNCTION get_work_data_batch(
  p_stage_code VARCHAR,
  p_derived_sw_codes TEXT[],
  p_other_work_codes TEXT[],
  p_wo_models TEXT[],
  p_wo_ids INTEGER[]
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'work_types', (
      SELECT json_agg(row_to_json(wt))
      FROM mstr_wo_type wt
      WHERE wt.wo_type_name = ANY(p_wo_models)
    ),
    'work_type_details', (
      SELECT json_agg(
        json_build_object(
          'wtd', row_to_json(wtd),
          'swd', row_to_json(swd)
        )
      )
      FROM std_work_type_details wtd
      INNER JOIN std_work_details swd ON swd.sw_code = wtd.sw_code
      WHERE wtd.derived_sw_code = ANY(p_derived_sw_codes)
        AND wtd.is_active = true
        AND wtd.is_deleted = false
    ),
    'work_flows', (
      SELECT json_agg(row_to_json(vwf))
      FROM std_vehicle_work_flow vwf
      INNER JOIN mstr_wo_type wt ON wt.id = vwf.wo_type_id
      WHERE vwf.derived_sw_code = ANY(p_derived_sw_codes)
        AND wt.wo_type_name = ANY(p_wo_models)
        AND vwf.is_active = true
        AND vwf.is_deleted = false
    ),
    'skill_mappings', (
      SELECT json_agg(
        json_build_object(
          'wsm', row_to_json(wsm),
          'sc', row_to_json(sc)
        )
      )
      FROM std_work_skill_mapping wsm
      INNER JOIN std_skill_combinations sc ON sc.sc_name = wsm.sc_name
      WHERE wsm.derived_sw_code = ANY(p_derived_sw_codes)
        AND wsm.is_active = true
        AND wsm.is_deleted = false
    ),
    'skill_time_standards', (
      SELECT json_agg(row_to_json(sts))
      FROM std_skill_time_standards sts
      INNER JOIN std_work_skill_mapping wsm ON wsm.wsm_id = sts.wsm_id
      WHERE wsm.derived_sw_code = ANY(p_derived_sw_codes)
        AND sts.is_active = true
        AND sts.is_deleted = false
      ORDER BY sts.wsm_id, sts.skill_order
    ),
    'added_works', (
      SELECT json_agg(row_to_json(aw))
      FROM prdn_work_additions aw
      WHERE aw.stage_code = p_stage_code
        AND aw.wo_details_id = ANY(p_wo_ids)
        AND aw.other_work_code = ANY(p_other_work_codes)
    ),
    'skill_combinations', (
      SELECT json_agg(row_to_json(sc))
      FROM std_skill_combinations sc
      WHERE sc.sc_name IN (
        SELECT DISTINCT aw.other_work_sc
        FROM prdn_work_additions aw
        WHERE aw.stage_code = p_stage_code
          AND aw.wo_details_id = ANY(p_wo_ids)
          AND aw.other_work_code = ANY(p_other_work_codes)
          AND aw.other_work_sc IS NOT NULL
      )
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

### Step 2: Update TypeScript Code

```typescript
export async function batchFetchWorkData(
  stage: string,
  uniqueDerivedSwCodes: Set<string>,
  uniqueOtherWorkCodes: Set<string>,
  uniqueWoModels: Set<string>,
  workStatusMap: Map<number, any[]>,
  workOrderMap: Map<number, {id: number, wo_model: string, wo_no: string | null, pwo_no: string | null}>
) {
  // Single RPC call instead of 8-9 queries
  const { data, error } = await supabase.rpc('get_work_data_batch', {
    p_stage_code: stage,
    p_derived_sw_codes: Array.from(uniqueDerivedSwCodes),
    p_other_work_codes: Array.from(uniqueOtherWorkCodes),
    p_wo_models: Array.from(uniqueWoModels),
    p_wo_ids: Array.from(workStatusMap.keys())
  });

  if (error) {
    console.error('Error in batch fetch:', error);
    return {
      workTypesData: [],
      workTypeDetailsData: [],
      workFlowData: [],
      skillMappingsData: [],
      addedWorksData: [],
      skillTimeStandardsData: [],
      skillCombinationsData: []
    };
  }

  // Parse JSON response
  return {
    workTypesData: data.work_types || [],
    workTypeDetailsData: (data.work_type_details || []).map((item: any) => ({
      ...item.wtd,
      std_work_details: item.swd
    })),
    workFlowData: data.work_flows || [],
    skillMappingsData: (data.skill_mappings || []).map((item: any) => ({
      ...item.wsm,
      std_skill_combinations: item.sc
    })),
    addedWorksData: data.added_works || [],
    skillTimeStandardsData: data.skill_time_standards || [],
    skillCombinationsData: data.skill_combinations || []
  };
}
```

---

## 📈 Expected Performance Improvement

### Before:
- **Queries**: 8-9 database round trips
- **Time**: ~250-600ms
- **Network Overhead**: High

### After:
- **Queries**: 1 RPC call
- **Time**: ~100-200ms (database optimizes joins)
- **Network Overhead**: Minimal

### Improvement:
- **88-90% reduction** in database round trips
- **50-60% faster** execution time
- **Better scalability** (database handles optimization)

---

## ⚠️ Considerations

### 1. Empty Arrays Handling
- PostgreSQL handles empty arrays well
- Function should handle `NULL` or empty arrays gracefully

### 2. Data Size
- For very large datasets, consider pagination
- Current approach should handle typical production loads

### 3. Backward Compatibility
- Function signature matches current usage
- No breaking changes to TypeScript code

### 4. Testing
- Test with various combinations of codes/models
- Test with empty sets
- Test with large datasets

---

## 🚀 Next Steps

1. ✅ **Create database migration file** with function
2. ✅ **Test function** with sample data
3. ✅ **Update TypeScript code** to use RPC
4. ✅ **Test integration** end-to-end
5. ✅ **Monitor performance** in production
6. ✅ **Measure improvement** (query count, execution time)

---

## 📊 Summary

**Current State:**
- 8-9 queries executed multiple times per session
- ~250-600ms per execution
- High network overhead

**Optimized State:**
- 1 RPC call per execution
- ~100-200ms per execution
- Minimal network overhead

**Impact:**
- **88-90% reduction** in database queries
- **50-60% faster** execution
- **Better user experience** (faster page loads)

