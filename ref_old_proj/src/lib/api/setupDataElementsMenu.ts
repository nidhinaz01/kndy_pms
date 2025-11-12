import { supabase } from '$lib/supabaseClient';
import { sanitizeString, sanitizeObject } from '$lib/utils/inputSanitization';

/**
 * Setup menu entries for Data Elements functionality
 * This function adds the necessary menu entries to the database
 */
export async function setupDataElementsMenu(): Promise<{ success: boolean; message: string }> {
  try {
    // Step 1: Add System Admin parent menu if it doesn't exist
    const { error: parentError } = await supabase
      .from('menu')
      .upsert(sanitizeObject({
        menu_id: 'system-admin',
        menu_name: 'System Admin',
        menu_path: '/system-admin',
        parent_menu_id: null,
        menu_order: 100,
        is_visible: true,
        is_enabled: true
      }), {
        onConflict: 'menu_id'
      });

    if (parentError) {
      console.error('Error adding System Admin menu:', parentError);
      return { success: false, message: 'Failed to add System Admin menu' };
    }

    // Step 2: Add Data Elements submenu
    const { error: submenuError } = await supabase
      .from('menu')
      .upsert(sanitizeObject({
        menu_id: 'data-elements',
        menu_name: 'Data Elements',
        menu_path: '/system-admin/data-elements',
        parent_menu_id: 'system-admin',
        menu_order: 1,
        is_visible: true,
        is_enabled: true
      }), {
        onConflict: 'menu_id'
      });

    if (submenuError) {
      console.error('Error adding Data Elements menu:', submenuError);
      return { success: false, message: 'Failed to add Data Elements menu' };
    }

    // Step 3: Get admin user UUID
    const { data: adminUser, error: adminError } = await supabase
      .from('app_users')
      .select('app_user_uuid')
      .eq('username', 'admin')
      .maybeSingle();

    if (adminError || !adminUser) {
      console.error('Error finding admin user:', adminError);
      return { success: false, message: 'Admin user not found' };
    }

    // Step 4: Grant admin access to System Admin menu
    const { error: access1Error } = await supabase
      .from('user_menu_access')
      .upsert(sanitizeObject({
        app_user_uuid: adminUser.app_user_uuid,
        menu_id: 'system-admin'
      }), {
        onConflict: 'app_user_uuid,menu_id'
      });

    if (access1Error) {
      console.error('Error granting System Admin access:', access1Error);
      return { success: false, message: 'Failed to grant System Admin access' };
    }

    // Step 5: Grant admin access to Data Elements menu
    const { error: access2Error } = await supabase
      .from('user_menu_access')
      .upsert(sanitizeObject({
        app_user_uuid: adminUser.app_user_uuid,
        menu_id: 'data-elements'
      }), {
        onConflict: 'app_user_uuid,menu_id'
      });

    if (access2Error) {
      console.error('Error granting Data Elements access:', access2Error);
      return { success: false, message: 'Failed to grant Data Elements access' };
    }

    return { 
      success: true, 
      message: 'Data Elements menu setup completed successfully' 
    };

  } catch (error) {
    console.error('Error in setupDataElementsMenu:', error);
    return { 
      success: false, 
      message: 'Unexpected error during menu setup' 
    };
  }
}

/**
 * Check if Data Elements menu exists
 */
export async function checkDataElementsMenu(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('menu')
      .select('menu_id')
      .eq('menu_id', 'data-elements')
      .maybeSingle();

    if (error) {
      console.error('Error checking Data Elements menu:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error in checkDataElementsMenu:', error);
    return false;
  }
} 