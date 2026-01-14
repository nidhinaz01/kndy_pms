# Planning Holiday List Feature

## Overview

The Holiday List feature is a critical component of the Planning module that manages non-working days used in production date calculations. Holidays are excluded from working day calculations when determining production schedules, lead times, and delivery dates.

**Path**: `/planning/holiday-list`  
**Status**: ✅ Implemented and Functional  
**Last Updated**: Current

---

## Current Implementation Status

### ✅ Completed Features

1. **Holiday Management**
   - Add new holidays with date and description
   - Edit holiday status (active/inactive)
   - Delete holidays (soft delete)
   - View holidays in calendar or table format
   - Filter holidays by year

2. **Statistics Dashboard**
   - Total holidays count
   - Active vs inactive holidays
   - Holidays grouped by year
   - Real-time statistics using database function

3. **Calendar View**
   - Visual calendar display showing all months
   - Color-coded holidays (green = active, red = inactive)
   - Hover tooltips with holiday details
   - Click to view holiday information

4. **Table View**
   - Sortable table with all holiday details
   - Expandable/collapsible view
   - Row selection for editing
   - Delete functionality

5. **Import Functionality**
   - Import Sundays for a year range
   - CSV import for bulk holiday entry
   - Duplicate detection and handling

6. **Integration**
   - Used in production date calculations
   - Integrated with entry planning
   - Used in piece rate calculations
   - Referenced in lead time calculations

---

## Database Schema

### Table: `plan_holidays`

```sql
CREATE TABLE plan_holidays (
  id SERIAL PRIMARY KEY,
  dt_day INTEGER NOT NULL,              -- Day of month (1-31)
  dt_month VARCHAR(20) NOT NULL,        -- Month name (e.g., "January")
  dt_year INTEGER NOT NULL,              -- Year (e.g., 2024)
  dt_value DATE,                         -- ISO date string (YYYY-MM-DD)
  description VARCHAR(255) NOT NULL,     -- Holiday description
  is_active BOOLEAN DEFAULT TRUE,        -- Active status
  is_deleted BOOLEAN DEFAULT FALSE,      -- Soft delete flag
  created_by VARCHAR(255) NOT NULL,      -- Creator username
  created_dt TIMESTAMP DEFAULT NOW(),     -- Creation timestamp
  modified_by VARCHAR(255),               -- Last modifier username
  modified_dt TIMESTAMP                   -- Last modification timestamp
);
```

### Database Function: `get_holiday_stats`

**Location**: `database_migration_statistics_functions.sql`

**Purpose**: Efficiently calculates holiday statistics without fetching all records

**Parameters**:
- `p_year INTEGER DEFAULT NULL` - Optional year filter

**Returns**: JSONB object with:
- `total`: Total holidays count
- `active`: Active holidays count
- `inactive`: Inactive holidays count
- `byYear`: Object mapping year to count

**Status**: ✅ Implemented and optimized

---

## API Services

### File: `src/lib/api/planning/planningHolidayService.ts`

#### Functions

1. **`fetchHolidays(year?: number): Promise<Holiday[]>`**
   - Fetches holidays from database
   - Optional year filter
   - Orders by `dt_value` ascending
   - Filters out deleted holidays

2. **`saveHoliday(holiday: HolidayFormData): Promise<Holiday>`**
   - Creates new holiday record
   - Auto-populates audit fields (created_by, created_dt, etc.)
   - Returns created holiday

3. **`updateHoliday(id: number, holiday: Partial<HolidayFormData>): Promise<Holiday>`**
   - Updates existing holiday
   - Updates audit fields (modified_by, modified_dt)
   - Returns updated holiday

4. **`deleteHoliday(id: number): Promise<void>`**
   - Soft deletes holiday (sets `is_deleted = true`)
   - Preserves data for historical reference

5. **`getHolidayStats(year?: number): Promise<HolidayStats>`**
   - Uses database function for efficient calculation
   - Converts JSONB response to TypeScript interface
   - Handles year filtering

6. **`addSundaysForYear(): Promise<void>`**
   - Automatically adds all Sundays for current year + 1
   - Skips existing Sundays
   - Useful for quick setup

7. **`importHolidays(holidays: HolidayFormData[]): Promise<void>`**
   - Bulk import holidays from array
   - Used for CSV import functionality
   - Auto-populates audit fields

### Type Definitions

**File**: `src/lib/api/planning/planningTypes.ts`

```typescript
interface Holiday {
  id: number;
  dt_day: number;
  dt_month: string;
  dt_year: number;
  dt_value: string | null;
  created_dt: string;
  created_by: string;
  description: string;
  modified_by: string;
  modified_dt: string;
  is_active: boolean;
  is_deleted: boolean;
}

interface HolidayFormData {
  dt_day: number;
  dt_month: string;
  dt_year: number;
  dt_value: string | null;
  description: string;
  is_active: boolean;
}

interface HolidayStats {
  total: number;
  active: number;
  inactive: number;
  byYear: Record<number, number>;
}
```

---

## Components

### Main Page
**File**: `src/routes/planning/holiday-list/+page.svelte`

**Responsibilities**:
- Page layout and state management
- Data loading and error handling
- Modal state management
- Year filtering
- View toggling (calendar/table)

**Key State Variables**:
- `holidays: Holiday[]` - Current holidays list
- `stats: HolidayStats` - Statistics data
- `selectedYear: number` - Currently selected year
- `showCalendar: boolean` - View toggle
- Modal states (add, edit, import)

### Component Files

1. **`HolidayHeader.svelte`**
   - Page header with title
   - Action buttons (Add, Import)
   - Year selector
   - View toggle (Calendar/Table)
   - Sidebar toggle

2. **`HolidayStats.svelte`**
   - Displays statistics cards
   - Total, Active, Inactive counts
   - Year breakdown

3. **`HolidayCalendar.svelte`**
   - Visual calendar display
   - 12-month grid layout
   - Holiday highlighting
   - Tooltip on hover/click
   - Color coding (active/inactive)

4. **`HolidayTable.svelte`**
   - Sortable data table
   - Expandable rows
   - Edit/Delete actions
   - Responsive design

5. **`AddHolidayModal.svelte`**
   - Form for adding new holidays
   - Date input (day, month, year)
   - Description textarea
   - Active/Inactive status
   - Form validation

6. **`EditHolidayModal.svelte`**
   - Edit holiday status
   - Read-only date and description
   - Toggle active/inactive
   - ⚠️ **LIMITATION**: Only allows status editing, not full holiday details

7. **`ImportHolidayModal.svelte`**
   - Import Sundays functionality
   - CSV import option
   - Bulk import handling

---

## Integration Points

### 1. Production Date Calculations

**Files**:
- `src/lib/utils/dateCalculationUtils.ts`
- `src/lib/utils/stageDateCalculationUtils.ts`

**Usage**:
- `isHoliday(date: string, holidays: Holiday[]): boolean`
- `calculateDateAfter(startDate: string, days: number, holidays: Holiday[]): string`
- `calculateDateBefore(startDate: string, days: number, holidays: Holiday[]): string`

**Impact**: Holidays are excluded from working day calculations when determining:
- Production entry dates
- Stage exit dates
- Chassis arrival dates
- Document release dates
- Final inspection dates
- Delivery dates

### 2. Entry Planning

**File**: `src/routes/planning/entry-plan/+page.svelte`

**Usage**:
- Loads holidays on page mount
- Uses holidays in date comparisons
- Color-codes work orders based on holiday-aware date calculations

### 3. Piece Rate Calculations

**File**: `src/lib/services/pieceRateCalculationService.ts`

**Usage**:
- Calculates working days excluding holidays
- Used in monthly piece rate calculations
- Ensures accurate time-based calculations

### 4. Schedule Planning

**File**: `src/routes/planning/schedule/+page.svelte`

**Usage**:
- References holidays in production scheduling
- Used in date range calculations

---

## Known Issues & TODOs

### ⚠️ Current Issues

1. **Edit Modal Limitation** (Line 108 in `+page.svelte`)
   - TODO comment: "Implement edit modal or details view"
   - **Current**: Edit modal only allows status toggle
   - **Needed**: Full holiday editing (date, description)

2. **Date Key Mismatch in Calendar**
   - `HolidayCalendar.svelte` uses month name in date key
   - Potential mismatch if month names don't match exactly
   - Should use `dt_value` (ISO date) for consistency

3. **Error Handling**
   - Uses `alert()` for error messages (not user-friendly)
   - Should implement toast notifications or inline error display

4. **Validation**
   - No validation for invalid dates (e.g., Feb 30)
   - No duplicate date checking before save
   - No validation for date ranges in import

5. **Performance**
   - Calendar component logs to console in production
   - Should remove debug console.log statements

### 🔄 Recommended Improvements

1. **Enhanced Edit Functionality**
   - Allow editing date and description
   - Add validation for date changes
   - Check for conflicts with existing holidays

2. **Better Date Handling**
   - Use `dt_value` (ISO date) as primary key
   - Validate date consistency (dt_value matches dt_day/month/year)
   - Add date picker component instead of separate fields

3. **User Experience**
   - Replace alerts with toast notifications
   - Add loading states for async operations
   - Add confirmation dialogs for delete operations
   - Show success messages after operations

4. **Data Validation**
   - Validate date ranges (e.g., no Feb 30)
   - Check for duplicate dates before save
   - Validate year ranges in import

5. **Performance Optimizations**
   - Remove console.log statements
   - Optimize calendar rendering for large datasets
   - Add pagination for table view
   - Cache statistics calculations

6. **Accessibility**
   - Improve keyboard navigation
   - Add ARIA labels
   - Ensure color contrast meets WCAG standards

---

## Future Enhancements

### Phase 1: Core Improvements (High Priority)

1. **Full Edit Functionality**
   - Allow editing all holiday fields
   - Date picker component
   - Validation and conflict checking

2. **Better Error Handling**
   - Toast notification system
   - Inline error messages
   - User-friendly error descriptions

3. **Date Validation**
   - Validate date ranges
   - Duplicate detection
   - Consistency checks

### Phase 2: Enhanced Features (Medium Priority)

1. **Recurring Holidays**
   - Support for annual recurring holidays
   - Template system for common holidays
   - Bulk operations for recurring patterns

2. **Holiday Categories**
   - Categorize holidays (National, Regional, Company-specific)
   - Filter by category
   - Different handling per category

3. **Holiday Templates**
   - Pre-defined holiday templates
   - Quick add from templates
   - Regional holiday sets

4. **Advanced Import**
   - Excel import support
   - Calendar integration (iCal, Google Calendar)
   - API endpoint for external systems

### Phase 3: Advanced Features (Low Priority)

1. **Holiday Planning**
   - Multi-year planning
   - Holiday impact analysis
   - Production capacity planning with holidays

2. **Notifications**
   - Reminders for upcoming holidays
   - Email notifications
   - Calendar sync

3. **Reporting**
   - Holiday usage reports
   - Impact analysis on production
   - Historical trends

4. **API Enhancements**
   - RESTful API endpoints
   - Webhook support
   - Integration with external systems

---

## Migration & Optimization Opportunities

### Database Optimizations

1. **Indexes**
   ```sql
   -- Recommended indexes
   CREATE INDEX IF NOT EXISTS idx_plan_holidays_dt_value 
     ON plan_holidays(dt_value) 
     WHERE is_deleted = false;
   
   CREATE INDEX IF NOT EXISTS idx_plan_holidays_year_active 
     ON plan_holidays(dt_year, is_active) 
     WHERE is_deleted = false;
   
   CREATE INDEX IF NOT EXISTS idx_plan_holidays_active 
     ON plan_holidays(is_active) 
     WHERE is_deleted = false AND is_active = true;
   ```

2. **Constraints**
   ```sql
   -- Add unique constraint for active holidays
   ALTER TABLE plan_holidays
     ADD CONSTRAINT uq_plan_holidays_active_date
     UNIQUE (dt_value) 
     WHERE is_deleted = false AND is_active = true;
   ```

3. **Triggers**
   - Auto-calculate `dt_value` from `dt_day`, `dt_month`, `dt_year`
   - Validate date consistency
   - Prevent duplicate active holidays

### Code Optimizations

1. **Service Layer**
   - Add caching for frequently accessed holidays
   - Batch operations for bulk imports
   - Optimize date calculations

2. **Component Performance**
   - Virtual scrolling for large tables
   - Lazy loading for calendar months
   - Memoization for expensive calculations

3. **API Improvements**
   - Add pagination support
   - Add filtering and sorting options
   - Add search functionality

---

## Testing Considerations

### Unit Tests Needed

1. **Service Functions**
   - `fetchHolidays()` with year filter
   - `saveHoliday()` validation
   - `updateHoliday()` partial updates
   - `deleteHoliday()` soft delete
   - `getHolidayStats()` calculations

2. **Date Calculations**
   - `isHoliday()` function
   - `calculateDateAfter()` with holidays
   - `calculateDateBefore()` with holidays
   - Edge cases (year boundaries, leap years)

3. **Component Logic**
   - Calendar date mapping
   - Table sorting
   - Form validation

### Integration Tests Needed

1. **End-to-End Flows**
   - Add holiday → Verify in calendar → Use in date calculation
   - Import holidays → Verify statistics → Check integration
   - Edit holiday → Verify update → Check date calculations

2. **Date Calculation Integration**
   - Verify holidays are excluded from calculations
   - Test with various holiday configurations
   - Verify active/inactive holiday handling

### Manual Testing Checklist

- [ ] Add holiday with valid date
- [ ] Add holiday with invalid date (should fail)
- [ ] Edit holiday status
- [ ] Delete holiday
- [ ] Import Sundays
- [ ] Import CSV
- [ ] Filter by year
- [ ] Toggle calendar/table view
- [ ] Verify holidays in date calculations
- [ ] Test with active/inactive holidays
- [ ] Test duplicate date handling
- [ ] Test year boundary cases

---

## Dependencies

### Internal Dependencies
- `$lib/supabaseClient` - Database connection
- `$lib/utils/userUtils` - User authentication
- `$lib/services/menuService` - Menu navigation
- `$lib/utils/dateCalculationUtils` - Date calculations

### External Dependencies
- Supabase (PostgreSQL database)
- SvelteKit (framework)
- TypeScript (type safety)

---

## Documentation References

- **User Manual**: `USER_MANUAL.md` (Lines 1373-1395)
- **Database Migration**: `database_migration_statistics_functions.sql`
- **API Documentation**: `src/lib/api/planning/planningHolidayService.ts`
- **Type Definitions**: `src/lib/api/planning/planningTypes.ts`

---

## Summary

The Holiday List feature is **fully implemented and functional**, providing comprehensive holiday management for production planning. The system integrates well with date calculations and production scheduling.

### Key Strengths
- ✅ Complete CRUD operations
- ✅ Visual calendar and table views
- ✅ Statistics dashboard
- ✅ Import functionality
- ✅ Database function optimization
- ✅ Integration with production planning

### Areas for Improvement
- ⚠️ Limited edit functionality (status only)
- ⚠️ Basic error handling (alerts)
- ⚠️ Date validation gaps
- ⚠️ Performance optimizations needed

### Priority Actions
1. **High**: Implement full edit functionality
2. **High**: Replace alerts with toast notifications
3. **Medium**: Add date validation
4. **Medium**: Add database indexes
5. **Low**: Remove console.log statements

---

**Document Version**: 1.0  
**Last Updated**: Current  
**Maintained By**: Development Team

