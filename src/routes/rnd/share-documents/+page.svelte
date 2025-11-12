<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import { supabase } from '$lib/supabaseClient';

  // Page state
  let isLoading = false;
  let message = '';
  let messageType: 'success' | 'error' = 'success';
  let showSidebar = false;
  let menus: any[] = [];

  // Document release data
  let allDocumentReleases: any[] = [];
  let showDocumentReleaseModal = false;
  let selectedWorkOrder: any = null;
  let documentSubmissionDate = '';
  
  // Tab state
  let activeTab = 'pending';

  // Get current user
  $: currentUser = $page.data.session?.user?.email || (typeof window !== 'undefined' ? localStorage.getItem('username') : null) || 'Unknown User';

  // Filtered data based on active tab
  $: pendingReleases = allDocumentReleases.filter(release => !release.actual_date);
  $: completedReleases = allDocumentReleases.filter(release => release.actual_date);

  onMount(async () => {
    const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
    if (username) {
      menus = await fetchUserMenus(username);
    }
    await loadDocumentReleases();
  });

  function showMessage(msg: string, type: 'success' | 'error' = 'success') {
    message = msg;
    messageType = type;
    setTimeout(() => message = '', 5000);
  }

  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit'
    });
  }

  async function loadDocumentReleases() {
    try {
      // Get work orders that have planned document release dates (both pending and completed)
      const { data, error } = await supabase
        .from('prdn_dates')
        .select(`
          *,
          prdn_wo_details!inner(
            id,
            wo_no,
            pwo_no,
            wo_model,
            customer_name,
            wo_date
          )
        `)
        .eq('date_type', 'rnd_documents')
        .not('planned_date', 'is', null)
        .order('planned_date', { ascending: true });

      if (error) {
        console.error('Database error loading document releases:', error);
        allDocumentReleases = [];
        return;
      }
      allDocumentReleases = data || [];
    } catch (error) {
      console.error('Error loading document releases:', error);
      allDocumentReleases = [];
    }
  }

  function handleRecordDocumentSubmission(workOrder: any) {
    selectedWorkOrder = workOrder;
    documentSubmissionDate = new Date().toISOString().split('T')[0]; // Today's date as default
    showDocumentReleaseModal = true;
  }

  async function handleDocumentSubmission() {
    if (!documentSubmissionDate) {
      showMessage('Please select a submission date', 'error');
      return;
    }

    try {
      isLoading = true;
      const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
      const now = new Date().toISOString();

      // Update prdn_dates with actual document release date
      const { error } = await supabase
        .from('prdn_dates')
        .update({
          actual_date: documentSubmissionDate,
          modified_by: username,
          modified_dt: now
        })
        .eq('sales_order_id', selectedWorkOrder.prdn_wo_details.id)
        .eq('date_type', 'rnd_documents');

      if (error) throw error;

      showMessage('Document submission recorded successfully');
      showDocumentReleaseModal = false;
      selectedWorkOrder = null;
      documentSubmissionDate = '';
      await loadDocumentReleases();
    } catch (error) {
      showMessage('Error recording document submission', 'error');
      console.error('Error recording document submission:', error);
    } finally {
      isLoading = false;
    }
  }

  function handleCancelDocumentSubmission() {
    showDocumentReleaseModal = false;
    selectedWorkOrder = null;
    documentSubmissionDate = '';
  }

  function handleTabChange(tabId: string) {
    activeTab = tabId;
  }

  function getDateDifference(plannedDate: string, actualDate: string | null): number {
    if (!actualDate) return 0;
    const planned = new Date(plannedDate);
    const actual = new Date(actualDate);
    const diffTime = actual.getTime() - planned.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  function getDateColor(daysDiff: number): string {
    if (daysDiff === 0) return 'text-green-600';
    if (daysDiff <= 2) return 'text-yellow-600';
    if (daysDiff <= 5) return 'text-orange-600';
    return 'text-red-600';
  }

  function getRowBackgroundColor(daysDiff: number): string {
    if (daysDiff === 0) return 'on-time';
    if (daysDiff <= 2) return 'slight-delay';
    if (daysDiff <= 5) return 'moderate-delay';
    return 'significant-delay';
  }
</script>

<svelte:head>
  <title>R&D Document Sharing - Document Management</title>
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
    title="R&D Document Sharing"
    onSidebarToggle={handleSidebarToggle}
  />

  <!-- Message Display -->
  {#if message}
    <div class="p-4 {messageType === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} rounded-lg mx-4 mt-4">
      {message}
    </div>
  {/if}

  <!-- Main Content -->
  <div class="flex-1 p-6">
    {#if isLoading}
      <div class="flex items-center justify-center h-64">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 theme-accent mx-auto mb-4"></div>
          <p class="theme-text-primary">Loading documents...</p>
        </div>
      </div>
    {:else}
      <div class="max-w-7xl mx-auto">
        <!-- Tab Navigation -->
        <div class="theme-bg-primary rounded-lg shadow-lg p-6 mb-6">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-semibold theme-text-primary">
              Document Release Status
            </h2>
            </div>

          <nav class="flex space-x-8">
            <button
              class="py-2 px-3 font-medium text-sm transition-colors duration-200 rounded-lg {activeTab === 'pending' 
                ? 'border-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-sm' 
                : 'border-2 border-transparent theme-text-secondary hover:theme-text-primary hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/20'}"
              on:click={() => handleTabChange('pending')}
            >
              📋 Pending ({pendingReleases.length})
            </button>
            <button
              class="py-2 px-3 font-medium text-sm transition-colors duration-200 rounded-lg {activeTab === 'completed' 
                ? 'border-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-sm' 
                : 'border-2 border-transparent theme-text-secondary hover:theme-text-primary hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/20'}"
              on:click={() => handleTabChange('completed')}
            >
              ✅ Completed ({completedReleases.length})
            </button>
          </nav>
        </div>

        <!-- Tab Content -->
        {#if activeTab === 'pending' && pendingReleases.length > 0}
        <div class="theme-bg-primary rounded-lg shadow-lg p-6 mb-6">
          <div class="flex items-center justify-between mb-6">
              <h3 class="text-lg font-semibold theme-text-primary">
                Pending Document Releases ({pendingReleases.length})
              </h3>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full border-collapse theme-border">
                <thead>
                  <tr class="theme-bg-secondary">
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Work Order
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      PWO Number
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Model
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Customer
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Planned Release Date
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Actual Release Date
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Status
                    </th>
                    <th class="px-4 py-3 text-center font-medium theme-text-primary border theme-border">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {#each pendingReleases as release}
                    <tr class="hover:theme-bg-secondary transition-colors">
                      <td class="px-4 py-3 font-medium theme-text-primary border theme-border">
                        {release.prdn_wo_details.wo_no}
                      </td>
                      <td class="px-4 py-3 theme-text-primary border theme-border">
                        {release.prdn_wo_details.pwo_no || 'N/A'}
                      </td>
                      <td class="px-4 py-3 theme-text-primary border theme-border">
                        {release.prdn_wo_details.wo_model}
                      </td>
                      <td class="px-4 py-3 theme-text-primary border theme-border">
                        {release.prdn_wo_details.customer_name || 'N/A'}
                      </td>
                      <td class="px-4 py-3 theme-text-primary border theme-border">
                        {formatDate(release.planned_date)}
                      </td>
                      <td class="px-4 py-3 border theme-border">
                        <span class="text-gray-500">Not submitted</span>
                      </td>
                      <td class="px-4 py-3 border theme-border">
                        <span class="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full text-xs">
                          Pending
                        </span>
                      </td>
                      <td class="px-4 py-3 text-center border theme-border">
              <Button
                variant="primary"
                          on:click={() => handleRecordDocumentSubmission(release)}
              >
                          📄 Record Submission
              </Button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
          </div>

                      </div>
        {:else if activeTab === 'completed' && completedReleases.length > 0}
          <div class="theme-bg-primary rounded-lg shadow-lg p-6 mb-6">
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-lg font-semibold theme-text-primary">
                Completed Document Releases ({completedReleases.length})
              </h3>
                      </div>

            <div class="overflow-x-auto">
              <table class="w-full border-collapse theme-border">
                <thead>
                  <tr class="theme-bg-secondary">
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Work Order
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      PWO Number
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Model
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Customer
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Planned Release Date
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Actual Release Date
                    </th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary border theme-border">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {#each completedReleases as release}
                    {@const daysDiff = getDateDifference(release.planned_date, release.actual_date)}
                    {@const rowBgClass = getRowBackgroundColor(daysDiff)}
                    <tr class="hover:theme-bg-secondary transition-colors" class:on-time={rowBgClass === 'on-time'} class:slight-delay={rowBgClass === 'slight-delay'} class:moderate-delay={rowBgClass === 'moderate-delay'} class:significant-delay={rowBgClass === 'significant-delay'}>
                      <td class="px-4 py-3 font-medium border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {release.prdn_wo_details.wo_no}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {release.prdn_wo_details.pwo_no || 'N/A'}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {release.prdn_wo_details.wo_model}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {release.prdn_wo_details.customer_name || 'N/A'}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {formatDate(release.planned_date)}
                      </td>
                      <td class="px-4 py-3 border theme-border">
                        <span class="{getDateColor(daysDiff)}">
                          {formatDate(release.actual_date)}
                            </span>
                        {#if daysDiff !== 0}
                          <div class="text-xs {getDateColor(daysDiff)}">
                            ({daysDiff > 0 ? '+' : ''}{daysDiff} days)
                        </div>
                      {/if}
                      </td>
                      <td class="px-4 py-3 border theme-border">
                        <span class="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full text-xs">
                          Completed
                        </span>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
                    </div>

            <!-- Date Comparison Legend -->
            <div class="mt-4 p-4 theme-bg-secondary rounded-lg">
              <h3 class="text-sm font-medium theme-text-primary mb-3">Date Comparison Legend:</h3>
              <div class="flex flex-wrap gap-4 text-sm">
                <div class="flex items-center gap-2">
                  <div class="w-3 h-3 bg-green-600 rounded"></div>
                  <span class="theme-text-primary">On Time (0 days)</span>
                </div>
                <div class="flex items-center gap-2">
                  <div class="w-3 h-3 bg-yellow-600 rounded"></div>
                  <span class="theme-text-primary">Slight Delay (1-2 days)</span>
                </div>
                <div class="flex items-center gap-2">
                  <div class="w-3 h-3 bg-orange-600 rounded"></div>
                  <span class="theme-text-primary">Moderate Delay (3-5 days)</span>
                </div>
                <div class="flex items-center gap-2">
                  <div class="w-3 h-3 bg-red-600 rounded"></div>
                  <span class="theme-text-primary">Significant Delay (5+ days)</span>
                    </div>
                  </div>
                </div>
            </div>
          {:else}
          <div class="theme-bg-primary rounded-lg shadow-lg p-6 mb-6">
            <div class="text-center py-8">
              <p class="text-lg theme-text-secondary mb-4">
                {activeTab === 'pending' ? 'No pending document releases' : 'No completed document releases'}
              </p>
              <p class="text-sm theme-text-tertiary">
                {activeTab === 'pending' ? 'All document releases are up to date' : 'Complete some document releases to see them here'}
              </p>
            </div>
          </div>
              {/if}
            </div>
          {/if}
  </div>
        </div>

<!-- Document Submission Modal -->
{#if showDocumentReleaseModal}
          <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="theme-bg-primary rounded-lg shadow-xl p-6 w-full max-w-md">
              <h2 class="text-xl font-semibold theme-text-primary mb-6">
        Record Document Submission
              </h2>

      {#if selectedWorkOrder}
        <div class="mb-6 p-4 theme-bg-secondary rounded-lg">
          <h3 class="font-medium theme-text-primary mb-2">Work Order Details:</h3>
          <p class="text-sm theme-text-secondary"><strong>WO No:</strong> {selectedWorkOrder.prdn_wo_details.wo_no}</p>
          <p class="text-sm theme-text-secondary"><strong>Model:</strong> {selectedWorkOrder.prdn_wo_details.wo_model}</p>
          <p class="text-sm theme-text-secondary"><strong>Customer:</strong> {selectedWorkOrder.prdn_wo_details.customer_name || 'N/A'}</p>
          <p class="text-sm theme-text-secondary"><strong>Planned Release:</strong> {formatDate(selectedWorkOrder.planned_date)}</p>
        </div>
      {/if}

      <form on:submit|preventDefault={handleDocumentSubmission} class="space-y-6">
        <!-- Submission Date -->
                <div>
          <label for="submissionDate" class="block text-sm font-medium theme-text-primary mb-2">
            Document Submission Date *
                  </label>
                  <input
            id="submissionDate"
            type="date"
            bind:value={documentSubmissionDate}
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <!-- Action Buttons -->
                <div class="flex justify-end gap-3 pt-4">
                  <Button
                    variant="secondary"
            on:click={handleCancelDocumentSubmission}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    disabled={isLoading}
                  >
                    {#if isLoading}
                      <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
              Recording...
                    {:else}
              Record Submission
                    {/if}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        {/if}

<!-- Floating Theme Toggle -->
<FloatingThemeToggle />

<style>
  /* Row highlighting styles for document release status */
  tr.on-time {
    background-color: #f0fdf4;
    border-left: 4px solid #22c55e;
  }
  
  tr.slight-delay {
    background-color: #fefce8;
    border-left: 4px solid #eab308;
  }
  
  tr.moderate-delay {
    background-color: #fff7ed;
    border-left: 4px solid #f97316;
  }
  
  tr.significant-delay {
    background-color: #fef2f2;
    border-left: 4px solid #ef4444;
  }
  
  /* Dark mode support */
  :global(.dark) tr.on-time {
    background-color: rgba(34, 197, 94, 0.2);
    border-left: 4px solid #22c55e;
  }
  
  :global(.dark) tr.on-time td,
  :global(.dark) tr.on-time td * {
    color: #1f2937 !important;
  }
  
  :global(.dark) tr.slight-delay {
    background-color: rgba(234, 179, 8, 0.2);
    border-left: 4px solid #eab308;
  }
  
  :global(.dark) tr.slight-delay td,
  :global(.dark) tr.slight-delay td * {
    color: #1f2937 !important;
  }
  
  :global(.dark) tr.moderate-delay {
    background-color: rgba(249, 115, 22, 0.2);
    border-left: 4px solid #f97316;
  }
  
  :global(.dark) tr.moderate-delay td,
  :global(.dark) tr.moderate-delay td * {
    color: #1f2937 !important;
  }
  
  :global(.dark) tr.significant-delay {
    background-color: rgba(239, 68, 68, 0.2);
    border-left: 4px solid #ef4444;
  }
  
  :global(.dark) tr.significant-delay td,
  :global(.dark) tr.significant-delay td * {
    color: #1f2937 !important;
  }
</style>
