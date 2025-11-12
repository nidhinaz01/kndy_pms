# API Module

This directory contains business logic and API modules for the application. Each file encapsulates logic for a specific business domain, such as employees, planning, holidays, work orders, and more.

## Purpose
- Centralize all data-fetching, transformation, and business logic related to the application's core features.
- Provide reusable functions for use in Svelte components and server routes.

## Structure
- `employee.ts` — Employee management logic
- `skillMaster.ts` — Skill master data logic
- `holidays.ts` — Holiday and leave management
- `planning.ts` — Production planning logic
- `leadTimes.ts` — Lead time calculations
- `stageOrder.ts` — Order of production stages
- `workOrders.ts` — Work order management
- `dataElements.ts` — System data elements
- `menu.ts`, `setupPlanningMenu.ts`, `setupDataElementsMenu.ts` — Menu and setup helpers

## Usage
Import the relevant module and use its exported functions in your Svelte components or server endpoints. Example:

```ts
import { getEmployees, addEmployee } from '$lib/api/employee';

const employees = await getEmployees();
await addEmployee({ name: 'John Doe', ... });
```

## Notes
- All modules are written in TypeScript for type safety.
- Error handling should be implemented at the call site or within the API functions as appropriate. 