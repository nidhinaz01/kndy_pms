import { supabase } from '$lib/supabaseClient';
import type { UserMenuMapping, CreateUserMenuMappingData } from './userManagementTypes';

async function getParentMenus(menuId: string): Promise<string[]> {
  const parentMenus: string[] = [];
  
  try {
    let currentMenuId = menuId;
    
    while (currentMenuId) {
      const { data: menu, error } = await supabase
        .from('menu')
        .select('parent_menu_id')
        .eq('menu_id', currentMenuId)
        .single();

      if (error || !menu || !menu.parent_menu_id) {
        break;
      }

      parentMenus.push(menu.parent_menu_id);
      currentMenuId = menu.parent_menu_id;
    }
  } catch (error) {
    console.error('Error getting parent menus:', error);
  }
  
  return parentMenus;
}

async function userHasMenuAccess(userId: string, menuId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('app_users_menu')
      .select('*')
      .eq('app_user_uuid', userId)
      .eq('menu_uuid', menuId)
      .maybeSingle();

    return !error && !!data;
  } catch (error) {
    return false;
  }
}

async function getChildMenus(menuId: string): Promise<string[]> {
  const childMenus: string[] = [];
  
  try {
    const { data: menus, error } = await supabase
      .from('menu')
      .select('menu_id')
      .eq('parent_menu_id', menuId);

    if (error || !menus) {
      return childMenus;
    }

    const directChildren = menus.map(menu => menu.menu_id);
    childMenus.push(...directChildren);

    for (const childId of directChildren) {
      const grandChildren = await getChildMenus(childId);
      childMenus.push(...grandChildren);
    }
  } catch (error) {
    console.error('Error getting child menus:', error);
  }
  
  return childMenus;
}

export async function fetchUserMenuMappings(): Promise<UserMenuMapping[]> {
  try {
    const { data, error } = await supabase
      .from('app_users_menu')
      .select(`
        *,
        app_users(username, email),
        menu(menu_name, menu_path)
      `)
      .order('created_dt', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching user menu mappings:', error);
    throw error;
  }
}

export async function fetchUserMenuMappingsByUser(userId: string): Promise<UserMenuMapping[]> {
  try {
    const { data, error } = await supabase
      .from('app_users_menu')
      .select(`
        *,
        menu(menu_name, menu_path)
      `)
      .eq('app_user_uuid', userId)
      .order('created_dt', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching user menu mappings:', error);
    throw error;
  }
}

export async function createUserMenuMapping(mappingData: CreateUserMenuMappingData, createdBy: string): Promise<UserMenuMapping> {
  try {
    const now = new Date().toISOString();
    
    const { data: existingMapping, error: checkError } = await supabase
      .from('app_users_menu')
      .select('*')
      .eq('app_user_uuid', mappingData.app_user_uuid)
      .eq('menu_uuid', mappingData.menu_uuid)
      .maybeSingle();

    if (existingMapping && !checkError) {
      throw new Error('Menu access already assigned to this user');
    }

    const parentMenus = await getParentMenus(mappingData.menu_uuid);
    
    const missingParentMenus: string[] = [];
    for (const parentMenuId of parentMenus) {
      const hasAccess = await userHasMenuAccess(mappingData.app_user_uuid, parentMenuId);
      if (!hasAccess) {
        missingParentMenus.push(parentMenuId);
      }
    }

    const allMenuAssignments = [
      ...missingParentMenus.map(menuId => ({
        app_user_uuid: mappingData.app_user_uuid,
        menu_uuid: menuId,
        created_by: createdBy,
        created_dt: now
      })),
      {
        app_user_uuid: mappingData.app_user_uuid,
        menu_uuid: mappingData.menu_uuid,
        created_by: createdBy,
        created_dt: now
      }
    ];

    const { data: insertedData, error } = await supabase
      .from('app_users_menu')
      .insert(allMenuAssignments)
      .select();

    if (error) throw error;
    
    const mainAssignment = insertedData?.find(
      item => item.menu_uuid === mappingData.menu_uuid
    ) || insertedData?.[0];
    
    if (!mainAssignment) {
      throw new Error('Failed to create menu mapping');
    }
    
    return {
      ...mainAssignment,
      parentMenusAssigned: missingParentMenus.length
    };
  } catch (error) {
    console.error('Error creating user menu mapping:', error);
    throw error;
  }
}

export async function deleteUserMenuMapping(userId: string, menuId: string): Promise<{ deletedCount: number; childMenusRemoved: number }> {
  try {
    const childMenus = await getChildMenus(menuId);
    
    const userChildMenus: string[] = [];
    for (const childMenuId of childMenus) {
      const hasAccess = await userHasMenuAccess(userId, childMenuId);
      if (hasAccess) {
        userChildMenus.push(childMenuId);
      }
    }

    const { error } = await supabase
      .from('app_users_menu')
      .delete()
      .eq('app_user_uuid', userId)
      .eq('menu_uuid', menuId);

    if (error) throw error;

    let childMenusRemoved = 0;
    if (userChildMenus.length > 0) {
      const { error: childError } = await supabase
        .from('app_users_menu')
        .delete()
        .eq('app_user_uuid', userId)
        .in('menu_uuid', userChildMenus);

      if (childError) {
        console.error('Error deleting child menu mappings:', childError);
      } else {
        childMenusRemoved = userChildMenus.length;
      }
    }

    return {
      deletedCount: 1,
      childMenusRemoved
    };
  } catch (error) {
    console.error('Error deleting user menu mapping:', error);
    throw error;
  }
}

