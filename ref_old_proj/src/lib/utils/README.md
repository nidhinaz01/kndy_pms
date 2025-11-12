# Utilities Module

This directory contains utility functions and helpers used throughout the application. Utilities are written in TypeScript and are designed to be reusable and easily testable.

## Purpose
- Provide common functions for data formatting, validation, export, and sanitization.
- Reduce code duplication by centralizing shared logic.

## Structure
- `formatDate.ts` — Date formatting helpers
- `dateValidation.ts` — Date validation logic
- `exportUtils.ts` — Data export utilities (e.g., CSV, Excel)
- `inputSanitization.ts` — Input cleaning and sanitization
- `dataTable.ts` — Helpers for data table operations

## Usage
Import the required utility function in your Svelte components, API modules, or stores. Example:

```ts
import { formatDate } from '$lib/utils/formatDate';

const formatted = formatDate(new Date());
```

## Notes
- All utilities are written in TypeScript for type safety.
- Add new utilities here to keep logic modular and maintainable. 