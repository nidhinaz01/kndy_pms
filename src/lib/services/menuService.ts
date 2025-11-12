import { supabase } from '$lib/supabaseClient';

export interface MenuItem {
  menu_id: string;
  menu_name: string;
  menu_path: string;
  parent_menu_id: string | null;
  menu_order: number;
  is_visible: boolean;
  is_enabled: boolean;
  submenus?: MenuItem[];
}

export async function fetchUserMenus(username: string): Promise<MenuItem[]> {
  try {
    // Get user info including role
    const { data: user, error: userError } = await supabase
      .from('app_users')
      .select('app_user_uuid, role')
      .eq('username', username)
      .eq('is_active', true)
      .maybeSingle();

    if (userError || !user) {
      console.error('Error fetching user info:', userError);
      return [];
    }

    // If user is admin, get all menus
    if (user.role && user.role.toLowerCase() === 'admin') {
      const { data: allMenus, error: allMenusError } = await supabase
        .from('menu')
        .select('*')
        .eq('is_visible', true)
        .eq('is_enabled', true)
        .order('menu_order');

      if (allMenusError) {
        console.error('Error fetching all menus:', allMenusError);
        return [];
      }

      return buildMenuTree(allMenus || []);
    }

    // For other users, get their specific menus
    if (!user.app_user_uuid) {
      console.error('User UUID not found for username:', username);
      return [];
    }

    // First get the menu UUIDs for this user
    const { data: userMenuUuids, error: userMenuError } = await supabase
      .from('app_users_menu')
      .select('menu_uuid')
      .eq('app_user_uuid', user.app_user_uuid);

    if (userMenuError) {
      console.error('Error fetching user menu UUIDs:', userMenuError);
      return [];
    }

    if (!userMenuUuids || userMenuUuids.length === 0) {
      return [];
    }

    // Then get the actual menu items
    // Note: menu_uuid in app_users_menu corresponds to menu_id in menu table
    const menuIds = userMenuUuids.map(item => item.menu_uuid);
    const { data: menuItems, error: menuError } = await supabase
      .from('menu')
      .select('*')
      .in('menu_id', menuIds)
      .eq('is_visible', true)
      .eq('is_enabled', true)
      .order('menu_order');

    if (menuError) {
      console.error('Error fetching menu items:', menuError);
      return [];
    }

    return buildMenuTree(menuItems || []);
  } catch (error) {
    console.error('Error in fetchUserMenus:', error);
    return [];
  }
}

// getUserUuid function is no longer needed as we fetch user info in fetchUserMenus

function buildMenuTree(menuItems: MenuItem[]): MenuItem[] {
  const menuMap = new Map<string, MenuItem>();
  const rootMenus: MenuItem[] = [];

  // Create a map of all menu items
  menuItems.forEach(item => {
    menuMap.set(item.menu_id, { ...item, submenus: [] });
  });

  // Build the tree structure
  menuItems.forEach(item => {
    const menuItem = menuMap.get(item.menu_id)!;
    
    if (item.parent_menu_id && menuMap.has(item.parent_menu_id)) {
      // This is a submenu
      const parent = menuMap.get(item.parent_menu_id)!;
      if (!parent.submenus) parent.submenus = [];
      parent.submenus.push(menuItem);
    } else {
      // This is a root menu
      rootMenus.push(menuItem);
    }
  });

  return rootMenus;
}

// Get menu items for the current user
export async function getMenuItems(): Promise<MenuItem[]> {
  try {
    // Get current user from localStorage
    const savedUser = localStorage.getItem('user');
    if (!savedUser) {
      console.error('No user found in localStorage');
      return [];
    }

    const userData = JSON.parse(savedUser);
    const username = userData.username;

    if (!username) {
      console.error('No username found in user data');
      return [];
    }

    // Use the existing fetchUserMenus function
    return await fetchUserMenus(username);
  } catch (error) {
    console.error('Error getting menu items:', error);
    return [];
  }
} 