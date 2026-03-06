<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import { loadDocumentReleases } from './services/documentReleaseService';
  import PendingReleasesTable from './components/PendingReleasesTable.svelte';
  import CompletedReleasesTable from './components/CompletedReleasesTable.svelte';
  import DocumentUploadModal from './components/DocumentUploadModal.svelte';

  // Page state
  let isLoading = false;
  let message = '';
  let messageType: 'success' | 'error' = 'success';
  let showSidebar = false;
  let menus: any[] = [];

  // Document release data
  let allDocumentReleases: any[] = [];
  let showDocumentUploadModal = false;
  let selectedWorkOrder: any = null;
  
  // Tab state
  let activeTab = 'pending';
  
  // Search state
  let searchQuery = '';

  // Filtered data based on active tab
  // Pending: work orders with at least one pending document
  // Completed: work orders where all documents are uploaded or not required
  $: pendingReleases = allDocumentReleases.filter(release => release.hasPendingDocuments);
  $: completedReleases = allDocumentReleases.filter(release => release.allDocumentsCompleted);
  
  // Filter releases based on search query - explicitly reactive
  $: filteredPendingReleases = (() => {
    if (!searchQuery.trim()) {
      return pendingReleases;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return pendingReleases.filter(release => {
      const woNo = (release.wo_no || '').toLowerCase();
      const pwoNo = (release.pwo_no || '').toLowerCase();
      const model = (release.wo_model || '').toLowerCase();
      const customer = (release.customer_name || '').toLowerCase();
      
      return woNo.includes(query) || 
             pwoNo.includes(query) || 
             model.includes(query) || 
             customer.includes(query);
    });
  })();
  
  $: filteredCompletedReleases = (() => {
    if (!searchQuery.trim()) {
      return completedReleases;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return completedReleases.filter(release => {
      const woNo = (release.wo_no || '').toLowerCase();
      const pwoNo = (release.pwo_no || '').toLowerCase();
      const model = (release.wo_model || '').toLowerCase();
      const customer = (release.customer_name || '').toLowerCase();
      
      return woNo.includes(query) || 
             pwoNo.includes(query) || 
             model.includes(query) || 
             customer.includes(query);
    });
  })();

  onMount(async () => {
    const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
    if (username) {
      menus = await fetchUserMenus(username);
    }
    await loadDocumentReleasesData();
  });

  function showMessage(msg: string, type: 'success' | 'error' = 'success') {
    message = msg;
    messageType = type;
    setTimeout(() => message = '', 5000);
  }

  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }

  async function loadDocumentReleasesData() {
    try {
      isLoading = true;
      allDocumentReleases = await loadDocumentReleases();
    } catch (error) {
      console.error('Error loading document releases:', error);
      showMessage('Failed to load document releases', 'error');
    } finally {
      isLoading = false;
    }
  }

  function handleUploadDocuments(workOrder: any) {
    selectedWorkOrder = workOrder;
    showDocumentUploadModal = true;
  }

  async function handleDocumentUploaded() {
    showMessage('Document uploaded successfully');
    await loadDocumentReleasesData();
  }

  async function handleDocumentDeleted() {
    showMessage('Document deleted successfully');
    await loadDocumentReleasesData();
  }

  function handleCloseUploadModal() {
    showDocumentUploadModal = false;
    selectedWorkOrder = null;
  }

  function handleTabChange(tabId: string) {
    activeTab = tabId;
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

          <!-- Search Bar -->
          <div class="mb-6">
            <div class="relative">
              <input
                type="text"
                placeholder="Search by Work Order, PWO Number, Model, or Customer..."
                bind:value={searchQuery}
                class="w-full px-4 py-2 pl-10 pr-4 theme-bg-secondary theme-text-primary theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-5 w-5 theme-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {#if searchQuery}
                <button
                  on:click={() => searchQuery = ''}
                  class="absolute inset-y-0 right-0 pr-3 flex items-center theme-text-secondary hover:theme-text-primary"
                  aria-label="Clear search"
                >
                  <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              {/if}
            </div>
            {#if searchQuery}
              <p class="text-sm theme-text-secondary mt-2">
                Showing {activeTab === 'pending' ? filteredPendingReleases.length : filteredCompletedReleases.length} of {activeTab === 'pending' ? pendingReleases.length : completedReleases.length} {activeTab === 'pending' ? 'pending' : 'completed'} releases
              </p>
            {/if}
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
        {#if activeTab === 'pending' && filteredPendingReleases.length > 0}
          <PendingReleasesTable 
            releases={filteredPendingReleases} 
            onUploadDocuments={handleUploadDocuments}
          />
        {:else if activeTab === 'completed' && filteredCompletedReleases.length > 0}
          <CompletedReleasesTable 
            releases={filteredCompletedReleases}
            onViewDocuments={handleUploadDocuments}
          />
        {:else}
          <div class="theme-bg-primary rounded-lg shadow-lg p-6 mb-6">
            <div class="text-center py-8">
              <p class="text-lg theme-text-secondary mb-4">
                {#if searchQuery}
                  No releases found matching "{searchQuery}"
                {:else if activeTab === 'pending'}
                  No pending document releases
                {:else}
                  No completed document releases
                {/if}
              </p>
              <p class="text-sm theme-text-tertiary">
                {#if searchQuery}
                  Try adjusting your search terms
                {:else if activeTab === 'pending'}
                  All document releases are up to date
                {:else}
                  Complete some document releases to see them here
                {/if}
              </p>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<!-- Document Upload Modal -->
<DocumentUploadModal
  bind:showModal={showDocumentUploadModal}
  workOrder={selectedWorkOrder}
  on:document-uploaded={handleDocumentUploaded}
  on:document-deleted={handleDocumentDeleted}
  on:close={handleCloseUploadModal}
/>

<!-- Floating Theme Toggle -->
<FloatingThemeToggle />
