<script lang="ts">
  import { onMount } from 'svelte';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import { fetchUsers, createUser, updateUser, deleteUser, fetchMenus, createMenu, updateMenu, deleteMenu, fetchUserMenuMappings, createUserMenuMapping, deleteUserMenuMapping } from '$lib/api/userManagement';
  import UsersTab from './components/UsersTab.svelte';
  import MenuTab from './components/MenuTab.svelte';
  import UserMenuTab from './components/UserMenuTab.svelte';

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
  let isSavingUser = false;
  let isEditMode = false;
  let selectedUser: any = null;
  let userForm = {
    username: '',
    email: '',
    password: '',
    role: '',
    desig: '',
    emp_id: '',
    is_active: true,
    auth_user_id: ''
  };

  // Menu tab state
  let menuItems: any[] = [];
  let isMenuLoading = false;
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
  let selectedUserForMenus: any = null;
  let userMenuTabRef: any = null;

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

  async function loadData() {
    try {
      await Promise.all([
        loadUsers(),
        loadMenus(),
        fetchUserMenuMappings()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  // Users functions
  function handleEditUser(event: CustomEvent) {
    const user = event.detail;
    isEditMode = true;
    selectedUser = user;
    userForm = {
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
      desig: user.desig,
      emp_id: user.emp_id,
      is_active: user.is_active,
      auth_user_id: user.auth_user_id || ''
    };
  }

  function handleDeleteUser(event: CustomEvent) {
    const user = event.detail;
    if (confirm(`Are you sure you want to delete user ${user.username}?`)) {
      deleteUserHandler(user);
    }
  }

  async function deleteUserHandler(user: any) {
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

  async function handleSaveUser() {
    if (isSavingUser) return;

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
      handleResetForm();
    } catch (error) {
      console.error('Error saving user:', error);
      showMessage('Error saving user: ' + ((error as Error)?.message || 'Unknown error'), 'error');
    } finally {
      isSavingUser = false;
    }
  }

  function handleResetForm() {
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
  }

  // Menu functions
  function handleEditMenu(event: CustomEvent) {
    const menu = event.detail;
    isMenuEditMode = true;
    selectedMenu = menu;
    menuForm = {
      menu_name: menu.menu_name,
      menu_path: menu.menu_path,
      parent_menu_id: menu.parent_menu_id,
      menu_order: menu.menu_order,
      is_visible: menu.is_visible,
      is_enabled: menu.is_enabled
    };
  }

  function handleDeleteMenu(event: CustomEvent) {
    const menu = event.detail;
    if (confirm(`Are you sure you want to delete menu ${menu.menu_name}?`)) {
      deleteMenuHandler(menu);
    }
  }

  async function deleteMenuHandler(menu: any) {
    try {
      await deleteMenu(menu.menu_id);
      showMessage('Menu deleted successfully!', 'success');
      await loadMenus();
    } catch (error) {
      console.error('Error deleting menu:', error);
      showMessage('Error deleting menu: ' + ((error as Error)?.message || 'Unknown error'), 'error');
    }
  }

  async function handleSaveMenu() {
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

      await loadMenus();
      isMenuEditMode = false;
      selectedMenu = null;
      menuForm = {
        menu_name: '',
        menu_path: '',
        parent_menu_id: null,
        menu_order: 0,
        is_visible: true,
        is_enabled: true
      };
    } catch (error) {
      console.error('Error saving menu:', error);
      showMessage('Error saving menu: ' + ((error as Error)?.message || 'Unknown error'), 'error');
    }
  }

  // User Menu functions
  async function handleSaveUserMenuChanges(event: CustomEvent) {
    const { userMenuSections, selectedUserForMenus } = event.detail;
    
    try {
      const currentUser = localStorage.getItem('username');
      if (!currentUser) {
        showMessage('User session not found', 'error');
        return;
      }

      const changes: any[] = [];
      
      userMenuSections.forEach((section: any) => {
        section.children.forEach((menu: any) => {
          if (menu.hasAccess !== menu.originalAccess) {
            changes.push({
              menu,
              action: menu.hasAccess ? 'add' : 'remove'
            });
          }
        });
      });

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
      
      if (userMenuTabRef) {
        userMenuTabRef.markChangesSaved();
      }
      
    } catch (error) {
      console.error('Error saving user menu changes:', error);
      showMessage('Error saving user menu changes: ' + ((error as Error)?.message || 'Unknown error'), 'error');
    }
  }

  // Tab change handler
  async function handleTabChange(tabId: string) {
    activeTab = tabId;
    
    switch (tabId) {
      case 'users':
        await loadUsers();
        break;
      case 'menu':
        await loadMenus();
        break;
      case 'users-menu':
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

  function handleMessage(event: CustomEvent) {
    showMessage(event.detail.text, event.detail.type);
  }

  onMount(async () => {
    const username = localStorage.getItem('username');
    if (!username || username.toLowerCase() !== 'admin') {
      console.log('User is not admin, redirecting to dashboard');
      window.location.href = '/dashboard';
      return;
    }

    console.log('Admin access confirmed, loading user management data');
    await loadData();

    if (username) {
      menus = await fetchUserMenus(username);
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
        <UsersTab
          {users}
          isLoading={isUsersLoading}
          {isSavingUser}
          {isEditMode}
          {selectedUser}
          bind:userForm
          on:edit-user={handleEditUser}
          on:delete-user={handleDeleteUser}
          on:save-user={handleSaveUser}
          on:reset-form={handleResetForm}
          on:message={handleMessage}
        />
      {/if}

      <!-- Menu Tab -->
      {#if activeTab === 'menu'}
        <MenuTab
          {menuItems}
          isLoading={isMenuLoading}
          {isMenuEditMode}
          {selectedMenu}
          bind:menuForm
          on:edit-menu={handleEditMenu}
          on:delete-menu={handleDeleteMenu}
          on:save-menu={handleSaveMenu}
        />
      {/if}

      <!-- User's Menu Tab -->
      {#if activeTab === 'users-menu'}
        <UserMenuTab
          bind:this={userMenuTabRef}
          {users}
          bind:selectedUserForMenus
          on:save-changes={handleSaveUserMenuChanges}
          on:message={handleMessage}
        />
      {/if}
    {/if}
  </div>
</div>

<!-- Floating Theme Toggle -->
<FloatingThemeToggle />
