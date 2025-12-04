# KNDY Production Management System

A comprehensive production management system built with SvelteKit and Supabase.

## 📋 Important Guidelines

**Before writing any code, please read:**
- **[CODING_GUIDELINES.md](./CODING_GUIDELINES.md)** - Core coding principles and standards

### Key Principles:
1. **Minimal Code Addition** - Always prefer modifying existing code over adding new code
2. **Code Reuse First** - Check existing utilities before writing new code
3. **Helper Files Discussion** - Discuss creating helper files when code exceeds 50 lines

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm/pnpm/yarn
- Supabase account and project

### Installation

```bash
npm install
```

### Development

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

### Building

```bash
npm run build
```

You can preview the production build with `npm run preview`.

## 📁 Project Structure

```
src/
├── lib/
│   ├── api/          # API service functions
│   ├── components/   # Reusable Svelte components
│   ├── services/     # Business logic services
│   ├── stores/       # Svelte stores
│   ├── types/        # TypeScript type definitions
│   └── utils/        # Utility functions (check here first!)
└── routes/           # SvelteKit routes/pages
```

## 🔍 Code Reuse Checklist

Before writing new code:
- [ ] Check `src/lib/utils/` for existing utilities
- [ ] Check `src/lib/api/` for existing API functions
- [ ] Check components for similar patterns
- [ ] Verify if code can be added to existing files vs creating new ones

## 📚 Documentation

- [CODING_GUIDELINES.md](./CODING_GUIDELINES.md) - Coding standards and best practices
- [DATABASE_FUNCTION_OPPORTUNITIES.md](./DATABASE_FUNCTION_OPPORTUNITIES.md) - Database function opportunities and examples
- [DUPLICATION_SUMMARY.md](./DUPLICATION_SUMMARY.md) - Code duplication analysis
- [FINAL_DUPLICATION_REPORT.md](./FINAL_DUPLICATION_REPORT.md) - Detailed duplication report

## 🛠️ Available Utilities

### Date/Time Utilities:
- `formatDate.ts` - Date/time formatting (UTC-aware)
- `timeFormatUtils.ts` - Time duration formatting
- `dateCalculationUtils.ts` - Date calculations with holidays
- `stageDateCalculationUtils.ts` - Production stage date calculations

### Calculation Utilities:
- `planWorkUtils.ts` - Plan work calculations
- `breakTimeUtils.ts` - Break time calculations (standard: returns minutes)
- `multiSkillReportUtils.ts` - Multi-skill report utilities
- `reportWorkUtils.ts` - Report work utilities

### Validation Utilities:
- `*Validation.ts` files - Form validation utilities

See [CODING_GUIDELINES.md](./CODING_GUIDELINES.md) for complete list and usage guidelines.
