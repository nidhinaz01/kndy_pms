<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import DataTable from '$lib/components/common/DataTable.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { Edit, Trash2 } from 'lucide-svelte';
  
  export let menuItems: any[] = [];
  export let isLoading: boolean = false;
  export let isEditMode: boolean = false;
  export let selectedMenu: any = null;
  export let menuForm: {
    menu_name: string;
    menu_path: string;
    parent_menu_id: string | null;
    menu_order: number;
    is_visible: boolean;
    is_enabled: boolean;
  };
  
  const dispatch = createEventDispatcher();
  
  function handleEdit(menu: any) {
    dispatch('edit-menu', menu);
  }
  
  function handleDelete(menu: any) {
    dispatch('delete-menu', menu);
  }
  
  function handleSave() {
    dispatch('save-menu');
  }
</script>

<div class="flex flex-1 gap-6">
  <!-- Left Side - Menu Form -->
  <div class="w-3/10">
    <div class="theme-bg-primary rounded-lg shadow-lg p-6 border theme-border h-full">
      <h3 class="text-lg font-semibold theme-text-primary mb-6">
        {isEditMode ? 'Edit Menu' : 'Add New Menu'}
      </h3>
      
      <form on:submit|preventDefault={handleSave} class="space-y-6">
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
              if (menu.parent_menu_id) return false;
              if (isEditMode && selectedMenu && menu.menu_id === selectedMenu.menu_id) return false;
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
            on:click={handleSave}
          >
            {isEditMode ? 'Update Menu' : 'Save Menu'}
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
          onClick: handleEdit
        },
        {
          label: 'Delete',
          icon: Trash2,
          onClick: handleDelete
        }
      ]}
      title="Menu Items"
      isLoading={isLoading}
    />
  </div>
</div>

