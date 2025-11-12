import { supabase } from '$lib/supabaseClient';

// Interface for Supabase Auth user with linked status
export interface SupabaseAuthUser {
  id: string;
  email: string;
  created_at: string;
  email_confirmed_at: string | null;
  is_linked: boolean; // Whether this auth user is already linked to an app_users record
}

// Types
export interface AppUser {
  app_user_uuid: string;
  username: string;
  email: string;
  password_hash: string;
  role: string;
  desig: string;
  is_active: boolean;
  emp_id: string;
  created_dt: string;
  created_by: string;
  modified_dt: string;
  modified_by: string;
  current_session_id?: string;
  last_login_time?: string;
  last_logout_time?: string;
  last_force_logout_by?: string;
  last_force_logout_time?: string;
  is_deleted: boolean;
  // New fields for Supabase Auth integration
  auth_user_id?: string | null;
  must_change_password?: boolean;
  last_password_change?: string | null;
  password_setup_completed?: boolean;
  failed_login_attempts?: number;
  account_locked_until?: string | null;
  last_login_ip?: string | null;
  email_verified?: boolean;
}

export interface Menu {
  menu_id: string;
  menu_name: string;
  menu_path: string;
  parent_menu_id?: string;
  menu_order: number;
  is_visible: boolean;
  is_enabled: boolean;
}

export interface UserMenuMapping {
  app_user_uuid: string;
  menu_uuid: string;
  created_by: string;
  created_dt: string;
  parentMenusAssigned?: number;
  app_users?: {
    username: string;
    email: string;
  };
  menu?: {
    menu_name: string;
    menu_path: string;
  };
}

export interface CreateUserData {
  username: string;
  email?: string; // Optional - will come from linked Supabase Auth user
  password?: string; // Not used - password is set in Supabase Auth
  role: string;
  desig: string;
  emp_id: string;
  is_active?: boolean;
  auth_user_id: string; // Required - must link to existing Supabase Auth user
}

export interface UpdateUserData {
  username?: string;
  password?: string;
  role?: string;
  desig?: string;
  emp_id?: string;
  is_active?: boolean;
}

export interface CreateMenuData {
  menu_name: string;
  menu_path: string;
  parent_menu_id?: string | null;
  menu_order?: number;
  is_visible?: boolean;
  is_enabled?: boolean;
}

export interface UpdateMenuData {
  menu_name?: string;
  menu_path?: string;
  parent_menu_id?: string | null;
  menu_order?: number;
  is_visible?: boolean;
  is_enabled?: boolean;
}

export interface CreateUserMenuMappingData {
  app_user_uuid: string;
  menu_uuid: string;
}

// User Management Functions
export async function fetchUsers(): Promise<AppUser[]> {
  try {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('is_deleted', false)
      .order('created_dt', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}

export async function fetchUserById(userId: string): Promise<AppUser | null> {
  try {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('app_user_uuid', userId)
      .eq('is_deleted', false)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
}

/**
 * Fetches all Supabase Auth users with their linked status
 * This requires a database function to query auth.users table
 */
export async function fetchSupabaseAuthUsers(): Promise<SupabaseAuthUser[]> {
  try {
    console.log('Fetching Supabase Auth users...');
    
    // Call a database function that returns auth users with linked status
    const { data, error } = await supabase.rpc('get_auth_users_with_linked_status');

    if (error) {
      console.error('Error fetching Supabase Auth users:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw error;
    }

    console.log('Supabase Auth users fetched:', data);
    return data || [];
  } catch (error) {
    console.error('Error in fetchSupabaseAuthUsers:', error);
    throw error;
  }
}

export async function createUser(userData: CreateUserData, createdBy: string): Promise<AppUser> {
  try {
    const now = new Date().toISOString();
    
    // Check if username already exists
    // Use maybeSingle to handle cases where query might fail due to RLS
    const { data: existingUser, error: usernameCheckError } = await supabase
      .from('app_users')
      .select('username')
      .eq('username', userData.username)
      .eq('is_deleted', false)
      .maybeSingle();

    // If we can check and username exists, throw error
    // If we get a 406 error, it might be RLS - we'll let the insert fail with duplicate key error
    if (existingUser && !usernameCheckError) {
      throw new Error('Username already exists');
    }

    // Check if auth_user_id is already linked to another user
    const { data: existingLink, error: linkCheckError } = await supabase
      .from('app_users')
      .select('username')
      .eq('auth_user_id', userData.auth_user_id)
      .eq('is_deleted', false)
      .maybeSingle();

    // If we can check and link exists, throw error
    // If we get a 406 error, it might be RLS - we'll let the insert fail with duplicate key error
    if (existingLink && !linkCheckError) {
      throw new Error('This Supabase Auth user is already linked to another application user');
    }

    // Use email from userData (already set from dropdown selection)
    // The email is auto-filled when user selects from Supabase Auth dropdown
    if (!userData.email) {
      throw new Error('Email is required. Please select a Supabase Auth user from the dropdown.');
    }

    const email = userData.email;

    // Check if email already exists in app_users
    // Note: 406 errors may occur due to RLS, but we'll catch duplicate errors on insert
    const { data: existingEmail, error: emailCheckError } = await supabase
      .from('app_users')
      .select('email, username')
      .eq('email', email)
      .eq('is_deleted', false)
      .maybeSingle();

    // If we can check and email exists, throw error
    if (existingEmail && !emailCheckError) {
      throw new Error(`Email already exists in application users (username: ${existingEmail.username})`);
    }

    // If we get a 406 error, it might be RLS - we'll let the insert fail with duplicate key error
    // and handle it there

    // Insert into app_users table with auth_user_id (linking to existing Supabase Auth user)
    const { data, error } = await supabase
      .from('app_users')
      .insert({
        username: userData.username,
        email: email,
        password_hash: 'managed_by_supabase_auth', // Password is managed by Supabase Auth
        role: userData.role,
        desig: userData.desig,
        emp_id: userData.emp_id,
        is_active: userData.is_active ?? true,
        auth_user_id: userData.auth_user_id,
        must_change_password: true, // User must change password on first login
        password_setup_completed: false,
        email_verified: false, // Will be updated when user verifies email in Supabase
        created_dt: now,
        created_by: createdBy,
        modified_dt: now,
        modified_by: createdBy
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting into app_users:', error);
      
      // Handle duplicate key errors with better messages
      if (error.code === '23505') {
        if (error.message.includes('email')) {
          throw new Error('Email already exists in application users. Please check if this user was already created.');
        } else if (error.message.includes('username')) {
          throw new Error('Username already exists. Please choose a different username.');
        } else if (error.message.includes('auth_user_id')) {
          throw new Error('This Supabase Auth user is already linked to another application user.');
        } else {
          throw new Error('A user with these details already exists. Please check the existing users.');
        }
      }
      
      throw error;
    }

    console.log('✅ User created and linked successfully:', {
      username: userData.username,
      email: email,
      auth_user_id: userData.auth_user_id
    });

    return data;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

export async function updateUser(userId: string, userData: UpdateUserData, modifiedBy: string): Promise<AppUser> {
  try {
    const now = new Date().toISOString();
    
    // Check if username already exists (excluding current user)
    if (userData.username) {
      const { data: existingUser } = await supabase
        .from('app_users')
        .select('username')
        .eq('username', userData.username)
        .neq('app_user_uuid', userId)
        .eq('is_deleted', false)
        .single();

      if (existingUser) {
        throw new Error('Username already exists');
      }
    }

    const updateData: any = {
      modified_dt: now,
      modified_by: modifiedBy
    };

    // Only include fields that are provided
    if (userData.username !== undefined) updateData.username = userData.username;
    if (userData.password !== undefined) updateData.password_hash = userData.password; // In production, hash this
    if (userData.role !== undefined) updateData.role = userData.role;
    if (userData.desig !== undefined) updateData.desig = userData.desig;
    if (userData.emp_id !== undefined) updateData.emp_id = userData.emp_id;
    if (userData.is_active !== undefined) updateData.is_active = userData.is_active;

    const { data, error } = await supabase
      .from('app_users')
      .update(updateData)
      .eq('app_user_uuid', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

export async function deleteUser(userId: string, modifiedBy: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    const { error } = await supabase
      .from('app_users')
      .update({
        is_deleted: true,
        modified_dt: now,
        modified_by: modifiedBy
      })
      .eq('app_user_uuid', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

export async function toggleUserStatus(userId: string, modifiedBy: string): Promise<AppUser> {
  try {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('app_users')
      .update({
        is_active: supabase.raw('NOT is_active'),
        modified_dt: now,
        modified_by: modifiedBy
      })
      .eq('app_user_uuid', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error toggling user status:', error);
    throw error;
  }
}

// Menu Management Functions
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

// User Menu Mapping Functions
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

// Helper function to get all parent menus for a given menu
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

// Helper function to check if user already has access to a menu
async function userHasMenuAccess(userId: string, menuId: string): Promise<boolean> {
  try {
    // Use maybeSingle to handle cases where query might fail due to RLS
    const { data, error } = await supabase
      .from('app_users_menu')
      .select('*')
      .eq('app_user_uuid', userId)
      .eq('menu_uuid', menuId)
      .maybeSingle();

    // If we get an error (like 406), assume no access
    // If we can check and data exists, return true
    return !error && !!data;
  } catch (error) {
    return false;
  }
}

export async function createUserMenuMapping(mappingData: CreateUserMenuMappingData, createdBy: string): Promise<UserMenuMapping> {
  try {
    const now = new Date().toISOString();
    
    // Check if mapping already exists
    // Use maybeSingle to handle cases where query might fail due to RLS
    const { data: existingMapping, error: checkError } = await supabase
      .from('app_users_menu')
      .select('*')
      .eq('app_user_uuid', mappingData.app_user_uuid)
      .eq('menu_uuid', mappingData.menu_uuid)
      .maybeSingle();

    // If we can check and mapping exists, throw error
    // If we get a 406 error, it might be RLS - we'll let the insert fail with duplicate key error
    if (existingMapping && !checkError) {
      throw new Error('Menu access already assigned to this user');
    }

    // Get all parent menus for the selected menu
    const parentMenus = await getParentMenus(mappingData.menu_uuid);
    
    // Check which parent menus the user doesn't have access to
    const missingParentMenus: string[] = [];
    for (const parentMenuId of parentMenus) {
      const hasAccess = await userHasMenuAccess(mappingData.app_user_uuid, parentMenuId);
      if (!hasAccess) {
        missingParentMenus.push(parentMenuId);
      }
    }

    // Prepare all menu assignments (parent menus + selected menu)
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

    // Insert all menu assignments
    const { data: insertedData, error } = await supabase
      .from('app_users_menu')
      .insert(allMenuAssignments)
      .select();

    if (error) throw error;
    
    // Find the main menu assignment from the inserted data
    const mainAssignment = insertedData?.find(
      item => item.menu_uuid === mappingData.menu_uuid
    ) || insertedData?.[0];
    
    if (!mainAssignment) {
      throw new Error('Failed to create menu mapping');
    }
    
    // Return the main assignment with additional info about parent assignments
    return {
      ...mainAssignment,
      parentMenusAssigned: missingParentMenus.length
    };
  } catch (error) {
    console.error('Error creating user menu mapping:', error);
    throw error;
  }
}

// Helper function to get all child menus for a given menu
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

    // Get direct children
    const directChildren = menus.map(menu => menu.menu_id);
    childMenus.push(...directChildren);

    // Recursively get children of children
    for (const childId of directChildren) {
      const grandChildren = await getChildMenus(childId);
      childMenus.push(...grandChildren);
    }
  } catch (error) {
    console.error('Error getting child menus:', error);
  }
  
  return childMenus;
}

export async function deleteUserMenuMapping(userId: string, menuId: string): Promise<{ deletedCount: number; childMenusRemoved: number }> {
  try {
    // Get all child menus that will be affected
    const childMenus = await getChildMenus(menuId);
    
    // Check which child menus the user has access to
    const userChildMenus: string[] = [];
    for (const childMenuId of childMenus) {
      const hasAccess = await userHasMenuAccess(userId, childMenuId);
      if (hasAccess) {
        userChildMenus.push(childMenuId);
      }
    }

    // Delete the main menu access
    const { error } = await supabase
      .from('app_users_menu')
      .delete()
      .eq('app_user_uuid', userId)
      .eq('menu_uuid', menuId);

    if (error) throw error;

    // Delete child menu accesses if any
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

// Utility Functions
export async function checkUsernameExists(username: string, excludeUserId?: string): Promise<boolean> {
  try {
    let query = supabase
      .from('app_users')
      .select('username')
      .eq('username', username)
      .eq('is_deleted', false);

    if (excludeUserId) {
      query = query.neq('app_user_uuid', excludeUserId);
    }

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
      throw error;
    }

    return !!data;
  } catch (error) {
    console.error('Error checking username:', error);
    throw error;
  }
}

export async function checkEmailExists(email: string, excludeUserId?: string): Promise<boolean> {
  try {
    let query = supabase
      .from('app_users')
      .select('email')
      .eq('email', email)
      .eq('is_deleted', false);

    if (excludeUserId) {
      query = query.neq('app_user_uuid', excludeUserId);
    }

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
      throw error;
    }

    return !!data;
  } catch (error) {
    console.error('Error checking email:', error);
    throw error;
  }
}

export async function getAvailableRoles(): Promise<string[]> {
  return [
    'Admin', 'SalesExecutive', 'SalesManager', 'PlanningEngineer', 'PlanningManager',
    'RDEngineer', 'RDManager', 'ProductionEngineer', 'PlantManager', 'ProductionManager',
    'QCEngineer', 'QCManager', 'OperationsManager', 'GeneralManager', 'ManagingDirector',
    'FinanceExecutive', 'FinanceManager', 'HRExecutive', 'HRManager'
  ];
}
