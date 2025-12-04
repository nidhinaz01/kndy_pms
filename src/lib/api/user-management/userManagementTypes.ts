// User Management API Types and Interfaces

export interface SupabaseAuthUser {
  id: string;
  email: string;
  created_at: string;
  email_confirmed_at: string | null;
  is_linked: boolean;
}

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
  email?: string;
  password?: string;
  role: string;
  desig: string;
  emp_id: string;
  is_active?: boolean;
  auth_user_id: string;
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

