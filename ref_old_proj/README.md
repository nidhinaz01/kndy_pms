# Production Management App (SvelteKit)

A modern, modular web application for managing production, HR, planning, sales, and system administration, built with SvelteKit, TypeScript, Tailwind CSS, and Supabase.

---

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Setup & Installation](#setup--installation)
- [Usage](#usage)
- [Project Structure & Architecture](#project-structure--architecture)
- [Technology Stack](#technology-stack)
- [Contributing](#contributing)

---

## Overview
This application provides a unified platform for managing business operations such as HR, production planning, sales, and system administration. It leverages SvelteKit for a fast, reactive UI and Supabase for backend/database/authentication needs.

## Features
- **HR Management:** Employee and skill master records
- **Production Planning:** Holidays, lead times, order of stages, daily entries
- **Sales:** Models, work orders
- **System Administration:** Data elements management
- **Authentication:** Secure login/logout, session management
- **Dashboard:** Centralized overview of key metrics
- **Reusable Components:** Modular UI for rapid development

## Setup & Installation
1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd production-app
   ```
2. **Install dependencies:**
   ```bash
   npm install
   # or
   pnpm install
   # or
   yarn install
   ```
3. **Configure environment:**
   - Copy `.env.example` to `.env` and fill in required environment variables (e.g., Supabase credentials).

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173` by default.

5. **Build for production:**
   ```bash
   npm run build
   npm run preview
   ```

## Usage
- **Login:** Access the `/login` route to authenticate.
- **Navigate:** Use the sidebar to access modules (Dashboard, HR, Planning, Sales, System Admin, etc.).
- **CRUD Operations:** Add, edit, or view records in each module.
- **Theme:** Toggle light/dark mode using the floating theme toggle.

## Project Structure & Architecture
```
production-app/
  src/
    lib/
      api/         # Business logic & API modules (employee, planning, sales, etc.)
      auth/        # Authentication helpers (session check)
      components/  # Reusable Svelte components (common, hr, planning, etc.)
      stores/      # Svelte stores for state management (theme, etc.)
      utils/       # Utility functions (date formatting, validation, etc.)
      templates/   # Reusable page templates
      supabaseClient.ts # Supabase client setup
    routes/        # SvelteKit file-based routing (login, dashboard, hr, planning, sales, etc.)
  static/          # Static assets (logo, favicon)
  package.json     # Project dependencies and scripts
  tailwind.config.js # Tailwind CSS configuration
  tsconfig.json    # TypeScript configuration
```

### Key Modules
- **API:** `src/lib/api/` (employee, holidays, planning, sales, etc.)
- **Components:** `src/lib/components/` (common UI, navigation, feature modules)
- **Utilities:** `src/lib/utils/` (date formatting, export, validation)
- **State:** `src/lib/stores/` (theme management)
- **Authentication:** `src/lib/auth/`
- **Templates:** `src/lib/templates/`

## Technology Stack
- **Frontend:** [SvelteKit](https://kit.svelte.dev/), [Svelte](https://svelte.dev/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **TypeScript:** Type safety throughout
- **Backend/DB/Auth:** [Supabase](https://supabase.com/)
- **Charts:** [ApexCharts](https://apexcharts.com/) via [svelte-apexcharts](https://github.com/apexcharts/svelte-apexcharts)
- **Date Picker:** [flatpickr](https://flatpickr.js.org/)
- **Icons:** [lucide-svelte](https://github.com/lucide-icons/lucide)
- **Linting/Formatting:** ESLint, Prettier

## Contributing
1. Fork the repository and create your branch from `main`.
2. Make your changes and add tests if applicable.
3. Run `npm run lint` and `npm run format` before submitting a PR.
4. Open a pull request with a clear description of your changes.

---

For questions or support, please contact the project maintainer.
