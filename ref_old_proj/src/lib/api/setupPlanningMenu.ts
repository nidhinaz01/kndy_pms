import { supabase } from '$lib/supabaseClient';
import { sanitizeString, sanitizeObject } from '$lib/utils/inputSanitization';

/**
 * Setup menu entries for Planning functionality
 * This function adds the necessary menu entries to the database
 */
export async function setupPlanningMenu(): Promise<{ success: boolean; message: string }> {
  try {
    // Step 1: Add Planning parent menu if it doesn't exist
    const { error: parentError } = await supabase
      .from('menu')
      .upsert(sanitizeObject({
        menu_id: 'planning',
        menu_name: 'Planning',
        menu_path: '/planning',
        parent_menu_id: null,
        menu_order: 50,
        is_visible: true,
        is_enabled: true
      }), {
        onConflict: 'menu_id'
      });

    if (parentError) {
      console.error('Error adding Planning menu:', parentError);
      return { success: false, message: 'Failed to add Planning menu' };
    }

    // Step 2: Add Holiday List submenu
    const { error: holidayError } = await supabase
      .from('menu')
      .upsert(sanitizeObject({
        menu_id: 'holiday-list',
        menu_name: 'Holiday List',
        menu_path: '/planning/holiday-list',
        parent_menu_id: 'planning',
        menu_order: 1,
        is_visible: true,
        is_enabled: true
      }), {
        onConflict: 'menu_id'
      });

    if (holidayError) {
      console.error('Error adding Holiday List menu:', holidayError);
      return { success: false, message: 'Failed to add Holiday List menu' };
    }

    // Step 3: Add Entry Per Day submenu
    const { error: entryError } = await supabase
      .from('menu')
      .upsert(sanitizeObject({
        menu_id: 'entry-per-day',
        menu_name: 'Entry Per Day',
        menu_path: '/planning/entry-per-day',
        parent_menu_id: 'planning',
        menu_order: 2,
        is_visible: true,
        is_enabled: true
      }), {
        onConflict: 'menu_id'
      });

    if (entryError) {
      console.error('Error adding Entry Per Day menu:', entryError);
      return { success: false, message: 'Failed to add Entry Per Day menu' };
    }

    // Step 4: Get admin user UUID
    const { data: adminUser, error: adminError } = await supabase
      .from('app_users')
      .select('app_user_uuid')
      .eq('username', 'admin')
      .maybeSingle();

    if (adminError || !adminUser) {
      console.error('Error finding admin user:', adminError);
      return { success: false, message: 'Admin user not found' };
    }

    // Step 5: Grant admin access to Planning menu
    const { error: access1Error } = await supabase
      .from('user_menu_access')
      .upsert(sanitizeObject({
        app_user_uuid: adminUser.app_user_uuid,
        menu_id: 'planning'
      }), {
        onConflict: 'app_user_uuid,menu_id'
      });

    if (access1Error) {
      console.error('Error granting Planning access:', access1Error);
      return { success: false, message: 'Failed to grant Planning access' };
    }

    // Step 6: Grant admin access to Holiday List menu
    const { error: access2Error } = await supabase
      .from('user_menu_access')
      .upsert(sanitizeObject({
        app_user_uuid: adminUser.app_user_uuid,
        menu_id: 'holiday-list'
      }), {
        onConflict: 'app_user_uuid,menu_id'
      });

    if (access2Error) {
      console.error('Error granting Holiday List access:', access2Error);
      return { success: false, message: 'Failed to grant Holiday List access' };
    }

    // Step 7: Grant admin access to Entry Per Day menu
    const { error: access3Error } = await supabase
      .from('user_menu_access')
      .upsert(sanitizeObject({
        app_user_uuid: adminUser.app_user_uuid,
        menu_id: 'entry-per-day'
      }), {
        onConflict: 'app_user_uuid,menu_id'
      });

    if (access3Error) {
      console.error('Error granting Entry Per Day access:', access3Error);
      return { success: false, message: 'Failed to grant Entry Per Day access' };
    }

    return { 
      success: true, 
      message: 'Planning menu setup completed successfully' 
    };

  } catch (error) {
    console.error('Error in setupPlanningMenu:', error);
    return { 
      success: false, 
      message: 'Unexpected error during menu setup' 
    };
  }
}

/**
 * Check if Planning menu exists
 */
export async function checkPlanningMenu(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('menu')
      .select('menu_id')
      .eq('menu_id', 'planning')
      .maybeSingle();

    if (error) {
      console.error('Error checking Planning menu:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error in checkPlanningMenu:', error);
    return false;
  }
} 