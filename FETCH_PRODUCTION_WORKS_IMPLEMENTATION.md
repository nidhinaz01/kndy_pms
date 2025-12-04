# fetchProductionWorks Optimization - Implementation

## Summary

Optimized `fetchProductionWorks` by replacing the first two query steps with database functions.

## Changes

### 1. Database Functions Created

**File:** `database_migration_fetch_production_works.sql`

#### Function 1: `get_active_work_orders`
- **Purpose:** Get active work orders for a stage (entered but not exited)
- **Replaces:** `getActiveWorkOrders()` helper function
- **Impact:** Reduces 2 queries → 1 query
- **Returns:** Table with `wo_id`, `wo_model`, `wo_no`, `pwo_no`

#### Function 2: `get_work_statuses_with_codes`
- **Purpose:** Get work statuses and extract unique codes in one query
- **Replaces:** `getWorkStatuses()` helper function
- **Impact:** Single query with all necessary data
- **Returns:** JSONB with `workStatuses`, `uniqueDerivedSwCodes`, `uniqueOtherWorkCodes`

### 2. TypeScript Updates

**File:** `src/lib/api/production/productionWorkFetchHelpers.ts`

#### Updated `getActiveWorkOrders()`
- Now uses `supabase.rpc('get_active_work_orders')`
- Processes the returned table data into the expected Map structure
- Maintains the same return signature for backward compatibility

#### Updated `getWorkStatuses()`
- Now uses `supabase.rpc('get_work_statuses_with_codes')`
- Processes the JSONB response to extract work statuses and unique codes
- Maintains the same return signature for backward compatibility

## Query Reduction

### Before:
1. Query 1: Fetch entered work orders
2. Query 2: Fetch exited work orders
3. Query 3: Fetch work statuses
4. JavaScript: Filter and process

**Total:** 3 queries + JavaScript processing

### After:
1. RPC 1: `get_active_work_orders` (replaces queries 1 & 2)
2. RPC 2: `get_work_statuses_with_codes` (replaces query 3)
3. JavaScript: Process (same as before)

**Total:** 2 RPC calls + JavaScript processing

**Reduction:** 3 queries → 2 RPC calls (33% reduction)

## Benefits

1. ✅ **Fewer Database Round-trips:** 3 queries → 2 RPC calls
2. ✅ **Database-Level Filtering:** Active work order logic moved to database
3. ✅ **Better Performance:** Database can optimize the queries
4. ✅ **Maintainability:** Business logic (active work orders) in one place
5. ✅ **Backward Compatible:** Same function signatures, no breaking changes

## Remaining Optimization Opportunities

The rest of `fetchProductionWorks` still has:
- 5-6 parallel queries in `batchFetchWorkData()` (could be optimized further)
- 2 queries for reporting data (could be combined)
- Complex JavaScript enrichment (kept in JS for maintainability)

**Next Steps:**
- Consider optimizing `batchFetchWorkData()` if needed
- Consider combining reporting data queries
- Monitor performance after this change

## Testing

After creating the database functions, test:
1. ✅ Active work orders are correctly identified
2. ✅ Work statuses are correctly fetched
3. ✅ Unique codes are correctly extracted
4. ✅ No breaking changes in the rest of the flow

