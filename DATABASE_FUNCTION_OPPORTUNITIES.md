# Database Function Opportunities

## Overview
This document identifies opportunities to replace application-level code with PostgreSQL database functions. Using database functions can:
- Reduce application code complexity
- Improve performance (data stays in database)
- Ensure data consistency
- Reduce network round trips
- Leverage database optimization capabilities

---

## High Priority Opportunities

### 1. **Statistics Calculations** (Multiple Locations)

#### Current Pattern:
Fetch all records, then calculate statistics in application code.

#### Examples:

**`getWorkOrderStatistics`** (`src/lib/api/workOrders.ts:232-293`)
```typescript
// Current: Fetches all work orders, then filters/counts in JS
const { data } = await query;
const typeStats = types.map(type => {
  const typeOrders = workOrders.filter(wo => wo.wo_model === type);
  const ordered = typeOrders.length;
  const wip = typeOrders.filter(wo => wo.wo_prdn_start && !wo.wo_delivery).length;
  const delivered = typeOrders.filter(wo => wo.wo_delivery).length;
  return { label: type, ordered, wip, delivered };
});
```

**Recommendation**: Create database function:
```sql
CREATE OR REPLACE FUNCTION get_work_order_statistics(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  wo_type_name TEXT,
  ordered_count BIGINT,
  wip_count BIGINT,
  delivered_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.wo_type_name,
    COUNT(*) FILTER (WHERE wo.wo_date IS NOT NULL) as ordered_count,
    COUNT(*) FILTER (WHERE wo.wo_prdn_start IS NOT NULL AND wo.wo_delivery IS NULL) as wip_count,
    COUNT(*) FILTER (WHERE wo.wo_delivery IS NOT NULL) as delivered_count
  FROM mstr_wo_type m
  LEFT JOIN prdn_wo_details wo ON wo.wo_model = m.wo_type_name
    AND (start_date IS NULL OR wo.wo_date >= start_date)
    AND (end_date IS NULL OR wo.wo_date <= end_date)
  WHERE m.is_active = true AND m.is_deleted = false
  GROUP BY m.wo_type_name;
END;
$$ LANGUAGE plpgsql;
```

**Similar Functions**:
- `getWorkOrderStageOrderStats()` - `src/lib/api/planning/planningWorkOrderStageOrderService.ts:109`
- `getProductionPlanStats()` - `src/lib/api/planning/planningProductionPlanService.ts:105`
- `getHolidayStats()` - `src/lib/api/planning/planningHolidayService.ts:84`

---

### 2. **Time Calculation Functions**

#### Current Pattern:
Fetch data, then calculate totals/breakdowns in application code.

#### Examples:

**`calculateTotalTimeForMapping`** (`src/lib/api/stdSkillTimeStandards.ts:242-259`)
```typescript
// Current: Fetches all time standards, then sums in JS
const { data: timeStandards } = await supabase
  .from('std_skill_time_standards')
  .select('standard_time_minutes')
  .eq('wsm_id', wsm_id);

const totalMinutes = timeStandards.reduce((sum, ts) => sum + ts.standard_time_minutes, 0);
```

**Recommendation**: Create database function:
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

**`getDetailedTimeBreakdownForDerivativeWork`** (`src/lib/api/stdSkillTimeStandards.ts:262-337`)
```typescript
// Current: Multiple queries + grouping/calculating in JS
// 1. Get mappings
// 2. Get time standards
// 3. Group by skill_order, calculate max per order
// 4. Sum max times
```

**Recommendation**: Create database function:
```sql
CREATE OR REPLACE FUNCTION get_time_breakdown_for_derivative_work(
  p_derived_sw_code VARCHAR
)
RETURNS TABLE (
  total_minutes INTEGER,
  breakdown JSONB,
  is_uniform BOOLEAN
) AS $$
DECLARE
  v_total_minutes INTEGER;
  v_breakdown JSONB;
BEGIN
  WITH order_max_times AS (
    SELECT 
      skill_order,
      MAX(standard_time_minutes) as max_time
    FROM std_work_skill_mapping wsm
    JOIN std_skill_time_standards sts ON sts.wsm_id = wsm.wsm_id
    WHERE wsm.derived_sw_code = p_derived_sw_code
      AND wsm.is_deleted = false
      AND wsm.is_active = true
      AND sts.is_deleted = false
      AND sts.is_active = true
    GROUP BY skill_order
  )
  SELECT 
    COALESCE(SUM(max_time), 0),
    jsonb_agg(jsonb_build_object(
      'skill_order', skill_order,
      'max_time', max_time
    ))
  INTO v_total_minutes, v_breakdown
  FROM order_max_times;
  
  RETURN QUERY SELECT v_total_minutes, v_breakdown, true;
END;
$$ LANGUAGE plpgsql;
```

---

### 3. **Import Functions with Existence Checks**

#### Current Pattern:
Loop through records, check existence one by one.

#### Examples:

**`importEmployees`** (`src/lib/api/employee-api/employeeImportExportService.ts:39-202`)
```typescript
// Current: Checks existence for each employee in loop
for (let i = 1; i < lines.length; i++) {
  const exists = await checkEmployeeIdExists(employeeData.emp_id);
  if (exists) {
    errors.push(`Row ${i + 2}: Employee ID ${employeeData.emp_id} already exists`);
    continue;
  }
  await saveEmployee(...);
}
```

**Recommendation**: Create database function for bulk import:
```sql
CREATE OR REPLACE FUNCTION import_employees(
  p_employees JSONB,
  p_username VARCHAR
)
RETURNS TABLE (
  success_count INTEGER,
  error_details JSONB
) AS $$
DECLARE
  v_emp JSONB;
  v_success INTEGER := 0;
  v_errors JSONB := '[]'::jsonb;
BEGIN
  FOR v_emp IN SELECT * FROM jsonb_array_elements(p_employees)
  LOOP
    BEGIN
      -- Check existence
      IF EXISTS (
        SELECT 1 FROM hr_emp 
        WHERE emp_id = v_emp->>'emp_id' 
          AND is_deleted = false
      ) THEN
        v_errors := v_errors || jsonb_build_object(
          'row', v_emp->>'row_number',
          'error', 'Employee ID already exists'
        );
        CONTINUE;
      END IF;
      
      -- Insert employee
      INSERT INTO hr_emp (...)
      VALUES (...);
      
      v_success := v_success + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object(
        'row', v_emp->>'row_number',
        'error', SQLERRM
      );
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_success, v_errors;
END;
$$ LANGUAGE plpgsql;
```

**Similar Functions**:
- `importWorkDetails()` - `src/lib/api/stdWorkDetails.ts:123-256`
- `importSkills()` - `src/lib/api/skillMaster.ts:331-454`
- `importDerivativeWork()` - Component modal

---

### 4. **Complex Data Fetching with Multiple Joins**

#### Current Pattern:
Multiple sequential queries, then join/merge in application code.

#### Examples:

**`fetchProductionWorks`** (`src/lib/api/production/productionWorkFetchService.ts:6-164`)
```typescript
// Current: Multiple queries, then enrichment in JS
const { workOrderMap, activeWorkOrderIds } = await getActiveWorkOrders(stage);
const { workStatusMap, ... } = await getWorkStatuses(stage, activeWorkOrderIds);
const { workTypesData, workTypeDetailsData, ... } = await batchFetchWorkData(...);
// Then: createLookupMaps(), enrichWorksWithData(), enrichWorksWithTimeData()
```

**Recommendation**: Create database view or function:
```sql
CREATE OR REPLACE VIEW production_works_enriched AS
SELECT 
  ws.wo_details_id,
  ws.derived_sw_code,
  ws.other_work_code,
  ws.stage_code,
  wo.wo_no,
  wo.wo_model,
  wtd.derived_sw_code,
  wtd.type_description,
  -- ... all joined fields
FROM prdn_work_status ws
JOIN prdn_wo_details wo ON wo.id = ws.wo_details_id
LEFT JOIN std_work_type_details wtd ON wtd.derived_sw_code = ws.derived_sw_code
-- ... other joins
WHERE ws.is_deleted = false;

-- Then use function to filter by stage/date
CREATE OR REPLACE FUNCTION fetch_production_works(
  p_stage VARCHAR,
  p_date DATE
)
RETURNS TABLE (...) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM production_works_enriched
  WHERE stage_code = p_stage
    AND from_date = p_date;
END;
$$ LANGUAGE plpgsql;
```

**Similar Functions**:
- `fetchProductionEmployees()` - `src/lib/api/production/productionEmployeeFetchService.ts:6-161`
- `fetchAllWorkSkillMappings()` - `src/lib/api/stdWorkSkillMapping.ts:21-121`

---

### 5. **Aggregation Calculations**

#### Current Pattern:
Fetch all records, then calculate totals in application code.

#### Examples:

**`calculateTotals`** (`src/lib/utils/manpowerTableUtils.ts:25-35`)
```typescript
// Current: Calculates totals in JS after fetching
return {
  totalEmployees: employees.length,
  totalPlannedHours: employees.reduce((sum, emp) => sum + (emp.hours_planned || 0), 0),
  totalReportedHours: employees.reduce((sum, emp) => sum + (emp.hours_reported || 0), 0),
  // ...
};
```

**Recommendation**: Create database function:
```sql
CREATE OR REPLACE FUNCTION calculate_manpower_totals(
  p_stage VARCHAR,
  p_date DATE
)
RETURNS TABLE (
  total_employees BIGINT,
  total_planned_hours NUMERIC,
  total_reported_hours NUMERIC,
  total_ot_hours NUMERIC,
  total_lt_hours NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_employees,
    COALESCE(SUM(hours_planned), 0) as total_planned_hours,
    COALESCE(SUM(hours_reported), 0) as total_reported_hours,
    COALESCE(SUM(ot_hours), 0) as total_ot_hours,
    COALESCE(SUM(lt_hours), 0) as total_lt_hours
  FROM hr_emp
  WHERE stage = p_stage
    AND is_deleted = false
    AND is_active = true;
END;
$$ LANGUAGE plpgsql;
```

**Excel/PDF Generation Calculations** (`src/routes/production/plant1/p1s2-general/+page.svelte:2220-2556`)
```typescript
// Current: Calculates statistics in JS for export
const totalPlannedManhours = plannedWorksWithStatus.reduce((sum, work) => {
  // Complex calculation with break time
}, 0);
```

**Recommendation**: Create database function for export statistics.

---

### 6. **Sequence Number Generation**

#### Current Pattern:
Fetch max sequence, then increment in application code.

#### Examples:

**`importWorkDetails`** (`src/lib/api/stdWorkDetails.ts:140-220`)
```typescript
// Current: Fetches max sequences, then increments in loop
const existingMaxCodeSeqs = await Promise.all([
  fetchMaxSeqNo('Parent'),
  fetchMaxSeqNo('Mother'),
  fetchMaxSeqNo('Child')
]);
// Then in loop:
const currentCodeSeq = codeSeqMap.get(work.sw_type) || 0;
const nextCodeSeq = currentCodeSeq === 0 ? 101 : currentCodeSeq + 1;
const generatedSwCode = `${work.sw_type.charAt(0).toUpperCase()}${nextCodeSeq.toString().padStart(4, '0')}`;
```

**Recommendation**: Create database function:
```sql
CREATE OR REPLACE FUNCTION generate_sw_code(p_sw_type VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  v_next_seq INTEGER;
BEGIN
  -- Get next sequence number
  SELECT COALESCE(MAX(
    CASE 
      WHEN sw_code ~ '^[A-Z][0-9]+$' 
      THEN CAST(SUBSTRING(sw_code FROM '[0-9]+') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO v_next_seq
  FROM std_work_details
  WHERE sw_type = p_sw_type
    AND is_deleted = false;
  
  -- Start from 101 if no records
  IF v_next_seq < 101 THEN
    v_next_seq := 101;
  END IF;
  
  RETURN UPPER(SUBSTRING(p_sw_type FROM 1 FOR 1)) || LPAD(v_next_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;
```

---

## Medium Priority Opportunities

### 7. **Validation Functions**

#### Current Pattern:
Check existence before insert/update in application code.

#### Examples:
- `checkEmployeeIdExists()` - `src/lib/api/employee-api/employeeUtils.ts:3`
- `checkSkillNameExists()` - `src/lib/api/skillMaster.ts:231`
- `checkCombinationNameExists()` - `src/lib/api/skillCombinations.ts:76`

**Recommendation**: These are simple and may not need database functions, but could be combined with insert/update operations using database constraints or triggers.

---

### 8. **Bulk Operations**

#### Current Pattern:
Loop through records, perform operations one by one.

#### Examples:

**`saveBulkSkillTimeStandards`** (`src/lib/api/stdSkillTimeStandards.ts:209-239`)
```typescript
// Current: Prepares array, then bulk insert (this is already good!)
const bulkData = timeStandards.map(...);
await supabase.from('std_skill_time_standards').insert(bulkData);
```

**Status**: Already using bulk insert - good! But could add validation/error handling in database function.

---

## Implementation Guidelines

### When to Use Database Functions:

✅ **Use database functions for:**
1. Complex calculations involving multiple tables
2. Statistics/aggregations that process large datasets
3. Bulk operations with validation
4. Data transformations that require multiple queries
5. Operations that benefit from database optimization

❌ **Don't use database functions for:**
1. Simple CRUD operations (Supabase handles these well)
2. Business logic that changes frequently
3. Operations requiring complex UI state management
4. Simple validations (use constraints/triggers instead)

### Migration Strategy:

1. **Start with read-only functions** (statistics, calculations)
2. **Add validation functions** (existence checks, constraints)
3. **Migrate complex writes** (bulk imports, updates)
4. **Create views for complex queries** (reduce join complexity)

### Example Migration Pattern:

```typescript
// Before
export async function getWorkOrderStatistics() {
  const { data } = await supabase.from('prdn_wo_details').select('*');
  // Calculate in JS...
  return stats;
}

// After
export async function getWorkOrderStatistics(period?: { start: string; end: string }) {
  const { data, error } = await supabase.rpc('get_work_order_statistics', {
    start_date: period?.start || null,
    end_date: period?.end || null
  });
  if (error) throw error;
  return data;
}
```

---

## Priority Summary

| Priority | Category | Files Affected | Estimated Impact |
|----------|----------|----------------|------------------|
| **High** | Statistics Calculations | 5+ files | High - Reduces data transfer, improves performance |
| **High** | Time Calculations | 2 files | Medium - Simplifies complex logic |
| **High** | Import Functions | 3+ files | High - Reduces round trips, improves performance |
| **Medium** | Complex Data Fetching | 3 files | Medium - Simplifies code, may improve performance |
| **Medium** | Aggregations | 2 files | Medium - Reduces data transfer |
| **Low** | Sequence Generation | 1 file | Low - Small performance gain |

---

## Next Steps

1. **Create database function migration file** for high-priority items
2. **Update API functions** to use `supabase.rpc()` instead of complex queries
3. **Test performance improvements** with large datasets
4. **Update documentation** with new function signatures
5. **Add to coding guidelines** - prefer database functions for complex operations

---

## Notes

- Database functions should be version-controlled (create migration files)
- Test thoroughly before deploying to production
- Consider backward compatibility during migration
- Monitor performance improvements after migration
- Document all database functions with comments

