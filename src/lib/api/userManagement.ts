// User Management API - Re-export all functions and types for backward compatibility
// This file has been refactored into multiple service files under ./user-management/

// Types
export type {
  SupabaseAuthUser,
  AppUser,
  Menu,
  UserMenuMapping,
  CreateUserData,
  UpdateUserData,
  CreateMenuData,
  UpdateMenuData,
  CreateUserMenuMappingData
} from './user-management/userManagementTypes';

// User Services
export {
  fetchUsers,
  fetchUserById,
  fetchSupabaseAuthUsers,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus
} from './user-management/userManagementUserService';

// Menu Services
export {
  fetchMenus,
  fetchMenuById,
  createMenu,
  updateMenu,
  deleteMenu
} from './user-management/userManagementMenuService';

// User Menu Mapping Services
export {
  fetchUserMenuMappings,
  fetchUserMenuMappingsByUser,
  createUserMenuMapping,
  deleteUserMenuMapping
} from './user-management/userManagementMenuMappingService';

// Utility Functions
export {
  checkUsernameExists,
  checkEmailExists,
  getAvailableRoles
} from './user-management/userManagementUtils';
