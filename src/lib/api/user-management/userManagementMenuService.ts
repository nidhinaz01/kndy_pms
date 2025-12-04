import { supabase } from '$lib/supabaseClient';
import type { Menu, CreateMenuData, UpdateMenuData } from './userManagementTypes';

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

