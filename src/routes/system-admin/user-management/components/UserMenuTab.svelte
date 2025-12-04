<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { fetchMenus, fetchUserMenuMappings } from '$lib/api/userManagement';
  import { buildMenuTree, getLeafMenus } from '../utils/menuTreeUtils';
  
  export let users: any[] = [];
  export let selectedUserForMenus: any = null;
  
  let userMenuSections: any[] = [];
  let isUserMenuSectionsLoading = false;
  let hasUnsavedChanges = false;
  
  const dispatch = createEventDispatcher();
  
  async function loadUserMenuSections() {
    if (!selectedUserForMenus) return;
    
    isUserMenuSectionsLoading = true;
    try {
      const [menusData, mappingsData] = await Promise.all([
        fetchMenus(),
        fetchUserMenuMappings()
      ]);

      const userMappings = mappingsData.filter(mapping => mapping.app_user_uuid === selectedUserForMenus.app_user_uuid);
      const userMenuIds = userMappings.map(mapping => mapping.menu_uuid);
      
      const isAdmin = selectedUserForMenus.role.toLowerCase() === 'admin';
      const menuTree = buildMenuTree(menusData);
      
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
      dispatch('message', { text: 'Error loading user menu sections', type: 'error' });
    } finally {
      isUserMenuSectionsLoading = false;
    }
  }
  
  function handleUserSelectionChange() {
    if (selectedUserForMenus) {
      loadUserMenuSections();
    } else {
      userMenuSections = [];
    }
    hasUnsavedChanges = false;
  }
  
  function toggleMenuAccess(menu: any) {
    if (selectedUserForMenus?.role.toLowerCase() === 'admin') {
      dispatch('message', { text: 'Admin users have implicit access to all menus and cannot be modified', type: 'error' });
      return;
    }
    
    menu.hasAccess = !menu.hasAccess;
    hasUnsavedChanges = true;
  }
  
  function handleSave() {
    dispatch('save-changes', { userMenuSections, selectedUserForMenus });
  }
  
  function handleCancel() {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        loadUserMenuSections();
        hasUnsavedChanges = false;
      }
    }
  }
  
  // Reload when user changes
  $: if (selectedUserForMenus) {
    handleUserSelectionChange();
  }
  
  // Update hasUnsavedChanges when changes are saved
  export function markChangesSaved() {
    hasUnsavedChanges = false;
    loadUserMenuSections();
  }
</script>

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
              on:click={handleSave}
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
              on:click={handleCancel}
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

