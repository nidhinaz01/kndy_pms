<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { theme } from '$lib/stores/theme';
  import { fetchDataElementNames, saveDataElement, saveMultipleDataElements, checkExistingCombinations, fetchDataElements, deleteDataElement } from '$lib/api/dataElements';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import { fetchUserMenus } from '$lib/api/menu';
  import Button from '$lib/components/common/Button.svelte';
  import AdvancedDataTable from '$lib/components/common/AdvancedDataTable.svelte';
  import { sanitizeString, isValidTrimmedString } from '$lib/utils/inputSanitization';

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

      // Initialize data table when data is available
      // The AdvancedDataTable component handles its own initialization and updates
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
      await deleteDataElement(element.id);
      await loadDataElements();
      showMessage('Data element deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting data element:', error);
      showMessage('Error deleting data element', 'error');
    }
  }

  // Save data element
  async function handleSaveDataElement() {
    // Sanitize and validate required fields
    const sanitizedDataElementValue = sanitizeString(dataElementValue);
    const sanitizedNewDataElementName = sanitizeString(newDataElementName);
    
    if (!isValidTrimmedString(sanitizedDataElementValue)) {
      showMessage('Data Element Value is required', 'error');
      return;
    }

    const finalDataElementName = isCreatingNew ? sanitizedNewDataElementName : selectedDataElementName;
    
    if (!finalDataElementName) {
      showMessage('Data Element Name is required', 'error');
      return;
    }

    // Split values by comma and trim each value
    const values = sanitizedDataElementValue.split(',').map(v => sanitizeString(v)).filter(v => v.length > 0);
    
    if (values.length === 0) {
      showMessage('At least one valid value is required', 'error');
      return;
    }

    isLoading = true;

    try {
      // Get current user
      const session = await supabase.auth.getSession();
      const user = session.data.session?.user;
      
      if (!user?.email) {
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
      await saveMultipleDataElements(finalDataElementName, values, user.email);

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

  // Update search when it changes
  $: if (dataElements) {
    // The AdvancedDataTable component handles its own search logic
  }



  // Svelte reactive sorting and filtering
  $: sortedData = (() => {
    if (!dataElements || dataElements.length === 0) return [];
    
    let data = [...dataElements];
    
    // Apply search filter
    // The AdvancedDataTable component handles its own search logic
    
    // Apply column filters
    // The AdvancedDataTable component handles its own filter logic
    
    // Apply sorting
    // The AdvancedDataTable component handles its own sorting logic
    
    return data;
  })();

  function handleSort(column: string) {
    // The AdvancedDataTable component handles its own sorting logic
  }





  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }

  onMount(async () => {
    // Check if user is admin
    const session = await supabase.auth.getSession();
    const user = session.data.session?.user;
    
    if (!user) {
      window.location.href = '/login';
      return;
    }

    // Check if user is admin
    const { data: userData, error } = await supabase
      .from('app_users')
      .select('username')
      .eq('email', user.email)
      .maybeSingle();

    if (error || !userData || userData.username !== 'admin') {
      console.log('User is not admin, redirecting to dashboard');
      window.location.href = '/dashboard';
      return;
    }

    console.log('Admin access confirmed, loading data elements');
    await loadDataElementNames();
    await loadDataElements();

    // Load menus
    const username = localStorage.getItem('username');
    if (username) {
      menus = await fetchUserMenus();
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
              type="submit"
              variant="primary"
              size="lg"
              disabled={isLoading}
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
      <AdvancedDataTable
        data={dataElements}
        columns={[
          { key: 'de_name', label: 'Data Element Name', sortable: true, filterable: true, type: 'text' },
          { key: 'de_value', label: 'Value', sortable: true, filterable: true, type: 'text' },
          { key: 'modified_by', label: 'Created By', sortable: true, filterable: true, type: 'text' },
          { key: 'modified_dt', label: 'Created Date', sortable: true, filterable: true, type: 'date' }
        ]}
        actions={[
          {
            label: 'Delete',
            icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />',
            onClick: handleDeleteDataElement,
            color: 'red'
          }
        ]}
        title="Data Elements"
        isLoading={tableLoading}
        exportFileName="data_elements_export.csv"
      />
    </div>
  </div>
</div>

<!-- Floating Theme Toggle -->
<FloatingThemeToggle /> 