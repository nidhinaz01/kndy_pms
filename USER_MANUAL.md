# Production Management System - User Manual

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Menu Structure](#menu-structure)
4. [Dashboard](#dashboard)
5. [Production Module](#production-module)
6. [Planning Module](#planning-module)
7. [HR Module](#hr-module)
8. [Sales Module](#sales-module)
9. [Standards Module](#standards-module)
10. [R&D Module](#rnd-module)
11. [System Admin Module](#system-admin-module)
12. [Piece Rate Module](#piece-rate-module)
13. [Common Features](#common-features)
14. [Troubleshooting](#troubleshooting)

---

## Introduction

The Production Management System is a comprehensive web-based application designed to manage production workflows, employee data, work orders, planning, and reporting for manufacturing operations. This manual provides detailed instructions for using each module and feature of the system.

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

---

## Menu Structure

The application is organized into the following main modules:

1. **Dashboard** - Overview and welcome page
2. **Production** - Stage/Shift production management
3. **Planning** - Production planning and scheduling
4. **HR** - Human resources and employee management
5. **Sales** - Sales orders and work order management
6. **Standards** - Standard works and workflow definitions
7. **R&D** - Research and development document management
8. **System Admin** - System administration and configuration
9. **Piece Rate** - Piece rate calculations and reporting

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
   - **From Time**: Click the time picker and select the start time
     - Times are in 15-minute intervals (e.g., 09:00, 09:15, 09:30)
   - **To Time**: The system may auto-calculate based on standard time, or you can select manually
   - **Duration**: The system shows the calculated duration
   - Review any warnings shown (e.g., time overlaps, break times)

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
   - The system shows warnings if:
     - Worker has time conflicts
     - Worker doesn't have the required skill
     - Worker is already assigned to overlapping work

7. **Review Warnings**:
   - Check the warnings section at the bottom
   - **Time Overlap Warning**: Worker is already assigned to another work in the same time
   - **Time Excess Warning**: Worker's total planned hours exceed shift hours
   - **Skill Mismatch Warning**: Worker doesn't have the required skill
   - You can proceed with warnings, but it's recommended to resolve them

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

#### Step 7.1: Record Employee Attendance (Manpower Report)

Before reporting work, you need to record which employees actually attended:

1. **Navigate to Manpower Report Tab**:
   - Go to **Production** > Your Stage/Shift
   - Click on the **"Manpower Report"** tab
   - Select the date

2. **Record Entry Times**:
   - Find employees who entered your stage
   - Click **"Entry"** button (or "Mark Entry")
   - Select the work order the employee is working on
   - Enter the actual entry time
   - Click **"Save"**

3. **Record Exit Times**:
   - At the end of shift, find employees
   - Click **"Exit"** button (or "Mark Exit")
   - Select the work order
   - Enter the actual exit time
   - Click **"Save"**

4. **Report Overtime** (if applicable):
   - If employees worked overtime, click **"Report Overtime"**
   - Enter overtime hours
   - Save the record

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
- Employees must have recorded entry/exit times
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
   - For multi-skill works, report for each skill separately or together

6. **Review and Save**:
   - Review all entered information
   - Check for any warnings
   - Click **"Save Report"** or **"Report"** button
   - The report is saved as "Draft Report"

7. **Verify Report Created**:
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
- Employees must be recorded in Manpower Report
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

**Purpose**: Plan employee assignments and attendance for the date.

**Features**:
- View planned employee attendance
- Assign employees to shifts
- Plan employee stage assignments
- Export manpower plan

**How to Use**:
- Navigate to **Manpower Plan** tab
- View employee list
- Mark attendance for employees
- Assign employees to specific stages if needed
- Plan is automatically created when you plan works

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

**Purpose**: Record actual employee attendance.

**Features**:
- Record employee entry times
- Record employee exit times
- Report overtime
- View attendance history

**How to Use**:
- Navigate to **Manpower Report** tab
- Click **"Entry"** to record employee entry
- Click **"Exit"** to record employee exit
- Click **"Report Overtime"** for overtime hours

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
   - Record employee entry times (Manpower Report)

2. **Planning** (if not done previous day):
   - Go to Works tab
   - Plan all works for the day
   - Review draft plan
   - Submit plan for approval

3. **During Shift**:
   - Monitor work progress
   - Update plans if needed (before submission)

4. **End of Shift**:
   - Record employee exit times
   - Report work completion (Draft Report)
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

### Plan Review

**Path**: `/production/plan-review`

**Description**: 
Review and view finalized production plans in PDF format.

**Features**:
- View production plans as PDF documents
- Navigate through different work orders
- Print or download plan documents

**How to Use**:
1. Navigate to Production > Plan Review
2. Select a work order or date range
3. View the plan PDF
4. Use navigation controls to browse different plans

**Prerequisites**:
- Production plans must be submitted
- PDF generation must be successful

**Areas Affected**:
- None (read-only view)

### Report Review

**Path**: `/production/report-review`

**Description**: 
Review and view finalized production reports in PDF format.

**Features**:
- View production reports as PDF documents
- Navigate through different work orders
- Print or download report documents

**How to Use**:
1. Navigate to Production > Report Review
2. Select a work order or date range
3. View the report PDF
4. Use navigation controls to browse different reports

**Prerequisites**:
- Production reports must be submitted
- PDF generation must be successful

**Areas Affected**:
- None (read-only view)

---

## Planning Module

### Overview

The Planning module handles production planning, scheduling, and entry management. This section provides detailed, step-by-step instructions for all planning workflows.

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
Manages holiday calendar used for production date calculations.

**Features**:
- Add holidays to the calendar
- View list of holidays
- Edit or delete holidays
- Holidays are excluded from production date calculations

**How to Use**:

1. **Adding Holidays**:
   - Navigate to Planning > Holiday List
   - Click "Add Holiday" button
   - Enter holiday date and description
   - Save the holiday

2. **Managing Holidays**:
   - View all holidays in the table
   - Edit holiday details
   - Delete holidays if needed

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

The System Admin module provides administrative functions for user management, system configuration, and data element management.

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

2. **Managing Menus**:
   - Go to "Menu" tab
   - Click "Add Menu" to create new menu item
   - Enter menu details:
     - Menu Name
     - Menu Path (URL)
     - Parent Menu (if sub-menu)
     - Menu Order
     - Visibility and Enabled status
   - Save the menu

3. **Assigning User Menus**:
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

---

## Piece Rate Module

### Overview

The Piece Rate module provides piece rate calculations and reporting based on completed work.

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

---

## Common Features

### Data Export

Many modules support exporting data to Excel or PDF:

- **Excel Export**: Click "Export to Excel" button to download data as Excel file
- **PDF Export**: Click "Export to PDF" button to generate PDF document

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

### Navigation Quick Reference

| Task | Path |
|------|------|
| View Dashboard | Dashboard |
| Production Planning | Production > [Stage]-[Shift] |
| Entry Planning | Planning > Entry Plan |
| View Schedule | Planning > Schedule |
| Manage Employees | HR > Employee |
| Manage Shifts | HR > Shift Master |
| Create Work Order | Sales > Work Orders |
| Manage Standards | Standards > Works |
| System Admin | System Admin > User Management |

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

**Document Version**: 1.0  
**Last Updated**: 21 December 2025  
**System Version**: Production Management System v1.0

