# Remaining Code Duplications

## 1. calculateBreakTime Functions (3 implementations)

### A. `calculateBreakTimeInSlot` (planWorkUtils.ts)
**Location**: `src/lib/utils/planWorkUtils.ts:55`
**Purpose**: Calculate break time within a time slot (fromTime to toTime)
**Parameters**:
- `fromTime: string` - Start time (HH:MM)
- `toTime: string` - End time (HH:MM)
- `shiftBreakTimes: Array<{ start_time: string; end_time: string }>` - Break times array

**Key Features**:
- Handles overnight shifts
- Adjusts break times if work period crosses midnight
- Returns break time in **hours**

**Usage**: Used in plan work calculations for time slots

---

### B. `calculateBreakTimeForWorkPeriod` (planWorkUtils.ts)
**Location**: `src/lib/utils/planWorkUtils.ts:111`
**Purpose**: Calculate break time for a work period starting at a specific time
**Parameters**:
- `startTimeStr: string` - Start time (HH:MM)
- `workDurationMinutes: number` - Duration of work in minutes
- `shiftBreakTimes: Array<{ start_time: string; end_time: string }>` - Break times array

**Key Features**:
- Calculates break time for a duration starting at a specific time
- Handles overnight breaks
- Returns break time in **hours**

**Usage**: Used in production stage exit time calculations

---

### C. `calculateBreakTimeInPeriod` (multiSkillReportUtils.ts)
**Location**: `src/lib/utils/multiSkillReportUtils.ts:41`
**Purpose**: Calculate break time between two time strings
**Parameters**:
- `startTimeStr: string` - Start time (HH:MM)
- `endTimeStr: string` - End time (HH:MM)
- `breakTimes: any[]` - Break times array

**Key Features**:
- Uses Date objects for calculations
- Handles overnight periods
- Returns break time in **minutes** (rounded)

**Usage**: Used in multi-skill report calculations

---

### D. `calculateBreakTimeInRange` (p1s2-general/+page.svelte)
**Location**: `src/routes/production/plant1/p1s2-general/+page.svelte:1769`
**Purpose**: Calculate break time that overlaps with a time range
**Parameters**:
- `fromTime: string` - Start time (HH:MM)
- `toTime: string` - End time (HH:MM)
- Uses `shiftBreakTimes` from component scope

**Key Features**:
- Uses Date objects for calculations
- Handles overnight periods
- Returns break time in **minutes**

**Usage**: Used in planned hours calculation for work display

---

### Analysis
**Similarities**:
- All calculate overlap between work periods and break times
- All handle overnight shifts/breaks
- Similar logic for finding overlap

**Differences**:
1. **Return type**: Some return hours, others return minutes
2. **Input format**: Some take duration, others take end time
3. **Implementation**: Some use Date objects, others use minute calculations
4. **Context**: Different use cases (planning vs reporting vs display)

**Recommendation**:
- These serve slightly different purposes but could potentially be consolidated
- Consider creating a unified `calculateBreakTimeOverlap` function that:
  - Takes start time, end time (or duration), and break times
  - Returns both hours and minutes (or a configurable unit)
  - Handles all edge cases (overnight, etc.)

---

## 2. Component-Specific formatTime Implementations

### A. `formatTime` in ViewWorkHistoryModal.svelte
**Location**: `src/lib/components/production/ViewWorkHistoryModal.svelte:131`
**Code**:
```typescript
function formatTime(hours: number): string {
  if (!hours) return '0h 0m';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}
```
**Purpose**: Format hours to "Xh Ym" format
**Status**: ✅ **DUPLICATE** - Can be replaced with `formatTime` from `timeFormatUtils.ts`

---

### B. `formatTime24` in TimePicker.svelte
**Location**: `src/lib/components/common/TimePicker.svelte:24`
**Purpose**: Format 12-hour time to 24-hour format string
**Status**: ✅ **DIFFERENT PURPOSE** - This is for time picker UI, not time duration formatting

---

### C. `formatTime` in StageReassignmentModal.svelte
**Location**: `src/lib/components/production/StageReassignmentModal.svelte:198`
**Code**:
```typescript
function formatTime(timeStr: string): string {
  return timeStr.substring(0, 5); // Show only HH:MM
}
```
**Purpose**: Extract HH:MM from a time string (truncate to 5 characters)
**Status**: ✅ **DIFFERENT PURPOSE** - This is string manipulation, not time formatting

---

### D. `formatTime` in StageJourneyModal.svelte
**Location**: `src/lib/components/production/StageJourneyModal.svelte:15`
**Code**:
```typescript
function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-GB', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}
```
**Purpose**: Format a date string to time string (HH:MM)
**Status**: ✅ **DIFFERENT PURPOSE** - This extracts time from a date string, similar to `formatTimeLocal` in `formatDate.ts`

---

### E. `formatTimeSlots` in ProductionPlanHistoryTable.svelte
**Location**: `src/lib/components/planning/ProductionPlanHistoryTable.svelte:26`
**Code**:
```typescript
function formatTimeSlots(times: any[]): string {
  return times.map(time => `Slot ${time.slot_order}: ${time.entry_time}`).join(', ');
}
```
**Purpose**: Format an array of time slots into a readable string
**Status**: ✅ **DIFFERENT PURPOSE** - This is array formatting, not time formatting

---

## Summary

### Can Be Consolidated:
1. ✅ **ViewWorkHistoryModal.svelte** - `formatTime` → Use `formatTime` from `timeFormatUtils.ts`
2. ⚠️ **calculateBreakTime functions** - Could be unified but serve different contexts

### Different Purposes (Keep As-Is):
1. ✅ **TimePicker.svelte** - `formatTime24` - UI time picker formatting
2. ✅ **StageReassignmentModal.svelte** - `formatTime` - String truncation
3. ✅ **StageJourneyModal.svelte** - `formatTime` - Date to time extraction (could use `formatTimeLocal`)
4. ✅ **ProductionPlanHistoryTable.svelte** - `formatTimeSlots` - Array formatting

### Recommendation Priority:
1. **High**: Replace `formatTime` in `ViewWorkHistoryModal.svelte`
2. **Medium**: Consider consolidating `calculateBreakTime` functions if they can be unified
3. **Low**: Review `StageJourneyModal.svelte` to use `formatTimeLocal` from `formatDate.ts`

