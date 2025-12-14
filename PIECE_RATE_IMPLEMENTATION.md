# Piece Rate Calculation Implementation

## Overview
This document describes the implementation of piece rate calculation for work reporting. Piece rates are automatically calculated when work is marked as completed.

## Database Changes

### Migration File
`database_migration_piece_rate_calculation.sql`

### New Columns in `prdn_work_reporting`
- `pr_amount` (DECIMAL(10,2)) - Piece rate amount calculated
- `pr_calculated_dt` (TIMESTAMP) - When piece rate was calculated
- `pr_rate` (DECIMAL(10,2)) - Rate per hour used for calculation
- `pr_std_time` (INTEGER) - Standard time in minutes (for standard work only)
- `pr_pow` (DECIMAL(5,4)) - Proportion of work (minutes worked by worker / total minutes worked by all workers)

## Calculation Logic

### Standard Work
1. Get skill time standards for the work (wsm_id)
2. Get skill combination and individual skills
3. For each skill in the combination:
   - Calculate: `rate_per_hour * standard_time_hours`
   - Sum all skills to get total piece rate for the work
4. Distribute proportionally among all workers who worked on the same `planning_id` based on hours worked
5. Piece rate is FIXED based on standard time, regardless of actual time taken

### Non-Standard Work
1. Get employee's monthly salary
2. Calculate working days in the month (excluding weekends and holidays)
3. Calculate hourly salary: `monthly_salary / working_days / 8`
4. Calculate piece rate: `hourly_salary * 1.15 * hours_worked`

## Auto-Calculation

### When Work is Completed
- When any worker marks work as completed (`completion_status = 'C'`), piece rate is calculated for ALL reports of that `planning_id`
- This ensures all contributing workers get paid, even if they worked on different days

### When Work is Updated
- If a report is updated after completion, piece rate is recalculated for all reports of that `planning_id`
- This handles cases where new workers are added or hours are adjusted

### When Status Changes to NC
- If completion status changes from 'C' to 'NC', piece rate fields are cleared for all reports of that `planning_id`

## Files Created/Modified

### New Files
1. `database_migration_piece_rate_calculation.sql` - Database migration
2. `src/lib/services/pieceRateCalculationService.ts` - Core calculation logic
3. `src/routes/piece-rate/time-period/+page.svelte` - UI page for viewing piece rates

### Modified Files
1. `src/lib/services/reportWorkSaveService.ts` - Added piece rate calculation on save
2. `src/lib/services/multiSkillReportSaveService.ts` - Added piece rate calculation for multi-skill reports
3. `src/lib/components/navigation/MenuIcon.svelte` - Added Piece Rate icon

## Menu Setup Required

The following menu items need to be added to the database `menu` table:

1. **Piece Rate** (Top-level menu)
   - `menu_name`: "Piece Rate"
   - `menu_path`: "/piece-rate"
   - `parent_menu_id`: null
   - `menu_order`: (set appropriate order)
   - `is_visible`: true
   - `is_enabled`: true

2. **Time Period (1 Emp)** (Sub-menu)
   - `menu_name`: "Time Period (1 Emp)"
   - `menu_path`: "/piece-rate/time-period"
   - `parent_menu_id`: (ID of Piece Rate menu)
   - `menu_order`: 1
   - `is_visible`: true
   - `is_enabled`: true

## Usage

### Viewing Piece Rate Reports
1. Navigate to Piece Rate > Time Period (1 Emp)
2. Select an employee
3. Select from date and to date (must be in same month/year)
4. Click "Load Data" to view piece rate calculations

### Automatic Calculation
Piece rates are automatically calculated when:
- A work report is saved with `completion_status = 'C'`
- A work report is updated after being completed
- Multiple workers report on the same work

## Important Notes

1. **Standard Work Calculation**: Piece rate is based on standard time, not actual time. If workers finish in 2 hours or 6 hours, they get the same piece rate (based on 4-hour standard time).

2. **Multi-Worker Distribution**: When multiple workers work on the same `planning_id`, piece rate is distributed proportionally based on hours worked.

3. **Skill Competency Split**: For works requiring multiple skills (e.g., SS+US), the piece rate is calculated for all skills combined, then distributed among all workers proportionally.

4. **Rate Lookup**: Skill rates are looked up based on `wef` (with effect from) date. The rate with the latest `wef` date that is <= work date is used.

5. **Working Days Calculation**: For non-standard work, working days exclude weekends and holidays from `plan_holidays` table.

## Testing Checklist

- [ ] Test standard work piece rate calculation
- [ ] Test non-standard work piece rate calculation
- [ ] Test multi-worker distribution
- [ ] Test completion status change (C to NC clears piece rate)
- [ ] Test update after completion (recalculates)
- [ ] Test date range validation (same month/year)
- [ ] Test UI page with various filters
- [ ] Verify menu items are added to database

