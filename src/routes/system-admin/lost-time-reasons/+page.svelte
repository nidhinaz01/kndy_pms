<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { theme } from '$lib/stores/theme';
  import { 
    fetchAllLostTimeReasons, 
    createLostTimeReason, 
    updateLostTimeReason,
    fetchPayableHeads,
    type LostTimeReason,
    type CreateLostTimeReasonData,
    type UpdateLostTimeReasonData
  } from '$lib/api/lostTimeReasons';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import Button from '$lib/components/common/Button.svelte';
  import DataTable from '$lib/components/common/DataTable.svelte';
  import { Edit } from 'lucide-svelte';

  // State management
  let lostTimeReasons: LostTimeReason[] = [];
  let payableHeads: string[] = [];
  let isLoading = false;
  let message = '';
  let messageType: 'success' | 'error' = 'success';
  let showSidebar = false;
  let menus: any[] = [];
  let tableLoading = false;

  // Form data
  let formData: CreateLostTimeReasonData = {
    p_head: 'Non-Payable',
    lost_time_reason: ''
  };

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

  // Load data
  async function loadData() {
    try {
      tableLoading = true;
      const [reasonsData, payableHeadsData] = await Promise.all([
        fetchAllLostTimeReasons(),
        fetchPayableHeads()
      ]);
      
      lostTimeReasons = reasonsData;
      payableHeads = payableHeadsData;
    } catch (error) {
      console.error('Error loading data:', error);
      showMessage('Error loading lost time reasons data', 'error');
    } finally {
      tableLoading = false;
    }
  }

  // Handle toggle status
  async function handleToggleStatus(reason: LostTimeReason) {
    const action = reason.is_active ? 'deactivate' : 'activate';
    const statusText = reason.is_active ? 'deactivate' : 'activate';
    
    if (!confirm(`Are you sure you want to ${statusText} "${reason.lost_time_reason}"?`)) {
      return;
    }

    try {
      const username = localStorage.getItem('username');
      if (!username) {
        showMessage('User session not found', 'error');
        return;
      }

      const updateData: UpdateLostTimeReasonData = {
        is_active: !reason.is_active
      };
      
      await updateLostTimeReason(reason.id, updateData, username);
      await loadData();
      showMessage(`Lost time reason ${statusText}d successfully!`, 'success');
    } catch (error) {
      console.error(`Error ${statusText}ing lost time reason:`, error);
      showMessage(`Error ${statusText}ing lost time reason`, 'error');
    }
  }

  // Save lost time reason
  async function handleSaveLostTimeReason() {
    // Validate required fields
    if (!formData.lost_time_reason.trim()) {
      showMessage('Lost Time Reason is required', 'error');
      return;
    }

    // Check for duplicates
    const duplicate = lostTimeReasons.find(
      reason => reason.lost_time_reason.toLowerCase() === formData.lost_time_reason.toLowerCase()
    );
    
    if (duplicate) {
      showMessage('A lost time reason with this name already exists', 'error');
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

      await createLostTimeReason(formData, username);
      showMessage('Lost time reason created successfully!', 'success');
      
      // Reset form
      formData = {
        p_head: 'Non-Payable',
        lost_time_reason: ''
      };

      // Refresh the table
      await loadData();
    } catch (error) {
      console.error('Error creating lost time reason:', error);
      showMessage('Error creating lost time reason', 'error');
    } finally {
      isLoading = false;
    }
  }

  onMount(async () => {
    // Check if user is admin
    const username = localStorage.getItem('username');
    if (!username || username.toLowerCase() !== 'admin') {
      console.log('User is not admin, redirecting to dashboard');
      window.location.href = '/dashboard';
      return;
    }

    console.log('Admin access confirmed, loading lost time reasons');
    await loadData();

    // Load menus
    if (username) {
      menus = await fetchUserMenus(username);
    }
  });
</script>

<svelte:head>
  <title>Lost Time Reasons Management</title>
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
    title="Lost Time Reasons Management"
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
        <h3 class="text-lg font-semibold theme-text-primary mb-6">Create New Lost Time Reason</h3>
        
        <form on:submit|preventDefault={handleSaveLostTimeReason} class="space-y-6">
          
          <!-- Payable Head -->
          <div>
            <label for="pHead" class="block text-sm font-medium theme-text-primary mb-2">
              Payable Head *
            </label>
            <select
              id="pHead"
              bind:value={formData.p_head}
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="Payable">Payable</option>
              <option value="Non-Payable">Non-Payable</option>
            </select>
          </div>

          <!-- Lost Time Reason -->
          <div>
            <label for="lostTimeReason" class="block text-sm font-medium theme-text-primary mb-2">
              Lost Time Reason *
            </label>
            <input
              id="lostTimeReason"
              type="text"
              bind:value={formData.lost_time_reason}
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Equipment Breakdown"
              required
            />
          </div>

          <!-- Submit Button -->
          <div class="flex justify-end">
            <Button
              variant="primary"
              size="lg"
              disabled={isLoading}
              on:click={handleSaveLostTimeReason}
            >
              {#if isLoading}
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              {:else}
                Save Lost Time Reason
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
              <span>Select whether the lost time reason is "Payable" or "Non-Payable".</span>
            </div>
            <div class="flex items-start space-x-2">
              <span class="text-blue-500 font-semibold">•</span>
              <span>Enter a descriptive name for the lost time reason (e.g., "Equipment Breakdown").</span>
            </div>
            <div class="flex items-start space-x-2">
              <span class="text-blue-500 font-semibold">•</span>
              <span>The system will check for duplicates and prevent creation of existing reasons.</span>
            </div>
            <div class="flex items-start space-x-2">
              <span class="text-blue-500 font-semibold">•</span>
              <span>Once created, reasons cannot be altered - only activated or deactivated.</span>
            </div>
            <div class="flex items-start space-x-2">
              <span class="text-blue-500 font-semibold">•</span>
              <span>All fields marked with * are required.</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Side - Existing Lost Time Reasons -->
    <div class="w-7/10">
      <DataTable
        data={lostTimeReasons}
        columns={[
          { key: 'p_head', label: 'Payable Head', sortable: true, filterable: true, type: 'text' },
          { key: 'lost_time_reason', label: 'Lost Time Reason', sortable: true, filterable: true, type: 'text' },
          { key: 'is_active', label: 'Status', sortable: true, filterable: true, type: 'status' }
        ]}
        actions={[
          {
            label: 'Toggle Status',
            icon: Edit,
            onClick: handleToggleStatus
          }
        ]}
        title="Lost Time Reasons"
        isLoading={tableLoading}
      />
    </div>
  </div>
</div>

<!-- Floating Theme Toggle -->
<FloatingThemeToggle />

