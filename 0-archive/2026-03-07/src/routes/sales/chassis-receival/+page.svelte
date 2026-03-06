<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import { loadWorkOrders, loadTemplates } from './services/chassisReceivalService';
  import { checkExistingInspection, loadTemplate, saveInspectionProgress, completeInspection } from './services/inspectionService';
  import { validateInspectionForm } from './utils/chassisReceivalUtils';
  import TemplateSelectionModal from './components/TemplateSelectionModal.svelte';
  import InspectionModal from './components/InspectionModal.svelte';
  import PendingWorkOrdersTable from './components/PendingWorkOrdersTable.svelte';
  import CompletedWorkOrdersTable from './components/CompletedWorkOrdersTable.svelte';

  // Page state
  let isLoading = true;
  let showSidebar = false;
  let menus: any[] = [];

  // Data
  let allWorkOrders: any[] = [];
  let templates: any[] = [];
  let selectedWorkOrder: any = null;
  let selectedTemplate: any = null;
  let showTemplateModal = false;
  let showInspectionModal = false;
  
  // Tab state
  let activeTab = 'pending';

  // Forms
  let inspectionForm = {
    inspection_date: new Date().toISOString().split('T')[0],
    inspector_name: '',
    inspection_notes: '',
    field_responses: {}
  };

  // Field responses
  let fieldResponses: Record<string, any> = {};
  
  // Inspection state
  let existingInspection: any = null;
  let isResumingInspection = false;

  // Filtered data based on active tab
  $: pendingWorkOrders = allWorkOrders.filter(wo => !wo.chassisArrival?.actual_date);
  $: completedWorkOrders = allWorkOrders.filter(wo => wo.chassisArrival?.actual_date);

  onMount(async () => {
    const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
    if (username) {
      menus = await fetchUserMenus(username);
      inspectionForm.inspector_name = username;
    }
    await loadData();
    isLoading = false;
  });

  async function loadData() {
    try {
      const [workOrders, templateData] = await Promise.all([
        loadWorkOrders(),
        loadTemplates()
      ]);
      allWorkOrders = workOrders;
      templates = templateData;
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  async function handleStartInspection(workOrder: any) {
    selectedWorkOrder = workOrder;
    
    // Check if there's an ongoing inspection for this work order
    const inspection = await checkExistingInspection(workOrder.id);

    if (inspection) {
      // Resume existing inspection
      existingInspection = inspection;
      isResumingInspection = true;
      
      // Load the template
      selectedTemplate = await loadTemplate(inspection.template_id);
      
      // Restore form data
      inspectionForm = {
        inspection_date: inspection.inspection_date,
        inspector_name: inspection.inspector_name,
        inspection_notes: inspection.inspection_notes || '',
        field_responses: inspection.field_responses || {}
      };
      
      // Restore field responses
      fieldResponses = inspection.field_responses || {};
      
      showInspectionModal = true;
    } else {
      // Start new inspection
      existingInspection = null;
      isResumingInspection = false;
      showTemplateModal = true;
    }
  }

  function handleTemplateSelect(event: CustomEvent) {
    const template = event.detail;
    selectedTemplate = template;
    showTemplateModal = false;
    
    // Reset inspection state for new inspection
    existingInspection = null;
    isResumingInspection = false;
    
    // Initialize field responses
    fieldResponses = {};
    template.sys_chassis_receival_template_fields?.forEach((field: any) => {
      fieldResponses[field.field_name] = '';
    });
    
    showInspectionModal = true;
  }

  async function handleSaveProgress() {
    try {
      // Basic validation for save progress (less strict than completion)
      if (!inspectionForm.inspection_date) {
        alert('Please select an inspection date before saving progress.');
        return;
      }
      if (!inspectionForm.inspector_name?.trim()) {
        alert('Please enter inspector name before saving progress.');
        return;
      }

      const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;

      await saveInspectionProgress(
        selectedWorkOrder.id,
        selectedTemplate.id,
        inspectionForm,
        fieldResponses,
        existingInspection,
        username
      );

      // Refresh data
      await loadData();
      
      // Close modals
      showInspectionModal = false;
      selectedWorkOrder = null;
      selectedTemplate = null;
      existingInspection = null;
      isResumingInspection = false;
      
      alert('Inspection progress saved successfully! You can continue later.');
    } catch (error) {
      console.error('Error saving progress:', error);
      alert('Error saving progress. Please try again.');
    }
  }

  async function handleCompleteInspection() {
    try {
      // Validate mandatory fields before completion
      const validationErrors = validateInspectionForm(
        inspectionForm,
        selectedTemplate,
        fieldResponses
      );
      
      if (validationErrors.length > 0) {
        alert(`Please fill in all mandatory fields:\n${validationErrors.join('\n')}`);
        return;
      }

      const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;

      await completeInspection(
        selectedWorkOrder.id,
        selectedTemplate.id,
        inspectionForm,
        fieldResponses,
        existingInspection,
        username
      );

      // Refresh data
      await loadData();
      
      // Close modals
      showInspectionModal = false;
      selectedWorkOrder = null;
      selectedTemplate = null;
      existingInspection = null;
      isResumingInspection = false;
      
      alert('Chassis receival inspection completed successfully!');
    } catch (error) {
      console.error('Error completing inspection:', error);
      alert('Error completing inspection. Please try again.');
    }
  }

  function handleTabChange(tabId: string) {
    activeTab = tabId;
  }
</script>

<svelte:head>
  <title>Chassis Receival - Sales</title>
</svelte:head>

<!-- Sidebar Overlay -->
{#if showSidebar}
  <div class="fixed inset-0 z-50">
    <button
      type="button"
      aria-label="Close sidebar overlay"
      class="fixed inset-0 bg-black bg-opacity-40 z-40"
      on:click={() => showSidebar = false}
      tabindex="0"
      on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && (showSidebar = false)}
    ></button>
    <div class="fixed left-0 top-0 h-full w-64 z-50 theme-bg-primary shadow-lg">
      <Sidebar {menus} />
    </div>
  </div>
{/if}

<div class="min-h-screen theme-bg-primary">
  <!-- Header -->
  <div class="theme-bg-primary shadow-sm border-b theme-border">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between py-4">
        <!-- Burger Menu -->
        <button 
          class="p-2 rounded hover:theme-bg-tertiary focus:outline-none transition-colors duration-200" 
          on:click={() => showSidebar = !showSidebar} 
          aria-label="Show sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 theme-text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <!-- Page Title -->
        <h1 class="text-2xl font-bold theme-text-primary">Chassis Receival</h1>

        <!-- Favicon -->
        <button
          on:click={() => goto('/dashboard')}
          class="flex items-center hover:opacity-80 transition-opacity cursor-pointer"
          aria-label="Go to dashboard"
        >
          <img src="/favicon.png" alt="Company Logo" class="h-8 w-auto" />
        </button>
      </div>
    </div>
  </div>

  <!-- Main Content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    {#if isLoading}
      <div class="flex items-center justify-center h-64">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 theme-accent mx-auto mb-4"></div>
          <p class="theme-text-primary">Loading work orders...</p>
        </div>
      </div>
    {:else}
      <!-- Tab Navigation -->
      <div class="theme-bg-primary rounded-lg shadow-lg p-6 mb-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold theme-text-primary">
            Chassis Receival Status
          </h2>
        </div>
        
        <nav class="flex space-x-8">
          <button
            class="py-2 px-3 font-medium text-sm transition-colors duration-200 rounded-lg {activeTab === 'pending' 
              ? 'border-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-sm' 
              : 'border-2 border-transparent theme-text-secondary hover:theme-text-primary hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/20'}"
            on:click={() => handleTabChange('pending')}
          >
            📋 Pending ({pendingWorkOrders.length})
          </button>
          <button
            class="py-2 px-3 font-medium text-sm transition-colors duration-200 rounded-lg {activeTab === 'completed' 
              ? 'border-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-sm' 
              : 'border-2 border-transparent theme-text-secondary hover:theme-text-primary hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/20'}"
            on:click={() => handleTabChange('completed')}
          >
            ✅ Completed ({completedWorkOrders.length})
          </button>
        </nav>
      </div>

      <!-- Tab Content -->
      {#if activeTab === 'pending'}
        <PendingWorkOrdersTable 
          workOrders={pendingWorkOrders} 
          on:start-inspection={(e) => handleStartInspection(e.detail)}
        />
      {:else if activeTab === 'completed'}
        <CompletedWorkOrdersTable workOrders={completedWorkOrders} />
      {/if}
    {/if}
  </div>
</div>

<!-- Template Selection Modal -->
<TemplateSelectionModal
  show={showTemplateModal}
  {templates}
  {selectedWorkOrder}
  on:select={handleTemplateSelect}
  on:close={() => showTemplateModal = false}
/>

<!-- Inspection Modal -->
<InspectionModal
  show={showInspectionModal}
  {selectedWorkOrder}
  {selectedTemplate}
  {isResumingInspection}
  bind:inspectionForm
  bind:fieldResponses
  on:close={() => showInspectionModal = false}
  on:save-progress={handleSaveProgress}
  on:complete={handleCompleteInspection}
/>

<!-- Floating Theme Toggle -->
<FloatingThemeToggle />
