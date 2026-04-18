<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { Edit, Trash2 } from 'lucide-svelte';
  import { buildMenuTree } from '../utils/menuTreeUtils';
  
  export let menuItems: any[] = [];
  export let isLoading: boolean = false;
  export let isEditMode: boolean = false;
  export let selectedMenu: any = null;
  export let menuForm: {
    menu_name: string;
    menu_path: string;
    redirect_path: string;
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

  type FlatMenuRow = {
    menu_id: string;
    menu_name: string;
    menu_path: string;
    redirect_path?: string | null;
    parent_menu_id?: string | null;
    menu_order: number;
    is_visible: boolean;
    is_enabled: boolean;
    depth: number;
  };

  function flattenMenuTree(nodes: any[], depth = 0): FlatMenuRow[] {
    const rows: FlatMenuRow[] = [];
    const sortedNodes = [...(nodes || [])].sort((a, b) => {
      const orderDelta = (a.menu_order || 0) - (b.menu_order || 0);
      if (orderDelta !== 0) return orderDelta;
      return String(a.menu_name || '').localeCompare(String(b.menu_name || ''));
    });

    sortedNodes.forEach((node) => {
      rows.push({
        ...node,
        depth
      });
      if (node.submenus?.length) {
        rows.push(...flattenMenuTree(node.submenus, depth + 1));
      }
    });
    return rows;
  }

  /** IDs of menus under `rootId` (not including rootId). Used to avoid picking a descendant as parent when editing. */
  function getDescendantMenuIds(rootId: string, items: any[]): Set<string> {
    const childrenByParent = new Map<string, string[]>();
    for (const m of items || []) {
      const pid = m.parent_menu_id;
      if (!pid) continue;
      const list = childrenByParent.get(pid) ?? [];
      list.push(m.menu_id);
      childrenByParent.set(pid, list);
    }
    const blocked = new Set<string>();
    const stack = [...(childrenByParent.get(rootId) ?? [])];
    while (stack.length) {
      const id = stack.pop()!;
      blocked.add(id);
      for (const kid of childrenByParent.get(id) ?? []) stack.push(kid);
    }
    return blocked;
  }

  function formatParentOptionLabel(row: FlatMenuRow): string {
    const pad = '\u00A0\u00A0'.repeat(row.depth);
    return `${pad}${row.menu_name}`;
  }

  $: menuTree = buildMenuTree(menuItems || []);
  $: flattenedMenuRows = flattenMenuTree(menuTree);

  $: descendantIdsForEdit =
    isEditMode && selectedMenu?.menu_id
      ? getDescendantMenuIds(selectedMenu.menu_id, menuItems)
      : new Set<string>();

  $: parentMenuSelectRows = flattenedMenuRows.filter((row) => {
    if (isEditMode && selectedMenu?.menu_id) {
      if (row.menu_id === selectedMenu.menu_id) return false;
      if (descendantIdsForEdit.has(row.menu_id)) return false;
    }
    return true;
  });
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

        <!-- Redirect Path -->
        <div>
          <label for="redirect_path" class="block text-sm font-medium theme-text-primary mb-2">
            Redirect Path
          </label>
          <input
            id="redirect_path"
            type="text"
            bind:value={menuForm.redirect_path}
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Optional, e.g. /dashboard"
          />
          <p class="mt-1 text-xs theme-text-secondary">
            If set, navigation for this menu uses redirect path.
          </p>
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
            {#each parentMenuSelectRows as row}
              <option value={row.menu_id}>{formatParentOptionLabel(row)}</option>
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
            <span>Redirect Path is optional and managed in menu_redirect.</span>
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
    <div class="theme-bg-primary rounded-lg shadow-lg border theme-border">
      <div class="px-4 py-3 border-b theme-border">
        <h3 class="text-base font-semibold theme-text-primary">Menu Items (Tree View)</h3>
        <p class="text-xs theme-text-secondary mt-1">
          Parent-child hierarchy helps identify submenu ownership clearly.
        </p>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y theme-border">
          <thead class="theme-bg-secondary">
            <tr>
              <th class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider theme-text-secondary">Menu Name</th>
              <th class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider theme-text-secondary">Menu Path</th>
              <th class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider theme-text-secondary">Redirect Path</th>
              <th class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider theme-text-secondary">Order</th>
              <th class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider theme-text-secondary">Visible</th>
              <th class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider theme-text-secondary">Enabled</th>
              <th class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider theme-text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody class="theme-bg-primary divide-y theme-border">
            {#if isLoading}
              <tr>
                <td colspan="7" class="px-4 py-6 text-center theme-text-secondary">Loading menus...</td>
              </tr>
            {:else if flattenedMenuRows.length === 0}
              <tr>
                <td colspan="7" class="px-4 py-6 text-center theme-text-secondary">No menu items found</td>
              </tr>
            {:else}
              {#each flattenedMenuRows as menu}
                <tr class="hover:theme-bg-secondary">
                  <td class="px-4 py-2 text-sm theme-text-primary">
                    <div class="flex items-center">
                      <span style={`display:inline-block;width:${menu.depth * 18}px;`}></span>
                      {#if menu.depth > 0}
                        <span class="mr-2 theme-text-secondary">└</span>
                      {/if}
                      <span class={menu.depth === 0 ? 'font-semibold' : ''}>{menu.menu_name}</span>
                    </div>
                  </td>
                  <td class="px-4 py-2 text-sm theme-text-primary">{menu.menu_path}</td>
                  <td class="px-4 py-2 text-sm theme-text-primary">{menu.redirect_path || '—'}</td>
                  <td class="px-4 py-2 text-sm theme-text-primary">{menu.menu_order ?? 0}</td>
                  <td class="px-4 py-2 text-sm">
                    <span class={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${menu.is_visible ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300'}`}>
                      {menu.is_visible ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td class="px-4 py-2 text-sm">
                    <span class={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${menu.is_enabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300'}`}>
                      {menu.is_enabled ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td class="px-4 py-2 text-sm">
                    <div class="flex items-center gap-2">
                      <button
                        class="inline-flex items-center gap-1 px-2 py-1 rounded border theme-border hover:theme-bg-secondary"
                        on:click={() => handleEdit(menu)}
                        aria-label="Edit menu"
                      >
                        <Edit class="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        class="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        on:click={() => handleDelete(menu)}
                        aria-label="Delete menu"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

