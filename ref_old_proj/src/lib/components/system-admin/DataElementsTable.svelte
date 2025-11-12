<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchDataElements, deleteDataElement, type DataElement } from '$lib/api/dataElements';
  import { supabase } from '$lib/supabaseClient';
  import { formatDate } from '$lib/utils/formatDate';

  export let refreshTrigger = 0;

  let dataElements: DataElement[] = [];
  let isLoading = true;
  let error = '';
  let selectedElement: DataElement | null = null;
  let showDeleteModal = false;

  async function loadDataElements() {
    try {
      isLoading = true;
      error = '';
      dataElements = await fetchDataElements();
      
      // Get usernames for modified_by emails
      const emails = [...new Set(dataElements.map(de => de.modified_by))];
      if (emails.length > 0) {
        const { data: users, error: userError } = await supabase
          .from('app_users')
          .select('email, username')
          .in('email', emails);
        
        if (!userError && users) {
          const emailToUsername = new Map(users.map(u => [u.email, u.username]));
          dataElements = dataElements.map(de => ({
            ...de,
            modified_by: emailToUsername.get(de.modified_by) || de.modified_by
          }));
        }
      }
    } catch (err) {
      console.error('Error loading data elements:', err);
      error = 'Failed to load data elements';
    } finally {
      isLoading = false;
    }
  }

  function openDeleteModal(element: DataElement) {
    selectedElement = element;
    showDeleteModal = true;
  }

  async function handleDelete() {
    if (!selectedElement) return;

    try {
      await deleteDataElement(selectedElement.id);
      showDeleteModal = false;
      selectedElement = null;
      await loadDataElements();
    } catch (err) {
      console.error('Error deleting data element:', err);
      error = 'Failed to delete data element';
    }
  }

  $: if (refreshTrigger > 0) {
    loadDataElements();
  }

  onMount(() => {
    loadDataElements();
  });
</script>

<div class="space-y-4 h-full flex flex-col">
  <div class="flex justify-between items-center">
    <h3 class="text-lg font-semibold theme-text-primary">Existing Data Elements</h3>
    <button
      on:click={loadDataElements}
      class="px-3 py-1 text-sm theme-bg-tertiary theme-text-primary rounded hover:theme-bg-secondary transition-colors"
    >
      Refresh
    </button>
  </div>

  {#if error}
    <div class="p-4 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-lg">
      {error}
    </div>
  {/if}

  {#if isLoading}
    <div class="flex justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  {:else if dataElements.length === 0}
    <div class="text-center py-8 theme-text-secondary">
      No data elements found.
    </div>
  {:else}
    <div class="overflow-x-auto flex-1">
      <table class="w-full border-collapse theme-bg-primary rounded-lg overflow-hidden shadow">
        <thead class="theme-bg-secondary">
          <tr>
            <th class="px-4 py-3 text-left theme-text-primary font-semibold">Data Element Name</th>
            <th class="px-4 py-3 text-left theme-text-primary font-semibold">Value</th>
            <th class="px-4 py-3 text-left theme-text-primary font-semibold">Modified By</th>
            <th class="px-4 py-3 text-left theme-text-primary font-semibold">Modified Date</th>
            <th class="px-4 py-3 text-center theme-text-primary font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {#each dataElements as element}
            <tr class="border-t theme-border hover:theme-bg-tertiary">
              <td class="px-4 py-3 theme-text-primary font-medium">{element.de_name}</td>
              <td class="px-4 py-3 theme-text-primary">
                <div class="max-w-xs truncate" title={element.de_value}>
                  {element.de_value}
                </div>
              </td>
              <td class="px-4 py-3 theme-text-secondary">{element.modified_by}</td>
              <td class="px-4 py-3 theme-text-secondary">
                {formatDate(element.modified_dt)}
              </td>
              <td class="px-4 py-3 text-center">
                <button
                  on:click={() => openDeleteModal(element)}
                  class="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>



<!-- Delete Modal -->
{#if showDeleteModal && selectedElement}
  <div class="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
    <div class="theme-bg-primary p-6 rounded shadow-lg w-80 max-w-full mx-4">
      <h3 class="text-lg font-semibold theme-text-primary mb-4">Confirm Delete</h3>
      <p class="theme-text-secondary mb-6">
        Are you sure you want to delete the data element "<strong>{selectedElement.de_name}</strong>"?
        This action cannot be undone.
      </p>
      <div class="flex justify-end space-x-3">
        <button
          on:click={() => { showDeleteModal = false; selectedElement = null; }}
          class="px-4 py-2 theme-bg-tertiary theme-text-primary rounded hover:theme-bg-secondary transition-colors"
        >
          Cancel
        </button>
        <button
          on:click={handleDelete}
          class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
{/if} 