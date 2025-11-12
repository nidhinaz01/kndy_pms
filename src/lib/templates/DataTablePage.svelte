<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';

  // Props that child components must provide
  export let pageTitle: string;
  export let isLoading: boolean;
  export let isTableLoading: boolean;
  export let tableData: any[];
  export let selectedRow: any;
  export let showAddModal: boolean;
  export let showSidebar: boolean;
  export let expandTable: boolean = false;
  export let showStats: boolean = false;
  export let statsComponent: any = null;
  export let periodModalComponent: any = null;
  export let showPeriodModal: boolean = false;
  export let tableComponentProps: any = {};
  export let headerComponentProps: any = {};

  // Event handlers that child components must provide
  export let onSidebarToggle: () => void;
  export let onRowSelect: (row: any) => void;
  export let onCloseRowDetails: () => void;
  export let onAddItem: () => void;
  export let onCloseAddModal: () => void;
  export let onItemAdded: () => void;
  export let onDeleteSelected: (selectedIds: string[]) => void;
  export let onEditModel: ((model: any) => void) | null = null;
  export let onExpandToggle: (() => void) | null = null;
  export let onPeriodClick: (() => void) | null = null;
  export let onStatusUpdated: (() => void) | null = null;
  export let onImportClick: (() => void) | null = null;
  export let onCloseImportModal: (() => void) | null = null;
  export let onImportSuccess: (() => void) | null = null;

  // Components that child components must provide
  export let headerComponent: any = null;
  export let tableComponent: any;
  export let addModalComponent: any;
  export let rowDetailsModalComponent: any;
  export let importModalComponent: any = null;
  export let showImportModal: boolean = false;

  // State
  let menus: any[] = [];

  onMount(async () => {
    // Load menus in background without blocking the UI
    const username = localStorage.getItem('username') || 'admin';
    fetchUserMenus(username).then(menuData => {
      menus = menuData;
    }).catch(error => {
      console.error('Failed to load menus:', error);
    });
  });
</script>

<!-- Loading State -->
{#if isLoading}
  <div class="flex items-center justify-center h-screen theme-bg-secondary">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 theme-accent mx-auto mb-4"></div>
      <p class="theme-text-primary">Loading {pageTitle}...</p>
    </div>
  </div>
{:else}
  <!-- Sidebar Overlay -->
  {#if showSidebar}
    <div class="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close sidebar overlay"
        class="fixed inset-0 bg-black bg-opacity-40 z-40"
        on:click={() => onSidebarToggle()}
        tabindex="0"
        on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && onSidebarToggle()}
        style="cursor: pointer; border: none; width: 100%; height: 100%; position: fixed; left: 0; top: 0; background-color: rgba(0,0,0,0.4);"
      ></button>
      <div class="fixed left-0 top-0 h-full w-64 z-50 theme-bg-primary shadow-lg">
        <Sidebar {menus} />
      </div>
    </div>
  {/if}

  <div class="flex flex-col h-full w-full theme-bg-secondary p-4 transition-colors duration-200" style="min-height: 100vh;">
    <!-- Header -->
    {#if headerComponent}
      <div class={`mb-4 ${expandTable ? 'hidden' : ''}`}>  
        <svelte:component 
          this={headerComponent} 
          {showSidebar}
          {expandTable}
          onSidebarToggle={onSidebarToggle}
          onAddItem={onAddItem}
          onAddModel={onAddItem}
          onExpandToggle={onExpandToggle}
          onPeriodClick={onPeriodClick}
          onImportClick={onImportClick}
          onCloseImportModal={onCloseImportModal}
          onImportSuccess={onImportSuccess}
          {...headerComponentProps}
        />
      </div>
    {/if}

    <!-- Statistics (optional) -->
    {#if showStats && statsComponent}
      <svelte:component 
        this={statsComponent} 
        {expandTable}
      />
    {/if}

    <!-- Period Modal (optional) -->
    {#if periodModalComponent && showPeriodModal}
      <svelte:component 
        this={periodModalComponent} 
        {showPeriodModal}
        onCloseModal={() => showPeriodModal = false}
      />
    {/if}

    <!-- Table -->
    <svelte:component 
      this={tableComponent} 
      {tableData}
      {selectedRow}
      {isTableLoading}
      {expandTable}
      onRowSelect={onRowSelect}
      onDeleteSelected={onDeleteSelected}
      onEditModel={onEditModel}
      onExpandToggle={onExpandToggle}
      onStatusUpdated={onStatusUpdated}
      {...tableComponentProps}
    />

    <!-- Add Modal -->
    <svelte:component 
      this={addModalComponent} 
      {showAddModal}
      onClose={onCloseAddModal}
      onItemAdded={onItemAdded}
      onModelAdded={onItemAdded}
    />

    <!-- Import Modal -->
    {#if importModalComponent && showImportModal}
      <svelte:component 
        this={importModalComponent} 
        {showImportModal}
        onClose={onCloseImportModal}
        onImportSuccess={onImportSuccess}
      />
    {/if}

    <!-- Row Details Modal -->
    <svelte:component 
      this={rowDetailsModalComponent} 
      {selectedRow}
      onClose={onCloseRowDetails}
    />
  </div>
{/if}

<!-- Floating Theme Toggle -->
<FloatingThemeToggle />

<style>
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fade-in 0.2s ease;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .animate-spin {
    animation: spin 1s linear infinite;
  }
</style> 