-- ============================================================================
-- Menu: Reports → Daily Production Status
-- ============================================================================
-- 1) Find (or create) a parent "Reports" menu row and note its menu_id (UUID).
--    Example:
--      SELECT menu_id, menu_name, menu_path FROM menu WHERE menu_name ILIKE '%report%';
--
-- 2) Replace :parent_menu_id below with that UUID (or NULL for a top-level item).
--
-- 3) Adjust menu_order so it sorts correctly among siblings.
--
-- menu_id type: if your table uses UUID (common with Supabase):
-- ============================================================================

INSERT INTO menu (menu_id, menu_name, menu_path, parent_menu_id, menu_order, is_visible, is_enabled)
VALUES (
  gen_random_uuid(),
  'Daily Production Status',
  '/reports/production/daily-production-status',
  NULL,  -- TODO: set to Reports parent menu_id
  10,
  true,
  true
);

-- If gen_random_uuid() is not allowed on menu_id, omit menu_id and use your serial/identity instead.
