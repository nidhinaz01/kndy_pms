# Production Management System - User Manual

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Menu Structure](#menu-structure)
4. [Process Flow](#process-flow)
5. [Dashboard](#dashboard)
6. [Production Module](#production-module)
7. [Planning Module](#planning-module)
8. [HR Module](#hr-module)
9. [Sales Module](#sales-module)
10. [Accounts Module](#accounts-module)
11. [Standards Module](#standards-module)
12. [R&D Module](#rnd-module)
13. [System Admin Module](#system-admin-module)
14. [Piece Rate Module](#piece-rate-module)
15. [Reports Module](#reports-module)
16. [Common Features](#common-features)
17. [Frequently Asked Questions (FAQ)](#frequently-asked-questions-faq)
18. [Troubleshooting](#troubleshooting)
19. [Quick Reference Guide](#quick-reference-guide)
20. [Appendix](#appendix)

---

## Introduction

The Production Management System is a comprehensive web-based application designed to manage production workflows, employee data, work orders, planning, reporting, and operational reports (including month-to-date production status, lost time, deviation, C-Off, overtime, non-standard overtime, and HR attendance pivot reports) for manufacturing operations. This manual provides detailed instructions for using each module and feature of the system.

### System Requirements

- **Browser**: Modern web browser (Chrome, Firefox, Edge, Safari)
- **Internet Connection**: Required for accessing the application
- **User Account**: Valid username and password assigned by system administrator
- **Permissions**: Appropriate menu access permissions based on user role

---

## Getting Started

### Login

1. Navigate to the application URL
2. Enter your username and password
3. Click "Login" to access the system
4. Upon successful login, you will be redirected to the Dashboard

### First-Time Set Password

If your account was created by an administrator and you are logging in for the first time (or after a password reset), you may be redirected to a **Set Your Password** page.

1. Enter your new password in the "New Password" field
2. Enter the same password again in "Confirm Password"
3. Passwords must meet the system's complexity requirements (e.g., minimum length, character mix)
4. Click "Set Password" or "Reset Password" to save
5. You will then be able to use the new password to log in

**Note**: The set-password link is valid only for a limited time. If the link has expired, ask your administrator to send a new password reset from System Admin > User Management.

### Password Reset (Forgot Password)

If you need to reset your password (e.g., you forgot it):

1. Ask your system administrator to use **System Admin > User Management** and send you a password reset email (see [Reset Password for a User](#reset-password-for-a-user) below), or
2. If your organization uses an external "Forgot password" link on the login page, use that to receive a reset link by email
3. Open the reset link (in the same browser or device when possible)
4. Enter your new password and confirm it
5. Click "Reset Password"
6. Use the new password to log in

**Note**: Reset links can expire. If you see "Invalid or expired reset link", request a new reset from your administrator.

### Navigation

- **Sidebar Menu**: Located on the left side of the screen, contains all available menu items
- **Menu Expansion**: Click on a menu item to expand sub-menus (if available)
- **Sidebar Toggle**: Click the hamburger icon (☰) to collapse/expand the sidebar
- **Theme Toggle**: Use the floating theme toggle button to switch between light and dark modes

### Help Documentation

1. Click the "Help Doc." button in the sidebar (located above the logout button)
2. The interactive user manual will open in a new browser tab
3. Use the sidebar table of contents to navigate to different sections
4. Use the search function to find specific topics
5. The manual includes step-by-step instructions for all workflows and features

### Logout

1. Click the logout button in the sidebar footer
2. Confirm logout when prompted
3. You will be redirected to the login page

### Authentication pages (reference)

You normally reach these via email links from password reset or first login, not from the sidebar:

- **`/auth/reset-password`** — Set a new password (may include `?first_login=true` for first-time setup). Requires a valid session from the link.
- **`/auth/callback`** — Handles redirects from the identity provider (e.g. after email link); you are usually forwarded automatically to the set-password page or login.

---

## Menu Structure

The application is organized into the following main modules:

1. **Dashboard** - Overview and welcome page
2. **Production** - Stage/Shift production management
3. **Planning** - Production planning and scheduling
4. **HR** - Human resources and employee management
5. **Sales** - Sales orders and work order management
6. **Accounts** - Non-commercial work orders (internal / accounting)
7. **Standards** - Standard works and workflow definitions
8. **R&D** - Research and development document management
9. **Reports** - Operational reports (e.g. month-to-date production status)
10. **System Admin** - System administration and configuration
11. **Piece Rate** - Piece rate calculations and reporting

---

## Process Flow

This section describes the **full end-to-end process flow** of the application—from creating a work order to delivering it and optionally archiving it. Use it to understand how modules connect and in what order to perform tasks.

### Overview

A work order moves through the system in these main phases:

1. **Setup** (one-time or periodic) — Configure master data so work orders can be created and executed.
2. **Order intake** — Create the work order and complete any pre-production steps (e.g. chassis receival).
3. **Document release** — Ensure R&D documents are released for the work order, if required.
4. **Planning** — Schedule when the work order will enter each production stage.
5. **Production** — At each stage: enter the WO, add/plan works, submit plan, report work, submit report.
6. **Review & delivery** — Plan/Report Review, inspection, then delivery.
7. **Archive** (optional) — Move completed work orders to the archive.

The flow is linear at a high level, but some steps (e.g. R&D documents, chassis receival) may be done in parallel or in an order that depends on your process.

---

### Phase 1: Setup and Prerequisites

Before work orders can be planned and produced, the following must be in place. System administrators and relevant roles typically perform these.

| Area | Where in the app | What to do |
|------|------------------|------------|
| **Users & access** | System Admin > User Management | Create users, assign menus. See [System Admin Module](#system-admin-module). |
| **Reference data** | System Admin > Data Elements, Lost Time Reasons, Chassis Receival Template | Configure dropdowns, lost-time reasons, and inspection templates. |
| **HR** | HR > Employee, Shift Master, Skill Master, Daily Shift | Register employees, define shifts and skills. See [HR Module](#hr-module). |
| **Standards** | Standards > Works, Work Flow, Skill Combinations | Define standard works, workflow (which works belong to which stage), skill combinations, time standards. See [Standards Module](#standards-module). |
| **Planning config** | Planning > Lead Times, Order of Stages, Holiday List | Set lead times per stage, stage order, and holidays so Entry Plan can calculate dates. See [Planning Module](#planning-module). |
| **Models** | Sales > Models | Create product models used when creating work orders. See [Sales Module](#sales-module). |

Without this setup, work orders cannot be created, planned, or executed correctly.

---

### Phase 2: Order Intake

| Step | Where in the app | What happens |
|------|------------------|---------------|
| Create work order | Sales > Work Orders | Create a new work order and assign a model (and other details). See [How to Create a New Work Order](#1-how-to-create-a-new-work-order). |
| Non-commercial work order (if applicable) | Accounts > Create non-commercial work order | For internal or accounting-driven work orders that are not created through the normal Sales flow. See [Accounts Module](#accounts-module). |
| Chassis receival (if applicable) | Sales > Chassis Receival | When the chassis arrives, record arrival and complete inspection using a template. Work order can then move from “Chassis to be Received” to “To be Planned” in Planning. See [Chassis Receival](#chassis-receival). |

After this, the work order exists in the system and may appear in **Planning > Entry Plan** under “Chassis to be Received” or “To be Planned” depending on your process.

---

### Phase 3: Document Release (if required)

If your process requires R&D documents before production:

| Step | Where in the app | What happens |
|------|------------------|---------------|
| Release documents | R&D > Share Documents | Upload and submit documents for the work order by stage. Work orders waiting for documents appear in Planning > Entry Plan under “Documents to be Released.” See [R&D Module](#rnd-module). |

When all required documents are released, the work order can be planned (Phase 4).

---

### Phase 4: Planning — Schedule the Work Order Through Stages

Planning decides **when** the work order will enter each production stage. This is required before production can “enter” the work order at any stage.

| Step | Where in the app | What happens |
|------|------------------|---------------|
| Create entry plan | Planning > Entry Plan | In the “To be Planned” tab (or “Chassis to be Received” / “Documents to be Released” as applicable), select the work order and **Create Plan**. Choose entry date/time for the first stage. The system calculates entry/exit dates for all stages using Lead Times, Order of Stages, and Holiday List. Save the plan. See [How to Create an Entry Plan for a Work Order](#1-how-to-create-an-entry-plan-for-a-work-order). |
| View schedule | Planning > Schedule | View Plan vs Actual vs Deviation and statistics. See [How to View and Analyze Production Schedule](#2-how-to-view-and-analyze-production-schedule). |

After the entry plan is saved, the work order is scheduled and becomes available for **entry** at each stage on the planned dates.

---

### Phase 5: Production — Execute Work at Each Stage

Production is done **per stage and per shift** (e.g. P1S2-GEN). The same sequence repeats at every stage where the work order is processed.

#### 5.1 Enter work order into the stage

| Step | Where in the app | What happens |
|------|------------------|---------------|
| Enter WO to stage | Production > [Stage_Shift] > **Work Orders** tab | On the planned entry date, select the date and click **Entry** for the work order. The system creates work status records for all standard works for that WO at this stage. See [How to Add a Work Order to a Stage](#1-how-to-add-a-work-order-to-a-stage). |

#### 5.2 Add works (if needed)

| Step | Where in the app | What happens |
|------|------------------|---------------|
| Add works | Production > [Stage_Shift] > **Works** tab | If the model has no standard works for this stage, or you need extra works, add works to the work order. See [How to Add Works to a Work Order](#2-how-to-add-works-to-a-work-order). |

#### 5.3 Plan works (assign workers and time)

| Step | Where in the app | What happens |
|------|------------------|---------------|
| Plan works | Production > [Stage_Shift] > **Works** tab | For each work “To be Planned,” click **Plan**, choose time slot and workers, then save. Works move to “Draft Plan.” See [How to Plan a Work](#3-how-to-plan-a-work). You can modify or delete draft plans before submission. |
| Submit plan | Production > [Stage_Shift] > **Draft Plan** tab | Review the draft plan, resolve any validation issues, then **Submit Plan**. After approval, the plan is fixed for the day. See [How to Submit a Plan](#6-how-to-submit-a-plan). |

#### 5.4 Report work and submit report

| Step | Where in the app | What happens |
|------|------------------|---------------|
| Record attendance | Production > [Stage_Shift] > **Manpower Plan** / **Manpower Report** | Use **Mark Attendance** to set **Present**, **Absent (Informed)**, or **Absent (Uninformed)**; when Present, set attendance **from/to date and time**, optional **C-Off**, and notes when required. See [Step 7.1: Record Employee Attendance](#step-71-record-employee-attendance-manpower-report). |
| Report work completion | Production > [Stage_Shift] > **Plan** tab → **Report** on each work | For each completed (or partially completed) work, click **Report** and fill in completion status, times, lost time, etc. See [How to Report a Plan (Report Work Completion)](#7-how-to-report-a-plan-report-work-completion). |
| Draft report & overtime | Production > [Stage_Shift] > **Draft Report** tab | Review draft report, report overtime if needed (Report OT), then **Submit Report**. See [Step 7.5: Submit Final Report](#step-75-submit-final-report). |

#### 5.5 Review (optional)

| Step | Where in the app | What happens |
|------|------------------|---------------|
| Plan Review | Production > Plan Review | View and compare plans (e.g. PDF). |
| Report Review | Production > Report Review | View and compare submitted reports (e.g. PDF). |

This cycle (Enter → Add works → Plan → Submit plan → Report → Submit report) is repeated at **each production stage** where the work order is processed. At the next stage, use the same Production route for that stage/shift and again start with **Work Orders** tab → **Entry** when the WO is due.

---

### Phase 6: Inspection and Delivery

As the work order completes production stages, its status in **Planning > Entry Plan** reflects progress:

- **WIP** — Work in progress (in production).
- **To be Inspected** — Ready for inspection.
- **To be Delivered** — Ready for delivery.

Inspection and delivery are typically recorded or confirmed in your process (in the app or outside it). When the work order is delivered, it is considered closed for production.

---

### Phase 7: Archive (optional)

When a work order is no longer needed in active operations (e.g. after delivery), it can be archived to keep the main database lean.

| Step | Where in the app | What happens |
|------|------------------|---------------|
| Archive work order | System Admin > Archive Work Order | Select one or more eligible work orders, confirm the irreversible archive action. Data is moved to the archive schema. See [Archive Work Order](#archive-work-order). |

---

### Process Flow Diagram (high-level)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  SETUP (one-time / periodic)                                                     │
│  System Admin • HR (Employee, Shifts, Skills) • Standards (Works, Work Flow)     │
│  Planning (Lead Times, Order of Stages, Holiday List) • Sales (Models)           │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ORDER INTAKE                                                                     │
│  Sales: Create Work Order → (optional) Chassis Receival                            │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  DOCUMENT RELEASE (if required)                                                    │
│  R&D: Share Documents for the work order / stages                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  PLANNING                                                                         │
│  Planning > Entry Plan: Create plan (entry date → calculated dates per stage)     │
│  Planning > Schedule: View plan vs actual vs deviation                            │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  PRODUCTION (repeat per stage)                                                    │
│  Enter WO → Add works (if any) → Plan works → Submit plan → Report work →        │
│  Submit report  (Plan Review / Report Review as needed)                            │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  INSPECTION & DELIVERY                                                            │
│  To be Inspected → To be Delivered → Delivery confirmed                           │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ARCHIVE (optional)                                                               │
│  System Admin > Archive Work Order                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### Where to Find Detailed Steps

- **Sales (work order, chassis receival, models):** [Sales Module](#sales-module)
- **Accounts (non-commercial work orders):** [Accounts Module](#accounts-module)
- **R&D (document release):** [R&D Module](#rnd-module)
- **Planning (entry plan, schedule, lead times, holidays):** [Planning Module](#planning-module)
- **Production (enter, add works, plan, submit plan, report, submit report):** [Production Module](#production-module) and [Production Workflows - Step by Step](#production-workflows---step-by-step)
- **Production manager views:** [Central Production Dashboard](#central-production-dashboard), [Shift change](#shift-change)
- **HR and Standards (setup):** [HR Module](#hr-module), [Standards Module](#standards-module); bulk add works: [Add Multiple Standard Works](#add-multiple-standard-works)
- **Piece Rate (per employee vs by stage Excel):** [Piece Rate Module](#piece-rate-module)
- **Reports (daily production status, lost time, deviations, C-Off, overtime, attendance pivot):** [Reports Module](#reports-module)
- **Archive:** [Archive Work Order](#archive-work-order)

---

## Dashboard

### Overview

The Dashboard serves as the main landing page after login, displaying the company logo and welcome message.

**Path**: `/dashboard`

### Features

- Welcome screen with company branding
- Quick access point to all modules via sidebar navigation

### Prerequisites

- Valid user session
- Successful login

### Areas Affected

- None (informational page only)

---

## Production Module

### Overview

The Production module is the core of the system, managing production activities for different stages and shifts. This section provides detailed, step-by-step instructions for all production workflows that you'll use daily.

**Path**: `/production/[stage_Shift]`

**Important**: The Production module is organized by Stage and Shift. When you navigate to Production, you'll see options like "P1S2-GEN" (Plant 1 Stage 2 - General Shift). Always select the correct stage and shift combination for your work.

**Related pages**: **Central Production Dashboard** (`/production/dashboard`) for a cross–stage/shift summary, and **Shift change** (`/production/shift-change`) to reassign employee shifts by stage. See the subsections below.

---

## Production Workflows - Step by Step

### Workflow Overview

The typical production workflow follows this sequence:

1. **Add Work Order to Stage** → 2. **Add Works to Work Order** → 3. **Plan Works** → 4. **Submit Plan** → 5. **Report Work** → 6. **Submit Report**

Let's go through each step in detail:

---

### 1. How to Add a Work Order to a Stage

**Purpose**: When a work order arrives at your stage, you need to "enter" it into the system. This creates work status records for all standard works associated with that work order.

**When to Use**: 
- A new work order has physically arrived at your stage
- You need to start tracking work for a work order in your stage
- The work order has moved from a previous stage to your stage

**Step-by-Step Instructions**:

1. **Navigate to Production Page**:
   - Click on **Production** in the sidebar menu
   - Select your stage/shift (e.g., "P1S2-GEN")
   - The page opens with the **Work Orders** tab active

2. **Select the Date**:
   - At the top of the page, you'll see a date picker
   - Select the date when the work order is entering your stage
   - This is usually today's date, but you can select a past date if needed

3. **View Waiting Work Orders**:
   - In the Work Orders tab, you'll see a list of work orders
   - Look for work orders that are "waiting" to enter your stage
   - These are work orders that have been planned to enter your stage but haven't been entered yet

4. **Click "Entry" Button**:
   - Find the work order you want to enter
   - Click the **"Entry"** button (or "Enter" button) next to the work order
   - A modal window will open showing entry details

5. **Review Entry Information**:
   - The modal shows:
     - Work Order Number (WO No)
     - PWO Number
     - Model
     - Entry Date (pre-filled with selected date)
   - Verify all information is correct

6. **Confirm Entry**:
   - Review the list of works that will be created
   - The system automatically creates work status records for all standard works for this work order that belong to your stage
   - Click **"Confirm Entry"** or **"Save"** button
   - You'll see a progress message as the system processes the entry

7. **Verify Entry**:
   - After successful entry, the work order will move from "waiting" list
   - Go to the **"Works"** tab
   - You should now see all the works for this work order with status "To be Planned"
   - The work order is now ready for planning

**What Happens Behind the Scenes**:
- The system creates work status records (`prdn_work_status`) for all standard works
- Updates the production dates table with the actual entry date
- Sets work status to "To be Planned" for all works
- Links all works to the work order and stage

**Common Issues & Solutions**:

- **"No works found for this stage"**: This means the work order's model doesn't have any standard works defined for your stage. You'll need to add non-standard works manually (see section 2).
- **"Work order already entered"**: The work order has already been entered. Check the Works tab to see existing works.
- **Entry button not visible**: The work order may not be scheduled to enter your stage yet. Check Planning > Entry Plan to see when it's scheduled.

**Prerequisites**:
- Work order must exist in the system
- Work order must have a model assigned
- The model must have a work flow defined (in Standards > Work Flow)
- Work order should be scheduled to enter your stage (via Planning > Entry Plan)

---

### 2. How to Add Works to a Work Order

**Purpose**: Add standard or non-standard works to a work order that's in your stage. Standard works are automatically added when you enter a work order, but you may need to add non-standard works manually.

**When to Use**:
- You need to add a non-standard work (work not in the standard work flow)
- A standard work was missed during entry
- You need to add additional work for a specific work order

**Step-by-Step Instructions**:

1. **Navigate to Works Tab**:
   - Go to the **Production** page for your stage/shift
   - Click on the **"Works"** tab at the top
   - You'll see a list of all works for work orders in your stage

2. **Click "Add Work" Button**:
   - Look for the **"Add Work"** button (usually at the top right of the table)
   - Click it to open the Add Work modal

3. **Select Work Order**:
   - In the modal, you'll see a dropdown list of available work orders
   - Select the work order you want to add work to
   - Only work orders that are in your stage will be shown

4. **Fill in Work Details**:
   - **Work Type**: The system will show "Non-Standard Work" (standard works are added automatically)
   - **Work Code**: The system will auto-generate the next available work code (e.g., "WO-001-NS-001")
   - **Work Description**: Enter a clear description of the work
     - Example: "Additional welding for custom modification"
   - **Skill Combination**: Select the required skill combination from the dropdown
     - This determines which skills are needed for this work
   - **Estimated Time**: Enter the estimated time in minutes
     - Example: 120 minutes = 2 hours
   - **Reason for Addition**: Enter why this non-standard work is needed
     - Example: "Customer requested additional reinforcement"

5. **Review and Save**:
   - Review all the information you entered
   - Click **"Save"** or **"Add Work"** button
   - The system will create the work and add it to your Works tab

6. **Verify Work Added**:
   - Go back to the Works tab
   - You should see the new work in the list
   - The work will have status "To be Planned"
   - You can now plan this work (see section 3)

**Important Notes**:
- Non-standard works are specific to the work order you select
- Each non-standard work gets a unique code
- You can add multiple non-standard works to the same work order
- Non-standard works follow the same planning and reporting process as standard works

**Prerequisites**:
- Work order must be entered into your stage (see section 1)
- Skill combinations must be defined in Standards > Skill Combinations
- You need to know the estimated time for the work

---

### 3. How to Plan a Work

**Purpose**: Plan when and by whom a work will be performed. This includes selecting workers, assigning time slots, and setting up the work schedule.

**When to Use**:
- You have works with status "To be Planned" in the Works tab
- You need to schedule work for a specific date
- You want to assign workers to specific works

**Step-by-Step Instructions**:

#### Method 1: Plan from Works Tab

1. **Navigate to Works Tab**:
   - Go to **Production** > Your Stage/Shift
   - Click on the **"Works"** tab
   - Select the date you want to plan for (using the date picker at the top)

2. **Find Work to Plan**:
   - Look through the works list
   - Find a work with status "To be Planned"
   - Each work shows:
     - Work Order Number
     - Work Code
     - Work Name
     - Status

3. **Click "Plan" Button**:
   - Find the **"Plan"** button (or icon) in the row for the work you want to plan
   - Click it to open the Plan Work modal

4. **Step 1: Select Time Slot**:
   - The modal opens with **Step 1: Time Selection**
   - **Select Skill Mapping**: If the work requires multiple skills, select which skill combination you're planning for
   - **From Date** and **To Date**: Choose the calendar span for the planned work (often the same as the production date; use different dates only when the planned window crosses midnight or multiple days)
   - **From Time**: Select the start time from the shift’s allowed slots (typically 15-minute intervals)
   - **To Time**: The system may auto-calculate from standard time (**Auto Calculate End Time** when available), or select manually
   - **Duration / planned hours**: Based on the elapsed time between the selected **from** and **to** times for that window (simple duration for the slot)
   - Review any warnings shown (e.g., overlaps with other work, shift configuration)

5. **Continue to Step 2**:
   - Click **"Next"** or **"Continue"** button
   - This takes you to **Step 2: Worker Selection**

6. **Step 2: Select Workers**:
   - The system shows available workers filtered by:
     - The time slot you selected
     - The skills required
     - Worker availability
   - **For each required skill**:
     - Click on a worker from the available list
     - The worker will be selected and highlighted
     - You can see worker details (name, skill, availability)
   - **Multi-Skill Works**: If the work requires multiple skills, you'll need to select one worker for each skill
   - **Adding Trainees (Optional)**:
     - You can add up to 2 trainees per work
     - Click "Add Trainee" button
     - Select trainees from the available list (trainees have skill code 'T')
     - You must provide a reason for adding trainees (deviation reason)
     - Trainees are added to help with the work but don't replace the main worker
     - Maximum of 2 trainees allowed per work
   - **Custom from/to times per assignment (Optional)**:
     - Under each selected **main worker** or **trainee**, you can enable **"Custom from/to times for this assignment"**
     - When enabled, pick **From time** and **To time** for that person only (still within the shift’s time slots). Other assignments keep the shared Step 1 window unless they also use custom times
     - Uncheck the option to clear custom times and use the shared window again
     - If custom times are enabled, both from and to must be filled before saving; incomplete custom rows show a validation message
   - The system shows warnings if:
     - Worker has time conflicts
     - Worker doesn't have the required skill
     - Worker is already assigned to overlapping work

7. **Review Warnings**:
   - Check the warnings section at the bottom
   - **Time Overlap Warning**: Worker is already assigned to another work in the same time
   - **Time Excess Warning**: Worker's total planned hours exceed shift hours
   - **Skill Mismatch Warning**: Worker doesn't have the required skill
   - Some **time conflicts** are **blocking**: the system will not save until workers’ times no longer overlap other draft plans (you’ll see a message to resolve conflicts first)
   - **Planning blocked**: If the daily plan for this stage/shift/date is already submitted or approved, planning may be blocked for that date (message explains why)

8. **Save the Plan**:
   - Click **"Save Plan"** or **"Save"** button
   - The system will:
     - Create planning records
     - Assign workers to the work
     - Set work status to "Draft Plan"
   - You'll see a success message

9. **Verify Plan Created**:
   - Go to the **"Draft Plan"** tab
   - You should see your planned work listed
   - The work shows:
     - Work details
     - Assigned workers
     - Time slots
     - Status: "Draft Plan"

#### Method 2: Plan from Draft Plan Tab

You can also plan works directly from the Draft Plan tab, which shows all works that need planning.

**Tips for Planning**:
- Plan works in order of priority
- Consider worker availability and skills
- Avoid time overlaps when possible
- Use the search function to find specific works
- You can plan multiple works for the same time slot if they use different workers

**What Happens Behind the Scenes**:
- Creates records in `prdn_work_planning` table
- Links workers to works via `prdn_planning_manpower` table
- Updates work status from "To be Planned" to "Draft Plan"
- Calculates planned hours and validates against shift hours

**Prerequisites**:
- Work must exist in Works tab with status "To be Planned"
- Workers must be registered in HR > Employee
- Workers must have the required skills
- Date must be selected
- Shift must be configured with start/end times
- Trainees (if adding) must be registered in HR > Employee with skill code 'T'

**Adding Trainees to Planned Work**:

You can add trainees to existing planned work from the Plan tab:

1. **Navigate to Plan Tab**:
   - Go to **Production** > Your Stage/Shift
   - Click on the **"Plan"** tab
   - Select the date

2. **Find the Planned Work**:
   - Find the work group you want to add trainees to
   - Works are grouped by work code

3. **Click "Add Trainees" Button**:
   - Click the **"Add Trainees"** button for the work group
   - The Add Trainees modal opens

4. **Select Trainees**:
   - The system shows available trainees (employees with skill code 'T')
   - Select up to 2 trainees (maximum limit)
   - The system prevents selecting more than 2 trainees
   - If 2 trainees already exist, you'll see a message: "Maximum of 2 trainees already planned for this work"

5. **Provide Deviation Reason**:
   - Enter a reason for adding trainees (required field)
   - This is mandatory to track why trainees were added

6. **Save**:
   - Click **"Save"** button
   - The system creates planning records for the trainees
   - Trainees are linked to the same work with skill requirement 'T'

**Important Notes**:
- Maximum of 2 trainees per work (enforced by the system)
- Trainees don't replace main workers - they are additional
- You must provide a deviation reason when adding trainees
- Trainees are shown in the plan with skill code 'T'
- Trainees can be added to both draft and approved plans

---

### 4. How to Modify a Planned Work

**Purpose**: Edit an existing plan to change workers, time slots, or other planning details.

**When to Use**:
- You need to change the assigned worker
- You need to adjust the time slot
- Worker is unavailable and needs to be replaced
- Time slot needs to be rescheduled

**Step-by-Step Instructions**:

1. **Navigate to Draft Plan Tab**:
   - Go to **Production** > Your Stage/Shift
   - Click on the **"Draft Plan"** tab
   - Select the date you want to modify plans for

2. **Find the Planned Work**:
   - Scroll through the list or use the search box
   - Find the work you want to modify
   - Works are grouped by work code
   - Each work shows:
     - Work details
     - Assigned workers
     - Time slots
     - Status

3. **Click "Edit" Button**:
   - Find the **"Edit"** button (or icon) for the work you want to modify
   - Click it to open the Plan Work modal (same as planning)

4. **Modify the Plan**:
   - The modal opens with existing plan details pre-filled
   - **Change Time Slot**:
     - Modify "From Time" and "To Time" in Step 1
     - Click "Next" to go to Step 2
   - **Change Workers**:
     - In Step 2, deselect current workers
     - Select new workers from the available list
   - **Change Skill Mapping**:
     - Go back to Step 1
     - Select a different skill mapping if available

5. **Review Changes**:
   - Check for any new warnings
   - Verify the changes are correct
   - Review worker availability

6. **Save Changes**:
   - Click **"Save Plan"** button
   - The system updates the existing plan
   - You'll see a success message

7. **Verify Changes**:
   - Go back to Draft Plan tab
   - Refresh if needed
   - Verify the work shows updated information

**Important Notes**:
- You can only edit plans that are in "Draft Plan" status
- Once a plan is submitted (status "Submitted" or "Approved"), you cannot edit it directly
- If a plan is rejected, you can edit and resubmit it
- Editing a plan updates all related records (workers, time slots, etc.)

**What Happens Behind the Scenes**:
- Updates existing records in `prdn_work_planning` table
- Updates worker assignments in `prdn_planning_manpower` table
- Recalculates planned hours
- Validates against constraints

**Prerequisites**:
- Plan must exist in Draft Plan tab
- Plan status must be "Draft Plan" or "Rejected"
- New workers (if changing) must be available
- New time slot (if changing) must be valid

---

### 5. How to Delete a Planned Work

**Purpose**: Remove a planned work from the plan. This is useful when work is cancelled or no longer needed.

**When to Use**:
- Work is cancelled and won't be performed
- Work was planned by mistake
- Work needs to be removed from the plan

**Step-by-Step Instructions**:

#### Method 1: Delete Single Work

1. **Navigate to Draft Plan Tab**:
   - Go to **Production** > Your Stage/Shift
   - Click on the **"Draft Plan"** tab
   - Select the date

2. **Find the Planned Work**:
   - Find the work you want to delete
   - Works are grouped by work code

3. **Click "Delete" Button**:
   - Find the **"Delete"** button (or trash icon) for the work
   - Click it
   - A confirmation dialog will appear

4. **Confirm Deletion**:
   - Review the work details shown in the confirmation
   - Click **"Confirm"** or **"Delete"** to proceed
   - Or click **"Cancel"** to abort

5. **Verify Deletion**:
   - The work should disappear from the Draft Plan tab
   - Go to Works tab to verify work status changed back to "To be Planned"

#### Method 2: Delete All Plans for a Work

If a work has multiple skill competencies planned, you can delete all at once:

1. **In Draft Plan Tab**:
   - Find the work group
   - Click **"Delete All Plans"** button for that work
   - Confirm the deletion
   - All plans for that work will be deleted

#### Method 3: Multi-Select Delete

1. **Select Multiple Works**:
   - In Draft Plan tab, use checkboxes to select multiple works
   - You can select works across different work orders

2. **Click "Delete Selected"**:
   - Click the **"Delete Selected"** button (appears when works are selected)
   - Confirm deletion
   - All selected works will be deleted

**Important Notes**:
- You can only delete plans in "Draft Plan" status
- Once submitted, plans cannot be deleted (they must be cancelled instead - see Plan Tab section)
- Deleting a plan returns the work status to "To be Planned"
- The work itself is not deleted, only the plan

**What Happens Behind the Scenes**:
- Marks planning records as deleted (`is_deleted = true`)
- Removes worker assignments
- Updates work status back to "To be Planned"
- Frees up worker time slots

**Prerequisites**:
- Plan must exist in Draft Plan tab
- Plan status must be "Draft Plan"
- You must have permission to delete plans

---

### 6. How to Submit a Plan

**Purpose**: Submit your draft plan for approval. Once submitted, the plan moves to "Submitted" status and cannot be edited until approved or rejected.

**When to Use**:
- You've finished planning all works for the date
- You've reviewed the draft plan and it's ready
- You want to lock the plan for approval

**Step-by-Step Instructions**:

1. **Navigate to Draft Plan Tab**:
   - Go to **Production** > Your Stage/Shift
   - Click on the **"Draft Plan"** tab
   - Select the date you want to submit the plan for

2. **Review Your Plan**:
   - Scroll through all planned works
   - Verify:
     - All required works are planned
     - Workers are assigned correctly
     - Time slots are appropriate
     - No critical warnings exist
   - Use the search box to find specific works if needed

3. **Check Submission Status**:
   - At the top of the Draft Plan tab, you'll see the submission status:
     - **"To be Submitted"**: No submission yet, ready to submit
     - **"Submitted"**: Already submitted, waiting for approval
     - **"Approved"**: Plan has been approved
     - **"Rejected"**: Plan was rejected, can be edited and resubmitted
     - **"Resubmitted"**: Plan was resubmitted after rejection

4. **Resolve Validation Issues** (if any):
   - Before submitting, the system validates:
     - All workers have valid shift assignments
     - No critical time conflicts
     - Required fields are filled
   - If there are validation errors, fix them before submitting
   - Warnings may appear but won't block submission (you'll be asked to confirm)

5. **Click "Submit Plan" Button**:
   - Find the **"Submit Plan"** button (usually at the top right)
   - The button may be disabled if:
     - No plans exist
     - Plan is already submitted and pending approval
     - Plan is already approved
   - Click the button when it's enabled

6. **Confirm Submission**:
   - If there are validation warnings, a confirmation dialog appears
   - Review the warnings
   - Click **"Proceed"** to submit despite warnings, or **"Cancel"** to fix issues first
   - If no warnings, submission proceeds immediately

7. **Wait for Processing**:
   - You'll see a loading indicator
   - The system processes the submission
   - This may take a few seconds

8. **Verify Submission**:
   - After successful submission:
     - Status changes to "Submitted" or "Resubmitted"
     - Submit button becomes disabled
     - Plans move from Draft Plan tab to Plan tab
     - You can no longer edit plans (until approved/rejected)

9. **View Submitted Plan**:
   - Go to the **"Plan"** tab
   - You should see all your submitted plans
   - Status shows "Submitted" or "Pending Approval"
   - You can export to Excel/PDF from here

**What Happens Behind the Scenes**:
- Creates a submission record in `prdn_planning_submissions` table
- Updates all plan records to link to the submission
- Changes plan status from "Draft Plan" to "Submitted"
- Locks plans from editing
- Triggers approval workflow

**After Submission**:
- Plans are sent for approval (if approval workflow is enabled)
- Once approved, work status changes to "Planned"
- Once approved, you can proceed to reporting
- If rejected, you can edit and resubmit

**Important Notes**:
- You can submit multiple times (creates new version if previous was rejected)
- Each submission gets a version number
- Once approved, plans cannot be edited (must use Cancel Work feature in Plan tab)
- Submission creates a snapshot of the plan at that moment

**Prerequisites**:
- At least one work must be planned in Draft Plan tab
- Date must be selected
- All validation checks should pass (warnings are optional)
- Plan must be in "Draft Plan" or "Rejected" status

---

### 7. How to Report a Plan (Report Work Completion)

**Purpose**: Report the actual completion of planned work. This includes recording actual hours worked, completion status, and any deviations from the plan.

**When to Use**:
- Work has been completed (or partially completed)
- You need to record actual hours worked
- You need to report completion status
- Work deviated from the plan

**Step-by-Step Instructions**:

<span id="step-71-record-employee-attendance-manpower-report"></span>

#### Step 7.1: Record Employee Attendance (Manpower Plan & Manpower Report)

Before reporting work, record each employee’s **attendance** (Present, Absent Informed, or Absent Uninformed) and, when Present, their **attendance window** and optional **C-Off** on **Manpower Report**. For **planning**, use **Manpower Plan** the same way so planned hours and attendance line up with works.

1. **Navigate to Manpower Plan or Manpower Report**:
   - Go to **Production** > Your Stage/Shift
   - Open **Manpower Plan** (planned attendance for the day) or **Manpower Report** (actual attendance before/during reporting)
   - Select the **date** at the top of the page

2. **Mark attendance (single employee)**:
   - In the employee table, click **Mark Attendance** (or **Attendance Locked** if the plan/report for that date is already submitted or approved and attendance cannot be changed)
   - The **Mark Attendance** modal opens

3. **In the Mark Attendance modal — status**:
   - Choose **Present**, **Absent (Informed)**, or **Absent (Uninformed)**. Any absence clears attendance **from/to** date and time, **C-Off**, and **OT** for that row (same as the on-screen hints).
   - **Shift times** (when **Present** only):
     - **From date** / **From time** and **To date** / **To time**: the wall-clock span this employee is counted present for that stage/shift. Usually all four are the **same calendar day** as the selected production date; you can extend **To date** (e.g. overnight shift) when your process requires it
     - Hours (**Planned** on Manpower Plan, **Actual** on Manpower Report) are derived from the time range **minus configured shift breaks**
   - **C-Off (optional)** — only when **Present**:
     - **Value (days)**: `0`, `0.5 (4h)`, `1 (8h)`, or `1.5 (12h)` net time off
     - When value &gt; 0: set **C-Off from date** and **from time** (required). **To date** / **To time** default from net hours plus shift breaks in that window and can be edited
     - C-Off is only allowed when net attendance (excluding breaks) is **exactly 4, 8, or 12 hours**; the C-Off window must lie **fully inside** the attendance from/to date and time (widen the attendance span if needed)
   - **Notes**: Required when attendance is **partial** (hours less than full shift in planning; in reporting, when actual hours are below planned or below full shift—see on-screen label)

4. **Bulk mark attendance**:
   - Select multiple employees (checkboxes), then use the bulk attendance action when available
   - Same fields apply: status (including informed vs uninformed absence), from/to date and time for **Present**, optional C-Off for **Present**, notes when partial

5. **Filters** (Manpower Plan and Manpower Report toolbars, when shown):
   - You can narrow the table by attendance status, including **Absent (Informed)** and **Absent (Uninformed)** separately

6. **Table columns** (Plan and Report tables):
   - **Status** (Present / Absent informed / Absent uninformed — labels may abbreviate, e.g. **A(I)** / **A(U)**), **C-Off value** (sortable), planned/reported hours columns, and actions (**Mark Attendance**, reassign, journey, etc.) as shown on screen
   - On **Manpower Report**, rows with **Absent (Uninformed)** may use a **red-tinted** row background so they stand out in the list

7. **Overtime** (shift totals): Calculated and confirmed from **Draft Report** (**Report OT**), not inside this modal — see **Detailed Overtime Reporting** below.

**Detailed Overtime Reporting**:

Overtime can be reported from the Draft Report tab:

1. **Navigate to Draft Report Tab**:
   - Go to **Production** > Your Stage/Shift
   - Click on the **"Draft Report"** tab
   - Select the date

2. **Check for Overtime**:
   - The system automatically calculates if there's overtime based on:
     - Shift hours
     - Actual hours worked by employees
     - Time worked beyond shift end time
   - If overtime exists, the **"Report OT"** button becomes enabled
   - The button shows "Calculating..." while the system checks

3. **Click "Report OT" Button**:
   - Click the **"Report OT"** button at the top of the Draft Report tab
   - **Note**: This button is disabled if:
     - No overtime exists
     - Overtime is already reported
     - Report is already submitted or approved

4. **Review Overtime Details**:
   - The system shows calculated overtime for all employees
   - Overtime is calculated per employee based on:
     - Actual work hours
     - Shift end time
     - Hours worked beyond shift hours

5. **Confirm Overtime Report**:
   - Review the overtime amounts
   - The system automatically calculates overtime minutes and amounts
   - Click **"Save"** or **"Confirm"** to record overtime
   - Overtime is recorded in the reporting records

**Important Notes**:
- Overtime is calculated automatically based on shift hours and actual work time
- Overtime must be reported before submitting the daily report
- Once the report is submitted or approved, overtime cannot be modified
- Overtime calculations consider shift breaks and actual work duration
- The system validates that overtime is reasonable (not exceeding maximum limits)

**Prerequisites**:
- Employees must have **attendance** recorded on **Manpower Report** when applicable (**Present** with times, or **Absent** informed/uninformed as appropriate)
- Work must be reported with actual times
- Shift must be configured with start/end times
- Report must be in draft status

#### Step 7.2: Report Work Completion (Draft Report)

1. **Navigate to Plan Tab**:
   - Go to **Production** > Your Stage/Shift
   - Click on the **"Plan"** tab
   - Select the date
   - You'll see all approved/submitted plans

2. **Find Work to Report**:
   - Scroll through planned works
   - Find the work you want to report
   - Works are grouped by work code
   - Each work shows planned details

3. **Click "Report" Button**:
   - Find the **"Report"** button for the work you completed
   - Click it to open the Report Work modal

4. **Fill in Report Details**:
   - **Completion Status**: Select from dropdown
     - **"C" (Completed)**: Work is fully completed
     - **"NC" (Not Completed)**: Work is not completed
   - **From Time**: Enter actual start time
   - **To Time**: Enter actual end time
   - **Hours Worked Today**: System calculates from times, or enter manually
   - **Total Hours Worked**: Cumulative hours worked on this work (across all days)
   - **Overtime Hours**: If work extended beyond shift hours
   - **Lost Time** (if applicable): Time lost due to issues
   - **Lost Time Reason**: Select reason from dropdown (if lost time entered)
   - **Notes**: Any additional comments

5. **Select Workers**:
   - The system shows planned workers
   - Verify actual workers who performed the work
   - You can change workers if different from plan
   - For **multi-skill** works, the **Report** flow uses a multi-skill report screen: assign workers per skill (and trainees if applicable), then continue to lost time / save as prompted

6. **Per-worker from/to times (planning and reporting)**:
   - **Plan Work (modal)**: In **Step 2**, after choosing the shared time window in **Step 1**, each **main worker** and **trainee** can optionally use **Custom from/to times for this assignment** so that person’s planned **from** and **to** times differ from the shared slot (still chosen from the shift’s time list). This is the same pattern whether you plan from the **Works** tab or edit a draft plan.
   - **Report (multi-skill modal)**: For works reported through the **multi-skill report** flow, you set an overall **from/to date and time** for the report, then—under each worker or trainee—you can again enable **Custom from/to times for this assignment** so each person’s **actual** reporting window can differ from the shared times.
   - **Report (single-work modal)**: For a standard single-work **Report** dialog, **From time** and **To time** usually describe the overall work interval; use multi-skill reporting when each worker needs different times.

7. **Review and Save**:
   - Review all entered information
   - Check for any warnings
   - Click **"Save Report"** or **"Report"** button
   - The report is saved as "Draft Report"

8. **Verify Report Created**:
   - Go to **"Draft Report"** tab
   - You should see your reported work
   - Status shows "Draft Report"
   - You can edit it before final submission

#### Step 7.3: Edit Draft Report (if needed)

1. **Navigate to Draft Report Tab**:
   - Go to **"Draft Report"** tab
   - Find the work you want to edit

2. **Click "Edit" Button**:
   - Click **"Edit"** for the work
   - Modify any details
   - Save changes

#### Step 7.4: Report Unplanned Work

**Purpose**: Report work that was completed but was not planned in advance. This creates both planning and reporting records for work that happened outside the normal planning process.

**When to Use**:
- Work was completed but wasn't planned beforehand
- Emergency work or urgent tasks were performed
- Work was done that wasn't in the original plan
- You need to report work that doesn't have a planning record

**Step-by-Step Instructions**:

1. **Navigate to Draft Report Tab**:
   - Go to **Production** > Your Stage/Shift
   - Click on the **"Draft Report"** tab
   - Select the date

2. **Click "Report Unplanned Work" Button**:
   - Find the **"Report Unplanned Work"** button at the top of the Draft Report tab
   - Click it to open the Report Unplanned Work modal
   - **Note**: This button is disabled if the report is already submitted or approved

3. **Select Unplanned Work**:
   - The modal shows a list of works that exist in the system but don't have planning records
   - These are works that were never planned but need to be reported
   - Scroll through the list or use search to find the work
   - Click on a work to select it
   - The selected work will be highlighted

4. **Click "Report" Button**:
   - After selecting a work, click the **"Report"** button
   - This opens the Unplanned Work Report modal (similar to regular reporting)

5. **Fill in Report Details**:
   - **Work Details**: Pre-filled from the selected work
   - **From Time**: Enter actual start time
   - **To Time**: Enter actual end time
   - **Hours Worked Today**: System calculates from times
   - **Select Workers**: 
     - Assign workers for each required skill competency
     - Workers must have the required skills
     - You can assign multiple workers if the work requires multiple skills
   - **Lost Time** (if applicable): Time lost due to issues
   - **Lost Time Reason**: Select reason from dropdown
   - **Breakdown** (if applicable): Detailed breakdown of lost time by worker and reason
   - **Notes**: Any additional comments

6. **Review and Save**:
   - Review all entered information
   - Check for any warnings
   - Click **"Save Report"** or **"Report"** button
   - The system will:
     - Create planning records for the unplanned work (marked as `report_unplanned_work = true`)
     - Create reporting records for the work
     - Link workers to the work
     - Set appropriate statuses

7. **Verify Report Created**:
   - Go back to **"Draft Report"** tab
   - Refresh the page
   - You should see the unplanned work now listed in the draft reports
   - The work will also appear in the **"Plan"** tab (since planning records were created)

**Important Notes**:
- Unplanned work reporting creates both planning and reporting records
- The planning records are marked with `report_unplanned_work = true` to distinguish them from regular planned work
- You can only report unplanned work before submitting the daily report
- Once the report is submitted or approved, the "Report Unplanned Work" button is disabled
- Unplanned work appears in both Plan and Report tabs after reporting
- All validation rules apply (worker skills, time slots, etc.)

**What Happens Behind the Scenes**:
- Creates records in `prdn_work_planning` table with `report_unplanned_work = true`
- Creates records in `prdn_work_reporting` table
- Links workers via `prdn_planning_manpower` and `prdn_reporting_manpower` tables
- Updates work status appropriately

**Prerequisites**:
- Work must exist in the Works tab (but not have planning records)
- Workers must be registered in HR > Employee
- Workers must have the required skills
- Date must be selected
- Report must not be submitted or approved yet

---

#### Step 7.5: Submit Final Report

1. **Navigate to Draft Report Tab**:
   - Go to **"Draft Report"** tab
   - Review all reports
   - Ensure all completed works are reported (including unplanned work)

2. **Click "Submit Report" Button**:
   - Find the **"Submit Report"** button (top right)
   - Click it to submit all draft reports

3. **Confirm Submission**:
   - Review any warnings (e.g., overtime calculations)
   - Confirm submission
   - System processes the submission

4. **Verify Submission**:
   - Go to **"Report"** tab
   - You should see all submitted reports
   - Status shows "Submitted" or "Pending Approval"
   - Reports are now final

**Multi-Work Reporting**:

You can report multiple works at once:

1. **In Plan Tab**:
   - Select multiple works using checkboxes
   - Click **"Report Selected"** button
   - Fill in report details for all selected works
   - Save all at once

**What Happens Behind the Scenes**:
- Creates records in `prdn_work_reporting` table
- Links to planning records
- Calculates actual hours worked
- Updates work status to "Reported"
- Calculates piece rates (if work is completed)
- Updates work order progress

**Important Notes**:
- You can only report works that are in "Planned" or "Approved" status
- Completion status "C" triggers piece rate calculation
- Multiple workers can report on the same work (piece rate is distributed)
- Reports can be exported to Excel/PDF from Report tab

**Prerequisites**:
- Plan must be submitted and approved
- Work must be in "Planned" status
- Employees must have **attendance** marked on **Manpower Report** for the date (as required by your process)
- Date must be selected

---

### Production Module - Additional Features

#### Work Orders Tab

**Purpose**: View and manage work orders in your stage.

**Features**:
- View all work orders assigned to your stage
- See work order status and details
- Enter work orders into the stage (see section 1)
- Exit work orders from the stage

**How to Use**:
- Navigate to **Work Orders** tab
- Use date picker to select date
- View work order list
- Click **"Entry"** to enter a work order
- Click **"Exit"** when work order leaves your stage

#### Works Tab

**Purpose**: View all works (standard and non-standard) for work orders in your stage.

**Features**:
- View all works with their status
- Add non-standard works (see section 2)
- Remove works
- Plan works (see section 3)
- View work history

**How to Use**:
- Navigate to **Works** tab
- View works list
- Use **"Add Work"** to add non-standard works
- Use **"Plan"** button to plan works
- Use **"Remove"** to remove works (if not yet planned)

#### Manpower Plan Tab

**Purpose**: Plan employee assignments and **planned attendance** for the date (same attendance model as reporting).

**Features**:
- View planned employee attendance, **Status**, and **C-Off value** (sortable column)
- **Mark Attendance** / **Bulk** mark: Present / Absent (Informed) / Absent (Uninformed); **from/to date and time** when Present; optional **C-Off** (value and window); notes when partial attendance applies
- Assign employees to shifts; stage reassignment for part of the day
- Export manpower plan

**How to Use**:
- Navigate to **Manpower Plan** tab and select the **date**
- View the employee list; use **Mark Attendance** on a row (or bulk actions after selecting checkboxes) to open the modal—details match [Step 7.1](#step-71-record-employee-attendance-manpower-report)
- When the plan for that date is submitted or approved, attendance may show as locked (read-only) like on Manpower Report
- Plan is automatically created when you plan works

#### Stage reassignment: which stage submits the reassignment

When you **reassign** an employee to another stage for part of the day (Manpower Plan or Manpower Report), that action does **not** change the employee’s permanent stage in HR. It records a **time-bounded visit** to another stage.

**Important — who clicks “Submit plan” / “Submit report” for those lines:**

- A reassignment **from your stage to another stage** (e.g. **P1S2 → P1S3**) is tied to the **receiving** stage in the system. The **receiving stage** (e.g. **P1S3**) must include that segment when **they** submit plan or report for that date.
- A reassignment **into your stage** from elsewhere (e.g. **P1S4 → P1S2**) is included when **your** stage submits, because your stage is the **destination**.

So: **the stage that receives the employee for that interval is responsible for submitting** that reassignment as part of its own submission for that date—not the stage that sent the employee away.

Full detail and examples for teams and developers: see **`PRODUCTION_STAGE_REASSIGNMENT_SUBMISSION.md`** in the project repository.

#### Plan Tab

**Purpose**: View submitted and approved plans.

**Features**:
- View all submitted plans
- Export plans to Excel/PDF
- Cancel approved works (if needed)
- Report works (see section 7)
- View plan history

**How to Use**:
- Navigate to **Plan** tab
- View submitted plans
- Click **"Generate Excel"** or **"Generate PDF"** to export
- Click **"Report"** to report work completion
- Click **"Cancel Work"** to cancel an approved work (requires reason)

**Detailed Cancel Work Process**:

1. **Navigate to Plan Tab**:
   - Go to **Production** > Your Stage/Shift
   - Click on the **"Plan"** tab
   - Select the date
   - You'll see all approved/submitted plans

2. **Find Work to Cancel**:
   - Scroll through planned works
   - Find the work you want to cancel
   - Works are grouped by work code
   - Each work shows planned details

3. **Click "Cancel" Button**:
   - Find the **"Cancel"** button for the work you want to cancel
   - **Note**: Cancel button is disabled if:
     - Work is already cancelled
     - Work has been reported (completed)
   - Click the **"Cancel"** button

4. **Enter Cancellation Reason**:
   - A modal opens asking for cancellation reason
   - **Reason is required** - you must provide a reason
   - Enter a clear explanation, for example:
     - "Work order cancelled by customer"
     - "Material not available"
     - "Work no longer required"
     - "Stage change required"

5. **Confirm Cancellation**:
   - Review the cancellation reason
   - Click **"Confirm"** or **"Cancel Work"** button
   - A confirmation dialog appears showing:
     - Number of work plans to be cancelled
     - Warning that action cannot be reversed
     - Cancellation reason
   - Click **"Yes"** to confirm or **"No"** to cancel

6. **Verify Cancellation**:
   - Go back to Plan tab
   - Refresh if needed
   - The cancelled work should show:
     - Status: "Cancelled"
     - Cancellation reason visible
     - Workers are freed from the assignment
     - Work is no longer available for reporting

**Important Notes**:
- Cancellation is permanent and cannot be reversed
- Once cancelled, work cannot be reported
- Workers assigned to cancelled work are freed immediately
- Cancellation reason is recorded for audit purposes
- You can only cancel works that are approved/submitted but not yet reported
- If work has multiple skill competencies, all are cancelled together

**What Happens Behind the Scenes**:
- Updates work status to "Cancelled" in `prdn_work_planning` table
- Records cancellation reason
- Frees worker assignments
- Updates work order status if applicable
- Creates audit trail of cancellation

**Prerequisites**:
- Work must be in "Approved" or "Submitted" status
- Work must not be reported yet
- User must have permission to cancel works

#### Manpower Report Tab

**Purpose**: Record **actual** employee attendance for the date before or while reporting work.

**Features**:
- **Mark Attendance** (single or bulk): Present / Absent (Informed) / Absent (Uninformed); **from date/time** and **to date/time** when Present; optional **C-Off** when Present; **Notes** when partial
- Table columns include **Status**, **C-Off value**, planned vs actual hours, reassign/journey actions as on screen
- Overtime for the shift is handled from **Draft Report** (**Report OT**), not from this tab’s old entry/exit-only flow

**How to Use**:
- Navigate to **Manpower Report** tab and select the **date**
- Click **Mark Attendance** on each employee (or use bulk mark when available). See [Step 7.1](#step-71-record-employee-attendance-manpower-report) for field rules and validation
- After the daily report is submitted or approved, rows may show **Attendance Locked**

#### Draft Report Tab

**Purpose**: Create and edit draft work reports before final submission.

**Features**:
- View all draft reports
- Edit draft reports
- Delete draft reports
- Submit all reports

**How to Use**:
- Navigate to **Draft Report** tab
- View draft reports
- Click **"Edit"** to modify a report
- Click **"Submit Report"** to submit all reports

#### Report Tab

**Purpose**: View final submitted reports.

**Features**:
- View all submitted reports
- Export reports to Excel/PDF
- View report details
- See completion status and hours worked

**How to Use**:
- Navigate to **Report** tab
- View submitted reports
- Click **"Generate Excel"** or **"Generate PDF"** to export
- Use search to find specific reports

---

### Production Module - Prerequisites Summary

Before using the Production module, ensure:

1. **Work Orders**:
   - Work orders exist in Sales module
   - Work orders have models assigned
   - Work orders are scheduled (via Planning > Entry Plan)

2. **Standards**:
   - Standard works are defined (Standards > Works)
   - Work flow is configured (Standards > Work Flow)
   - Skill combinations are defined (Standards > Skill Combinations)
   - Time standards are set (Standards > Works > Time Standards)

3. **HR**:
   - Employees are registered (HR > Employee)
   - Shifts are configured (HR > Shift Master)
   - Skills are assigned to employees

4. **Planning**:
   - Entry plans are created (Planning > Entry Plan)
   - Production dates are configured
   - Lead times are set (Planning > Lead Times)

---

### Production Module - Common Workflows

#### Daily Production Workflow

1. **Morning**:
   - Check Work Orders tab for new arrivals
   - Enter work orders into stage
   - Mark employee attendance (**Manpower Plan** and/or **Manpower Report**): **Mark Attendance** with from/to date and time (and optional C-Off)

2. **Planning** (if not done previous day):
   - Go to Works tab
   - Plan all works for the day
   - Review draft plan
   - Submit plan for approval

3. **During Shift**:
   - Monitor work progress
   - Update plans if needed (before submission)

4. **End of Shift**:
   - Confirm or adjust **Manpower Report** attendance if times changed during the shift
   - Report work completion (Draft Report); use **Report OT** if overtime applies
   - Submit final reports

#### Weekly Workflow

- **Monday**: Plan works for the week
- **Daily**: Execute daily workflow
- **Friday**: Review weekly reports, export data

---

### Production Module - Tips & Best Practices

1. **Planning**:
   - Plan works in advance (day before or early morning)
   - Review worker availability before planning
   - Avoid time overlaps when possible
   - Plan high-priority works first

2. **Reporting**:
   - Report work as soon as it's completed
   - Be accurate with time entries
   - Report deviations promptly
   - Complete all reports before end of shift

3. **Data Entry**:
   - Double-check work order numbers
   - Verify dates before submitting
   - Review warnings before proceeding
   - Keep records accurate

4. **Troubleshooting**:
   - If work doesn't appear, check work order entry
   - If worker not available, check HR records
   - If time slot invalid, check shift configuration
   - If plan can't be submitted, check validation errors

### Central Production Dashboard

**Path**: `/production/dashboard`

**Description**: 
**Central Production Dashboard** gives a read-only summary across **all** configured plant–stage–shift combinations for a selected date. It is intended for production managers who need a single view of attendance, works, lost time, and submission status without opening each stage/shift page separately.

**Features**:
- **Date**: Pick the production date to analyze.
- **View**: Planning only, Reporting only, or **Both** (filters how metrics and validations are presented).
- **Production Circle (Hierarchy)**: Interactive diagram—click **plant** (outer ring), then **stage** (middle band), then **shift** (inner ring) to select a stage/shift. Drill-down instructions appear on screen.
- **Entire Production** totals: Manpower (planned vs reported), works planned vs reported, work orders planned vs reported, lost time (WO count and minutes).
- **Selected stage/shift panel**: When a shift is selected, shows detailed metrics, validation (planning/reporting), manpower plan vs report lists, and lost-time reasons (as applicable).
- **Open Full Page**: Jumps to the full Production page for that stage/shift (`/production/[stageCode]-[shiftCode]`) for the same day’s operations.
- **Pending submissions**: Lists pending plan/report approvals where configured.
- **Back to Dashboard**: Returns to the main application dashboard (`/dashboard`).

**How to Use**:

1. Go to **Production > Central Production Dashboard** (menu label may vary).
2. Set the **Date** and **View** (Planning / Reporting / Both).
3. Use the **Production Circle** to select a plant → stage → shift.
4. Review totals and the selected shift’s details; use **Open Full Page** to work in the full Production module for that stage/shift.

**Prerequisites**:
- Plant–stage–shift configuration must exist (otherwise the circle shows no hierarchy).
- Read-only for managers; actual planning/reporting still happens on the stage/shift Production page.

**Areas Affected**:
- None (read-only view and navigation; no data changes from this page alone)

### Shift change

**Path**: `/production/shift-change`

**Description**: 
**Shift change** lets authorized users move **active employees** from one shift to another **within a stage**. Updates are written to employee shift (`hr_emp.shift_code`) and an audit log (`prdn_emp_shift_change_log`). Use this when workers’ shifts are reassigned (e.g. rotation or coverage) without editing each employee record manually in HR.

**Features**:
- Select a **stage** to load active employees for that stage (employee ID, name, skill, current shift code/name).
- **Select** employees (checkboxes; select all on page available).
- **Change shift**: Opens a modal with **allowed target shifts** (only alternatives that apply to the current selection).
- **View shift history** per employee: Opens a modal with past shift-change log entries.

**How to Use**:

1. Go to **Production > Shift change**.
2. Choose a **stage** from the dropdown. The employee list loads.
3. Select one or more employees who need a new shift.
4. Click **Change shift** (shows count of selected). Pick the **new shift** in the modal and confirm.
5. The list refreshes; a message shows how many rows were updated (some may be skipped if already on the target shift).
6. Use **View shift history** on a row to see past changes for that employee.

**Prerequisites**:
- Active employees must be assigned to the stage with valid shift codes.
- Target shifts must exist in **HR > Shift Master** (active shifts).
- Appropriate menu access.

**Areas Affected**:
- Employee shift assignment (`hr_emp.shift_code`)
- Production planning and reporting (manpower is tied to shift)

### Plan Review

**Path**: `/production/plan-review`

**Description**: 
Review submitted planning for a shift/date: compare the **works plan** (PDF-style view) with a **Manpower Plan** grid for the same submission.

**Features**:
- Tabs typically include **Works Plan** (plan PDF viewer) and **Manpower Plan** (table of planned attendance per employee / reassignment rows)
- On **Manpower Plan**, rows marked **Absent (Uninformed)** use a **highlight** (e.g. light red background) so uninformed absences stand out during approval/review
- Navigate through submissions/work orders per your screen flow; print or download plan documents where available

**How to Use**:
1. Navigate to Production > Plan Review
2. Select the submission or context your site uses (work order / date range as shown)
3. Review **Works Plan** and switch to **Manpower Plan** to inspect attendance badges (**P**, **A(I)**, **A(U)**) and hours
4. Use on-screen navigation controls as provided

**Prerequisites**:
- Production plans must be submitted
- PDF generation must be successful

**Areas Affected**:
- None (read-only view)

### Report Review

**Path**: `/production/report-review`

**Description**: 
Review submitted reporting for a shift/date: works report viewing plus a **Manpower Report** table aligned to the submission.

**Features**:
- Tabs typically include works/report viewing and **Manpower Report**
- On **Manpower Report**, rows with **Absent (Uninformed)** may be **highlighted** like Plan Review so reviewers spot uninformed absences quickly
- Print or download report documents where available

**How to Use**:
1. Navigate to Production > Report Review
2. Select the submission or filters as shown on screen
3. Open the **Manpower Report** tab when you need attendance-level detail
4. Use navigation controls to browse different reports or submissions

**Prerequisites**:
- Production reports must be submitted
- PDF generation must be successful

**Areas Affected**:
- None (read-only view)

---

## Planning Module

### Overview

The Planning module handles production planning, scheduling, and entry management. This section provides detailed, step-by-step instructions for all planning workflows.

**Main URL paths** (for bookmarks and support):

| Screen | Path |
|--------|------|
| Entry Plan | `/planning/entry-plan` |
| Schedule | `/planning/schedule` |
| Holiday List | `/planning/holiday-list` |
| Lead Times | `/planning/lead-times` |
| Order of Stages | `/planning/order-of-stages` |
| Entry Per Day | `/planning/entry-per-day` |
| Entry Per Shift | `/planning/entry-per-shift` |

---

## Planning Workflows - Step by Step

### 1. How to Create an Entry Plan for a Work Order

**Purpose**: Plan when a work order will enter each production stage. The system automatically calculates exit dates based on lead times, helping you schedule work orders through the entire production process.

**When to Use**:
- A new work order needs to be scheduled
- You need to plan work order flow through all stages
- You want to see calculated dates for each stage
- You need to schedule work orders in advance

**Step-by-Step Instructions**:

1. **Navigate to Entry Plan**:
   - Click on **Planning** in the sidebar menu
   - Select **Entry Plan**
   - The page loads showing work orders in different status tabs

2. **Select the Appropriate Tab**:
   - **"To be Planned"**: Work orders that haven't been planned yet
   - **"Chassis to be Received"**: Work orders waiting for chassis arrival
   - **"Documents to be Released"**: Work orders waiting for R&D documents
   - **"WIP"**: Work orders currently in production
   - **"To be Inspected"**: Work orders ready for inspection
   - **"To be Delivered"**: Work orders ready for delivery
   - Start with **"To be Planned"** tab for new work orders

3. **Filter Work Orders** (Optional):
   - Use the **Stage filter** dropdown to filter by specific stage
   - Use the **Search box** to search by work order number or model
   - This helps you find specific work orders quickly

4. **Select a Work Order**:
   - Scroll through the work order list
   - Each row shows:
     - Work Order Number (WO No)
     - PWO Number
     - Model
     - Customer Name
     - Current Stage (if any)
   - Find the work order you want to plan
   - Click the **"Create Plan"** button (green button with 📋 icon)

5. **Select Entry Slot**:
   - A modal opens: **"Entry Slot Selection"**
   - **Select Entry Date**: Click the date picker and select when the work order should enter the first stage
   - **Select Entry Time**: Choose the time (in 15-minute intervals)
   - **Toggle Past Entry Mode** (if needed):
     - If you're planning for a date in the past, toggle this ON
     - This allows you to backdate entry plans
   - Click **"Next"** or **"Calculate Dates"**

6. **Review Calculated Dates**:
   - The system automatically calculates:
     - Entry date/time for each stage
     - Exit date/time for each stage
     - Based on:
       - Lead times (from Planning > Lead Times)
       - Holiday list (from Planning > Holiday List)
       - Stage order (from Planning > Order of Stages)
   - Review the calculated dates in the **Plan Summary** modal
   - You'll see a table showing:
     - Stage Code
     - Entry Date/Time
     - Exit Date/Time
     - Lead Time (in days/hours)

7. **Verify Calculations**:
   - Check that dates make sense
   - Verify entry dates are after previous stage exit dates
   - Check that holidays are excluded
   - If dates need adjustment, go back and change entry date/time

8. **Save the Plan**:
   - Review all information in the Plan Summary
   - Click **"Save Plan"** button
   - The system creates production date records for all stages
   - You'll see a success message

9. **Verify Plan Created**:
   - The work order moves from "To be Planned" tab
   - Go to **Planning > Schedule** to see the planned dates
   - The work order is now scheduled and ready for production

**Example Scenario**:
- Work Order: WO-2024-001
- Model: Bus Model A
- Entry Date Selected: 15-Jan-2024, 09:00
- System Calculates:
  - Stage 1 Entry: 15-Jan-2024 09:00, Exit: 17-Jan-2024 17:00 (2 days lead time)
  - Stage 2 Entry: 18-Jan-2024 09:00, Exit: 20-Jan-2024 17:00 (2 days lead time)
  - Stage 3 Entry: 21-Jan-2024 09:00, Exit: 22-Jan-2024 17:00 (1 day lead time)

**Visual Description - Entry Slot Selection Modal**:
```
┌─────────────────────────────────────────┐
│  Entry Slot Selection                   │
├─────────────────────────────────────────┤
│  Work Order: WO-2024-001                │
│  Model: Bus Model A                     │
│                                         │
│  Entry Date: [15-Jan-2024 ▼]            │
│  Entry Time: [09:00 ▼]                 │
│                                         │
│  ☐ Past Entry Mode                     │
│                                         │
│  [Cancel]  [Next →]                    │
└─────────────────────────────────────────┘
```

**Visual Description - Plan Summary Modal**:
```
┌─────────────────────────────────────────┐
│  Plan Summary                            │
├─────────────────────────────────────────┤
│  Work Order: WO-2024-001                │
│                                         │
│  Stage    │ Entry Date/Time │ Exit Date/Time │
│  ─────────┼─────────────────┼───────────────│
│  P1S1     │ 15-Jan 09:00    │ 17-Jan 17:00  │
│  P1S2     │ 18-Jan 09:00    │ 20-Jan 17:00  │
│  P1S3     │ 21-Jan 09:00    │ 22-Jan 17:00  │
│                                         │
│  [← Back]  [Save Plan]                  │
└─────────────────────────────────────────┘
```

**What Happens Behind the Scenes**:
- Creates records in `prdn_dates` table for each stage
- Calculates dates based on lead times and holidays
- Updates work order status
- Makes work order available for production planning

**Common Issues & Solutions**:

- **"No lead times configured"**: Go to Planning > Lead Times and set lead times for each stage
- **"Dates not calculating correctly"**: Check holiday list and lead times
- **"Cannot select past date"**: Toggle "Past Entry Mode" ON
- **"Work order not appearing"**: Check if work order exists in Sales module

**Prerequisites**:
- Work order must exist in Sales > Work Orders
- Lead times must be configured (Planning > Lead Times)
- Holiday list should be set up (Planning > Holiday List)
- Stage order must be defined (Planning > Order of Stages)

**Areas Affected**:
- Production planning dates
- Work order scheduling
- Production calendar
- Schedule views
- Production module (work orders become available for entry)

### 2. How to View and Analyze Production Schedule

**Purpose**: View and analyze production schedules to track planned vs actual dates, identify deviations, and monitor performance.

**When to Use**:
- You need to see when work orders are scheduled for each stage
- You want to compare planned vs actual dates
- You need to identify schedule delays or early completions
- You want to analyze schedule performance

**Step-by-Step Instructions**:

1. **Navigate to Schedule**:
   - Click on **Planning** in the sidebar
   - Select **Schedule**
   - The page loads with default date range (current month)

2. **Select Date Range**:
   - At the top, you'll see **"From Date"** and **"To Date"** fields
   - Click on each date picker to select your desired range
   - Default is first day of current month to today
   - Select dates to view schedule for that period

3. **Select View Tab**:
   - **Plan Tab** (📋): View planned entry/exit dates
   - **Actual Tab** (✅): View actual entry/exit dates
   - **Deviation Tab** (📊): View differences between planned and actual
   - **Statistics Tab** (📈): View performance metrics

4. **View Plan Schedule** (Plan Tab):
   - Click on **"Plan"** tab
   - You'll see a table with columns:
     - Work Order Number
     - PWO Number
     - Customer Name
     - Stage columns (one for each stage)
   - Each stage column shows:
     - Entry Date/Time (planned)
     - Exit Date/Time (planned)
   - Dates are formatted as: "DD-MMM-YYYY HH:MM"
   - "N/A" means no date planned for that stage

5. **View Actual Schedule** (Actual Tab):
   - Click on **"Actual"** tab
   - Same table structure as Plan tab
   - Shows actual entry/exit dates (recorded in Production module)
   - Compare with Plan tab to see differences

6. **Analyze Deviations** (Deviation Tab):
   - Click on **"Deviation"** tab
   - Table shows work orders with schedule differences
   - Deviations are highlighted:
     - **Red/Delayed**: Actual date is later than planned
     - **Green/Early**: Actual date is earlier than planned
     - **No deviation**: Dates match
   - Use this to identify:
     - Which work orders are delayed
     - Which stages have delays
     - Patterns in delays

7. **View Statistics** (Statistics Tab):
   - Click on **"Statistics"** tab
   - View aggregated metrics:
     - Total work orders in period
     - On-time performance percentage
     - Average delay time
     - Stage-wise performance
   - Use statistics to:
     - Monitor overall performance
     - Identify problem stages
     - Track improvement over time

8. **Filter by Stage** (Optional):
   - Use the **Stage filter** dropdown
   - Select a specific stage to focus on
   - Table updates to show only that stage's data

**Example Scenario**:
- Date Range: 01-Jan-2024 to 31-Jan-2024
- Plan Tab shows: WO-001 scheduled for Stage 1 on 15-Jan, Stage 2 on 18-Jan
- Actual Tab shows: WO-001 entered Stage 1 on 16-Jan (1 day delay), Stage 2 on 19-Jan (1 day delay)
- Deviation Tab highlights: WO-001 has 1-day delay in both stages

**What Happens Behind the Scenes**:
- Reads data from `prdn_dates` table
- Compares planned dates with actual dates
- Calculates deviations and statistics
- Displays in organized table format

**Common Uses**:
- Daily schedule review
- Weekly performance analysis
- Identifying bottlenecks
- Planning resource allocation
- Reporting to management

**Prerequisites**:
- Entry plans must be created (Planning > Entry Plan)
- Actual dates must be recorded (Production module)
- Production dates must be configured

**Areas Affected**:
- None (read-only analysis view)

#### Entry Per Day

**Path**: `/planning/entry-per-day`

**Description**: 
Manages daily production plan entries with time specifications for each stage.

**Features**:
- Create production plans for specific dates
- Set entry and exit times for each stage
- View current production plan
- View production plan history
- Edit or delete existing plans

**How to Use**:

1. **Creating Daily Plan**:
   - Navigate to Planning > Entry Per Day
   - Click "Add Plan" button
   - Select date
   - Enter entry and exit times for each stage
   - Save the plan

2. **Viewing Current Plan**:
   - View the current active production plan
   - See all stage timings

3. **Viewing History**:
   - Expand history table
   - View past production plans
   - Edit or delete historical plans if needed

**Prerequisites**:
- Stages must be configured
- Valid date selection

**Areas Affected**:
- Daily production scheduling
- Stage timing configuration

#### Entry Per Shift

**Path**: `/planning/entry-per-shift`

**Description**: 
Manages production plan entries per shift for each stage.

**Features**:
- Create shift-specific production plans
- Set entry and exit times per shift
- View current shift plans
- View shift plan history

**How to Use**:

1. **Creating Shift Plan**:
   - Navigate to Planning > Entry Per Shift
   - Click "Add Plan" button
   - Select date and shift
   - Enter entry and exit times for each stage
   - Save the plan

2. **Viewing Plans**:
   - View current shift plans
   - View historical shift plans
   - Edit or delete plans as needed

**Prerequisites**:
- Stages must be configured
- Shifts must be configured in HR > Shift Master
- Valid date and shift selection

**Areas Affected**:
- Shift-based production scheduling
- Stage timing per shift

#### Holiday List

**Path**: `/planning/holiday-list`

**Description**: 
Manages the holiday calendar used for production date calculations, reporting (e.g. working days in **Daily Production Status**), and entry-plan logic.

**Features**:
- **Year selector**: Load and manage holidays for a specific calendar year
- **Statistics**: Summary counts (total, active, inactive, by year)
- **Table and calendar views**: Toggle between list/table and calendar layout
- **Add** single holidays (date, description, active flag as applicable)
- **Edit** holidays (e.g. activate/deactivate, update details)
- **Delete** holidays
- **Import holidays** (bulk import via the import flow—follow on-screen steps and template if provided)
- **Add Sundays for year**: One action to insert Sunday entries for the year (existing Sundays are skipped)
- **Active holidays** are the ones typically excluded from working-day counts; inactive rows may be kept for history

**How to Use**:

1. **Adding Holidays**:
   - Navigate to Planning > Holiday List
   - Choose the **year** if needed
   - Click **Add Holiday** (or equivalent)
   - Enter holiday date, description, and other required fields
   - Save

2. **Managing Holidays**:
   - Use the table or calendar view to review holidays for the selected year
   - **Edit** or toggle **active** status as needed
   - **Delete** if the holiday should be removed
   - Use **Import** for bulk load, or **Add Sundays** to seed all Sundays for the year

**Prerequisites**:
- None

**Areas Affected**:
- Production date calculations
- Entry plan date calculations
- Schedule date calculations

#### Lead Times

**Path**: `/planning/lead-times`

**Description**: 
Configures lead times (duration) for each production stage, used in automatic date calculations.

**Features**:
- Set lead time for each stage
- Lead times define how long work stays in each stage
- Used in automatic entry/exit date calculations

**How to Use**:

1. **Setting Lead Times**:
   - Navigate to Planning > Lead Times
   - View or edit lead time for each stage
   - Enter duration (typically in days or hours)
   - Save changes

**Prerequisites**:
- Stages must be configured

**Areas Affected**:
- Entry plan date calculations
- Schedule date calculations
- Production planning

#### Order of Stages

**Path**: `/planning/order-of-stages`

**Description**: 
Defines the sequence/order of production stages through which work orders progress.

**Features**:
- View stage order sequence
- Define which stage comes after which
- Used in production flow calculations

**How to Use**:

1. **Viewing Stage Order**:
   - Navigate to Planning > Order of Stages
   - View the stage sequence
   - Understand production flow

**Prerequisites**:
- Stages must be configured

**Areas Affected**:
- Production flow logic
- Entry plan calculations
- Work order progression

---

## HR Module

### Overview

The HR module manages employee data, shifts, skills, and daily shift operations. This section provides detailed, step-by-step instructions for all HR workflows.

---

## HR Workflows - Step by Step

### 1. How to Add a New Employee

**Purpose**: Register a new employee in the system with all their details, skills, and assignments.

**When to Use**:
- A new employee joins the organization
- You need to register an employee for production planning
- Employee needs to be assigned to a stage and shift

**Step-by-Step Instructions**:

1. **Navigate to Employee Management**:
   - Click on **HR** in the sidebar menu
   - Select **Employee**
   - The page loads showing the employee list table

2. **Click "Add Employee" Button**:
   - Look for the **"Add Employee"** button (usually at the top right)
   - Click it to open the employee form
   - The form appears as a modal or inline form

3. **Fill in Employee Details**:
   - **Employee ID** (Required):
     - Enter a unique employee ID
     - Format: Usually alphanumeric (e.g., "EMP001", "E-2024-001")
     - Must be unique - system will warn if duplicate
   - **Employee Name** (Required):
     - Enter full name of the employee
     - Example: "John Doe"
   - **Employee Category** (Required):
     - Select from dropdown
     - Options depend on configured categories
     - Examples: "Worker", "Supervisor", "Manager"
   - **Skill Short** (Required):
     - Select from dropdown
     - This is the primary skill of the employee
     - Options come from HR > Skill Master
     - Example: "WELD", "PAINT", "ASSEM"
   - **Date of Joining** (Required):
     - Click date picker
     - Select the date employee joined
     - Format: DD-MM-YYYY
   - **Last Appraisal Date** (Optional):
     - Click date picker
     - Select last appraisal date
     - Can be left empty if not applicable
   - **Basic DA** (Required):
     - Enter basic salary + DA amount
     - Enter numeric value only (no currency symbols)
     - Example: 25000
   - **Salary** (Required):
     - Enter total salary amount
     - Enter numeric value only
     - Example: 35000
   - **Stage** (Required):
     - Select from dropdown
     - This is the primary stage where employee works
     - Options: Stage codes (e.g., "P1S1", "P1S2")
   - **Shift Code** (Required):
     - Select from dropdown
     - This is the employee's assigned shift
     - Options come from HR > Shift Master
     - Examples: "GEN", "MOR", "EVE"
   - **Active Status** (Required):
     - Checkbox: "Active" (checked by default)
     - Uncheck if employee is inactive
     - Inactive employees won't appear in production planning

4. **Review Form**:
   - Double-check all entered information
   - Verify Employee ID is unique
   - Ensure all required fields are filled
   - Check dates are correct

5. **Save Employee**:
   - Click **"Save"** or **"Submit"** button
   - System validates the form
   - If validation passes, employee is saved
   - You'll see a success message: "Employee saved successfully!"

6. **Verify Employee Added**:
   - The employee should appear in the employee list table
   - You can see the new employee with all details
   - Employee is now available for:
     - Production planning
     - Attendance recording
     - Work assignments

**Example Scenario**:
- Employee ID: EMP-2024-050
- Name: Rajesh Kumar
- Category: Worker
- Skill: WELD (Welding)
- DOJ: 01-Jan-2024
- Basic DA: 20000
- Salary: 28000
- Stage: P1S2 (Plant 1 Stage 2)
- Shift: GEN (General)
- Status: Active

**Visual Description - Employee Form**:
```
┌─────────────────────────────────────────┐
│  Add Employee                            │
├─────────────────────────────────────────┤
│  Employee ID*: [EMP-2024-050        ]   │
│  Employee Name*: [Rajesh Kumar       ]   │
│  Category*: [Worker ▼]                   │
│  Skill Short*: [WELD ▼]                 │
│  Date of Joining*: [01-01-2024]          │
│  Last Appraisal: [__-__-____]            │
│  Basic DA*: [20000]                      │
│  Salary*: [28000]                        │
│  Stage*: [P1S2 ▼]                        │
│  Shift Code*: [GEN ▼]                   │
│  ☑ Active                                │
│                                         │
│  [Cancel]  [Save]                        │
└─────────────────────────────────────────┘
* = Required field
```

**What Happens Behind the Scenes**:
- Creates record in `hr_employee` table
- Links employee to stage and shift
- Makes employee available for production planning
- Employee can now be assigned to works

**Common Issues & Solutions**:

- **"Employee ID already exists"**: Use a different unique ID
- **"Skill not found"**: Go to HR > Skill Master and create the skill first
- **"Shift not found"**: Go to HR > Shift Master and create the shift first
- **"Stage not found"**: Verify stage code is correct
- **Validation errors**: Check all required fields are filled correctly

**Prerequisites**:
- Employee categories must be defined (in system configuration)
- Skill shorts must exist (HR > Skill Master)
- Stages must be configured
- Shifts must be configured (HR > Shift Master)

**Areas Affected**:
- Employee records database
- Production planning (employee becomes available for assignment)
- Production reporting (employee can be assigned to works)
- User management (if employee is also a system user)

---

### 2. How to Edit an Employee

**Purpose**: Update employee information such as skills, stage assignment, salary, or other details.

**When to Use**:
- Employee changes stage or shift
- Employee gets promoted (category change)
- Salary needs to be updated
- Skill needs to be updated
- Any employee information needs correction

**Step-by-Step Instructions**:

1. **Navigate to Employee Management**:
   - Go to **HR > Employee**
   - View the employee list table

2. **Find the Employee**:
   - Scroll through the table or use search
   - Find the employee you want to edit
   - Each row shows employee details

3. **Click Edit Icon**:
   - Find the **Edit** icon (✏️) in the row
   - Usually in the "Actions" column
   - Click it to open the edit form

4. **Modify Fields**:
   - The form opens with existing data pre-filled
   - **Note**: Employee ID usually cannot be changed (it's the unique identifier)
   - Modify any fields that need updating:
     - Employee Name
     - Employee Category
     - Skill Short
     - Date of Joining
     - Last Appraisal Date
     - Basic DA
     - Salary
     - Stage
     - Shift Code
     - Active Status

5. **Review Changes**:
   - Verify all changes are correct
   - Check that required fields are still filled
   - Ensure data is valid

6. **Save Changes**:
   - Click **"Update"** or **"Save"** button
   - System validates the changes
   - If valid, employee record is updated
   - You'll see: "Employee updated successfully!"

7. **Verify Update**:
   - Check the employee list table
   - Updated information should be reflected
   - Changes take effect immediately

**Important Notes**:
- Changing employee's stage/shift affects production planning
- Changing skill affects which works employee can be assigned to
- Setting employee to inactive removes them from planning options
- Salary changes don't affect historical records

**Prerequisites**:
- Employee must exist in the system
- New values (if changed) must be valid (e.g., new skill must exist)

**Areas Affected**:
- Employee record
- Production planning (if stage/shift changed)
- Future work assignments
- Active status affects availability

---

### 3. How to Import Employees from Excel

**Purpose**: Add multiple employees at once using an Excel file, saving time when registering many employees.

**When to Use**:
- Multiple new employees need to be registered
- Bulk employee data entry
- Migrating employee data from another system
- Adding employees from a list

**Step-by-Step Instructions**:

1. **Navigate to Employee Management**:
   - Go to **HR > Employee**
   - View the employee list

2. **Click "Import" Button**:
   - Find the **"Import"** button (usually near "Add Employee")
   - Click it to open the import modal

3. **Download Template**:
   - In the import modal, click **"Download Template"** or **"Export Template"**
   - An Excel file downloads to your computer
   - File name: Usually "employee_template.xlsx" or similar

4. **Open Template in Excel**:
   - Open the downloaded template file
   - You'll see columns with headers:
     - Employee ID
     - Employee Name
     - Employee Category
     - Skill Short
     - Date of Joining
     - Last Appraisal Date
     - Basic DA
     - Salary
     - Stage
     - Shift Code
     - Active Status (Y/N or true/false)

5. **Fill in Employee Data**:
   - Enter employee information in each row
   - **One row = One employee**
   - Follow the format shown in template:
     - Dates: DD-MM-YYYY or YYYY-MM-DD format
     - Numbers: No currency symbols, just digits
     - Active Status: "Y" or "N" (or "true"/"false")
   - **Important**: Don't modify column headers
   - Don't add extra columns
   - Ensure Employee IDs are unique

6. **Save the Excel File**:
   - Save the file after entering all data
   - Keep it in Excel format (.xlsx)
   - Remember where you saved it

7. **Upload the File**:
   - Go back to the import modal in the system
   - Click **"Choose File"** or **"Browse"** button
   - Navigate to your saved Excel file
   - Select the file
   - Click **"Upload"** or **"Import"** button

8. **Review Import Results**:
   - System processes the file
   - You'll see import results:
     - **Success Count**: Number of employees imported successfully
     - **Error Count**: Number of rows with errors
     - **Error Details**: List of errors (if any)
   - Errors might include:
     - Duplicate Employee ID
     - Invalid Skill Short
     - Invalid Stage Code
     - Missing required fields
     - Invalid date format

9. **Fix Errors** (if any):
   - Review error messages
   - Fix issues in the Excel file
   - Re-upload the corrected file
   - Repeat until all employees are imported

10. **Verify Import**:
    - Go back to employee list
    - Check that all employees appear
    - Verify data is correct
    - Employees are now available for use

**Example Excel Template**:
```
Employee ID | Employee Name | Category | Skill | DOJ       | Basic DA | Salary | Stage | Shift | Active
EMP-001     | John Doe      | Worker   | WELD  | 01-01-2024| 20000    | 28000  | P1S1  | GEN   | Y
EMP-002     | Jane Smith   | Worker   | PAINT | 01-01-2024| 20000    | 28000  | P1S2  | GEN   | Y
```

**Tips for Successful Import**:
- Fill all required fields
- Use exact values from dropdowns (e.g., exact skill codes)
- Check date formats match template
- Ensure Employee IDs are unique
- Validate data before uploading
- Start with a small test file (2-3 employees) to verify format

**Prerequisites**:
- Excel template downloaded from system
- All referenced data exists (skills, stages, shifts)
- Employee IDs are unique

**Areas Affected**:
- Employee records (multiple employees added)
- Production planning (all imported employees available)
- System performance (large imports may take time)

### 4. How to Bulk Update Employees

**Purpose**: Update multiple employees at once using a CSV file. This is useful when you need to update common fields like salary, stage assignment, or active status for many employees.

**When to Use**:
- Multiple employees need salary updates
- Bulk stage or shift reassignments
- Updating active status for multiple employees
- Changing employee categories in bulk
- Any bulk update operation for employees

**Step-by-Step Instructions**:

1. **Navigate to Employee Management**:
   - Go to **HR > Employee**
   - View the employee list

2. **Click "Bulk Update" Button**:
   - Find the **"Bulk Update"** button (usually near "Import" button)
   - Click it to open the Bulk Update modal

3. **Download Template**:
   - In the Bulk Update modal, click **"Download Template"** button
   - A CSV file downloads containing all current employee data
   - File name: Usually "employee_bulk_update_template.csv"

4. **Open Template in Excel/CSV Editor**:
   - Open the downloaded CSV file
   - You'll see all employees with their current data
   - **Important**: Do NOT modify:
     - Employee ID (used to identify which employee to update)
     - Column headers
     - File structure
   - **You CAN modify**:
     - Employee Name
     - Employee Category
     - Skill Short
     - Date of Joining
     - Last Appraisal Date
     - Basic DA
     - Salary
     - Stage
     - Shift Code
     - Active Status (Y/N)

5. **Modify Employee Data**:
   - Update only the fields you want to change
   - Leave unchanged fields as they are
   - **One row = One employee**
   - Ensure data format matches:
     - Dates: DD-MM-YYYY or YYYY-MM-DD format
     - Numbers: No currency symbols, just digits
     - Active Status: "Y" or "N" (or "true"/"false")
     - Stage/Shift: Must match existing codes

6. **Save the CSV File**:
   - Save the file after making changes
   - Keep it in CSV format (.csv)
   - Remember where you saved it

7. **Upload the File**:
   - Go back to the Bulk Update modal
   - Click **"Choose File"** or **"Browse"** button
   - Navigate to your saved CSV file
   - Select the file
   - Click **"Upload"** or **"Bulk Update"** button

8. **Review Update Results**:
   - System processes the file
   - You'll see update results:
     - **Success Count**: Number of employees updated successfully
     - **Error Count**: Number of rows with errors
     - **Skipped Count**: Number of rows skipped (no changes detected)
     - **Error Details**: List of errors (if any)
   - Errors might include:
     - Invalid Employee ID (employee doesn't exist)
     - Invalid Skill Short
     - Invalid Stage Code
     - Invalid Shift Code
     - Data format errors
     - Missing required fields

9. **Verify Updates**:
   - Go back to employee list
   - Refresh the page
   - Verify that employees show updated information
   - Check that changes are correct

**Important Notes**:
- Bulk update only updates fields that are changed in the CSV
- Employee ID is used to identify which employee to update
- If Employee ID doesn't exist, that row is skipped with an error
- All validation rules apply (same as individual edit)
- Large bulk updates may take time to process
- It's recommended to test with a small file first

**What Happens Behind the Scenes**:
- Reads CSV file row by row
- Identifies employee by Employee ID
- Updates only changed fields
- Validates all data before updating
- Creates audit trail of changes
- Updates related records if needed (e.g., production planning if stage changed)

**Prerequisites**:
- Employees must exist in the system (for Employee ID matching)
- CSV file must be properly formatted
- Modified values must be valid (skills, stages, shifts must exist)
- User must have permission to edit employees

**Areas Affected**:
- Employee records (updated fields)
- Production planning (if stage/shift changed)
- Future work assignments
- Active status affects availability

---

#### Shift Master

**Path**: `/hr/shift-master`

**Description**: 
Manages shift definitions, shift breaks, and stage-shift mappings.

**Features**:
- **Shifts Tab**: Create and manage shift definitions
- **Shift Breaks Tab**: Define break times for shifts
- **Stage-Shift Tab**: Map which shifts operate in which stages

**How to Use**:

1. **Managing Shifts**:
   - Navigate to HR > Shift Master
   - Go to "Shifts" tab
   - Click "Add Shift" to create new shift
   - Enter shift code, name, start time, end time
   - Save the shift

2. **Managing Shift Breaks**:
   - Go to "Shift Breaks" tab
   - Click "Add Break" button
   - Select shift
   - Enter break start time and end time
   - Save the break

3. **Stage-Shift Mapping**:
   - Go to "Stage-Shift" tab
   - View matrix of stages and shifts
   - Enable/disable shifts for each stage
   - This determines which shifts are available in production planning

**Prerequisites**:
- Stages must be configured

**Areas Affected**:
- Production planning (shift availability)
- Production reporting (shift-based reporting)
- Employee shift assignments
- Break time calculations

#### Skill Master

**Path**: `/hr/skill-master`

**Description**: 
Manages skill definitions used for employee categorization and work assignments.

**Features**:
- Add new skills
- Edit existing skills
- Delete skills
- Import skills from Excel
- Export skill template
- View skill list

**How to Use**:

1. **Adding a Skill**:
   - Navigate to HR > Skill Master
   - Click "Add Skill" button
   - Enter skill details:
     - Skill Short (code)
     - Skill Name
     - Description (optional)
   - Click "Save"

2. **Managing Skills**:
   - View all skills in the table
   - Click edit icon to modify
   - Click delete icon to remove
   - Use import/export for bulk operations

**Prerequisites**:
- None

**Areas Affected**:
- Employee skill assignments
- Work-skill mappings in Standards module
- Production planning (skill-based work assignment)

#### Daily Shift

**Path**: `/hr/daily-shift`

**Description**: 
Manages daily shift assignments and operations.

**Features**:
- View daily shift assignments
- Manage shift schedules
- Track daily shift operations

**How to Use**:

1. **Viewing Daily Shifts**:
   - Navigate to HR > Daily Shift
   - View shift assignments for selected date
   - Manage daily shift operations

**Prerequisites**:
- Shifts must be configured in Shift Master
- Employees must be registered

**Areas Affected**:
- Daily shift operations
- Employee shift assignments

#### Add Standard Work to WO

**Path**: `/hr/add-std-work-to-wo`

**Description**: 
Adds standard works to work orders for planning and execution.

**Features**:
- Select work order
- Add standard works to work order
- Manage work assignments

**How to Use**:

1. **Adding Standard Work**:
   - Navigate to HR > Add Standard Work to WO
   - Select a work order
   - Choose standard works to add
   - Save the assignment

**Prerequisites**:
- Work orders must exist
- Standard works must be defined in Standards module

**Areas Affected**:
- Work order work assignments
- Production planning

#### Add Multiple Standard Works

**Path**: `/hr/add-multiple-std-works`

**Description**: 
Adds **multiple standard works** to one or more work orders for a chosen **stage** in a single session. You build a **queue** of additions (stage + work order + standard work + reason), then submit the queue in one batch. This is suited to bulk additions when **Add Standard Work to WO** is too slow for many lines.

**Features**:
- Select **stage**, then **work order** (active work orders for that stage).
- Load **available standard works** for that work order at that stage (works not already added show in the list).
- Search/filter the standard work list; select one or many works; enter a **reason for addition** (required when adding to the queue).
- **Add to queue**: Queues items; duplicates for the same stage/WO/code are skipped.
- **Queue** table: Review queued items; remove individual lines before submit.
- **Submit all queued works**: Processes each queue row via the same production “add work” logic as the single-add flow; successes clear from the queue; failures remain with an error message.
- Changing **stage** while the queue contains items for another stage prompts to clear or cancel—avoid mixing stages accidentally.

**How to Use**:

1. Navigate to **HR > Add Multiple Standard Works**.
2. Select **stage**, then **work order**.
3. Select standard work(s), enter **reason for addition**, click **Add to queue** (or equivalent).
4. Repeat for more works or another work order (same stage).
5. Click **Submit all queued works** when ready. Refresh work order list after partial success to continue.

**Prerequisites**:
- Work orders and standard works must exist; workflow must allow these works at the stage.
- Same business rules as adding a single standard work to production.

**Areas Affected**:
- Production work status and planning for the affected work orders

---

## Sales Module

### Overview

The Sales module manages sales orders, work orders, models, and chassis receival operations. This section provides detailed, step-by-step instructions for all sales workflows.

---

## Sales Workflows - Step by Step

### 1. How to Create a New Work Order

**Purpose**: Create a new work order in the system to initiate the production process for a customer order.

**When to Use**:
- A new customer order is received
- You need to create a work order for production
- A sales order needs to be converted to a work order

**Step-by-Step Instructions**:

1. **Navigate to Work Orders**:
   - Click on **Sales** in the sidebar menu
   - Select **Work Orders**
   - The page loads showing work order list and statistics

2. **Click "Create Work Order" Button**:
   - Look for the **"Create Work Order"** button (usually at the top right)
   - Click it to open the Create Work Order modal
   - A form appears with fields to fill

3. **Fill in Work Order Details**:
   - **Work Order Number (WO No)** (Required):
     - Enter a unique work order number
     - Format: Usually alphanumeric (e.g., "WO-2024-001", "WO001")
     - Must be unique - system will validate
   - **PWO Number (Parent Work Order)** (Optional):
     - Enter parent work order number if this is a child work order
     - Leave empty if this is a standalone work order
   - **Customer Name** (Required):
     - Enter the customer's name
     - Example: "ABC Transport Company"
   - **Model** (Required):
     - Select from dropdown
     - Options come from Sales > Models
     - Example: "Bus Model A", "Bus Model B"
   - **Order Date** (Required):
     - Click date picker
     - Select the date when order was placed
     - Format: DD-MM-YYYY
   - **Delivery Date** (Optional but recommended):
     - Click date picker
     - Select expected delivery date
     - Used for planning and scheduling
   - **Other Fields** (if applicable):
     - Any additional fields specific to your organization
     - Fill as required

4. **Review Form**:
   - Double-check all entered information
   - Verify Work Order Number is unique
   - Ensure all required fields are filled
   - Check dates are correct and logical (delivery date should be after order date)

5. **Save Work Order**:
   - Click **"Save"** or **"Create"** button
   - System validates the form
   - If validation passes, work order is created
   - You'll see a success message: "Work order created successfully!"

6. **Verify Work Order Created**:
   - The work order should appear in the work order list
   - You can see it in the table
   - Status will be "Ordered"
   - Work order is now available for:
     - Planning (Planning > Entry Plan)
     - Production (Production module)
     - Chassis receival (Sales > Chassis Receival)

**Example Scenario**:
- Work Order Number: WO-2024-050
- PWO Number: (empty - standalone order)
- Customer Name: XYZ Bus Services
- Model: Bus Model A
- Order Date: 15-Jan-2024
- Delivery Date: 15-Feb-2024
- Status: Ordered

**Visual Description - Create Work Order Form**:
```
┌─────────────────────────────────────────┐
│  Create Work Order                      │
├─────────────────────────────────────────┤
│  Work Order Number*: [WO-2024-050    ]  │
│  PWO Number: [______________________]   │
│  Customer Name*: [XYZ Bus Services  ]   │
│  Model*: [Bus Model A ▼]               │
│  Order Date*: [15-01-2024]              │
│  Delivery Date: [15-02-2024]            │
│                                         │
│  [Cancel]  [Save]                        │
└─────────────────────────────────────────┘
* = Required field
```

**Visual Description - Work Orders Table**:
```
┌──────────┬──────────┬──────────────────┬─────────────┬────────────┬────────────┬──────────┐
│ WO No    │ PWO No   │ Customer Name    │ Model       │ Order Date │ Del. Date  │ Status   │
├──────────┼──────────┼──────────────────┼─────────────┼────────────┼────────────┼──────────┤
│ WO-2024- │          │ XYZ Bus Services │ Bus Model A │ 15-Jan-24  │ 15-Feb-24  │ Ordered  │
│ 050      │          │                  │             │            │            │          │
└──────────┴──────────┴──────────────────┴─────────────┴────────────┴────────────┴──────────┘
```

**What Happens Behind the Scenes**:
- Creates record in `prdn_wo_details` table
- Sets initial status to "Ordered"
- Makes work order available for planning
- Links work order to model (which determines work flow)

**Common Issues & Solutions**:

- **"Work Order Number already exists"**: Use a different unique number
- **"Model not found"**: Go to Sales > Models and create the model first
- **"Invalid date format"**: Use the date picker, don't type manually
- **"Delivery date before order date"**: Check and correct dates

**Prerequisites**:
- Model must exist (Sales > Models)
- Customer information should be available
- Work order number must be unique

**Areas Affected**:
- Work order records database
- Production planning (work order becomes available for entry planning)
- Production execution (work order can be entered into stages)
- Statistics and reporting

---

### 2. How to View and Filter Work Orders

**Purpose**: View work orders, filter by time period, and analyze work order statistics.

**When to Use**:
- You need to find a specific work order
- You want to see work orders in a time period
- You need to check work order status
- You want to view statistics

**Step-by-Step Instructions**:

1. **Navigate to Work Orders**:
   - Go to **Sales > Work Orders**
   - Page loads with default period (usually "Last 1 Month")

2. **Select Time Period**:
   - At the top, you'll see a **Period** dropdown
   - Options:
     - **Last 1 Month**: Work orders from last 30 days
     - **Last 3 Months**: Work orders from last 90 days
     - **Last 6 Months**: Work orders from last 180 days
     - **Last 1 Year**: Work orders from last 365 days
     - **Custom**: Select custom date range
   - Select your desired period
   - Table updates automatically

3. **View Work Order List**:
   - Table shows columns:
     - Work Order Number
     - PWO Number
     - Customer Name
     - Model
     - Order Date
     - Delivery Date
     - Status (Ordered, WIP, Delivered)
   - Scroll through the list
   - Each row represents one work order

4. **View Statistics** (Top Panel):
   - Statistics panel shows:
     - **Total Ordered**: Count of work orders with status "Ordered"
     - **Total WIP**: Count of work orders with status "WIP" (Work In Progress)
     - **Total Delivered**: Count of work orders with status "Delivered"
     - **Breakdown by Type**: Statistics grouped by model type
   - Statistics update based on selected period

5. **View Work Order Details**:
   - Click on any row in the table
   - A details modal or panel opens
   - Shows complete work order information:
     - All work order fields
     - Related records
     - Production status
     - Dates and milestones

6. **Use Custom Date Range** (if needed):
   - Select **"Custom"** from period dropdown
   - A date range picker appears
   - Select **From Date** and **To Date**
   - Click **"Apply"** or the dates auto-apply
   - Table shows work orders in that range

7. **Search Work Orders** (if search available):
   - Use search box (if present)
   - Enter work order number, customer name, or model
   - Results filter as you type
   - Clear search to see all again

**Example Scenario**:
- Period Selected: "Last 3 Months"
- Statistics Show:
  - Total Ordered: 25
  - Total WIP: 15
  - Total Delivered: 10
- Table shows 50 work orders (25+15+10)
- Click on WO-2024-001 to see details

**What Happens Behind the Scenes**:
- Queries work orders from database
- Filters by date range
- Calculates statistics
- Displays in organized table format

**Common Uses**:
- Daily work order review
- Weekly status check
- Monthly reporting
- Finding specific work orders
- Analyzing order trends

**Prerequisites**:
- Work orders must exist in the system
- Date range must be valid

**Areas Affected**:
- None (read-only view)

#### Models

**Path**: `/sales/models`

**Description**: 
Manages product models used in work orders.

**Features**:
- Add new models
- Edit existing models
- Delete models
- View model list

**How to Use**:

1. **Managing Models**:
   - Navigate to Sales > Models
   - Click "Add Model" to create new model
   - Enter model code and name
   - Save the model
   - Edit or delete models as needed

**Prerequisites**:
- None

**Areas Affected**:
- Work order model assignments
- Production planning (model-specific planning)

#### Chassis Receival

**Path**: `/sales/chassis-receival`

**Description**: 
Manages chassis receival and inspection process for work orders.

**Features**:
- View pending chassis receivals
- View completed chassis receivals
- Record chassis arrival
- Perform chassis inspection
- Use inspection templates
- Save inspection progress
- Complete inspections

**How to Use**:

1. **Recording Chassis Arrival**:
   - Navigate to Sales > Chassis Receival
   - Go to "Pending" tab
   - Select a work order
   - Click "Record Arrival" or "Start Inspection"
   - Select an inspection template (if available)
   - Fill in inspection form
   - Save inspection progress or complete inspection

2. **Viewing Completed Inspections**:
   - Go to "Completed" tab
   - View work orders with completed chassis receival
   - View inspection details

3. **Using Templates**:
   - When starting inspection, select a template
   - Template defines inspection fields
   - Fill in template fields
   - Save or complete inspection

**Prerequisites**:
- Work orders must exist
- Inspection templates must be configured in System Admin > Chassis Receival Template
- Chassis must be ready for receival

**Areas Affected**:
- Work order chassis receival status
- Production planning (chassis receival is a prerequisite)
- Inspection records

---

## Accounts Module

### Overview

The Accounts module is used to register **non-commercial work orders**—for example internal jobs, accounting-driven entries, or work orders that are not created through the standard **Sales > Work Orders** flow. These records are stored as production work order details and can be used in planning and production like other work orders, subject to your business rules.

### Create Non-Commercial Work Order

**Path**: `/accounts/create-work-order`

**Description**: 
Single-page form to create a non-commercial work order with category, customer, dates, optional type/model, and optional comments.

**Features**:
- **Non-commercial category** (required): Selected from configured data elements (non-commercial categories).
- **WO number** (required): Entered without spaces; the system normalizes the value.
- **Production / commercial WO no.** (optional): Short reference (e.g. up to 10 characters).
- **Date WO placed** (required): Cannot be in the future.
- **Customer name** (required).
- **Type** and **Model** (optional): Dropdowns from distinct vehicle type codes and model names in the system.
- **Comments**: Required **unless** both Type and Model are selected—if either Type or Model is missing, you must fill comments.
- **Category lock**: After you choose a non-commercial category, it stays fixed until you click **Reset form** (so you can complete the rest of the entry without accidentally changing category).
- **Save**: Creates the non-commercial work order record. Duplicate WO numbers are rejected.

**How to Use**:

1. Navigate to **Accounts > Create non-commercial work order** (or your menu’s equivalent path).
2. Wait for dropdown options to load (non-commercial categories, type codes, model names).
3. Select **Non-commercial category** first.
4. Enter **WO number** (required). Use the format your organization expects (no spaces).
5. Optionally enter **Production / commercial WO no.**
6. Select **Date WO placed**.
7. Enter **Customer name**.
8. Optionally select **Type** and **Model**, or leave one/both empty and provide **Comments** (required in that case).
9. Click **Save**. On success, the form resets and a confirmation message is shown.
10. Use **Reset form** to clear all fields and choose a different category.

**Prerequisites**:
- Non-commercial categories and vehicle type/model data must be configured (e.g. data elements and vehicle types).
- Appropriate menu access for Accounts.

**Areas Affected**:
- Production work order details (`prdn_wo_details`) for non-commercial entries
- Downstream planning and production if your process uses these work orders

---

## Standards Module

### Overview

The Standards module manages standard works, derivative works, work-skill mappings, time standards, skill combinations, and workflow definitions.

### Sub-Menus

#### Works

**Path**: `/standards/works`

**Description**: 
Comprehensive management of standard works, derivative works, work-skill mappings, and time standards.

**Features**:
- **Standard Works Tab**: Manage standard work definitions
- **Derivative Works Tab**: Manage derivative work definitions
- **Work-Skill Mapping Tab**: Map works to required skills
- **Time Standards Tab**: Define time standards for work-skill combinations

**How to Use**:

1. **Managing Standard Works**:
   - Navigate to Standards > Works
   - Go to "Standard Works" tab
   - Click "Add Work" to create new standard work
   - Enter work details:
     - Work Code
     - Work Name
     - Description
     - Other relevant fields
   - Save the work
   - Import/export for bulk operations

2. **Managing Derivative Works**:
   - Go to "Derivative Works" tab
   - Click "Add Derivative Work"
   - Enter derivative work details
   - Link to parent standard work
   - Save the work

3. **Work-Skill Mapping**:
   - Go to "Work-Skill Mapping" tab
   - Click "Add Mapping"
   - Select work and skill
   - Define mapping relationship
   - Save the mapping

4. **Time Standards**:
   - Go to "Time Standards" tab
   - Click "Add Time Standard"
   - Select work and skill combination
   - Enter standard time (in hours/minutes)
   - Save the standard
   - Time standards are used in production planning and piece rate calculations

**Prerequisites**:
- Skills must be defined in HR > Skill Master
- Works must be properly categorized

**Areas Affected**:
- Production planning (work definitions)
- Production reporting (work execution)
- Piece rate calculations (time standards)
- Work order work assignments

#### Work Flow

**Path**: `/standards/work-flow`

**Description**: 
Defines workflow processes and sequences for production operations.

**Features**:
- Define workflow steps
- Set workflow sequences
- Manage workflow definitions

**How to Use**:

1. **Managing Workflows**:
   - Navigate to Standards > Work Flow
   - View or create workflow definitions
   - Define workflow steps and sequences
   - Save workflows

**Prerequisites**:
- Works must be defined

**Areas Affected**:
- Production workflow execution
- Work sequencing

#### Skill Combinations

**Path**: `/standards/skill-combinations`

**Description**: 
Defines valid skill combinations for multi-skill work assignments.

**Features**:
- Define skill combinations
- Set combination rules
- Manage skill combination definitions

**How to Use**:

1. **Managing Skill Combinations**:
   - Navigate to Standards > Skill Combinations
   - View or create skill combination definitions
   - Define which skills can work together
   - Save combinations

**Prerequisites**:
- Skills must be defined in HR > Skill Master

**Areas Affected**:
- Multi-skill work assignments
- Production planning (skill combination validation)
- Production reporting (multi-skill reporting)

---

## R&D Module

### Overview

The R&D module manages research and development document sharing and viewing.

### Sub-Menus

#### Share Documents

**Path**: `/rnd/share-documents`

**Description**: 
Manages document sharing and submission for work orders and stages.

**Features**:
- View pending document releases (work orders with missing documents)
- View completed document releases (all documents submitted)
- Upload documents for work orders
- Submit documents for specific stages
- View document history
- Delete documents
- Support for 7 document types (see Document Types below)

**Document Types**:

The system supports the following document types:

1. **Bill of Material (BOM)** - Multi-file (multiple documents allowed per work order)
2. **Cutting Profile** - Multi-file (multiple documents allowed per work order)
3. **General** - Multi-file (multiple documents allowed per work order)
4. **Material Checklist** - Single-file (only one document allowed per work order)
5. **Platform Drawing** - Single-file (only one document allowed per work order)
6. **Seat Layout** - Single-file (only one document allowed per work order)
7. **Structure Drawing** - Single-file (only one document allowed per work order)

**Note**: 
- **Single-file types** (Material Checklist, Platform Drawing, Seat Layout, Structure Drawing): Only one document can be uploaded per work order. If you upload a new document, it will replace the existing one.
- **Multi-file types** (Bill of Material, Cutting Profile, General): Multiple documents can be uploaded per work order. Each upload creates a new document entry.

**How to Use**:

1. **Viewing Pending Releases**:
   - Navigate to R&D > Share Documents
   - Go to "Pending" tab
   - View work orders that need documents
   - See which stages are missing documents

2. **Uploading Documents**:
   - Click "Upload Documents" for a work order
   - Select stages that need documents
   - Upload document files
   - Add submission notes
   - Submit documents

3. **Viewing Completed Releases**:
   - Go to "Completed" tab
   - View work orders with all documents submitted
   - View document history

4. **Managing Documents**:
   - View document submission history
   - Delete documents if needed
   - Re-upload documents if corrections are needed

**Prerequisites**:
- Work orders must exist
- Stages must be configured
- Documents must be ready for upload

**Areas Affected**:
- Document submission records
- Production planning (document release is a prerequisite)
- Work order document tracking

#### View Documents

**Path**: `/rnd/view-documents/[documentType]`

**Description**: 
View documents submitted for specific document types. Each document type has its own dedicated page.

**Available Document Type Pages**:
- `/rnd/view-documents/bom` - Bill of Material documents
- `/rnd/view-documents/cutting-profile` - Cutting Profile documents
- `/rnd/view-documents/general` - General documents
- `/rnd/view-documents/material-checklist` - Material Checklist documents
- `/rnd/view-documents/platform-drawing` - Platform Drawing documents
- `/rnd/view-documents/seat-layout` - Seat Layout documents
- `/rnd/view-documents/structure-drawing` - Structure Drawing documents

**Features**:
- View documents by document type
- Filter by work order
- Download documents
- View document details
- View document submission history

**How to Use**:

1. **Viewing Documents by Type**:
   - Navigate to R&D > View Documents
   - Select the document type you want to view (e.g., "Bill of Material", "Structure Drawing")
   - View all documents of that type
   - Use the search box to filter by work order number
   - Click on a work order to expand and see all documents
   - Click "Download" to download a document
   - Click "View History" to see document submission history

2. **Viewing Document History**:
   - Click "View History" button for a work order
   - See all previous versions and submissions
   - View submission notes and timestamps
   - See who submitted each version

**Prerequisites**:
- Documents must be submitted in Share Documents
- Document type must be selected

**Areas Affected**:
- None (read-only view)

---

## System Admin Module

### Overview

The System Admin module provides administrative functions for user management, menu and access control, system configuration, data element management, lost time reasons, chassis receival templates, and work order archiving.

### Sub-Menus

#### User Management

**Path**: `/system-admin/user-management`

**Description**: 
Comprehensive user and menu management system for system administrators.

**Features**:
- **Users Tab**: Create, edit, and manage system users
- **Menu Tab**: Create, edit, and manage menu items
- **User's Menu Tab**: Assign menu access to users

**How to Use**:

1. **Managing Users**:
   - Navigate to System Admin > User Management
   - Go to "Users" tab
   - Click "Add User" to create new user
   - Fill in user details:
     - Username (must be unique)
     - Email
     - Password
     - Role (Admin, User, etc.)
     - Designation
     - Employee ID (if linked to employee)
     - Active status
   - Save the user

2. **Reset Password for a User** (admin-initiated):
   - Go to "Users" tab and find the user (or edit an existing user)
   - Click the **"Reset Password"** button for that user
   - The system sends a password-reset email to the user's registered email address
   - The user must open the link and set a new password (see [Password Reset (Forgot Password)](#password-reset-forgot-password) in Getting Started)
   - Use this when a user has forgotten their password or for first-time account activation

3. **Managing Menus**:
   - Go to "Menu" tab
   - Click "Add Menu" to create new menu item
   - Enter menu details:
     - Menu Name
     - Menu Path (URL)
     - Parent Menu (if sub-menu)
     - Menu Order
     - Visibility and Enabled status
   - Save the menu

4. **Assigning User Menus**:
   - Go to "User's Menu" tab
   - Select a user
   - Check/uncheck menus to assign access
   - Save the assignments
   - Users will only see menus they have access to

**Prerequisites**:
- Admin role required
- Employee records should exist if linking users to employees

**Areas Affected**:
- User access control
- Menu visibility
- System security

#### Data Elements

**Path**: `/system-admin/data-elements`

**Description**: 
Manages system data elements and reference data.

**Features**:
- View data element categories
- Manage reference data
- Configure system data elements

**How to Use**:

1. **Managing Data Elements**:
   - Navigate to System Admin > Data Elements
   - View data element categories
   - Add, edit, or delete data elements
   - Configure reference data

**Prerequisites**:
- Admin role required

**Areas Affected**:
- System reference data
- Dropdown options throughout the system

#### Lost Time Reasons

**Path**: `/system-admin/lost-time-reasons`

**Description**: 
Manages lost time reasons used in production reporting.

**Features**:
- Add lost time reasons
- Edit existing reasons
- Delete reasons
- View reason list

**How to Use**:

1. **Managing Lost Time Reasons**:
   - Navigate to System Admin > Lost Time Reasons
   - Click "Add Reason" to create new reason
   - Enter reason code and description
   - Save the reason
   - Edit or delete as needed

**Prerequisites**:
- Admin role required

**Areas Affected**:
- Production reporting (lost time reporting)
- Deviation reporting

#### Chassis Receival Template

**Path**: `/system-admin/chassis-receival-template`

**Description**: 
Manages inspection templates used in chassis receival process.

**Features**:
- Create inspection templates
- Define template fields
- Edit templates
- Delete templates
- View template list

**How to Use**:

1. **Creating Templates**:
   - Navigate to System Admin > Chassis Receival Template
   - Click "Add Template"
   - Enter template name and description
   - Define template fields (text, number, date, etc.)
   - Save the template

2. **Using Templates**:
   - Templates are used in Sales > Chassis Receival
   - When starting inspection, select a template
   - Template fields appear in inspection form

**Prerequisites**:
- Admin role required

**Areas Affected**:
- Chassis receival inspection process
- Inspection form structure

#### Archive Work Order

**Path**: `/system-admin/archive-wo`

**Description**: 
Archives completed or obsolete work orders by moving their data to a separate archive schema. Archiving is irreversible—archived data is removed from the main database and stored in the archive for historical reference.

**Features**:
- View list of work orders available to archive (e.g., delivered or otherwise eligible)
- Select one or more work orders to archive
- Confirm archive action (with warning that archiving is irreversible)
- View list of already archived work orders (WO No, WO Type, WO Model, WO Date, WO Delivery, Archived by, Archived at)

**How to Use**:

1. **Archiving Work Orders**:
   - Navigate to System Admin > Archive Work Order
   - Click the **"Archive work order"** button (with + icon)
   - In the **Select work order(s) to archive** modal, review the list of work orders available for archive
   - Select one or more work orders (checkboxes)
   - Click **Confirm** or **OK**
   - In the **Confirm archive** modal, review the warning that archiving is irreversible and data will be moved to the archive schema
   - Confirm to start the archive process
   - The page shows status lines for each work order (e.g., "Archiving WO-xxx... Done." or "Failed: ...")
   - When finished, the archived work orders table refreshes to include the newly archived items

2. **Viewing Archived Work Orders**:
   - On the Archive Work Order page, the main table shows **Archived work orders**
   - Columns include: WO No, WO Type, WO Model, WO Date, WO Delivery, Archived by, Archived at
   - Use the table to sort, filter, or search archived records

**Prerequisites**:
- Admin or appropriate role with access to System Admin > Archive Work Order
- Archive schema and archive function must be set up in the database (see database documentation)
- Work orders must be in a state eligible for archive (e.g., delivered or as per business rules)

**Areas Affected**:
- Work order and related data moved from main database to archive schema
- Archived work orders are no longer available in Production, Planning, or Sales for normal operations

---

## Piece Rate Module

### Overview

The Piece Rate module provides piece rate calculations and reporting based on completed work. Use **Time Period (1 Emp)** to review piece rate for one employee on screen; use **Stage** to export Excel for a whole stage and date range.

### Sub-Menus

#### Time Period (1 Emp)

**Path**: `/piece-rate/time-period`

**Description**: 
View piece rate calculations for individual employees over a time period.

**Features**:
- Select employee
- Select date range (must be within same month/year)
- View piece rate calculations
- See piece rate earnings per work
- View total piece rate for the period

**How to Use**:

1. **Viewing Piece Rates**:
   - Navigate to Piece Rate > Time Period (1 Emp)
   - Select an employee from dropdown
   - Select "From Date" and "To Date" (must be same month/year)
   - Click "Load Data"
   - View piece rate calculations:
     - Work details
     - Standard time
     - Actual hours worked
     - Piece rate amount
     - Total piece rate for period

**How Piece Rates Work**:

- Piece rates are automatically calculated when work is completed (completion status = 'C')
- Piece rate is based on standard time, not actual time
- If multiple workers work on the same work, piece rate is distributed proportionally
- Piece rate is calculated using the formula: (Standard Time / Total Hours) × Piece Rate Amount

**Prerequisites**:
- Employees must be registered
- Work reports must be completed (status = 'C')
- Time standards must be defined in Standards > Works > Time Standards
- Piece rate must be configured for works

**Areas Affected**:
- Piece rate calculations (automatic on work completion)
- Employee earnings tracking
- Production reporting (piece rate is part of work reports)

#### Stage (Excel export)

**Path**: `/piece-rate/stage`

**Description**: 
Exports **piece rate data to Excel** for a **single production stage** over a **date range**. There is no on-screen data table; you choose stage and dates, then **Export Excel report**. Generation runs asynchronously with a progress-style modal.

**Features**:
- **Stage**: Picked from **System Admin > Data Elements** category **Plant-Stage** (same stage list as elsewhere in the app).
- **From / To dates**: Must fall in the **same month and year**; “to” must be on or after “from.”
- **Excel workbook** typically includes:
  - **Detail**: All reporting rows for the stage and period (multi-employee line detail).
  - **Consolidated**: Per-employee totals plus a grand total.

**How to Use**:

1. Navigate to **Piece Rate > Stage** (or **Piece Rate - Stage** in the menu).
2. Select **stage**, **from date**, and **to date** (same calendar month).
3. Click **Export Excel report**. Wait until the file downloads or the modal completes.
4. Open the file in Excel for analysis or sharing.

**Prerequisites**:
- Completed production reports with piece rate data for the period
- Plant-Stage data elements configured

**Areas Affected**:
- None (export only)

---

## Reports Module

### Overview

The **Reports** area provides read-only operational reports. Your administrator may group them under a **Reports** menu in the sidebar. Documented reports:

- **Daily Production Status** (`/reports/production/...`) — month-to-date production entry/exit and targets  
- **Lost Time Report** — lost-time lines from work reports (with worker name) over a date range  
- **Deviation Report** — planning and reporting deviations overlapping a date range  
- **C-Off Report** (`/reports/hr/c-off-report`) — planning and reporting manpower rows with C-Off, where the attendance window overlaps the range  
- **Overtime Report** (`/reports/hr/ot-report`) — work reporting rows with overtime minutes &gt; 0 and a worker name, where the report window overlaps the range  
- **Non-Standard Overtime Report** (`/reports/hr/non-std-ot-report`) — overtime rows where work code does **not** start with `P`, `M`, or `C`, with worker name and overlapping report window  
- **Attendance Report** (`/reports/hr/attendance-report`) — **reporting** manpower in a **pivot** table: one row per shift / stage / employee / skill, with a **letter per calendar day** (**P** = present, **A(I)** = absent informed, **A(U)** = absent uninformed) for days covered by the reporting window  

**Shared date rules** (Lost Time, Deviation, C-Off Report, Overtime Report, Non-Standard Overtime Report, **Attendance Report**): **From** and **To** dates must both be set; **from** ≤ **to**; **to** cannot be after today; the range cannot exceed **93 days** (about three months). Defaults are often the first day of the current month through today. **Daily Production Status** uses a single **As of date** (month-to-date from the 1st of that month) instead.

### Daily Production Status

**Path**: `/reports/production/daily-production-status`

**Description**: 
A **month-to-date (MTD)** snapshot from the **1st of the selected month** through the **As of date** you choose. It summarizes working days, daily entry targets from the production plan, plant-level entry/exit counts, and a **by-stage, by-day** grid of work order entries and exits from production dates (`prdn_dates`).

**Features**:
- **As of date**: Pick any date; the report period runs from that month’s first day through that date (inclusive).
- **Generate Report**: Loads summary and detail tables (may take a few seconds).
- **Export Excel**: Downloads an Excel workbook with the same report content (after a report has been generated).
- **Summary (month to date)**:
  - **Period** (start → as-of date)
  - **Working days completed**: Count of working days in that range (weekends excluded; **Planning > Holiday List** active holidays excluded).
  - **Daily entry target**: From the **production plan per shift** (`plan_prod_plan_per_shift.ppd_count`) whose period covers the as-of date (uses an active plan when available; otherwise a plan that still includes that date).
  - **Target (daily × working days)**: Working days × daily entry target when both are known.
- **Plants** table: For each plant (e.g. P1, P2, P3), **Entered** = distinct work orders with an **entry** at the plant’s first line stage (PnS1). **Exited** = distinct work orders with an **exit** at the plant’s last line stage (e.g. P1S4, P2S4); P3 may use P3S1 for both when it is the only stage.
- **By stage (month to date)**: One row per stage from **System Admin > Data Elements** category **Plant-Stage**, plus any stage found in `prdn_dates` that is not in that list. For each calendar day in the period: **Entry** count and WO numbers, **Exit** count and WO numbers (up to two WO numbers per line in each cell). Scroll horizontally for more dates; the Stage column stays fixed.

**How to Use**:

1. Open **Reports > Daily Production Status** (or navigate to `/reports/production/daily-production-status` if you have the menu).
2. Set **As of date**.
3. Click **Generate Report**.
4. Review the summary, plant matrix, and by-stage grid.
5. Optionally click **Export Excel** to save a file for sharing or archiving.
6. Use the header logo shortcut to return to the **Dashboard** if shown.

**Prerequisites**:
- Menu access to the report (assigned by administrator).
- **Holiday list** and **production plan** data for accurate working days and targets.
- **Plant-Stage** data elements for the by-stage breakdown.
- Production **entry/exit** dates recorded in the system (`prdn_dates`).

**Areas Affected**:
- None (read-only report and export)

### Lost Time Report

**Path**: `/reports/production/lost-time-report`

**Description**: 
Lists **lost-time detail lines** from submitted work reports whose reporting window **overlaps** the selected **From** / **To** date range. Only rows that have lost-time data (`lt_details`) and a **worker name** are included (rows without a named worker are excluded).

**Features**:
- **From date** / **To date**: Same validation as other range reports (see Overview above).
- **Generate Report**: Loads a wide results table.
- **Export Excel**: Exports the current result set; the Excel file includes additional columns such as shift, worker ID/skill, LT comments, report status, and audit fields (beyond what is shown on screen).
- On-screen columns include (among others): Shift, Stage, Date (report from, with time if present), Work order, Work code, Work name + details, Skill competency, Std time, Worker, Report to (date/time), Minutes, Reason, Payable (Yes/No), Value.

**How to Use**:

1. Open **Reports > Lost Time Report** (or `/reports/production/lost-time-report`).
2. Set **From** and **To** dates.
3. Click **Generate Report**.
4. Review the table; use **Export Excel** if you need the extended columns or a file to share.

**Prerequisites**:
- Menu access; lost-time reasons configured in **System Admin > Lost Time Reasons** where applicable.
- Work reports in the range with lost-time lines and named workers.

**Areas Affected**:
- None (read-only)

### Deviation Report

**Path**: `/reports/production/deviation-report`

**Description**: 
Shows **planning and reporting deviations** whose time windows overlap the selected **From** / **To** range. Planning-side deviations (including trainee addition) appear as **one** row with context **Plan**. Reporting-side deviations appear as **two** rows each: **Plan** (planned window/worker and standard time from skill mapping) and **Report** (reported window/worker and reported standard time when present). Overlap is determined by each row’s `from_date` / `to_date` with your filter range.

**Features**:
- **From date** / **To date**: Same validation as Lost Time Report (max ~3 months, to ≤ today).
- **Generate Report** / **Export Excel** (Excel after rows are loaded).
- Table columns include: Stage, Shift, Date, **Context** (Plan / Report), Type, Reason, Work order, Work code, Work name + details, Skill competency, Std time, Worker.

**How to Use**:

1. Open **Reports > Deviation Report** (or `/reports/production/deviation-report`).
2. Set **From** and **To** dates.
3. Click **Generate Report**.
4. Review Plan vs Report lines; export to Excel if needed.

**Prerequisites**:
- Menu access; deviation records recorded during planning/reporting in Production.

**Areas Affected**:
- None (read-only)

<span id="c-off-report"></span>

### C-Off Report

**Path**: `/reports/hr/c-off-report`

**Description**:  
Lists **planning** and **reporting** manpower lines whose **attendance window overlaps** the selected **From** / **To** range and where **C-Off** applies (**C-Off value &gt; 0** or a **C-Off from date** is set). Use this to review or export comp-off–related attendance in one place.

**Features**:
- Same **From** / **To** validation as [Lost Time Report](#lost-time-report) (see [Reports Module](#reports-module) overview).
- **Generate Report** loads a table with columns such as: **Source** (plan vs report), shift, stage, employee, skill, attendance status, **Window** / **Times**, planned hours, actual hours, **C-Off (d)**, **C-Off window**, notes.
- **Export Excel** downloads the current result set (enabled when there is at least one row).

**How to Use**:

1. Open **Reports > C-Off Report** (or `/reports/hr/c-off-report` if your menu includes it).
2. Set **From** and **To** dates.
3. Click **Generate Report**; optionally **Export Excel**.

**Prerequisites**:
- Menu access; C-Off data entered in Production **Manpower Plan** / **Manpower Report** via **Mark Attendance**.

**Areas Affected**:
- None (read-only)

<span id="overtime-report"></span>

### Overtime Report

**Path**: `/reports/hr/ot-report`

**Note**: Your sidebar menu may show **OT Report** (seed data) while the screen title reads **Overtime Report**.

**Description**:  
Lists **work reporting** detail whose **report from/to window overlaps** the selected range, where **overtime minutes &gt; 0**, and the row has a **worker name** (same spirit as Lost Time Report’s named-worker filter).

**Features**:
- Same **From** / **To** rules as other range reports (max ~93 days, **to** ≤ today).
- On-screen columns include shift, stage, work order, work code, work name + details, **Worker**, report window, **OT** (time), **OT amount**.
- **Export Excel** after rows are loaded.

**How to Use**:

1. Open **Reports > Overtime Report** (or `/reports/hr/ot-report`).
2. Set **From** and **To** dates.
3. Click **Generate Report**; use **Export Excel** if needed.

**Prerequisites**:
- Menu access; submitted or available reporting data with OT recorded (e.g. via **Draft Report** > **Report OT**).

**Areas Affected**:
- None (read-only)

<span id="non-standard-overtime-report"></span>

### Non-Standard Overtime Report

**Path**: `/reports/hr/non-std-ot-report`

**Description**:  
A focused overtime report for **non-standard work**. It includes work reporting rows whose report window overlaps your date range, have **overtime minutes &gt; 0**, have a **worker name**, and whose **work code does not start with `P`, `M`, or `C`**.

**Features**:
- Same **From** / **To** date validation as other range reports (max ~93 days, **to** ≤ today).
- Includes OT time and amount with core work context (shift, stage, work order, work code, work name/details, worker, from/to date/time).
- **Search table** filter and **Export Excel** after generation.

**How to Use**:

1. Open **Reports > Non-Standard Overtime Report** (or `/reports/hr/non-std-ot-report`).
2. Set **From** and **To** dates.
3. Click **Generate Report**; optionally use search and **Export Excel**.

**Prerequisites**:
- Menu access; reporting rows in range with OT and worker name; work code not starting with P/M/C.

**Areas Affected**:
- None (read-only)

<span id="attendance-report"></span>

### Attendance Report

**Path**: `/reports/hr/attendance-report`

**Description**:  
A **pivot** view of **reporting** manpower from production **Manpower Report** data over a **From** / **To** range. Each row is a **shift, stage, employee, and skill**; one column per **calendar day** in the range. Each cell shows a short code: **P** (present), **A(I)** (absent informed), **A(U)** (absent uninformed), or **—** when there is no value. The page subtitle in the app is: *Reporting manpower — one letter per calendar day (P / A(I) / A(U); max ~3 months).*

**Features**:
- Same **From** / **To** validation as [Lost Time Report](#lost-time-report) (max ~93 days, **to** ≤ today).
- **Search** box to filter rows by any column text.
- **Generate Report** then **Export Excel** (export is available when at least one data row exists).

**How to Use**:

1. Open **Reports > Attendance Report** (or **HR** group, depending on how your administrator placed the menu; path is `/reports/hr/attendance-report`).
2. Set **From** and **To** dates.
3. Click **Generate Report**; use the search box to narrow results; **Export Excel** if you need a file.

**Prerequisites**:
- Menu access; **Manpower Report** attendance data for the period (so reporting manpower rows exist in range).

**Areas Affected**:
- None (read-only)

---

## Common Features

### Data Export

Many modules support exporting data to Excel or PDF:

- **Excel Export**: Click "Export to Excel" button to download data as Excel file
- **PDF Export**: Click "Export to PDF" button to generate PDF document
- **Reports**: **Daily Production Status**, **Lost Time Report**, **Deviation Report**, **C-Off Report**, **Overtime Report**, **Non-Standard Overtime Report**, and **Attendance Report** each offer **Export Excel** after you generate the on-screen report (where rows exist)

### Search and Filter

Most data tables support:
- **Search**: Use search box to find specific records
- **Filter**: Use dropdown filters to narrow down results
- **Date Range**: Select date ranges for time-based data

### Import/Export

Several modules support bulk operations:
- **Import**: Upload Excel file to import multiple records
- **Export Template**: Download template Excel file for import
- **Export Data**: Export existing data to Excel

### Modals and Forms

- **Add Modal**: Click "Add" button to open form for new record
- **Edit Modal**: Click edit icon to modify existing record
- **View Modal**: Click on row to view details
- **Delete**: Click delete icon and confirm to remove record

### Date Selection

- Date pickers are used throughout the system
- Select dates using calendar interface
- Date formats are consistent across the system

### Validation

- Forms include validation for required fields
- Error messages display for invalid inputs
- Success messages confirm successful operations

---

## Quick Reference Guide

### Common Tasks - Quick Steps

This section provides quick reference for the most common tasks. For detailed instructions, refer to the respective module sections.

#### Production Tasks

**Add Work Order to Stage**:
1. Production > [Stage/Shift] > Work Orders tab
2. Select date
3. Click "Entry" button
4. Confirm entry

**Plan a Work**:
1. Production > [Stage/Shift] > Works tab
2. Click "Plan" button for work
3. Select time slot (Step 1)
4. Select workers (Step 2)
5. Save plan

**Submit Plan**:
1. Production > [Stage/Shift] > Draft Plan tab
2. Review all plans
3. Click "Submit Plan" button
4. Confirm submission

**Report Work**:
1. Production > [Stage/Shift] > Plan tab
2. Click "Report" button for work
3. Fill completion status, times, hours
4. Save report
5. Go to Draft Report tab > Submit Report

**Mark attendance (Manpower Plan / Manpower Report)**:
1. Production > [Stage/Shift] > **Manpower Plan** or **Manpower Report**
2. Select the date
3. **Mark Attendance** (or select rows and use bulk mark): set Present / Absent (Informed) / Absent (Uninformed); when Present set from/to date and time; optional C-Off; notes if partial
4. See [Step 7.1](#step-71-record-employee-attendance-manpower-report) for C-Off rules (4/8/12 h net, window inside attendance)

#### Planning Tasks

**Create Entry Plan**:
1. Planning > Entry Plan > "To be Planned" tab
2. Click "Create Plan" for work order
3. Select entry date/time
4. Review calculated dates
5. Save plan

**View Schedule**:
1. Planning > Schedule
2. Select date range
3. Choose tab (Plan/Actual/Deviation/Statistics)
4. View schedule data

#### HR Tasks

**Add Employee**:
1. HR > Employee
2. Click "Add Employee"
3. Fill all required fields
4. Save

**Import Employees**:
1. HR > Employee > Import
2. Download template
3. Fill Excel file
4. Upload file
5. Review results

#### Sales Tasks

**Create Work Order**:
1. Sales > Work Orders
2. Click "Create Work Order"
3. Fill work order details
4. Save

**Record Chassis Arrival**:
1. Sales > Chassis Receival > Pending tab
2. Select work order
3. Click "Start Inspection"
4. Select template
5. Fill inspection form
6. Complete inspection

**Create Non-Commercial Work Order**:
1. Accounts > Create non-commercial work order
2. Select category, WO number, date, customer
3. Type + Model, or comments if either is missing
4. Save (Reset form to change category)

**Central Production Dashboard**:
1. Production > Central Production Dashboard
2. Pick date and view mode (Planning / Reporting / Both)
3. Use Production Circle to select plant → stage → shift
4. Open Full Page to jump to that stage/shift Production screen

**Shift Change**:
1. Production > Shift change
2. Select stage, select employees, Change shift
3. View shift history on a row if needed

**Add Multiple Standard Works**:
1. HR > Add Multiple Standard Works
2. Stage → work order → select works → reason → add to queue
3. Submit all queued works

**Piece Rate — Stage Export**:
1. Piece Rate > Stage
2. Stage + from/to dates (same month)
3. Export Excel report

**Daily Production Status (MTD)**:
1. Reports > Daily Production Status
2. Set As of date → Generate Report
3. Review summary, plants, by-stage grid
4. Export Excel if needed

**Lost Time Report**:
1. Reports > Lost Time Report
2. From / To dates (max ~3 months, to ≤ today)
3. Generate Report → Export Excel if needed

**Deviation Report**:
1. Reports > Deviation Report
2. From / To dates (same rules as Lost Time)
3. Generate Report → review Plan / Report context rows → Export Excel if needed

**C-Off Report**:
1. Reports > C-Off Report
2. From / To dates (max ~3 months, to ≤ today)
3. Generate Report → Export Excel if needed

**Overtime Report**:
1. Reports > Overtime Report
2. From / To dates (same rules)
3. Generate Report → Export Excel if needed

**Non-Standard Overtime Report**:
1. Reports > Non-Standard Overtime Report (`/reports/hr/non-std-ot-report`)
2. From / To dates (max ~3 months, to ≤ today)
3. Generate Report → optional search → Export Excel if needed

**Attendance Report**:
1. Reports > Attendance Report (`/reports/hr/attendance-report`)
2. From / To dates (max ~3 months, to ≤ today)
3. Generate Report → search optional → Export Excel if needed

### Navigation Quick Reference

| Task | Menu path | URL path (typical) |
|------|-----------|-------------------|
| View Dashboard | Dashboard | `/dashboard` |
| Central Production Dashboard | Production > Central Production Dashboard | `/production/dashboard` |
| Production (stage/shift) | Production > [Stage]-[Shift] | `/production/[stageCode]-[shiftCode]` |
| Shift change | Production > Shift change | `/production/shift-change` |
| Plan review | Production > Plan Review | `/production/plan-review` |
| Report review | Production > Report Review | `/production/report-review` |
| Entry Planning | Planning > Entry Plan | `/planning/entry-plan` |
| View Schedule | Planning > Schedule | `/planning/schedule` |
| Manage Employees | HR > Employee | `/hr/employee` |
| Add Multiple Standard Works | HR > Add Multiple Standard Works | `/hr/add-multiple-std-works` |
| Add Std Work to WO | HR > Add Standard Work to WO | `/hr/add-std-work-to-wo` |
| Manage Shifts | HR > Shift Master | `/hr/shift-master` |
| Create Work Order | Sales > Work Orders | `/sales/work-orders` |
| Non-Commercial WO | Accounts > Create non-commercial work order | `/accounts/create-work-order` |
| Manage Standards | Standards > Works | `/standards/works` |
| Piece Rate (employee) | Piece Rate > Time Period (1 Emp) | `/piece-rate/time-period` |
| Piece Rate (stage Excel) | Piece Rate > Stage | `/piece-rate/stage` |
| Archive Work Orders | System Admin > Archive Work Order | `/system-admin/archive-wo` |
| System Admin | System Admin > User Management | `/system-admin/user-management` |
| Daily Production Status | Reports > Daily Production Status | `/reports/production/daily-production-status` |
| Lost Time Report | Reports > Lost Time Report | `/reports/production/lost-time-report` |
| Deviation Report | Reports > Deviation Report | `/reports/production/deviation-report` |
| C-Off Report | Reports > C-Off Report | `/reports/hr/c-off-report` |
| Overtime Report | Reports > Overtime Report | `/reports/hr/ot-report` |
| Non-Standard Overtime Report | Reports > Non-Standard Overtime Report | `/reports/hr/non-std-ot-report` |
| Attendance Report | Reports > Attendance Report | `/reports/hr/attendance-report` |

### Status Reference

**Work Order Statuses**:
- **Ordered**: Work order created, not yet in production
- **WIP**: Work In Progress - work order is in production
- **Delivered**: Work order completed and delivered

**Work Statuses**:
- **To be Planned**: Work exists but not yet planned
- **Draft Plan**: Work is planned but not submitted
- **Planned/Approved**: Work plan is approved
- **Reported**: Work completion is reported

**Plan Submission Statuses**:
- **To be Submitted**: Plan not yet submitted
- **Submitted/Pending Approval**: Plan submitted, awaiting approval
- **Approved**: Plan approved, ready for execution
- **Rejected**: Plan rejected, can be edited and resubmitted

### Field Reference

**Common Required Fields**:
- Employee ID: Unique identifier (alphanumeric)
- Work Order Number: Unique identifier
- Date Fields: Use date picker (DD-MM-YYYY format)
- Time Fields: Use time picker (HH:MM format, 15-min intervals)
- Status Fields: Select from dropdown

**Common Dropdown Fields**:
- Stage: Select from configured stages
- Shift: Select from HR > Shift Master
- Skill: Select from HR > Skill Master
- Model: Select from Sales > Models
- Category: Select from configured categories

---

## Frequently Asked Questions (FAQ)

This section answers common questions in one place. For step-by-step instructions, follow the links to the relevant sections.

---

### Getting Started & Access

**Q: How do I log in?**  
A: Go to the application URL, enter your username and password, and click Login. You will be redirected to the Dashboard. See [Login](#login).

**Q: I forgot my password. What do I do?**  
A: Ask your system administrator to send you a password reset from **System Admin > User Management** (Users tab → Reset Password for your user). You will receive an email with a link to set a new password. See [Password Reset (Forgot Password)](#password-reset-forgot-password).

**Q: I was asked to set my password when I first logged in. Is that normal?**  
A: Yes. New accounts or password resets require you to set your password via the Set Your Password page. See [First-Time Set Password](#first-time-set-password).

**Q: How do I open the user manual or help?**  
A: Click the **"Help Doc."** button in the sidebar (above the logout button). The manual opens in a new browser tab. See [Help Documentation](#help-documentation).

**Q: How do I switch between light and dark theme?**  
A: Use the floating theme toggle button on the screen. See [Navigation](#navigation).

**Q: I don’t see some menu items. Why?**  
A: Menu access is controlled by your administrator. Only menus assigned to your user account are visible. Contact your admin to request access. See [User Management](#user-management).

---

### Work Orders & Sales

**Q: How do I add a work order?**  
A: Go to **Sales > Work Orders**, click **Add Work Order** (or equivalent), fill in the details (including model), and save. See [How to Create a New Work Order](#1-how-to-create-a-new-work-order).

**Q: How do I view or filter work orders?**  
A: Go to **Sales > Work Orders**. Use the period dropdown, search box, and filters to find work orders. See [How to View and Filter Work Orders](#2-how-to-view-and-filter-work-orders).

**Q: How do I add a new model?**  
A: Go to **Sales > Models**, click Add Model, enter model code and name, and save. Models are used when creating work orders. See [Models](#models).

**Q: What is chassis receival and when do I use it?**  
A: Chassis receival is the process of recording when the chassis arrives and completing an inspection. Use **Sales > Chassis Receival** when the chassis is received; this can be a prerequisite before the work order can be planned. See [Chassis Receival](#chassis-receival).

**Q: How do I record chassis arrival or complete chassis inspection?**  
A: Go to **Sales > Chassis Receival**, open the Pending tab, select the work order, and use **Record Arrival** or **Start Inspection**. Select a template and fill in the inspection form. See [Chassis Receival](#chassis-receival).

---

### Accounts

**Q: When should I use Accounts instead of Sales to create a work order?**  
A: Use **Accounts > Create non-commercial work order** for non-commercial or internal work orders that are not entered through **Sales > Work Orders** (e.g. accounting-driven or special categories). Commercial customer orders still go through Sales unless your process says otherwise. See [Create Non-Commercial Work Order](#create-non-commercial-work-order).

**Q: How do I create a non-commercial work order?**  
A: Go to **Accounts > Create non-commercial work order**, select **Non-commercial category** and **WO number**, enter **Date WO placed** and **Customer name**, optionally **Type** and **Model** (or fill **Comments** if type/model are not both set), then **Save**. Use **Reset form** to change category. See [Create Non-Commercial Work Order](#create-non-commercial-work-order).

**Q: Why won’t the form let me save without comments?**  
A: **Comments** are required unless **both** Type and Model are selected. If you leave either Type or Model empty, you must enter comments explaining the work order.

**Q: The system says this WO number already exists. What do I do?**  
A: WO numbers must be unique. Enter a different WO number or verify whether the work order was already created.

---

### Planning

**Q: How do I schedule a work order through production (create an entry plan)?**  
A: Go to **Planning > Entry Plan**, open the **"To be Planned"** tab (or **Chassis to be Received** / **Documents to be Released** if applicable), click **Create Plan** for the work order, choose the first-stage entry date and time, review the calculated dates for all stages, and save. See [How to Create an Entry Plan for a Work Order](#1-how-to-create-an-entry-plan-for-a-work-order).

**Q: How do I view the production schedule (plan vs actual)?**  
A: Go to **Planning > Schedule**. Select the date range and use the **Plan**, **Actual**, **Deviation**, and **Statistics** tabs. See [How to View and Analyze Production Schedule](#2-how-to-view-and-analyze-production-schedule).

**Q: How do I add a holiday to the calendar?**  
A: Go to **Planning > Holiday List**, select the **year** if needed, click **Add Holiday**, enter the date and description, and save. You can also **import** holidays in bulk or use **Add Sundays** for the year. See [Holiday List](#holiday-list).

**Q: How do I set or change lead times for stages?**  
A: Go to **Planning > Lead Times** and configure the lead time (e.g. in days) for each stage. Entry Plan uses these to calculate entry/exit dates. See [Lead Times](#lead-times).

**Q: How do I set the order of production stages?**  
A: Go to **Planning > Order of Stages** and define the sequence of stages. This order is used when calculating dates in Entry Plan. See [Order of Stages](#order-of-stages).

**Q: What are Entry Per Day and Entry Per Shift?**  
A: These planning views show planned or actual work order entries by day or by shift. Use them to see when work orders are scheduled to enter stages. See the Planning section for paths and usage.

---

### Production — Entering & Adding Work

**Q: How do I add a work order to my stage (enter a work order)?**  
A: Go to **Production > [Your Stage/Shift]** (e.g. P1S2-GEN), open the **Work Orders** tab, select the date, find the work order in the waiting list, and click **Entry**. Confirm in the modal. See [How to Add a Work Order to a Stage](#1-how-to-add-a-work-order-to-a-stage).

**Q: The Entry button is not visible for a work order. Why?**  
A: The work order may not be scheduled to enter your stage yet. Check **Planning > Entry Plan** (and Schedule) to see the planned entry date. Entry is only available when the work order is due to enter your stage on the selected date.

**Q: How do I add works to a work order?**  
A: Go to **Production > [Stage/Shift] > Works** tab, click **Add Work**, select the work order, choose the work (and skill combination if needed), fill in details, and save. Use this when the model has no standard works for your stage or you need extra works. See [How to Add Works to a Work Order](#2-how-to-add-works-to-a-work-order).

---

### Production — Planning Work

**Q: How do I plan a work (assign workers and time)?**  
A: In **Production > [Stage/Shift] > Works** tab, find the work with status **To be Planned**, click **Plan**, choose the time slot (Step 1), then select workers (Step 2), and save. See [How to Plan a Work](#3-how-to-plan-a-work).

**Q: How do I modify a planned work?**  
A: Go to **Draft Plan** tab, find the work, click **Edit**, change time slot or workers, and save. You can only edit before submitting the plan. See [How to Modify a Planned Work](#4-how-to-modify-a-planned-work).

**Q: How do I delete a planned work?**  
A: In **Draft Plan** tab, find the work and click **Delete**, then confirm. The work returns to **To be Planned**. See [How to Delete a Planned Work](#5-how-to-delete-a-planned-work).

**Q: How do I submit the plan for the day?**  
A: Go to **Production > [Stage/Shift] > Draft Plan** tab, review all plans, fix any validation issues, then click **Submit Plan** and confirm. After approval, the plan is fixed. See [How to Submit a Plan](#6-how-to-submit-a-plan).

**Q: What is the difference between Plan, Draft Plan, and Works tabs?**  
A: **Works** shows all works for the stage; you plan works here (they move to Draft Plan). **Draft Plan** shows planned works before submission; you can edit or delete here, then submit. **Plan** shows the approved/submitted plan for the day (read-only for reporting).

**Q: Can different workers on the same work have different start/end times?**  
A: **Yes—for planning and for multi-skill reporting.** In **Plan Work**, **Step 2**: enable **Custom from/to times for this assignment** under a worker or trainee. In the **multi-skill Report** modal, use the same optional control so each person’s **actual** from/to times can differ from the shared report window. Single-work **Report** dialogs typically use one from/to for the whole work; use the multi-skill report when each worker needs their own times.

**Q: Why won’t the plan save even though I clicked Save?**  
A: **Time conflicts** with other draft plans for the same workers can block saving until you adjust times or workers. **Planning** can also be **blocked** for a date if the stage/shift plan is already submitted or approved. Read the alert message for the exact reason.

---

### Production — Reporting

**Q: How do I report work completion?**  
A: In **Production > [Stage/Shift] > Plan** tab, find the completed work and click **Report**. In the modal, enter completion status (C/NC), from/to times, hours, lost time if any, and save. Then go to **Draft Report** and **Submit Report** when all reports are done. See [How to Report a Plan (Report Work Completion)](#7-how-to-report-a-plan-report-work-completion).

**Q: How do I report overtime?**  
A: Go to **Draft Report** tab. If overtime is calculated, the **Report OT** button is enabled. Click it, review the overtime details, and save. Do this before submitting the daily report. See [Detailed Overtime Reporting](#detailed-overtime-reporting).

**Q: How do I submit the daily report?**  
A: Go to **Draft Report** tab, ensure all work is reported (and overtime if needed), then click **Submit Report** and confirm. See [Step 7.5: Submit Final Report](#step-75-submit-final-report).

**Q: How do I report unplanned work (work that wasn’t in the plan)?**  
A: In **Draft Report** tab, click **Report Unplanned Work**, select the unplanned work, then click **Report** and fill in the same details as for planned work. See the Production section on reporting unplanned work.

**Q: How do I record employee attendance (entry/exit)?**  
A: Use **Manpower Plan** (planned) and/or **Manpower Report** (actual), select the date, then **Mark Attendance** on each row (or bulk mark). Choose **Present**, **Absent (Informed)**, or **Absent (Uninformed)**. When **Present**, set **from/to date and time**, optional **C-Off**, and **Notes** if required for partial attendance. Any **Absent** clears times, C-Off, and OT on that attendance row. Shift overtime is finalized from **Draft Report** (**Report OT**). See [Step 7.1: Record Employee Attendance](#step-71-record-employee-attendance-manpower-report).

**Q: What is the difference between Absent (Informed) and Absent (Uninformed)?**  
A: Both mean the employee is **not present** for that attendance record; dates/times and C-Off do not apply. **Informed** means the absence was communicated per your process; **Uninformed** flags a no-show-style case. **Absent (Uninformed)** rows are visually emphasized on **Manpower Report** and in **Plan Review** / **Report Review** manpower tables so reviewers notice them.

**Q: What is C-Off in Mark Attendance, and when can I use it?**  
A: **C-Off** (compensatory off) is optional time off recorded inside the employee’s attendance window. You choose a **value** (0, 0.5, 1, or 1.5 “days” tied to 4 / 8 / 12 net hours) and a **C-Off from/to** window that must sit **fully inside** the attendance from/to times. Net attendance hours (excluding shift breaks) must be **exactly 4, 8, or 12** to allow C-Off &gt; 0. See [Step 7.1](#step-71-record-employee-attendance-manpower-report).

**Q: The Report OT button is disabled. Why?**  
A: It is disabled when there is no overtime, overtime is already reported, or the report is already submitted or approved. Check that you have saved actual times and that the report is still in draft.

---

### Production — Other

**Q: How do I cancel a planned work?**  
A: In **Plan** tab, find the work, click **Cancel**, enter the cancellation reason, and confirm. See the Production module section on cancelling work.

**Q: What are Plan Review and Report Review?**  
A: **Plan Review** and **Report Review** (under Production) let you view and compare plans and reports, often as PDFs. They are read-only review tools. See [Plan Review](#plan-review) and [Report Review](#report-review).

**Q: What is the Central Production Dashboard?**  
A: **Production > Central Production Dashboard** (`/production/dashboard`) shows a read-only summary for all plant–stage–shift combinations on a chosen date: hierarchy circle, totals, and details for the selected shift. Use **Open Full Page** to jump to the full Production screen for that stage/shift. See [Central Production Dashboard](#central-production-dashboard).

**Q: How do I change an employee’s shift for a stage?**  
A: Go to **Production > Shift change**, select the **stage**, tick the employees, click **Change shift**, pick the new shift, and confirm. Use **View shift history** to see past changes. See [Shift change](#shift-change).

---

### HR & Employees

**Q: How do I add an employee?**  
A: Go to **HR > Employee**, click **Add Employee**, fill in details (name, code, shift, skills, etc.), and save. See [How to Add a New Employee](#1-how-to-add-a-new-employee).

**Q: How do I edit an employee?**  
A: Go to **HR > Employee**, find the employee, click the edit icon, update the fields, and save. See [How to Edit an Employee](#2-how-to-edit-an-employee).

**Q: How do I import employees from Excel?**  
A: Go to **HR > Employee**, use the Import option, download the template if needed, fill it in, upload the file, and follow the import steps. See [How to Import Employees from Excel](#3-how-to-import-employees-from-excel).

**Q: How do I bulk update employees?**  
A: Go to **HR > Employee** and use the bulk update feature (e.g. select multiple employees and apply changes). See [How to Bulk Update Employees](#4-how-to-bulk-update-employees).

**Q: How do I add a shift (e.g. morning shift)?**  
A: Go to **HR > Shift Master**, click Add, enter shift code and name (and times if applicable), and save. See [Shift Master](#shift-master).

**Q: How do I add a skill?**  
A: Go to **HR > Skill Master**, click Add, enter skill code and name, and save. See [Skill Master](#skill-master).

**Q: What is Daily Shift used for?**  
A: **HR > Daily Shift** is for viewing and managing daily shift assignments and operations. See [Daily Shift](#daily-shift).

**Q: What is “Add Std Work to WO”?**  
A: **HR > Add Standard Work to WO** adds standard works to a work order through that screen’s flow. See [Add Standard Work to WO](#add-standard-work-to-wo).

**Q: What is “Add Multiple Standard Works” and when should I use it?**  
A: **HR > Add Multiple Standard Works** lets you queue many standard-work additions (stage + work order + reason) and submit them in one batch—useful when you need to add several works across work orders without repeating the single-add flow. See [Add Multiple Standard Works](#add-multiple-standard-works).

---

### Standards

**Q: How do I add a standard work?**  
A: Go to **Standards > Works**, open the **Standard Works** tab, click **Add Work**, enter work code, name, description, and other fields, then save. See [Works](#works).

**Q: How do I define which works belong to which stage (work flow)?**  
A: Go to **Standards > Work Flow** and configure the workflow so that each work is assigned to the correct stage(s). This determines which works appear when a work order enters a stage. See [Work Flow](#work-flow).

**Q: How do I add skill combinations?**  
A: Go to **Standards > Skill Combinations**, add a new combination, and assign the required skills. These are used when planning and reporting multi-skill works. See [Skill Combinations](#skill-combinations).

**Q: How do I set time standards for works?**  
A: In **Standards > Works**, use the **Time Standards** tab to define standard times for work–skill combinations. See [Works](#works).

---

### R&D Documents

**Q: How do I upload or submit documents for a work order?**  
A: Go to **R&D > Share Documents**, open the Pending tab (or similar), find the work order, click **Upload Documents**, select stages, upload files, add notes, and submit. See [Share Documents](#share-documents).

**Q: How do I view documents by type (e.g. BOM, drawings)?**  
A: Go to **R&D > View Documents**, choose the document type (e.g. Bill of Material, Structure Drawing), and use the list to search, view, and download. See [View Documents](#view-documents).

**Q: What document types are supported?**  
A: The system supports BOM, Cutting Profile, General, Material Checklist, Platform Drawing, Seat Layout, and Structure Drawing. Some are single-file per work order, others allow multiple files. See [R&D Module](#rnd-module).

---

### System Admin

**Q: How do I add a new user?**  
A: Go to **System Admin > User Management**, open the **Users** tab, click **Add User**, enter username, email, password, role, and other details, then save. See [User Management](#user-management).

**Q: How do I assign menu access to a user?**  
A: Go to **System Admin > User Management**, open the **User's Menu** tab, select the user, check the menus they should see, and save. See [Assigning User Menus](#4-assigning-user-menus).

**Q: How do I reset a user’s password?**  
A: In **System Admin > User Management**, **Users** tab, find the user and click **Reset Password**. The user receives an email with a link to set a new password. See [Reset Password for a User](#2-reset-password-for-a-user-admin-initiated).

**Q: How do I add a new menu item?**  
A: In **System Admin > User Management**, go to the **Menu** tab, click **Add Menu**, enter menu name, path, parent, and order, then save. See [Managing Menus](#3-managing-menus).

**Q: How do I add lost time reasons?**  
A: Go to **System Admin > Lost Time Reasons**, click **Add Reason**, enter code and description, and save. These appear when reporting lost time in Production. See [Lost Time Reasons](#lost-time-reasons).

**Q: How do I create a chassis receival inspection template?**  
A: Go to **System Admin > Chassis Receival Template**, click **Add Template**, define name, description, and fields, and save. The template is then used in **Sales > Chassis Receival**. See [Chassis Receival Template](#chassis-receival-template).

**Q: How do I archive a work order?**  
A: Go to **System Admin > Archive Work Order**, click **Archive work order**, select one or more work orders, confirm the irreversible archive action, and complete the process. See [Archive Work Order](#archive-work-order).

---

### Reports

**Q: What is Daily Production Status?**  
A: **Reports > Daily Production Status** shows a **month-to-date** view from the 1st of the month through your chosen **As of date**: working days, daily entry target from the production plan, plant entry/exit counts, and a by-stage grid of entries/exits per day. See [Daily Production Status](#daily-production-status).

**Q: How do I run or export Daily Production Status?**  
A: Open the report, pick **As of date**, click **Generate Report**, then optionally **Export Excel**. Working days exclude weekends and holidays from **Planning > Holiday List**. See [Daily Production Status](#daily-production-status).

**Q: What is the Lost Time Report?**  
A: **Reports > Lost Time Report** lists lost-time lines from work reports that overlap your **From** / **To** range, for rows that have a **worker name**. Use **Export Excel** for extra columns (worker ID, comments, status, audit). See [Lost Time Report](#lost-time-report).

**Q: What is the Deviation Report?**  
A: **Reports > Deviation Report** shows planning and reporting deviations overlapping your date range. Reporting deviations appear as two lines (**Plan** and **Report**) per event. See [Deviation Report](#deviation-report).

**Q: Why does the Lost Time or Deviation report say my date range is invalid?**  
A: **To** cannot be after today, **from** must be on or before **to**, and the span cannot exceed **93 days** (~3 months). Narrow the range and try again.

**Q: What is the C-Off Report?**  
A: **Reports > C-Off Report** lists planning and reporting manpower rows whose attendance **overlaps** your **From** / **To** range and have C-Off recorded. Use **Generate Report** and **Export Excel** like other HR/production range reports. See [C-Off Report](#c-off-report).

**Q: What is the Overtime Report?**  
A: **Reports > Overtime Report** lists work reporting lines with **OT minutes &gt; 0** and a **worker name**, where the report window overlaps your date range. See [Overtime Report](#overtime-report).

**Q: What is the Non-Standard Overtime Report?**  
A: **Reports > Non-Standard Overtime Report** applies the same OT logic as Overtime Report, but only includes rows where **work code does not start with P/M/C**. Useful for isolating non-standard work OT. See [Non-Standard Overtime Report](#non-standard-overtime-report).

**Q: What is the Attendance Report (HR)?**  
A: **Reports > Attendance Report** builds a **date-range pivot** over **reporting** manpower: each row is shift / stage / employee / skill; each date column shows **P**, **A(I)**, or **A(U)** for that day. Same **From** / **To** limits as other ~93-day HR reports. See [Attendance Report](#attendance-report).

---

### Piece Rate

**Q: How do I view piece rate for an employee?**  
A: Go to **Piece Rate > Time Period (1 Emp)**, select the employee and date range (within the same month/year), click **Load Data**, and view the piece rate calculations. See [Time Period (1 Emp)](#time-period-1-emp).

**Q: How do I export piece rate for a whole stage to Excel?**  
A: Go to **Piece Rate > Stage** (or **Piece Rate - Stage**), select **stage**, **from** and **to** dates (same month and year), then **Export Excel report**. The file includes detail and consolidated sheets. See [Stage (Excel export)](#stage-excel-export).

---

### Troubleshooting & Errors

**Q: “No lead times configured” when creating an entry plan. What do I do?**  
A: Configure lead times in **Planning > Lead Times** for each stage. Entry Plan needs these to calculate dates. See [Lead Times](#lead-times).

**Q: Dates are wrong or not calculating in Entry Plan. Why?**  
A: Check that **Planning > Lead Times**, **Order of Stages**, and **Holiday List** are set up correctly. Dates are calculated from these. See [How to Create an Entry Plan for a Work Order](#1-how-to-create-an-entry-plan-for-a-work-order).

**Q: Work order does not appear in Production. What should I check?**  
A: Ensure (1) the work order exists in **Sales > Work Orders**, (2) an entry plan was created in **Planning > Entry Plan**, and (3) the selected date in Production is the planned entry date for your stage. See [Process Flow](#process-flow).

**Q: I get “Model not found” or “Skill not found” when creating a work order or planning. What does this mean?**  
A: Create the missing master data: add the model in **Sales > Models** or the skill in **HR > Skill Master**. The system only allows values that exist in these masters.

**Q: Where can I see a full overview of the process from order to delivery?**  
A: See the [Process Flow](#process-flow) section for the end-to-end flow and links to each step.

---

## Troubleshooting

### Common Issues and Solutions

#### Authentication Issues

**Problem**: Cannot login to the system

**Symptoms**:
- Login page shows error message
- "Invalid credentials" message
- Page redirects back to login

**Solutions**:
1. **Verify Credentials**:
   - Double-check username and password
   - Ensure Caps Lock is off
   - Check for typos

2. **Check Account Status**:
   - Contact administrator to verify account is active
   - Account may be deactivated or deleted

3. **Clear Browser Data**:
   - Clear browser cache and cookies
   - Try incognito/private browsing mode

4. **Contact Administrator**:
   - If issues persist, contact system administrator
   - Provide username and error message

---

#### Menu Access Issues

**Problem**: Menu items not visible or accessible

**Symptoms**:
- Expected menu items don't appear in sidebar
- Clicking menu item shows "Access Denied"
- Some modules are missing

**Solutions**:
1. **Check User Permissions**:
   - Contact administrator
   - Verify menu assignments in System Admin > User Management
   - User's Menu tab shows assigned menus

2. **Verify Role**:
   - Admin users see all menus
   - Regular users see only assigned menus
   - Check your user role

3. **Refresh Page**:
   - Refresh browser page (F5)
   - Clear cache and reload
   - Logout and login again

---

#### Data Loading Issues

**Problem**: Data not loading or page stuck loading

**Symptoms**:
- Loading spinner never stops
- Empty tables or "No data" messages
- Page appears frozen

**Solutions**:
1. **Check Internet Connection**:
   - Verify internet is working
   - Check network connectivity
   - Try accessing other websites

2. **Refresh Page**:
   - Press F5 to refresh
   - Or click browser refresh button
   - Wait for data to load

3. **Clear Browser Cache**:
   - Clear browser cache and cookies
   - Close and reopen browser
   - Try different browser

4. **Check Browser Console**:
   - Press F12 to open developer tools
   - Check Console tab for errors
   - Report errors to administrator

5. **Try Different Browser**:
   - Switch to Chrome (recommended)
   - Or try Firefox/Edge
   - Some browsers may have compatibility issues

---

#### Data Entry Issues

**Problem**: Cannot save data or form validation errors

**Symptoms**:
- "Save" button doesn't work
- Validation error messages appear
- Data not saved after clicking save

**Solutions**:
1. **Check Required Fields**:
   - All required fields (marked with *) must be filled
   - Review form for empty required fields
   - Fill missing fields

2. **Verify Data Format**:
   - Dates: Use date picker, don't type manually
   - Numbers: Enter digits only, no symbols
   - Text: Check for special characters
   - Dropdowns: Select from list, don't type

3. **Check Prerequisites**:
   - Related records must exist (e.g., model must exist before creating work order)
   - Verify all dependencies are met
   - Refer to "Prerequisites" section in manual

4. **Review Error Messages**:
   - Read error messages carefully
   - Error messages indicate what's wrong
   - Fix issues mentioned in errors

5. **Check Browser Console**:
   - Press F12 > Console tab
   - Look for JavaScript errors
   - Report errors to administrator

---

#### Production Planning Issues

**Problem**: Cannot plan work or worker not available

**Symptoms**:
- "Plan" button doesn't work
- Worker not showing in available list
- Time slot validation errors

**Solutions**:
1. **Check Work Status**:
   - Work must be in "To be Planned" status
   - If already planned, check Draft Plan tab
   - Work order must be entered into stage

2. **Verify Worker Availability**:
   - Check employee is active (HR > Employee)
   - Verify employee has required skill
   - Check employee is assigned to correct stage/shift
   - Employee may be already assigned to overlapping work

3. **Check Time Slot**:
   - Time must be within shift hours
   - Check shift configuration (HR > Shift Master)
   - Avoid break times
   - Time slots are in 15-minute intervals

4. **Review Warnings**:
   - System shows warnings for conflicts
   - Review warning messages
   - Resolve conflicts or proceed with caution

---

#### Plan Submission Issues

**Problem**: Cannot submit plan or validation errors

**Symptoms**:
- "Submit Plan" button disabled
- Validation errors on submission
- Plan submission fails

**Solutions**:
1. **Check Plan Status**:
   - Plan must be in "Draft Plan" status
   - If already submitted, check Plan tab
   - Rejected plans can be resubmitted

2. **Review Validation Errors**:
   - Read validation error messages
   - Common issues:
     - Workers not assigned to shifts
     - Time conflicts
     - Missing required data
   - Fix errors before submitting

3. **Verify All Works Planned**:
   - Ensure all required works are planned
   - Check Draft Plan tab for completeness
   - Add missing plans if needed

4. **Check Date Selection**:
   - Verify correct date is selected
   - Date must be valid (not in past if not allowed)
   - Check date format

---

#### Reporting Issues

**Problem**: Cannot report work or report not saving

**Symptoms**:
- "Report" button not working
- Report data not saving
- Completion status issues

**Solutions**:
1. **Check Plan Status**:
   - Work must be in "Planned" or "Approved" status
   - If not planned, plan it first
   - Check Plan tab for work status

2. **Verify Required Fields**:
   - Completion status is required
   - From Time and To Time are required
   - Hours worked should be calculated or entered
   - Fill all required fields

3. **Check Time Entries**:
   - From Time must be before To Time
   - Times should be within shift hours
   - Verify time format (HH:MM)

4. **Review Worker Assignment**:
   - Verify workers are selected
   - Workers must match planned workers (or be changed intentionally)
   - Check worker availability

---

#### Import/Export Issues

**Problem**: Import fails or export not working

**Symptoms**:
- Import shows errors
- Export file not downloading
- Data not importing correctly

**Solutions**:
1. **Import Issues**:
   - **Download Fresh Template**: Always use latest template from system
   - **Check File Format**: Must be .xlsx (Excel format)
   - **Verify Column Headers**: Don't modify headers
   - **Check Data Format**: Dates, numbers, text must match template
   - **Review Error Messages**: Fix errors shown in import results
   - **Validate Data**: Ensure all referenced data exists (skills, stages, etc.)

2. **Export Issues**:
   - **Check Data Loaded**: Ensure data is loaded before exporting
   - **Disable Popup Blocker**: Browser may block download
   - **Check Browser Settings**: Allow downloads from site
   - **Try Different Browser**: Some browsers handle exports differently
   - **Check File Size**: Large exports may take time

---

#### Date and Time Issues

**Problem**: Dates not calculating correctly or time validation errors

**Symptoms**:
- Entry plan dates seem wrong
- Time slots not available
- Date picker not working

**Solutions**:
1. **Date Calculation Issues**:
   - Check lead times are configured (Planning > Lead Times)
   - Verify holiday list is set (Planning > Holiday List)
   - Check stage order is defined (Planning > Order of Stages)
   - Review calculated dates for logic

2. **Time Slot Issues**:
   - Time slots are in 15-minute intervals
   - Must be within shift hours
   - Check shift configuration (HR > Shift Master)
   - Avoid break times

3. **Date Picker Issues**:
   - Use date picker, don't type manually
   - Check date format matches system format
   - Verify date is not in restricted range
   - Clear browser cache if picker not showing

---

### Error Message Reference

**Common Error Messages and Solutions**:

| Error Message | Meaning | Solution |
|---------------|---------|----------|
| "Employee ID already exists" | Duplicate employee ID | Use different unique ID |
| "Work Order Number already exists" | Duplicate work order | Use different work order number |
| "Model not found" | Model doesn't exist | Create model in Sales > Models first |
| "Skill not found" | Skill doesn't exist | Create skill in HR > Skill Master first |
| "No lead times configured" | Lead times missing | Configure in Planning > Lead Times |
| "Worker not available" | Worker conflict or inactive | Check worker status and assignments |
| "Time slot invalid" | Time outside shift or break | Select valid time within shift hours |
| "Plan already submitted" | Cannot edit submitted plan | Edit in Draft Plan tab before submission |
| "Work order not entered" | Work order not in stage | Enter work order in Production module first |

---

### Getting Help

**When to Contact Administrator**:
- Access/permission issues
- System errors or bugs
- Data corruption issues
- Configuration changes needed
- Account management

**When to Refer to Manual**:
- How to use features
- Workflow questions
- Field definitions
- Prerequisites
- Best practices

**Self-Help Steps**:
1. Check this troubleshooting section
2. Review relevant module section in manual
3. Check error messages for guidance
4. Verify prerequisites are met
5. Try common solutions listed above
6. Contact administrator if issue persists

---

## Appendix

### Repository scripts (database administrators)

The project includes **SQL maintenance scripts** in the source tree (for **DBAs** and **Supabase/Postgres** operators). They are **not** part of the end-user web app; run them in your database environment when you own that process.

| Script (under `scripts/`) | Purpose |
|---------------------------|--------|
| `db_performance_diagnose.sql` | **Step A** — row counts, selectivity checks, and `EXPLAIN` for the same query shapes the app uses (e.g. active work orders). Run on **staging** first. |
| `db_performance_indexes_migration.sql` | **Step B** — optional **partial indexes** and `ANALYZE` to improve hot paths. In **PostgreSQL**, `CREATE INDEX CONCURRENTLY` must run **outside** a transaction: in the Supabase SQL editor, execute **one statement at a time**. Prefer a **low-traffic** window the first time. |
| `db_performance_indexes_rollback.sql` | Drops the indexes created in Step B (`DROP INDEX CONCURRENTLY`), if you need to roll back. |
| `export_ddl_production_context.sql` | Helpers to capture **DDL** (functions, tables, constraints, RLS) for production-related objects — useful for audits, migrations, or comparing environments. Follow the comments inside the file (some steps use `pg_dump` from a terminal). |

**Suggested order**: run diagnostics → review plans → apply indexes → `ANALYZE` → re-run `EXPLAIN` from diagnostics and compare buffer/scan behavior.

### Glossary

- **Work Order (WO)**: A production order for manufacturing a product
- **Standard Work**: Predefined work that can be assigned to work orders
- **Derivative Work**: Variation of a standard work
- **Stage**: A production stage in the manufacturing process
- **Shift**: Work shift (e.g., General, Morning, Evening)
- **Lead Time**: Duration a work order stays in a stage
- **Piece Rate**: Payment based on work completed, calculated from standard time
- **WIP**: Work In Progress
- **PWO**: Parent Work Order

### Keyboard Shortcuts

- **Tab**: Navigate between form fields
- **Enter**: Submit forms
- **Escape**: Close modals
- **Ctrl/Cmd + F**: Search in page

### Browser Compatibility

- Chrome (recommended)
- Firefox
- Edge
- Safari

---

**Document Version**: 1.1  
**Last Updated**: 20 April 2026  
**System Version**: Production Management System v1.0













