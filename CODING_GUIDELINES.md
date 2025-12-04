# Coding Guidelines

## Core Principles

### 1. **Minimal Code Addition**
- **Rule**: Always prefer modifying existing code over adding new code
- **Before adding**: Check if existing functions/utilities can be extended or reused
- **When adding**: Keep additions minimal and focused on the specific requirement

### 2. **Code Reuse First**
- **Rule**: Always check for existing utilities/functions before writing new code
- **Search order**:
  1. Check `src/lib/utils/` for existing utilities
  2. Check `src/lib/api/` for existing API functions
  3. Check component files for similar patterns
  4. Only create new code if no suitable existing code exists

### 3. **Database Functions Over Application Code**
- **Rule**: Prefer database functions for complex operations instead of building many lines of application code
- **When to use database functions**:
  1. Complex calculations involving multiple tables
  2. Statistics/aggregations that process large datasets
  3. Bulk operations with validation (imports, batch updates)
  4. Data transformations requiring multiple queries
  5. Operations that benefit from database optimization
- **Benefits**:
  - Reduces application code complexity
  - Improves performance (data stays in database)
  - Reduces network round trips
  - Ensures data consistency
- **See**: [DATABASE_FUNCTION_OPPORTUNITIES.md](./DATABASE_FUNCTION_OPPORTUNITIES.md) for detailed examples

### 4. **Helper Files Discussion**
- **Rule**: When code changes would result in large additions (>50 lines), discuss creating helper files first
- **Threshold**: If new code exceeds 50 lines or is used in 2+ places, consider extraction
- **Process**:
  1. Identify the scope of new code
  2. Check if it fits in existing utility files
  3. If not, propose a new helper file with clear purpose
  4. Get approval before creating new files

---

## Code Reuse Checklist

Before writing new code, verify:

- [ ] **Utility Functions**: Check `src/lib/utils/` for existing functions
  - Date/time utilities: `formatDate.ts`, `timeFormatUtils.ts`, `dateCalculationUtils.ts`
  - Calculation utilities: `planWorkUtils.ts`, `breakTimeUtils.ts`, `stageDateCalculationUtils.ts`
  - Validation utilities: `*Validation.ts` files
  - Other utilities: Check all files in `src/lib/utils/`

- [ ] **API Functions**: Check `src/lib/api/` for existing API calls
  - Database operations: Check relevant service files
  - Data fetching: Check fetch functions
  - CRUD operations: Check save/update/delete functions

- [ ] **Component Patterns**: Check existing components for similar implementations
  - Modals: Check `src/lib/components/` for similar modal patterns
  - Tables: Check for existing table components
  - Forms: Check for existing form patterns

- [ ] **Shared Types**: Check `src/lib/types/` for existing type definitions

---

## Helper File Creation Guidelines

### When to Create a Helper File

**Create a new helper file when:**
1. Code exceeds 50 lines and is reusable
2. Code is used in 2+ different files
3. Code represents a distinct domain/concern
4. Code would clutter the main file significantly

**Don't create a new helper file when:**
1. Code is < 20 lines and used in one place
2. Code is tightly coupled to a specific component
3. Similar functionality already exists in an existing utility file

### Helper File Naming Convention

- **Utility functions**: `*Utils.ts` (e.g., `dateCalculationUtils.ts`, `timeFormatUtils.ts`)
- **Validation functions**: `*Validation.ts` (e.g., `planWorkValidation.ts`)
- **API services**: `*Service.ts` (e.g., `productionPlanService.ts`)
- **Type definitions**: `*Types.ts` (e.g., `planningTypes.ts`)

### Helper File Structure

```typescript
/**
 * Brief description of the utility file's purpose
 */

// Imports
import { ... } from '...';

// Type definitions (if needed)
export interface ... { }

// Main utility functions
export function utilityFunction1() { }
export function utilityFunction2() { }

// Helper functions (if needed, can be private)
function internalHelper() { }
```

---

## Code Modification Guidelines

### Extending Existing Functions

**Preferred approach:**
```typescript
// ✅ GOOD: Extend existing function with optional parameter
export function existingFunction(param1: string, param2?: string) {
  // existing logic
  if (param2) {
    // new optional logic
  }
}
```

**Avoid:**
```typescript
// ❌ BAD: Create duplicate function
export function existingFunctionNew(param1: string, param2: string) {
  // duplicate logic
}
```

### Reusing Existing Utilities

**Preferred approach:**
```typescript
// ✅ GOOD: Import and use existing utility
import { formatDate, formatTime } from '$lib/utils/formatDate';
import { formatTime } from '$lib/utils/timeFormatUtils';

function myFunction() {
  const date = formatDate(someDate);
  const time = formatTime(someHours);
}
```

**Avoid:**
```typescript
// ❌ BAD: Reimplement existing functionality
function formatDate(dateString: string): string {
  // duplicate implementation
}
```

---

## Decision Tree for New Code

```
Need to add new functionality?
│
├─ Is similar code already in the project?
│  ├─ YES → Reuse/extend existing code
│  └─ NO → Continue
│
├─ Is this a complex operation involving:
│  ├─ Multiple database queries?
│  ├─ Large dataset processing?
│  ├─ Complex calculations/aggregations?
│  └─ Bulk operations with validation?
│     ├─ YES → Consider database function (see DATABASE_FUNCTION_OPPORTUNITIES.md)
│     └─ NO → Continue
│
├─ How much code will be added?
│  ├─ < 20 lines → Add to existing file (if appropriate)
│  ├─ 20-50 lines → Add to existing file or existing utility
│  └─ > 50 lines → Continue
│
├─ Will this code be used in multiple places?
│  ├─ YES → Create helper file
│  └─ NO → Continue
│
└─ Does it fit in an existing utility file?
   ├─ YES → Add to existing utility file
   └─ NO → Discuss creating new helper file
```

---

## Examples

### ✅ Good: Reusing Existing Code

```typescript
// ✅ GOOD: Using existing utilities
import { formatDateWithWeekday } from '$lib/utils/formatDate';
import { calculateBreakTimeInMinutes } from '$lib/utils/breakTimeUtils';

function displayDate(date: string) {
  return formatDateWithWeekday(date);
}

function calculateBreakHours(start: string, end: string, breaks: any[]) {
  const minutes = calculateBreakTimeInMinutes(start, end, breaks);
  return minutes / 60; // Convert to hours
}
```

### ❌ Bad: Duplicating Existing Code

```typescript
// ❌ BAD: Reimplementing existing functionality
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}
```

### ✅ Good: Extending Existing Function

```typescript
// ✅ GOOD: Extending with optional parameter
export function calculateTime(
  hours: number, 
  includeMinutes: boolean = false
): string {
  const h = Math.floor(hours);
  if (includeMinutes) {
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  }
  return `${h}h`;
}
```

### ❌ Bad: Creating Duplicate Function

```typescript
// ❌ BAD: Creating new function instead of extending
export function calculateTimeWithMinutes(hours: number): string {
  // duplicate logic
}
```

---

## Review Checklist

Before submitting code changes, verify:

- [ ] No duplicate code was added
- [ ] Existing utilities were checked and used where applicable
- [ ] New code is minimal and focused
- [ ] Complex operations considered for database functions (see DATABASE_FUNCTION_OPPORTUNITIES.md)
- [ ] If helper file was created, it was discussed first
- [ ] Code follows existing patterns in the project
- [ ] Imports use existing utilities from `src/lib/utils/`

---

## Helper Files Reference

### Current Utility Files (Check these first):

**Date/Time Utilities:**
- `src/lib/utils/formatDate.ts` - Date/time formatting
- `src/lib/utils/timeFormatUtils.ts` - Time duration formatting
- `src/lib/utils/dateCalculationUtils.ts` - Date calculations with holidays
- `src/lib/utils/stageDateCalculationUtils.ts` - Stage date calculations

**Calculation Utilities:**
- `src/lib/utils/planWorkUtils.ts` - Plan work calculations
- `src/lib/utils/breakTimeUtils.ts` - Break time calculations
- `src/lib/utils/multiSkillReportUtils.ts` - Multi-skill report utilities
- `src/lib/utils/reportWorkUtils.ts` - Report work utilities
- `src/lib/utils/worksTableUtils.ts` - Works table utilities

**Validation Utilities:**
- `src/lib/utils/planWorkValidation.ts`
- `src/lib/utils/reportWorkValidation.ts`
- `src/lib/utils/multiSkillReportValidation.ts`
- `src/lib/utils/workOrderValidation.ts`

**Other Utilities:**
- `src/lib/utils/userUtils.ts` - User management utilities
- `src/lib/utils/exportUtils.ts` - Export utilities
- `src/lib/utils/passwordUtils.ts` - Password utilities

---

## Enforcement

These guidelines should be followed for:
- All new feature development
- All bug fixes that involve code changes
- All refactoring efforts
- All code reviews

**Remember**: Code reuse and minimal additions lead to:
- ✅ Better maintainability
- ✅ Reduced bugs
- ✅ Consistent behavior
- ✅ Smaller codebase
- ✅ Easier testing

