# Production Page Refactoring Plan

## Current State
- Original file: `+page.svelte` (4,872 lines)
- Target: ~200 lines per file

## Completed Refactoring

### 1. Utility Files Created
- `utils/workOrderUtils.ts` - Work order date/status helpers
- `utils/timeUtils.ts` - Time calculation and formatting
- `utils/csvUtils.ts` - CSV export utilities

### 2. Modal Components Created
- `components/EntryModal.svelte` - Work order entry modal
- `components/ExitModal.svelte` - Work order exit modal

### 3. Tab Components Created
- `components/WorkOrdersTab.svelte` - Work orders tab

### 4. Services Created
- `services/pageDataService.ts` - Data loading functions

## Remaining Work

### Tab Components to Create (each ~150-200 lines)
1. `components/WorksTab.svelte` - Uses existing WorksTable component
2. `components/ManpowerPlanTab.svelte` - Uses existing ManpowerTable component
3. `components/DraftPlanTab.svelte` - Draft planning display
4. `components/PlanTab.svelte` - Planned works display (complex, ~400 lines in original)
5. `components/ManpowerReportTab.svelte` - Uses existing ManpowerTable component
6. `components/DraftReportTab.svelte` - Draft reporting display
7. `components/ReportTab.svelte` - Work reports display (complex, ~400 lines in original)

### Additional Components Needed
- `components/PageHeader.svelte` - Header with tabs and date selector
- `components/PageLayout.svelte` - Main layout wrapper

### State Management
- Consider creating a store for shared state if needed
- Most state can remain in main page as props to components

## Refactoring Strategy

1. **Extract Tab Components**: Each tab becomes its own component (~150-200 lines)
2. **Extract Complex Logic**: Move data processing to services/utils
3. **Simplify Main Page**: Main page becomes orchestrator (~200 lines)
4. **Maintain Functionality**: Ensure all features work after refactoring

## Next Steps

1. Create remaining tab components
2. Extract complex tab logic (Plan tab, Report tab) into sub-components
3. Create page header component
4. Refactor main page to use all components
5. Test all functionality

