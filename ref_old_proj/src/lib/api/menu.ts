import { supabase } from '$lib/supabaseClient';
import { ensureValidSession } from '$lib/auth/checkSession';

/**
 * Fetch the accessible menu structure for the currently logged-in user.
 * Supports:
 * - Admin override (username = 'admin')
 * - Recursive submenus
 * - Visibility and enabled filters
 * - Caching
 * - Session validation
 */
let cachedMenus: any[] | null = null;

export async function fetchUserMenus(forceRefresh = false): Promise<any[]> {
  // Step 0: Ensure session is still valid
  const ok = await ensureValidSession();
  if (!ok) {
    console.warn('Session expired or invalid. Aborting menu fetch.');
    return [];
  }

  if (cachedMenus && !forceRefresh) return cachedMenus;

  const username = localStorage.getItem('username');
  if (!username) return [];

  // Step 1: Get user UUID
  const { data: user, error: userErr } = await supabase
    .from('app_users')
    .select('app_user_uuid')
    .eq('username', username)
    .maybeSingle();

  if (userErr || !user?.app_user_uuid) {
    console.error('User lookup failed:', userErr?.message || 'User not found');
    return [];
  }

  const userId = user.app_user_uuid;

  // Step 2: Fetch menus (admin sees all, others see allowed)
  let menus: any[] = [];

  if (username === 'admin') {
    const { data, error } = await supabase
      .from('menu')
      .select('*')
      .eq('is_visible', true)
      .eq('is_enabled', true)
      .order('menu_order', { ascending: true });

    if (error) {
      console.error('Fetching all menus (admin) failed:', error.message);
      return [];
    }

    menus = data;
  } else {
    // Fetch allowed menu_ids
    const { data: access, error: accessErr } = await supabase
      .from('user_menu_access')
      .select('menu_id')
      .eq('app_user_uuid', userId);

    if (accessErr) {
      console.error('Access lookup failed:', accessErr.message);
      return [];
    }

    const allowedMenuIds = access.map(row => row.menu_id);
    if (allowedMenuIds.length === 0) return [];

    const { data, error } = await supabase
      .from('menu')
      .select('*')
      .in('menu_id', allowedMenuIds)
      .eq('is_visible', true)
      .eq('is_enabled', true)
      .order('menu_order', { ascending: true });

    if (error) {
      console.error('Fetching menus failed:', error.message);
      return [];
    }

    menus = data;
  }

  // Step 3: Build recursive hierarchy
  const menuMap = new Map<string, any>();
  const idToMenu: Record<string, any> = {};

  for (const m of menus) {
    m.submenus = [];
    idToMenu[m.menu_id] = m;
  }

  for (const m of menus) {
    if (m.parent_menu_id && idToMenu[m.parent_menu_id]) {
      idToMenu[m.parent_menu_id].submenus.push(m);
    } else {
      menuMap.set(m.menu_id, m);
    }
  }

  const result = Array.from(menuMap.values()).sort(
    (a, b) => (a.menu_order ?? 0) - (b.menu_order ?? 0)
  );

  cachedMenus = result;
  return result;
}
