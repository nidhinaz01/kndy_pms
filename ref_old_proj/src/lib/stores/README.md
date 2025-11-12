# Stores Module

This directory contains Svelte stores for managing application-wide state. Stores are written in TypeScript and provide reactive state management for features such as theming.

## Purpose
- Centralize state management for features that need to be shared across components.
- Enable reactive updates to the UI when state changes.

## Structure
- `theme.ts` — Store for managing light/dark theme selection

## Usage
Import the store in your Svelte components and subscribe or update as needed. Example:

```ts
import { theme } from '$lib/stores/theme';

// Subscribe to theme changes
$: currentTheme = $theme;

// Update theme
function toggleTheme() {
  theme.set('dark');
}
```

## Notes
- Stores are implemented using Svelte's `writable` or `readable` APIs.
- Add new stores here for additional shared state needs. 