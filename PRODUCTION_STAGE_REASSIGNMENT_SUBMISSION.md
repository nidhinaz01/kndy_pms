# Stage reassignment: which stage “owns” plan and report submission

This document records the **agreed business rule** for how **employee stage reassignments** (Manpower Plan / Manpower Report) are bundled when users click **Submit plan** or **Submit report** on a production stage–shift page (`/production/[stage]-[shift]`).

It is intended for **operators, team leads, and implementers** so expectations stay aligned with application behavior.

---

## 1. What a reassignment means (reminder)

- An employee’s **home stage** in HR (`hr_emp.stage`) does **not** change when you reassign them for part of a day.
- A **reassignment** means: for a **time window**, the employee works at another **plant stage** (same **shift** as recorded on the reassignment row), while still being managed from their usual production context where appropriate.
- Planned reassignments are stored in **`prdn_planning_stage_reassignment`**. Reported reassignments are stored in **`prdn_reporting_stage_reassignment`**.

---

## 2. Agreed rule: the **receiving** stage submits the loan

When someone creates a reassignment **from stage A → stage B** for a given date:

| Field (concept) | Meaning |
|-----------------|--------|
| **From stage** (`from_stage_code`) | Stage that is **lending** the employee for that interval (e.g. where they are “based” for that day’s story). |
| **To stage** (`to_stage_code`) | Stage that **receives** the employee for that interval. |

**Submit plan** and **Submit report** on a given stage page attach **draft** reassignment rows whose **`to_stage_code` matches that stage** for the selected date.

So:

- **Outbound** reassignments (e.g. **P1S2 → P1S3**) are included when **P1S3** submits (because `to_stage_code = P1S3`), **not** when P1S2 submits.
- **Inbound** reassignments (e.g. **P1S4 → P1S2**) are included when **P1S2** submits (because `to_stage_code = P1S2`).

In short: **the receiving stage is responsible for submitting** those reassignment lines into the approval workflow for planning and reporting.

This matches the mental model: **P1S3** must plan and report what happens **on P1S3** while Tom is there, including finalizing the reassignment segment that brings Tom **into** P1S3.

---

## 3. Example (planning)

1. On **`/production/P1S2-GEN`**, you add: Tom is reassigned **from P1S2 to P1S3**, 10:00–11:00.
2. That row has **`to_stage_code = P1S3`**.
3. When **P1S2** clicks **Submit plan**, this row is **not** expected to be part of **P1S2’s** planning submission batch (filter is on `to_stage =` submitting stage).
4. When **P1S3** opens **`/production/P1S3-GEN`** (or the correct P1S3 shift route) and clicks **Submit plan** for that date, **P1S3’s** submission includes drafts whose **`to_stage_code` is P1S3**, which includes Tom’s segment **into** P1S3.

---

## 4. Example (reporting)

The same **to-stage = submitting stage** idea applies to **Submit report** for `prdn_reporting_stage_reassignment` drafts: the **destination** stage’s submission carries inbound reporting segments for that date.

If actual times differ from the plan (e.g. extra hours), users add the additional **reporting** reassignment rows as needed; those rows still follow the same **`to_stage`** rule for submission scope.

---

## 5. Implementation reference (for developers)

- Planning submission: `submitPlanning` in `src/lib/api/production/planningReportingService.ts` updates `prdn_planning_stage_reassignment` with `.eq('to_stage_code', stageCode)` (among other filters).
- Reporting submission: `submitReporting` in the same file updates `prdn_reporting_stage_reassignment` with `.eq('to_stage_code', stageCode)` (among other filters).

Related analysis (attendance / hours behaviour): `STAGE_REASSIGNMENT_ANALYSIS.md`.

---

## 6. Revision history

| Date | Change |
|------|--------|
| 2026-03-29 | Document created: receiving stage owns submission for reassignment rows (`to_stage_code` = submitting stage). |
