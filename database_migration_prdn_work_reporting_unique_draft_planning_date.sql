-- One active draft or pending_approval row per planning line per reporting date.
-- Apply only after removing existing duplicates (see Draft Reporting banner + soft-delete or merge).
-- If CREATE INDEX fails, clean duplicates first, e.g. keep min(id) per (planning_id, from_date) and set is_deleted = true on others.

CREATE UNIQUE INDEX IF NOT EXISTS ux_prdn_work_reporting_planning_from_date_draft_pending
ON public.prdn_work_reporting (planning_id, from_date)
WHERE is_deleted = false
  AND status IN ('draft', 'pending_approval');

COMMENT ON INDEX ux_prdn_work_reporting_planning_from_date_draft_pending IS
  'Prevents duplicate draft/pending work reports for the same planned line on the same day (saves without reporting_id in UI).';
