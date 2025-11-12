<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { theme } from '$lib/stores/theme';
  import { fetchUsers, createUser, updateUser, deleteUser, fetchMenus, createMenu, updateMenu, deleteMenu, fetchUserMenuMappings, createUserMenuMapping, deleteUserMenuMapping, fetchSupabaseAuthUsers, type SupabaseAuthUser } from '$lib/api/userManagement';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import Button from '$lib/components/common/Button.svelte';
  import DataTable from '$lib/components/common/DataTable.svelte';
  import { Trash2, Edit, Users, Menu, UserCheck } from 'lucide-svelte';

  // Tab management
  let activeTab = 'users';
  const tabs = [
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'menu', label: 'Menu', icon: '📋' },
    { id: 'users-menu', label: "User's Menu", icon: '🔗' }
  ];

  // Common state
  let showSidebar = false;
  let menus: any[] = [];
  let isLoading = true;
  let message = '';
  let messageType: 'success' | 'error' = 'success';

  // Users tab state
  let users: any[] = [];
  let isUsersLoading = false;
  let showUserModal = false;
  let isEditMode = false;
  let selectedUser: any = null;
  let isSavingUser = false; // Prevent double submission
  let userForm = {
    username: '',
    email: '',
    password: '',
    role: '',
    desig: '',
    emp_id: '',
    is_active: true,
    auth_user_id: '' // For linking to Supabase Auth user
  };
  
  // Supabase Auth users for linking
  let supabaseAuthUsers: SupabaseAuthUser[] = [];
  let isLoadingAuthUsers = false;

  // Menu tab state
  let menuItems: any[] = [];
  let isMenuLoading = false;
  let showMenuModal = false;
  let isMenuEditMode = false;
  let selectedMenu: any = null;
  let menuForm = {
    menu_name: '',
    menu_path: '',
    parent_menu_id: null,
    menu_order: 0,
    is_visible: true,
    is_enabled: true
  };

  // User's Menu tab state
  let userMenuMappings: any[] = [];
  let isUserMenuLoading = false;
  let showUserMenuModal = false;
  let userMenuForm = {
    app_user_uuid: '',
    menu_uuid: ''
  };
  
  // New user-centric view state
  let selectedUserForMenus: any = null;
  let userMenuSections: any[] = [];
  let isUserMenuSectionsLoading = false;
  let hasUnsavedChanges = false;

  // Available roles
  const roles = [
    'Admin', 'SalesExecutive', 'SalesManager', 'PlanningEngineer', 'PlanningManager',
    'RDEngineer', 'RDManager', 'ProductionEngineer', 'PlantManager', 'ProductionManager',
    'QCEngineer', 'QCManager', 'OperationsManager', 'GeneralManager', 'ManagingDirector',
    'FinanceExecutive', 'FinanceManager', 'HRExecutive', 'HRManager'
  ];

  // Load data functions
  async function loadUsers() {
    isUsersLoading = true;
    try {
      users = await fetchUsers();
    } catch (error) {
      console.error('Error loading users:', error);
      showMessage('Error loading users', 'error');
    } finally {
      isUsersLoading = false;
    }
  }

  async function loadMenus() {
    isMenuLoading = true;
    try {
      menuItems = await fetchMenus();
    } catch (error) {
      console.error('Error loading menus:', error);
      showMessage('Error loading menus', 'error');
    } finally {
      isMenuLoading = false;
    }
  }

  async function loadUserMenuMappings() {
    isUserMenuLoading = true;
    try {
      userMenuMappings = await fetchUserMenuMappings();
    } catch (error) {
      console.error('Error loading user menu mappings:', error);
      showMessage('Error loading user menu mappings', 'error');
    } finally {
      isUserMenuLoading = false;
    }
  }

  // Load user menu sections for selected user
  async function loadUserMenuSections() {
    if (!selectedUserForMenus) return;
    
    isUserMenuSectionsLoading = true;
    try {
      // Get all menus and user's menu mappings
      const [menusData, mappingsData] = await Promise.all([
        fetchMenus(),
        fetchUserMenuMappings()
      ]);

      // Get user's menu access
      const userMappings = mappingsData.filter(mapping => mapping.app_user_uuid === selectedUserForMenus.app_user_uuid);
      const userMenuIds = userMappings.map(mapping => mapping.menu_uuid);
      
      // Check if user is admin
      const isAdmin = selectedUserForMenus.role.toLowerCase() === 'admin';
      
      // Build menu tree
      const menuTree = buildMenuTree(menusData);
      
      // Group menus by root parent
      userMenuSections = menuTree.map(rootMenu => {
        const leafMenus = getLeafMenus([rootMenu]);
        
        return {
          parent: rootMenu,
          children: leafMenus.map(menu => ({
            ...menu,
            hasAccess: isAdmin || userMenuIds.includes(menu.menu_id),
            originalAccess: isAdmin || userMenuIds.includes(menu.menu_id)
          }))
        };
      }).filter(section => section.children.length > 0);
      
    } catch (error) {
      console.error('Error loading user menu sections:', error);
      showMessage('Error loading user menu sections', 'error');
    } finally {
      isUserMenuSectionsLoading = false;
    }
  }

  // Helper function to build menu tree (same as in menuService.ts)
  function buildMenuTree(menuItems: any[]): any[] {
    const menuMap = new Map<string, any>();
    const rootMenus: any[] = [];

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

  // Helper function to get all leaf menus from tree
  function getLeafMenus(menuTree: any[]): any[] {
    const leafMenus: any[] = [];
    
    function traverse(menus: any[]) {
      menus.forEach(menu => {
        if (!menu.submenus || menu.submenus.length === 0) {
          // This is a leaf menu
          leafMenus.push(menu);
        } else {
          // This has submenus, traverse them
          traverse(menu.submenus);
        }
      });
    }
    
    traverse(menuTree);
    return leafMenus;
  }

  async function loadData() {
    try {
      await Promise.all([
        loadUsers(),
        loadMenus(),
        loadUserMenuMappings()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  // Handle user selection change
  function handleUserSelectionChange() {
    if (selectedUserForMenus) {
      loadUserMenuSections();
    } else {
      userMenuSections = [];
    }
    hasUnsavedChanges = false;
  }

  // Toggle menu access
  function toggleMenuAccess(menu: any) {
    if (selectedUserForMenus?.role.toLowerCase() === 'admin') {
      showMessage('Admin users have implicit access to all menus and cannot be modified', 'error');
      return;
    }
    
    menu.hasAccess = !menu.hasAccess;
    hasUnsavedChanges = true;
  }

  // Save user menu changes
  async function saveUserMenuChanges() {
    if (!selectedUserForMenus) return;
    
    try {
      const currentUser = localStorage.getItem('username');
      if (!currentUser) {
        showMessage('User session not found', 'error');
        return;
      }

      // Find changes
      const changes: any[] = [];
      
      userMenuSections.forEach(section => {
        section.children.forEach((menu: any) => {
          if (menu.hasAccess !== menu.originalAccess) {
            changes.push({
              menu,
              action: menu.hasAccess ? 'add' : 'remove'
            });
          }
        });
      });

      // Apply changes
      for (const change of changes) {
        if (change.action === 'add') {
          await createUserMenuMapping({
            app_user_uuid: selectedUserForMenus.app_user_uuid,
            menu_uuid: change.menu.menu_id
          }, currentUser);
        } else {
          await deleteUserMenuMapping(selectedUserForMenus.app_user_uuid, change.menu.menu_id);
        }
      }

      showMessage(`Menu access updated successfully! ${changes.length} changes applied.`, 'success');
      hasUnsavedChanges = false;
      
      // Reload to get updated data
      await loadUserMenuSections();
      
    } catch (error) {
      console.error('Error saving user menu changes:', error);
      showMessage('Error saving user menu changes: ' + ((error as Error)?.message || 'Unknown error'), 'error');
    }
  }

  // Cancel changes
  function cancelUserMenuChanges() {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        // Reload original data
        loadUserMenuSections();
        hasUnsavedChanges = false;
      }
    }
  }

  // Load Supabase Auth users
  async function loadSupabaseAuthUsers() {
    console.log('loadSupabaseAuthUsers called');
    isLoadingAuthUsers = true;
    supabaseAuthUsers = []; // Clear previous data
    try {
      console.log('Loading Supabase Auth users...');
      const result = await fetchSupabaseAuthUsers();
      console.log('fetchSupabaseAuthUsers returned:', result);
      supabaseAuthUsers = result;
      console.log('supabaseAuthUsers after assignment:', supabaseAuthUsers);
      console.log('Number of users:', supabaseAuthUsers.length);
      
      if (supabaseAuthUsers.length === 0) {
        console.warn('No Supabase Auth users found');
        showMessage('No Supabase Auth users found. Please create a user in Supabase Dashboard first.', 'error');
      } else {
        console.log('Successfully loaded', supabaseAuthUsers.length, 'Supabase Auth users');
      }
    } catch (error) {
      console.error('Error loading Supabase Auth users:', error);
      console.error('Error stack:', (error as Error)?.stack);
      const errorMessage = (error as Error)?.message || 'Unknown error';
      showMessage('Error loading Supabase Auth users: ' + errorMessage, 'error');
      supabaseAuthUsers = [];
    } finally {
      isLoadingAuthUsers = false;
      console.log('loadSupabaseAuthUsers completed, isLoadingAuthUsers:', isLoadingAuthUsers);
    }
  }

  // Reset form to new user mode
  function resetToNewUser() {
    isEditMode = false;
    selectedUser = null;
    userForm = {
      username: '',
      email: '',
      password: '',
      role: '',
      desig: '',
      emp_id: '',
      is_active: true,
      auth_user_id: ''
    };
    // Load Supabase Auth users when resetting to new user
    loadSupabaseAuthUsers();
  }

  // Users functions
  function openUserModal(user: any = null) {
    console.log('openUserModal called, user:', user);
    isEditMode = !!user;
    selectedUser = user;
    if (user) {
      userForm = {
        username: user.username,
        email: user.email,
        password: '', // Don't show existing password
        role: user.role,
        desig: user.desig,
        emp_id: user.emp_id,
        is_active: user.is_active,
        auth_user_id: user.auth_user_id || ''
      };
    } else {
      resetToNewUser();
    }
    showUserModal = true;
  }

  async function saveUser() {
    // Prevent double submission
    if (isSavingUser) {
      console.log('User save already in progress, ignoring duplicate call');
      return;
    }

    isSavingUser = true;
    try {
      const currentUser = localStorage.getItem('username');
      if (!currentUser) {
        showMessage('User session not found', 'error');
        return;
      }

      if (isEditMode) {
        await updateUser(selectedUser.app_user_uuid, userForm, currentUser);
        showMessage('User updated successfully!', 'success');
      } else {
        await createUser(userForm, currentUser);
        showMessage('User created successfully!', 'success');
      }

      await loadUsers();
      // Reset form after saving
      if (!isEditMode) {
        resetToNewUser();
      }
    } catch (error) {
      console.error('Error saving user:', error);
      showMessage('Error saving user: ' + ((error as Error)?.message || 'Unknown error'), 'error');
    } finally {
      isSavingUser = false;
    }
  }

  async function deleteUserHandler(user: any) {
    if (confirm(`Are you sure you want to delete user ${user.username}?`)) {
      try {
        const currentUser = localStorage.getItem('username');
        if (!currentUser) {
          showMessage('User session not found', 'error');
          return;
        }

        await deleteUser(user.app_user_uuid, currentUser);
        showMessage('User deleted successfully!', 'success');
        await loadUsers();
      } catch (error) {
        console.error('Error deleting user:', error);
        showMessage('Error deleting user: ' + ((error as Error)?.message || 'Unknown error'), 'error');
      }
    }
  }

  // Menu functions
  function openMenuModal(menu: any = null) {
    isMenuEditMode = !!menu;
    selectedMenu = menu;
    if (menu) {
      menuForm = {
        menu_name: menu.menu_name,
        menu_path: menu.menu_path,
        parent_menu_id: menu.parent_menu_id,
        menu_order: menu.menu_order,
        is_visible: menu.is_visible,
        is_enabled: menu.is_enabled
      };
    } else {
      menuForm = {
        menu_name: '',
        menu_path: '',
        parent_menu_id: null,
        menu_order: 0,
        is_visible: true,
        is_enabled: true
      };
    }
    showMenuModal = true;
  }

  async function saveMenu() {
    try {
      const menuData = {
        ...menuForm,
        parent_menu_id: menuForm.parent_menu_id || undefined
      };

      if (isMenuEditMode) {
        await updateMenu(selectedMenu.menu_id, menuData);
        showMessage('Menu updated successfully!', 'success');
      } else {
        await createMenu(menuData);
        showMessage('Menu created successfully!', 'success');
      }

      showMenuModal = false;
      await loadMenus();
    } catch (error) {
      console.error('Error saving menu:', error);
      showMessage('Error saving menu: ' + ((error as Error)?.message || 'Unknown error'), 'error');
    }
  }

  async function deleteMenuHandler(menu: any) {
    if (confirm(`Are you sure you want to delete menu ${menu.menu_name}?`)) {
      try {
        await deleteMenu(menu.menu_id);
        showMessage('Menu deleted successfully!', 'success');
        await loadMenus();
      } catch (error) {
        console.error('Error deleting menu:', error);
        showMessage('Error deleting menu: ' + ((error as Error)?.message || 'Unknown error'), 'error');
      }
    }
  }

  // User Menu functions
  function openUserMenuModal() {
    userMenuForm = {
      app_user_uuid: '',
      menu_uuid: ''
    };
    showUserMenuModal = true;
  }

  async function saveUserMenuMapping() {
    try {
      const currentUser = localStorage.getItem('username');
      if (!currentUser) {
        showMessage('User session not found', 'error');
        return;
      }

      const result = await createUserMenuMapping(userMenuForm, currentUser);
      
      let message = 'Menu access assigned successfully!';
      if (result.parentMenusAssigned && result.parentMenusAssigned > 0) {
        message += ` Also assigned ${result.parentMenusAssigned} parent menu(s) to ensure proper access.`;
      }
      
      showMessage(message, 'success');
      showUserMenuModal = false;
      await loadUserMenuMappings();
    } catch (error) {
      console.error('Error saving user menu mapping:', error);
      showMessage('Error saving user menu mapping: ' + ((error as Error)?.message || 'Unknown error'), 'error');
    }
  }

  async function deleteUserMenuMappingHandler(mapping: any) {
    if (confirm(`Are you sure you want to remove this menu access? This will also remove access to any child menus.`)) {
      try {
        const result = await deleteUserMenuMapping(mapping.app_user_uuid, mapping.menu_uuid);
        
        let message = 'Menu access removed successfully!';
        if (result.childMenusRemoved > 0) {
          message += ` Also removed access to ${result.childMenusRemoved} child menu(s).`;
        }
        
        showMessage(message, 'success');
        await loadUserMenuMappings();
      } catch (error) {
        console.error('Error deleting user menu mapping:', error);
        showMessage('Error deleting user menu mapping: ' + ((error as Error)?.message || 'Unknown error'), 'error');
      }
    }
  }

  // Tab change handler
  async function handleTabChange(tabId: string) {
    activeTab = tabId;
    
    // Load data for the selected tab
    switch (tabId) {
      case 'users':
        await loadUsers();
        // Load Supabase Auth users when switching to users tab (for new user form)
        if (!isEditMode) {
          loadSupabaseAuthUsers();
        }
        break;
      case 'menu':
        await loadMenus();
        break;
      case 'users-menu':
        // No need to load data here - it's loaded when user is selected
        break;
    }
  }

  function showMessage(text: string, type: 'success' | 'error') {
    message = text;
    messageType = type;
    setTimeout(() => {
      message = '';
    }, 5000);
  }

  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }

  onMount(async () => {
    // Check if user is admin
    const username = localStorage.getItem('username');
    if (!username || username.toLowerCase() !== 'admin') {
      console.log('User is not admin, redirecting to dashboard');
      window.location.href = '/dashboard';
      return;
    }

    console.log('Admin access confirmed, loading user management data');
    await loadData();

    // Load menus
    if (username) {
      menus = await fetchUserMenus(username);
    }
    
    // Load Supabase Auth users if on users tab (for new user form)
    if (activeTab === 'users' && !isEditMode) {
      loadSupabaseAuthUsers();
    }
    
    isLoading = false;
  });
</script>

<svelte:head>
  <title>User Management - System Admin</title>
</svelte:head>

<!-- Sidebar Overlay -->
{#if showSidebar}
  <div class="fixed inset-0 z-50">
    <button
      type="button"
      aria-label="Close sidebar overlay"
      class="fixed inset-0 bg-black bg-opacity-40 z-40"
      on:click={handleSidebarToggle}
      tabindex="0"
      on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSidebarToggle()}
      style="cursor: pointer; border: none; width: 100%; height: 100%; position: fixed; left: 0; top: 0; background-color: rgba(0,0,0,0.4);"
    ></button>
    <div class="fixed left-0 top-0 h-full w-64 z-50 theme-bg-primary shadow-lg">
      <Sidebar {menus} />
    </div>
  </div>
{/if}

<div class="flex flex-col h-full w-full theme-bg-secondary transition-colors duration-200" style="min-height: 100vh;">
  <!-- Header -->
  <AppHeader 
    title="User Management"
    onSidebarToggle={handleSidebarToggle}
  />

  <!-- Message Display -->
  {#if message}
    <div class={`mx-4 mt-4 p-4 rounded-lg ${messageType === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
      {message}
    </div>
  {/if}

  <!-- Tab Navigation -->
  <div class="px-4 pt-4">
    <nav class="flex space-x-8 border-b theme-border">
      {#each tabs as tab}
        <button
          class="py-2 px-3 font-medium text-sm transition-colors duration-200 rounded-t-lg {activeTab === tab.id 
            ? 'border-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-sm border-b-0' 
            : 'border-2 border-transparent theme-text-secondary hover:theme-text-primary hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/20'}"
          on:click={() => handleTabChange(tab.id)}
        >
          <span class="mr-2">{tab.icon}</span>
          {tab.label}
        </button>
      {/each}
    </nav>
  </div>

  <!-- Tab Content -->
  <div class="flex flex-1 p-4 gap-6">
    {#if isLoading}
      <div class="flex justify-center items-center h-64 w-full">
        <div class="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    {:else}
      <!-- Users Tab -->
      {#if activeTab === 'users'}
        <!-- Left Side - User Form -->
        <div class="w-3/10">
          <div class="theme-bg-primary rounded-lg shadow-lg p-6 border theme-border h-full">
            <h3 class="text-lg font-semibold theme-text-primary mb-6">
              {isEditMode ? 'Edit User' : 'Add New User'}
            </h3>
            
            <form on:submit|preventDefault={saveUser} class="space-y-6">
              <!-- Username -->
              <div>
                <label for="username" class="block text-sm font-medium theme-text-primary mb-2">
                  Username *
                </label>
                <input
                  id="username"
                  type="text"
                  bind:value={userForm.username}
                  required
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter username"
                />
              </div>

              {#if !isEditMode}
                <!-- Link to Supabase Auth User -->
                <div>
                  <label for="auth_user_id" class="block text-sm font-medium theme-text-primary mb-2">
                    Link to Supabase Auth User *
                  </label>
                  {#if isLoadingAuthUsers}
                    <div class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary flex items-center">
                      <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                      <span class="text-sm theme-text-secondary">Loading Supabase Auth users...</span>
                    </div>
                  {:else}
                    <select
                      id="auth_user_id"
                      bind:value={userForm.auth_user_id}
                      required
                      class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      on:change={(e) => {
                        const selectedId = (e.target as HTMLSelectElement).value;
                        const selectedAuthUser = supabaseAuthUsers.find(u => u.id === selectedId);
                        if (selectedAuthUser) {
                          userForm.email = selectedAuthUser.email;
                        }
                      }}
                    >
                      <option value="">Select Supabase Auth User</option>
                      {#each supabaseAuthUsers as authUser}
                        <option 
                          value={authUser.id} 
                          disabled={authUser.is_linked}
                        >
                          {authUser.email} {authUser.is_linked ? '(Already Linked)' : ''}
                        </option>
                      {/each}
                    </select>
                    <p class="mt-1 text-xs theme-text-secondary">
                      Select a user from Supabase Authentication. Only unlinked users can be selected.
                      Email will be auto-filled from the selected user.
                    </p>
                    <button
                      type="button"
                      class="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      on:click={loadSupabaseAuthUsers}
                    >
                      Refresh List
                    </button>
                  {/if}
                </div>

                <!-- Email (auto-filled, read-only) -->
                <div>
                  <label for="email" class="block text-sm font-medium theme-text-primary mb-2">
                    Email (from Supabase Auth)
                  </label>
                  <input
                    id="email"
                    type="email"
                    bind:value={userForm.email}
                    readonly
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-gray-100 dark:theme-bg-gray-700 theme-text-primary cursor-not-allowed"
                    placeholder="Will be auto-filled from selected Supabase Auth user"
                  />
                </div>
              {:else}
                <!-- Email (read-only in edit mode) -->
                <div>
                  <label for="email" class="block text-sm font-medium theme-text-primary mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    bind:value={userForm.email}
                    readonly
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-gray-100 dark:theme-bg-gray-700 theme-text-primary cursor-not-allowed"
                  />
                  <p class="mt-1 text-xs theme-text-secondary">Email cannot be changed</p>
                </div>
              {/if}

              <!-- Role -->
              <div>
                <label for="role" class="block text-sm font-medium theme-text-primary mb-2">
                  Role *
                </label>
                <select
                  id="role"
                  bind:value={userForm.role}
                  required
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Role</option>
                  {#each roles as role}
                    <option value={role}>{role}</option>
                  {/each}
                </select>
              </div>

              <!-- Designation -->
              <div>
                <label for="desig" class="block text-sm font-medium theme-text-primary mb-2">
                  Designation *
                </label>
                <input
                  id="desig"
                  type="text"
                  bind:value={userForm.desig}
                  required
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter designation"
                />
              </div>

              <!-- Employee ID -->
              <div>
                <label for="emp_id" class="block text-sm font-medium theme-text-primary mb-2">
                  Employee ID *
                </label>
                <input
                  id="emp_id"
                  type="text"
                  bind:value={userForm.emp_id}
                  required
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter employee ID"
                />
              </div>

              <!-- Status -->
              <div>
                <div class="block text-sm font-medium theme-text-primary mb-2">
                  Status *
                </div>
                <div class="space-y-2" role="radiogroup" aria-labelledby="status-label">
                  <label class="flex items-center space-x-2">
                    <input
                      id="status-active"
                      type="radio"
                      bind:group={userForm.is_active}
                      value={true}
                      class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span class="text-sm theme-text-primary">Active</span>
                  </label>
                  <label class="flex items-center space-x-2">
                    <input
                      id="status-inactive"
                      type="radio"
                      bind:group={userForm.is_active}
                      value={false}
                      class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span class="text-sm theme-text-primary">Inactive</span>
                  </label>
                </div>
              </div>

              <!-- Submit Button -->
              <div class="flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingUser}
                  class="px-6 py-3 text-base font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-blue-600 text-white border-2 border-blue-600 hover:bg-blue-700 hover:border-blue-700 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingUser ? 'Saving...' : (isEditMode ? 'Update User' : 'Save User')}
                </button>
              </div>
            </form>

            <!-- Help Section -->
            <div class="mt-8 pt-6 border-t theme-border">
              <h4 class="text-sm font-semibold theme-text-primary mb-3">How to use this form:</h4>
              <div class="space-y-2 text-xs theme-text-secondary">
                <div class="flex items-start space-x-2">
                  <span class="text-blue-500 font-semibold">•</span>
                  <span>Enter a unique username and email for the new user.</span>
                </div>
                <div class="flex items-start space-x-2">
                  <span class="text-blue-500 font-semibold">•</span>
                  <span>Select the appropriate role from the dropdown.</span>
                </div>
                <div class="flex items-start space-x-2">
                  <span class="text-blue-500 font-semibold">•</span>
                  <span>Email cannot be changed once created.</span>
                </div>
                <div class="flex items-start space-x-2">
                  <span class="text-blue-500 font-semibold">•</span>
                  <span>All fields marked with * are required.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Side - Users Table -->
        <div class="w-7/10">
          <DataTable
            data={users}
            columns={[
              { key: 'username', label: 'Username', sortable: true, filterable: true, type: 'text' },
              { key: 'email', label: 'Email', sortable: true, filterable: true, type: 'text' },
              { key: 'role', label: 'Role', sortable: true, filterable: true, type: 'text' },
              { key: 'desig', label: 'Designation', sortable: true, filterable: true, type: 'text' },
              { key: 'emp_id', label: 'Employee ID', sortable: true, filterable: true, type: 'text' },
              { key: 'is_active', label: 'Status', sortable: true, filterable: true, type: 'status' },
              { key: 'last_login_time', label: 'Last Login', sortable: true, filterable: false, type: 'text' }
            ]}
            actions={[
              {
                label: 'Edit',
                icon: Edit,
                onClick: (user) => openUserModal(user)
              },
              {
                label: 'Delete',
                icon: Trash2,
                onClick: (user) => deleteUserHandler(user)
              }
            ]}
            title="Users"
            isLoading={isUsersLoading}
          />
        </div>
      {/if}

      <!-- Menu Tab -->
      {#if activeTab === 'menu'}
        <!-- Left Side - Menu Form -->
        <div class="w-3/10">
          <div class="theme-bg-primary rounded-lg shadow-lg p-6 border theme-border h-full">
            <h3 class="text-lg font-semibold theme-text-primary mb-6">
              {isMenuEditMode ? 'Edit Menu' : 'Add New Menu'}
            </h3>
            
            <form on:submit|preventDefault={saveMenu} class="space-y-6">
              <!-- Menu Name -->
              <div>
                <label for="menu_name" class="block text-sm font-medium theme-text-primary mb-2">
                  Menu Name *
                </label>
                <input
                  id="menu_name"
                  type="text"
                  bind:value={menuForm.menu_name}
                  required
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter menu name"
                />
              </div>

              <!-- Menu Path -->
              <div>
                <label for="menu_path" class="block text-sm font-medium theme-text-primary mb-2">
                  Menu Path *
                </label>
                <input
                  id="menu_path"
                  type="text"
                  bind:value={menuForm.menu_path}
                  required
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter menu path"
                />
              </div>

              <!-- Parent Menu -->
              <div>
                <label for="parent_menu" class="block text-sm font-medium theme-text-primary mb-2">
                  Parent Menu
                </label>
                <select
                  id="parent_menu"
                  bind:value={menuForm.parent_menu_id}
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={null}>No Parent</option>
                  {#each menuItems.filter(menu => {
                    // Only show menus that don't have a parent (top-level menus)
                    if (menu.parent_menu_id) return false;
                    
                    // If editing, don't show the current menu as a parent option
                    if (isMenuEditMode && selectedMenu && menu.menu_id === selectedMenu.menu_id) return false;
                    
                    return true;
                  }).sort((a, b) => a.menu_name.localeCompare(b.menu_name)) as menu}
                    <option value={menu.menu_id}>{menu.menu_name}</option>
                  {/each}
                </select>
              </div>

              <!-- Menu Order -->
              <div>
                <label for="menu_order" class="block text-sm font-medium theme-text-primary mb-2">
                  Menu Order
                </label>
                <input
                  id="menu_order"
                  type="number"
                  bind:value={menuForm.menu_order}
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter menu order"
                />
              </div>

              <!-- Visibility -->
              <div class="flex items-center">
                <input
                  id="is_visible"
                  type="checkbox"
                  bind:checked={menuForm.is_visible}
                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label for="is_visible" class="ml-2 block text-sm theme-text-primary">Visible</label>
              </div>

              <!-- Enabled -->
              <div class="flex items-center">
                <input
                  id="is_enabled"
                  type="checkbox"
                  bind:checked={menuForm.is_enabled}
                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label for="is_enabled" class="ml-2 block text-sm theme-text-primary">Enabled</label>
              </div>

              <!-- Submit Button -->
              <div class="flex justify-end">
                <Button
                  variant="primary"
                  size="lg"
                  on:click={saveMenu}
                >
                  {isMenuEditMode ? 'Update Menu' : 'Save Menu'}
                </Button>
              </div>
            </form>

            <!-- Help Section -->
            <div class="mt-8 pt-6 border-t theme-border">
              <h4 class="text-sm font-semibold theme-text-primary mb-3">How to use this form:</h4>
              <div class="space-y-2 text-xs theme-text-secondary">
                <div class="flex items-start space-x-2">
                  <span class="text-blue-500 font-semibold">•</span>
                  <span>Enter a unique menu name and path.</span>
                </div>
                <div class="flex items-start space-x-2">
                  <span class="text-blue-500 font-semibold">•</span>
                  <span>Select a parent menu if this is a submenu.</span>
                </div>
                <div class="flex items-start space-x-2">
                  <span class="text-blue-500 font-semibold">•</span>
                  <span>Set the menu order for display sequence.</span>
                </div>
                <div class="flex items-start space-x-2">
                  <span class="text-blue-500 font-semibold">•</span>
                  <span>All fields marked with * are required.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Side - Menu Table -->
        <div class="w-7/10">
          <DataTable
            data={menuItems}
            columns={[
              { key: 'menu_name', label: 'Menu Name', sortable: true, filterable: true, type: 'text' },
              { key: 'menu_path', label: 'Menu Path', sortable: true, filterable: true, type: 'text' },
              { key: 'menu_order', label: 'Order', sortable: true, filterable: true, type: 'number' },
              { key: 'is_visible', label: 'Visible', sortable: true, filterable: true, type: 'status' },
              { key: 'is_enabled', label: 'Enabled', sortable: true, filterable: true, type: 'status' }
            ]}
            actions={[
              {
                label: 'Edit',
                icon: Edit,
                onClick: (menu) => openMenuModal(menu)
              },
              {
                label: 'Delete',
                icon: Trash2,
                onClick: (menu) => deleteMenuHandler(menu)
              }
            ]}
            title="Menu Items"
            isLoading={isMenuLoading}
          />
        </div>
      {/if}

      <!-- User's Menu Tab -->
      {#if activeTab === 'users-menu'}
        <div class="w-full">
          <div class="theme-bg-primary rounded-lg shadow-lg border theme-border">
            <!-- Header -->
            <div class="p-4 border-b theme-border">
              <h3 class="text-lg font-semibold theme-text-primary">User Menu Access Management</h3>
              <p class="text-sm theme-text-secondary mt-1">
                Select a user to manage their menu access permissions.
              </p>
            </div>

            <!-- User Selection -->
            <div class="p-4 border-b theme-border">
              <div class="flex items-center space-x-4">
                <div class="flex-1">
                  <label for="userSelect" class="block text-sm font-medium theme-text-primary mb-2">
                    Select User
                  </label>
                  <select
                    id="userSelect"
                    bind:value={selectedUserForMenus}
                    on:change={handleUserSelectionChange}
                    class="w-full px-3 py-2 border theme-border rounded theme-bg-secondary theme-text-primary"
                  >
                    <option value={null}>-- Select a user --</option>
                    {#each users as user}
                      <option value={user}>
                        {user.username} ({user.email}) - {user.role}
                      </option>
                    {/each}
                  </select>
                </div>
                
                {#if selectedUserForMenus}
                  <div class="flex space-x-2">
                    <Button
                      variant="primary"
                      size="md"
                      disabled={!hasUnsavedChanges}
                      on:click={saveUserMenuChanges}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                      Save Changes
                    </Button>
                    <Button
                      variant="secondary"
                      size="md"
                      disabled={!hasUnsavedChanges}
                      on:click={cancelUserMenuChanges}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancel
                    </Button>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Menu Sections -->
            {#if selectedUserForMenus}
              <div class="p-4">
                {#if isUserMenuSectionsLoading}
                  <div class="flex justify-center items-center h-64">
                    <div class="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
                  </div>
                {:else if userMenuSections.length === 0}
                  <div class="text-center py-8">
                    <p class="text-gray-500">No menu sections found.</p>
                  </div>
                {:else}
                  <div class="space-y-6">
                    {#each userMenuSections as section}
                      <div class="border theme-border rounded-lg p-4">
                        <h4 class="text-lg font-semibold theme-text-primary mb-4 flex items-center">
                          <span class="mr-2">📁</span>
                          {section.parent.menu_name}
                          {#if selectedUserForMenus.role.toLowerCase() === 'admin'}
                            <span class="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">Admin Access</span>
                          {/if}
                        </h4>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {#each section.children as menu}
                            <div class="flex items-center space-x-3 p-3 border theme-border rounded hover:theme-bg-tertiary">
                              <input
                                type="checkbox"
                                checked={menu.hasAccess}
                                disabled={selectedUserForMenus.role.toLowerCase() === 'admin'}
                                on:change={() => toggleMenuAccess(menu)}
                                class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                              />
                              <div class="flex-1">
                                <div class="font-medium theme-text-primary">{menu.menu_name}</div>
                                {#if menu.menu_description}
                                  <div class="text-sm theme-text-secondary">{menu.menu_description}</div>
                                {/if}
                              </div>
                            </div>
                          {/each}
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {:else}
              <div class="p-8 text-center">
                <div class="text-gray-400 text-6xl mb-4">👤</div>
                <h4 class="text-lg font-medium theme-text-primary mb-2">No User Selected</h4>
                <p class="text-sm theme-text-secondary">
                  Please select a user from the dropdown above to manage their menu access.
                </p>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>

<!-- Floating Theme Toggle -->
<FloatingThemeToggle />