import { supabase } from '$lib/supabaseClient';
import type {
  Menu,
  MenuRedirect,
  CreateMenuData,
  UpdateMenuData,
  UpsertMenuRedirectData
} from './userManagementTypes';

export async function fetchMenus(): Promise<Menu[]> {
  try {
    const { data, error } = await supabase
      .from('menu')
      .select('*')
      .order('menu_order', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching menus:', error);
    throw error;
  }
}

export async function fetchMenuRedirects(): Promise<MenuRedirect[]> {
  try {
    const { data, error } = await supabase
      .from('menu_redirect')
      .select('menu_id, menu_path, redirect_path, is_active, created_by, modified_by')
      .eq('is_active', true);

    if (error) throw error;
    return (data || []) as MenuRedirect[];
  } catch (error) {
    console.error('Error fetching menu redirects:', error);
    throw error;
  }
}

export async function fetchMenusWithRedirectPath(): Promise<Menu[]> {
  const [menus, redirects] = await Promise.all([fetchMenus(), fetchMenuRedirects()]);
  const redirectMap = new Map<string, string>();
  redirects.forEach((row) => {
    if (row.menu_id && row.redirect_path) {
      redirectMap.set(row.menu_id, row.redirect_path);
    }
  });
  return menus.map((m) => ({
    ...m,
    redirect_path: redirectMap.get(m.menu_id) || null
  }));
}

export async function fetchMenuById(menuId: string): Promise<Menu | null> {
  try {
    const { data, error } = await supabase
      .from('menu')
      .select('*')
      .eq('menu_id', menuId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching menu:', error);
    throw error;
  }
}

export async function createMenu(menuData: CreateMenuData): Promise<Menu> {
  try {
    const { data, error } = await supabase
      .from('menu')
      .insert({
        menu_name: menuData.menu_name,
        menu_path: menuData.menu_path,
        parent_menu_id: menuData.parent_menu_id,
        menu_order: menuData.menu_order ?? 0,
        is_visible: menuData.is_visible ?? true,
        is_enabled: menuData.is_enabled ?? true
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating menu:', error);
    throw error;
  }
}

export async function updateMenu(menuId: string, menuData: UpdateMenuData): Promise<Menu> {
  try {
    const { data, error } = await supabase
      .from('menu')
      .update(menuData)
      .eq('menu_id', menuId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating menu:', error);
    throw error;
  }
}

export async function deleteMenu(menuId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('menu')
      .delete()
      .eq('menu_id', menuId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting menu:', error);
    throw error;
  }
}

export async function upsertMenuRedirect(data: UpsertMenuRedirectData): Promise<MenuRedirect> {
  try {
    const actor = (data.modified_by || data.created_by || null) as string | null;
    const { data: existing, error: existingError } = await supabase
      .from('menu_redirect')
      .select('menu_id')
      .eq('menu_id', data.menu_id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing?.menu_id) {
      const { data: updated, error } = await supabase
        .from('menu_redirect')
        .update({
          menu_path: data.menu_path,
          redirect_path: data.redirect_path,
          is_active: data.is_active ?? true,
          modified_by: actor
        })
        .eq('menu_id', data.menu_id)
        .select('menu_id, menu_path, redirect_path, is_active, created_by, modified_by')
        .single();

      if (error) throw error;
      return updated as MenuRedirect;
    }

    const { data: created, error: insertError } = await supabase
      .from('menu_redirect')
      .insert({
        menu_id: data.menu_id,
        menu_path: data.menu_path,
        redirect_path: data.redirect_path,
        is_active: data.is_active ?? true,
        created_by: (data.created_by || actor),
        modified_by: actor
      })
      .select('menu_id, menu_path, redirect_path, is_active, created_by, modified_by')
      .single();

    if (insertError) throw insertError;
    return created as MenuRedirect;
  } catch (error) {
    console.error('Error upserting menu redirect:', error);
    throw error;
  }
}

export async function deleteMenuRedirect(menuId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('menu_redirect')
      .delete()
      .eq('menu_id', menuId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting menu redirect:', error);
    throw error;
  }
}

