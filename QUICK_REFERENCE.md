# Quick Reference - Code Reuse Checklist

## ⚡ Before Writing New Code

### 1. Check Existing Utilities (in order)

```typescript
// Date/Time
import { formatDate, formatDateWithWeekday, formatDateGB, formatDateTimeLocal, formatTimeLocal } from '$lib/utils/formatDate';
import { formatTime, formatTimeFromMinutes, formatMinutes, formatTimeVerbose } from '$lib/utils/timeFormatUtils';
import { calculateDateAfter, calculateDateBefore, isHoliday } from '$lib/utils/dateCalculationUtils';

// Calculations
import { calculateBreakTimeInMinutes, calculateBreakTimeForWorkPeriod } from '$lib/utils/breakTimeUtils';
import { timeToMinutes, minutesToTime, isWeekend, calculatePlannedHours } from '$lib/utils/planWorkUtils';
import { calculateActualTime } from '$lib/utils/multiSkillReportUtils';
import { calculateExitTimeWithShifts } from '$lib/utils/stageDateCalculationUtils';

// User/Common
import { getCurrentUsername, getCurrentTimestamp } from '$lib/utils/userUtils';
import { parseUTCDate } from '$lib/utils/formatDate';
```

### 2. Quick Decision Tree

```
New Code Needed?
│
├─ < 20 lines → Add to existing file
├─ 20-50 lines → Check if fits in existing utility
└─ > 50 lines → DISCUSS creating helper file first
```

### 3. Helper File Threshold

- ✅ **Create helper file**: > 50 lines OR used in 2+ places
- ❌ **Don't create**: < 20 lines OR single-use OR tightly coupled

---

## 📋 Common Patterns

### Date Formatting
```typescript
// ✅ Use existing
formatDate(date)                    // "17-Nov-24"
formatDateWithWeekday(date)         // "Mon, Nov 17, 2024"
formatDateGB(date)                  // "17 Nov 2024"
formatDateTimeLocal(dateTime)       // "17 Nov 24 14:30"
```

### Time Formatting
```typescript
// ✅ Use existing
formatTime(hours)                   // "8h 30m"
formatTimeFromMinutes(minutes)      // "8h 30m"
formatMinutes(minutes)              // "8h 30m" or "30m"
formatTimeVerbose(hours)            // "8 Hr 30 Min"
```

### Break Time Calculations
```typescript
// ✅ Use existing (returns MINUTES)
const breakMinutes = calculateBreakTimeInMinutes(startTime, endTime, breakTimes);
const breakHours = breakMinutes / 60; // Convert if needed
```

### Date Calculations
```typescript
// ✅ Use existing
const futureDate = calculateDateAfter(startDate, days, holidays);
const pastDate = calculateDateBefore(startDate, days, holidays);
const isHolidayDate = isHoliday(dateStr, holidays);
```

---

## 🚫 Common Mistakes to Avoid

### ❌ Don't Do This:
```typescript
// Duplicate date formatting
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(...);
}

// Duplicate time formatting
function formatTime(hours: number) {
  return `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`;
}

// Duplicate break time calculation
function calculateBreakTime(...) {
  // duplicate logic
}
```

### ✅ Do This Instead:
```typescript
// Import and use existing
import { formatDate, formatTime } from '$lib/utils/formatDate';
import { formatTime } from '$lib/utils/timeFormatUtils';
import { calculateBreakTimeInMinutes } from '$lib/utils/breakTimeUtils';
```

---

## 📁 Utility Files Location

All utilities are in: `src/lib/utils/`

**Key files:**
- `formatDate.ts` - All date/time formatting
- `timeFormatUtils.ts` - Time duration formatting
- `dateCalculationUtils.ts` - Date calculations
- `breakTimeUtils.ts` - Break time calculations
- `planWorkUtils.ts` - Plan work utilities
- `*Validation.ts` - Validation utilities

---

## 💡 Remember

1. **Check first, code second** - Always search existing utilities
2. **Extend, don't duplicate** - Modify existing functions when possible
3. **Discuss large changes** - > 50 lines = discuss helper file first
4. **Minimal additions** - Keep new code focused and minimal

See [CODING_GUIDELINES.md](./CODING_GUIDELINES.md) for complete guidelines.

