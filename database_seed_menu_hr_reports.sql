-- ============================================================================
-- Menu: Reports → HR — C-Off Report & OT Report
-- ============================================================================
-- Set parent_menu_id to your Reports menu UUID (or NULL for top-level).
-- Adjust menu_order among siblings as needed.
-- ============================================================================

INSERT INTO menu (menu_id, menu_name, menu_path, parent_menu_id, menu_order, is_visible, is_enabled)
VALUES (
  gen_random_uuid(),
  'C-Off Report',
  '/reports/hr/c-off-report',
  NULL,
  20,
  true,
  true
);

INSERT INTO menu (menu_id, menu_name, menu_path, parent_menu_id, menu_order, is_visible, is_enabled)
VALUES (
  gen_random_uuid(),
  'OT Report',
  '/reports/hr/ot-report',
  NULL,
  21,
  true,
  true
);
