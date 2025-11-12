<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { theme } from '$lib/stores/theme';
  import { fetchDataElementNames, saveMultipleDataElements, checkExistingCombinations, fetchDataElements, deleteDataElement, toggleDataElementStatus } from '$lib/api/dataElements';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import Button from '$lib/components/common/Button.svelte';
  import DataTable from '$lib/components/common/DataTable.svelte';
  import { Trash2, Edit } from 'lucide-svelte';

  // State management
  let dataElementNames: string[] = [];
  let selectedDataElementName = '';
  let newDataElementName = '';
  let dataElementValue = '';
  let isCreatingNew = false;
  let isLoading = false;
  let message = '';
  let messageType: 'success' | 'error' = 'success';
  let showSidebar = false;
  let menus: any[] = [];
  let dataElements: any[] = [];
  let tableLoading = false;

  // Load existing data element names
  async function loadDataElementNames() {
    try {
      dataElementNames = await fetchDataElementNames();
    } catch (error) {
      console.error('Error loading data element names:', error);
    }
  }

  // Load data elements for table
  async function loadDataElements() {
    try {
      tableLoading = true;
      console.log('Fetching data elements...');
      dataElements = await fetchDataElements();
      console.log('Raw data elements:', dataElements);
      
      // Get usernames for modified_by emails
      const emails = [...new Set(dataElements.map(de => de.modified_by))];
      console.log('Emails to lookup:', emails);
      
      if (emails.length > 0) {
        const { data: users, error: userError } = await supabase
          .from('app_users')
          .select('email, username')
          .in('email', emails);
        
        console.log('Users lookup result:', users, userError);
        
        if (!userError && users) {
          const emailToUsername = new Map(users.map(u => [u.email, u.username]));
          dataElements = dataElements.map(de => ({
            ...de,
            modified_by: emailToUsername.get(de.modified_by) || de.modified_by
          }));
        }
      }
      
      console.log('Final data elements:', dataElements);
    } catch (error) {
      console.error('Error loading data elements:', error);
    } finally {
      tableLoading = false;
    }
  }

  async function handleDeleteDataElement(element: any) {
    if (!confirm(`Are you sure you want to delete "${element.de_name}"?`)) {
      return;
    }

    try {
      const username = localStorage.getItem('username');
      if (!username) {
        showMessage('User session not found', 'error');
        return;
      }

      await deleteDataElement(element.id, username);
      await loadDataElements();
      showMessage('Data element deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting data element:', error);
      showMessage('Error deleting data element', 'error');
    }
  }

  async function handleToggleStatus(element: any) {
    const newStatus = !element.is_active;
    const statusText = newStatus ? 'activate' : 'deactivate';
    
    if (!confirm(`Are you sure you want to ${statusText} "${element.de_name}"?`)) {
      return;
    }

    try {
      const username = localStorage.getItem('username');
      if (!username) {
        showMessage('User session not found', 'error');
        return;
      }

      await toggleDataElementStatus(element.id, newStatus, username);
      await loadDataElements();
      showMessage(`Data element ${statusText}d successfully!`, 'success');
    } catch (error) {
      console.error('Error toggling data element status:', error);
      showMessage('Error updating data element status', 'error');
    }
  }

  // Save data element
  async function handleSaveDataElement() {
    // Validate required fields
    if (!dataElementValue.trim()) {
      showMessage('Data Element Value is required', 'error');
      return;
    }

    const finalDataElementName = isCreatingNew ? newDataElementName.trim() : selectedDataElementName;
    
    if (!finalDataElementName) {
      showMessage('Data Element Name is required', 'error');
      return;
    }

    // Split values by comma and trim each value
    const values = dataElementValue.split(',').map(v => v.trim()).filter(v => v.length > 0);
    
    if (values.length === 0) {
      showMessage('At least one valid value is required', 'error');
      return;
    }

    isLoading = true;

    try {
      // Get current user
      const username = localStorage.getItem('username');
      if (!username) {
        showMessage('User session not found', 'error');
        return;
      }

      // Check for existing name-value combinations
      const existingCombinations = await checkExistingCombinations(finalDataElementName, values);
      
      if (existingCombinations.length > 0) {
        const existingValues = existingCombinations.map(combo => combo.de_value).join(', ');
        showMessage(`The following values already exist for "${finalDataElementName}": ${existingValues}`, 'error');
        return;
      }

      // Save multiple values
      await saveMultipleDataElements(finalDataElementName, values, username);

      showMessage(`${values.length} data element(s) saved successfully!`, 'success');
      
      // Reset form
      dataElementValue = '';
      if (isCreatingNew) {
        newDataElementName = '';
        isCreatingNew = false;
      } else {
        selectedDataElementName = '';
      }

      // Reload data element names if we created a new one
      if (isCreatingNew) {
        await loadDataElementNames();
      }

      // Refresh the table
      await loadDataElements();
    } catch (error) {
      console.error('Error saving data element:', error);
      showMessage('Error saving data element', 'error');
    } finally {
      isLoading = false;
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

    console.log('Admin access confirmed, loading data elements');
    await loadDataElementNames();
    await loadDataElements();

    // Load menus
    if (username) {
      menus = await fetchUserMenus(username);
    }
  });
</script>

<svelte:head>
  <title>Data Elements Management</title>
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
    title="Data Elements Management"
    onSidebarToggle={handleSidebarToggle}
  />

  <!-- Message Display -->
  {#if message}
    <div class={`mx-4 mt-4 p-4 rounded-lg ${messageType === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
      {message}
    </div>
  {/if}

  <!-- Main Content - Horizontal Split -->
  <div class="flex flex-1 p-4 gap-6">
    <!-- Left Side - Creation Form -->
    <div class="w-3/10">
      <div class="theme-bg-primary rounded-lg shadow-lg p-6 border theme-border h-full">
        <h3 class="text-lg font-semibold theme-text-primary mb-6">Create New Data Element</h3>
        
        <form on:submit|preventDefault={handleSaveDataElement} class="space-y-6">
          
          <!-- Data Element Name Section -->
          <div class="space-y-4">
            <div>
              <span class="block text-sm font-medium theme-text-primary mb-3">
                Data Element Name *
              </span>
              
              <!-- Radio Button Selection -->
              <div class="space-y-3">
                <div class="flex items-center">
                  <input
                    type="radio"
                    id="useExisting"
                    name="nameType"
                    checked={!isCreatingNew}
                    on:change={() => { isCreatingNew = false; newDataElementName = ''; }}
                    class="mr-3"
                  />
                  <label for="useExisting" class="text-sm font-medium theme-text-primary">
                    Use Existing Data Element Name
                  </label>
                </div>
                
                <div class="flex items-center">
                  <input
                    type="radio"
                    id="createNew"
                    name="nameType"
                    checked={isCreatingNew}
                    on:change={() => { isCreatingNew = true; selectedDataElementName = ''; }}
                    class="mr-3"
                  />
                  <label for="createNew" class="text-sm font-medium theme-text-primary">
                    Create New Data Element Name
                  </label>
                </div>
              </div>
            </div>

            {#if isCreatingNew}
              <!-- New Data Element Name Input -->
              <div>
                <label for="newDataElementName" class="block text-sm font-medium theme-text-primary mb-2">
                  New Data Element Name *
                </label>
                <input
                  id="newDataElementName"
                  type="text"
                  bind:value={newDataElementName}
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter new data element name"
                  required
                />
              </div>
            {:else}
              <!-- Existing Data Element Name Dropdown -->
              <div>
                <label for="dataElementName" class="block text-sm font-medium theme-text-primary mb-2">
                  Select Data Element Name *
                </label>
                <select
                  id="dataElementName"
                  bind:value={selectedDataElementName}
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select a data element name</option>
                  {#each dataElementNames as name}
                    <option value={name}>{name}</option>
                  {/each}
                </select>
              </div>
            {/if}
          </div>

          <!-- Data Element Value -->
          <div>
            <label for="dataElementValue" class="block text-sm font-medium theme-text-primary mb-2">
              Data Element Values * (comma-separated)
            </label>
            <textarea
              id="dataElementValue"
              bind:value={dataElementValue}
              rows="6"
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
              placeholder="Enter values separated by commas (e.g., A, B, C)"
              required
            ></textarea>
          </div>

          <!-- Submit Button -->
          <div class="flex justify-end">
            <Button
              variant="primary"
              size="lg"
              disabled={isLoading}
              on:click={handleSaveDataElement}
            >
              {#if isLoading}
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              {:else}
                Save Data Element
              {/if}
            </Button>
          </div>
        </form>

        <!-- Help Section -->
        <div class="mt-8 pt-6 border-t theme-border">
          <h4 class="text-sm font-semibold theme-text-primary mb-3">How to use this form:</h4>
          <div class="space-y-2 text-xs theme-text-secondary">
            <div class="flex items-start space-x-2">
              <span class="text-blue-500 font-semibold">•</span>
              <span>Select an existing data element name from the dropdown, or click "Create New" to add a new data element name.</span>
            </div>
            <div class="flex items-start space-x-2">
              <span class="text-blue-500 font-semibold">•</span>
              <span>Enter values for the data element in the text area. You can enter multiple values separated by commas (e.g., "A, B, C").</span>
            </div>
            <div class="flex items-start space-x-2">
              <span class="text-blue-500 font-semibold">•</span>
              <span>Each comma-separated value will create a separate record in the database.</span>
            </div>
            <div class="flex items-start space-x-2">
              <span class="text-blue-500 font-semibold">•</span>
              <span>The system will check for existing name-value combinations and prevent duplicates.</span>
            </div>
            <div class="flex items-start space-x-2">
              <span class="text-blue-500 font-semibold">•</span>
              <span>All fields marked with * are required.</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Side - Existing Data Elements -->
    <div class="w-7/10">
      <DataTable
        data={dataElements}
        columns={[
          { key: 'de_name', label: 'Data Element Name', sortable: true, filterable: true, type: 'text' },
          { key: 'de_value', label: 'Value', sortable: true, filterable: true, type: 'text' },
          { key: 'is_active', label: 'Status', sortable: true, filterable: true, type: 'status' }
        ]}
        actions={[
          {
            label: 'Toggle Status',
            icon: Edit,
            onClick: handleToggleStatus
          },
          {
            label: 'Delete',
            icon: Trash2,
            onClick: handleDeleteDataElement
          }
        ]}
        title="Data Elements"
        isLoading={tableLoading}
      />
    </div>
  </div>
</div>

<!-- Floating Theme Toggle -->
<FloatingThemeToggle /> 