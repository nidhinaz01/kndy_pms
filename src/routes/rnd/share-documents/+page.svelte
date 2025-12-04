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

  // Filtered data based on active tab
  // Pending: work orders with at least one stage without document
  // Completed: work orders where all stages have documents
  $: pendingReleases = allDocumentReleases.filter(release => !release.allStagesCompleted);
  $: completedReleases = allDocumentReleases.filter(release => release.allStagesCompleted);

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
    allDocumentReleases = await loadDocumentReleases();
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
          <PendingReleasesTable 
            releases={pendingReleases} 
            onUploadDocuments={handleUploadDocuments}
          />
        {:else if activeTab === 'completed' && completedReleases.length > 0}
          <CompletedReleasesTable 
            releases={completedReleases}
            onViewDocuments={handleUploadDocuments}
          />
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
