# Analysis: p1s2-general/+page.svelte - Generalization Opportunities

## File Overview
- **File**: `src/routes/production/plant1/p1s2-general/+page.svelte`
- **Current Size**: 4,630 lines
- **Stage Code**: `P1S2` (hardcoded 39 times throughout the file)
- **Shift Code**: `GEN` (from hr_shift_master, where shift_code = 'GEN')
- **Route Pattern**: `[stage]-[shift]` format (e.g., `P1S2-GEN`)
- **Purpose**: Production management page for a specific Stage + Shift combination

## Current Structure

### Tabs (5 main sections)
1. **Work Orders** - Display active work orders for the stage
2. **Works** - Display production works
3. **Plan** - Plan work assignments
4. **Manpower** - Manage employee assignments and attendance
5. **Report** - View work reporting and lost time

### Key Functionality
- Work order entry/exit management
- Work planning and reporting
- Manpower management (attendance, reassignment)
- Multi-skill reporting
- Excel/PDF export
- Lost time tracking
- Work addition/removal

## Generalization Opportunities

### 1. **Stage Code Hardcoding (39 occurrences)**
**Current Issue**: The stage code `'P1S2'` is hardcoded throughout:
- Data loading functions (fetchProductionEmployees, fetchProductionWorks, etc.)
- Database queries (`.eq('stage_code', 'P1S2')`)
- Modal props (`stageCode="P1S2"`)
- Export filenames (`Work_Planning_P1S2_${selectedDate}.xlsx`)
- Console logs (`Loading work orders for P1S2`)

**Note on Shift Code**: 
- Currently, `fetchProductionEmployees` filters by stage and active shift schedules, but doesn't filter by a specific shift_code
- The page is intended for a specific stage-shift combination (e.g., P1S2-GEN)
- **Action Required**: Update `fetchProductionEmployees` and related services to accept `shiftCode` parameter and filter employees by `shift_code = 'GEN'` (or the provided shift code)
- Shift break times are already loaded based on the shift schedule for the date, which should align with the shift_code

**Solution**: 
- Extract stage and shift codes from route parameters: `[stage]-[shift]/+page.svelte`
- Use dynamic route: `/production/[stage]-[shift]/+page.svelte` (e.g., `/production/P1S2-GEN`)
- Parse route param to extract: `stageCode = 'P1S2'` and `shiftCode = 'GEN'`
- Pass both as props or derive from URL
- Update all service functions to accept both `stageCode` and `shiftCode` parameters
- Filter employees and data by both stage and shift_code where applicable
- Create a config object at the top of the file

### 2. **Reusable Components Already Exist**
The file already uses shared components:
- `ManpowerTable.svelte`
- `WorksTable.svelte`
- `PlanWorkModal.svelte`
- `ReportWorkModal.svelte`
- `MultiSkillReportModal.svelte`
- `ViewWorkHistoryModal.svelte`
- `RemoveWorkModal.svelte`
- `AddWorkModal.svelte`

**Good**: These are already reusable across stages.

### 3. **Service Layer Opportunities**
**Current**: Some API calls are made directly in the component
**Opportunity**: Extract to service files:
- `services/stageProductionService.ts` - Stage-specific data loading
- `services/stageWorkOrderService.ts` - Work order entry/exit
- `utils/stageUtils.ts` - Stage-specific utilities

### 4. **Data Loading Functions**
All data loading functions are stage-specific but follow the same pattern:
- `loadManpowerData()` - Uses `'P1S2'`
- `loadWorkOrdersData()` - Filters by `'P1S2'`
- `loadWorksData()` - Uses `'P1S2'`
- `loadPlannedWorksData()` - Uses `'P1S2'`
- `loadReportData()` - Uses `'P1S2'`

**Generalization**: Make these functions accept `stageCode` as a parameter.

### 5. **Entry/Exit Modal Logic**
Entry and exit modals have stage-specific queries:
- Entry: `stage_code = 'P1S2'`, `date_type = 'entry'`, `actual_date IS NULL`
- Exit: `stage_code = 'P1S2'`, `date_type = 'exit'`, `actual_date IS NULL`

**Generalization**: Extract to reusable functions with stage code parameter.

### 6. **Export Functions**
Export filenames include stage code:
- `Work_Planning_P1S2_${selectedDate}.xlsx`
- PDF titles include "P1S2-General"

**Generalization**: Use dynamic stage code in filenames and titles.

### 7. **Page Title and Headers**
- Page title: "P1S2-General Production Management"
- Should be: `{stageCode}-{shiftCode} Production Management` (e.g., "P1S2-GEN Production Management")
- Note: "General" maps to shift_code = 'GEN' in hr_shift_master

## Recommended Refactoring Approach

### Phase 1: Extract Stage and Shift Codes
1. Convert route to dynamic: `[stageShift]/+page.svelte` where `stageShift` = `P1S2-GEN` format
2. Parse route param: Split `$page.params.stageShift` by `-` to get `[stageCode, shiftCode]`
3. Create reactive variables:
   ```typescript
   $: stageShiftParam = $page.params.stageShift || 'P1S2-GEN';
   $: [stageCode, shiftCode] = stageShiftParam.split('-');
   ```
4. Validate: Ensure both stage and shift codes are valid
5. Fallback: Default to `'P1S2-GEN'` for backward compatibility

### Phase 2: Create Service Layer
**Location Decision**: Based on codebase patterns, services should be at the route level for route-specific logic, but since this will be shared across stages, we have two options:

**Option A: Route-level services** (matches current pattern)
```
src/routes/production/[stage]/
├── +page.svelte
├── services/
│   ├── stageProductionService.ts
│   └── stageWorkOrderService.ts
└── utils/
    └── stageUtils.ts
```

**Option B: Production-level shared services** (better for generalization)
```
src/routes/production/
├── [stageShift]/              ← Dynamic route: P1S2-GEN, P1S3-MOR, etc.
│   └── +page.svelte
├── services/                   ← Shared across all stage-shift combinations
│   ├── stageProductionService.ts
│   └── stageWorkOrderService.ts
└── utils/                      ← Shared across all stage-shift combinations
    └── stageUtils.ts
```

**Recommendation**: **Option B** - Since the services will be identical for all stage-shift combinations, they should be shared at the `production/` level.

**Route Format**: `[stageShift]` where format is `STAGE-SHIFT` (e.g., `P1S2-GEN`, `P1S3-MOR`)
- Parse: `const [stageCode, shiftCode] = $page.params.stageShift.split('-')`

1. **`src/routes/production/services/stageProductionService.ts`**
   - `loadStageManpower(stageCode, shiftCode, date)`
   - `loadStageWorkOrders(stageCode, shiftCode, date)`
   - `loadStageWorks(stageCode, shiftCode, date)`
   - `loadStagePlannedWorks(stageCode, shiftCode, date)`
   - `loadStageReportData(stageCode, shiftCode, date)`

2. **`src/routes/production/services/stageWorkOrderService.ts`**
   - `getWaitingWorkOrdersForEntry(stageCode, shiftCode)`
   - `getAvailableWorkOrdersForExit(stageCode, shiftCode)`
   - `recordWorkOrderEntry(stageCode, shiftCode, workOrderId, date)`
   - `recordWorkOrderExit(stageCode, shiftCode, workOrderId, date)`

3. **`src/routes/production/utils/stageUtils.ts`**
   - `parseStageShiftParam(stageShiftParam: string): { stageCode: string, shiftCode: string }`
   - `getStageShiftDisplayName(stageCode, shiftCode)`
   - `formatStageShiftExportFilename(stageCode, shiftCode, date, type)`
   - Stage-shift validation functions

### Phase 3: Extract Complex Logic
1. **Work Order Status Calculation** - Extract to utility
2. **Grouping Logic** - Already somewhat abstracted, but could be more generic
3. **Export Functions** - Make stage-aware

### Phase 4: Component Extraction (Optional)
Consider extracting large tab sections into components:
- `WorkOrdersTab.svelte`
- `WorksTab.svelte`
- `PlanTab.svelte`
- `ManpowerTab.svelte`
- `ReportTab.svelte`

## Benefits of Generalization

1. **Code Reusability**: One codebase for all stages
2. **Maintainability**: Fix bugs once, apply to all stages
3. **Consistency**: All stages behave identically
4. **Scalability**: Easy to add new stages
5. **Reduced Duplication**: No need to copy 4,630 lines per stage

## Estimated Impact

- **Current**: 4,630 lines × N stage-shift combinations = Massive codebase
- **After Generalization**: ~500-700 lines (main page) + shared services/utils
- **Savings**: ~90% reduction in total code for multiple stage-shift combinations
- **Example Routes**: 
  - `/production/P1S2-GEN` (Plant 1, Stage 2, General shift)
  - `/production/P1S2-MOR` (Plant 1, Stage 2, Morning shift)
  - `/production/P1S3-GEN` (Plant 1, Stage 3, General shift)
  - etc.

## Implementation Considerations

1. **Backward Compatibility**: Keep existing route working during transition
2. **Stage-Specific Customization**: Some stages might need slight variations
3. **Testing**: Test with multiple stages to ensure generalization works
4. **Migration**: Plan migration path for existing stage-specific pages

## Next Steps

1. ✅ Analysis complete
2. ⏳ Create dynamic route structure
3. ⏳ Extract service layer
4. ⏳ Refactor main page to use services
5. ⏳ Test with multiple stages
6. ⏳ Document stage configuration requirements

