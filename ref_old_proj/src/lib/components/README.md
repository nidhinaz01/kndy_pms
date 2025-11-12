# Components Module

This directory contains reusable Svelte components organized by feature or domain. Components are grouped into subdirectories for common UI elements, navigation, HR, planning, work orders, models, and system administration.

## Purpose
- Promote reusability and consistency across the application UI.
- Encapsulate UI logic and presentation for each feature area.

## Structure
- `common/` — Shared UI elements (buttons, tables, headers, theme toggles, etc.)
- `navigation/` — Sidebar, menu icons, and navigation helpers
- `hr/` — Employee and skill master tables
- `planning/` — Holiday modals, tables, and planning tools
- `work-order/` — Work order modals, tables, and details
- `models/` — Model management modals and tables
- `system-admin/` — Data elements table

## Usage
Import and use components in your Svelte pages or other components. Example:

```svelte
<script>
  import Button from '$lib/components/common/Button.svelte';
</script>

<Button on:click={handleClick}>Click Me</Button>
```

## Notes
- All components are written in Svelte and support TypeScript where applicable.
- Follow accessibility (a11y) best practices when creating new components. 