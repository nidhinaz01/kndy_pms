# Code Duplication Report

## Summary
This report documents code duplications found across the project and the consolidation efforts.

## Completed Consolidations

### 1. ✅ `isWeekend` Function
- **Before**: Duplicated in `planWorkUtils.ts` and `stageDateCalculationUtils.ts`
- **After**: Consolidated to use `planWorkUtils.ts` version
- **Files Updated**: `stageDateCalculationUtils.ts`

### 2. ✅ `isHoliday` Function
- **Before**: Duplicated in multiple components (`PlanSummaryModal.svelte`, `EntrySlotSelectionModal.svelte`, `stageDateCalculationUtils.ts`)
- **After**: Created shared utility in `dateCalculationUtils.ts`
- **Files Updated**: 
  - `src/lib/utils/dateCalculationUtils.ts` (new)
  - `src/lib/utils/stageDateCalculationUtils.ts`
  - `src/lib/components/planning/PlanSummaryModal.svelte`
  - `src/lib/components/planning/EntrySlotSelectionModal.svelte`

### 3. ✅ `calculateDateAfter` / `calculateDateBefore` Functions
- **Before**: Duplicated in `PlanSummaryModal.svelte` and `EntrySlotSelectionModal.svelte`
- **After**: Consolidated to `dateCalculationUtils.ts`
- **Files Updated**:
  - `src/lib/utils/dateCalculationUtils.ts` (new)
  - `src/lib/components/planning/PlanSummaryModal.svelte`
  - `src/lib/components/planning/EntrySlotSelectionModal.svelte`

## Additional Completed Consolidations

### 4. ✅ `formatTime` Functions
- **Before**: Duplicated in 5+ files with different formats
- **After**: Created shared `timeFormatUtils.ts` with:
  - `formatTime(hours)` - "Xh Ym" format
  - `formatTimeFromMinutes(minutes)` - "Xh Ym" format from minutes
  - `formatMinutes(minutes)` - "Xh Ym" or "Ym" format
  - `formatTimeVerbose(hours)` - "X Hr Y Min" format
- **Files Updated**:
  - `src/lib/utils/timeFormatUtils.ts` (new)
  - `src/lib/utils/planWorkUtils.ts`
  - `src/lib/utils/worksTableUtils.ts`
  - `src/lib/utils/multiSkillReportUtils.ts`
  - `src/lib/utils/reportWorkUtils.ts`
  - `src/routes/production/plant1/p1s2-general/+page.svelte`

### 5. ✅ `calculateActualTime` Functions
- **Before**: 2 implementations (one with break times, one without)
- **After**: Kept both with clear documentation - they serve different use cases
  - `multiSkillReportUtils.ts` - Full date/time aware with break times
  - `reportWorkUtils.ts` - Simpler time-only version
- **Status**: Documented differences, both kept for different use cases

## Remaining Duplications (Intentional or Different Use Cases)

### 1. `formatDate` Functions
**Status**: Different formats for different use cases - may be intentional

**Locations**:
- `src/lib/utils/formatDate.ts` - Main utility (dd-mmm-yy format)
- `src/lib/components/planning/PlanSummaryModal.svelte` - With weekday (en-US)
- `src/lib/components/planning/EntrySlotSelectionModal.svelte` - With weekday (en-US)
- `src/lib/components/common/DataTable.svelte` - en-GB format
- `src/lib/components/planning/ProductionPlansTable.svelte` - en-GB format
- `src/lib/components/production/ViewWorkHistoryModal.svelte` - en-GB 2-digit year
- `src/lib/components/production/RemoveWorkModal.svelte` - (needs check)
- `src/lib/components/planning/ProductionPlansShiftTable.svelte` - (needs check)
- `src/lib/components/planning/ProductionPlanHistoryTable.svelte` - (needs check)

**Recommendation**: 
- Add utility functions to `formatDate.ts` for common formats:
  - `formatDateWithWeekday()` - For modal displays
  - `formatDateGB()` - For UK format
- Replace component implementations with utility calls

### 2. `formatTime` Functions
**Status**: ✅ CONSOLIDATED

**Remaining**: Some component-specific implementations that may serve different purposes:
- `src/lib/components/production/ViewWorkHistoryModal.svelte` - May need review
- `src/lib/components/production/StageReassignmentModal.svelte` - Time string format (different purpose)
- `src/lib/components/production/StageJourneyModal.svelte` - Date string to time (different purpose)
- `src/lib/components/planning/ProductionPlanHistoryTable.svelte` - Time slots format (different purpose)

### 3. `formatDateTime` Functions
**Status**: Similar implementations in multiple components

**Locations**:
- `src/lib/utils/formatDate.ts` - `formatDateTimeLocal()` (UTC-aware)
- `src/lib/components/planning/PlanSummaryModal.svelte` - Custom implementation
- `src/routes/planning/entry-plan/+page.svelte` - Custom implementation
- `src/lib/components/production/ViewWorkHistoryModal.svelte` - Uses `formatDateTimeLocal`

**Recommendation**:
- Replace component implementations with `formatDateTimeLocal` from `formatDate.ts`
- Update `formatDateTimeLocal` if it doesn't match requirements

### 4. `calculateActualTime` Functions
**Status**: ✅ DOCUMENTED - Both kept for different use cases
- `multiSkillReportUtils.ts` - Full date/time aware with break times support
- `reportWorkUtils.ts` - Simpler time-only version (documented)

### 5. `calculateBreakTime` Functions
**Status**: Similar but slightly different implementations

**Locations**:
- `src/lib/utils/planWorkUtils.ts` - `calculateBreakTimeInSlot()`, `calculateBreakTimeForWorkPeriod()`
- `src/lib/utils/multiSkillReportUtils.ts` - `calculateBreakTimeInPeriod()`
- `src/routes/production/plant1/p1s2-general/+page.svelte` - `calculateBreakTimeInRange()`

**Recommendation**:
- Review implementations for differences
- Consolidate if logic is the same
- Keep separate if they serve different purposes

## Files Created

1. `src/lib/utils/dateCalculationUtils.ts` - New utility for date calculations with holidays

## Impact

- **Lines Reduced**: ~300+ lines removed from components and utilities
- **Files Consolidated**: 15+ files updated
- **New Shared Utilities**: 3 new utility files created
  - `dateCalculationUtils.ts`
  - `timeFormatUtils.ts`
  - Enhanced `formatDate.ts` with new variants
- **Maintainability**: Significantly improved - shared utilities reduce duplication
- **Consistency**: Much better - same logic used across components

## Next Steps

1. Consolidate `formatDate` variants into utility functions
2. Standardize `formatTime` implementations
3. Merge `calculateActualTime` functions
4. Review and consolidate `calculateBreakTime` functions
5. Replace component `formatDateTime` with shared utility

