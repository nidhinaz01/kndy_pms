<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';

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
      await Promise.all([
        loadWorkOrders(),
        loadTemplates()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  async function loadWorkOrders() {
    try {
      // Load all work orders
      const { data: woData, error: woError } = await supabase
        .from('prdn_wo_details')
        .select('*')
        .order('wo_date', { ascending: false });

      if (woError) throw woError;

      // Load all production dates
      const { data: datesData, error: datesError } = await supabase
        .from('prdn_dates')
        .select('*')
        .order('planned_date', { ascending: true });

      if (datesError) throw datesError;

      // Load existing chassis receival records
      const { data: inspectionData, error: inspectionError } = await supabase
        .from('sales_chassis_receival_records')
        .select('*')
        .eq('is_deleted', false);

      if (inspectionError) throw inspectionError;

      // Filter work orders that have planned chassis arrival dates
      const workOrdersWithChassisArrival = (woData || []).filter(workOrder => {
        const woDates = (datesData || []).filter(d => d.sales_order_id === workOrder.id);
        const chassisArrival = woDates.find(d => d.date_type === 'chassis_arrival');
        
        // Has planned chassis arrival date
        return chassisArrival?.planned_date;
      });

      // Attach chassis arrival date and ongoing inspection status to each work order for display
      allWorkOrders = workOrdersWithChassisArrival.map(workOrder => {
        const woDates = (datesData || []).filter(d => d.sales_order_id === workOrder.id);
        const chassisArrival = woDates.find(d => d.date_type === 'chassis_arrival');
        
        // Check if there's an ongoing inspection for this work order
        const ongoingInspection = (inspectionData || []).find(ins => 
          ins.sales_order_id === workOrder.id && 
          ins.inspection_status === 'ongoing'
        );
        
        return {
          ...workOrder,
          chassisArrival: chassisArrival,
          chassisArrivalDate: chassisArrival?.planned_date,
          hasOngoingInspection: !!ongoingInspection
        };
      });
      console.log('Chassis Receival - Loaded work orders:', {
        totalWorkOrders: woData?.length || 0,
        totalDates: datesData?.length || 0,
        workOrdersWithChassisArrival: workOrdersWithChassisArrival.length,
        allWorkOrders: allWorkOrders.map(wo => ({ 
          id: wo.id, 
          wo_no: wo.wo_no, 
          wo_type: wo.wo_type,
          wo_model: wo.wo_model,
          wo_chassis: wo.wo_chassis,
          wheel_base: wo.wheel_base,
          chassisArrival: wo.chassisArrival,
          chassisArrivalDate: wo.chassisArrivalDate,
          hasOngoingInspection: wo.hasOngoingInspection
        }))
      });
    } catch (error) {
      console.error('Error loading work orders:', error);
      allWorkOrders = [];
    }
  }

  async function loadTemplates() {
    try {
      const { data, error } = await supabase
        .from('sys_chassis_receival_templates')
        .select(`
          *,
          sys_chassis_receival_template_fields(*)
        `)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('template_name');

      if (error) throw error;
      templates = data || [];
    } catch (error) {
      console.error('Error loading templates:', error);
      templates = [];
    }
  }

  async function handleStartInspection(workOrder: any) {
    selectedWorkOrder = workOrder;
    
    // Check if there's an ongoing inspection for this work order
    try {
      const { data, error } = await supabase
        .from('sales_chassis_receival_records')
        .select('*')
        .eq('sales_order_id', workOrder.id)
        .eq('inspection_status', 'ongoing')
        .eq('is_deleted', false)
        .single();

      if (data && !error) {
        // Resume existing inspection
        existingInspection = data;
        isResumingInspection = true;
        
        // Load the template
        const { data: templateData, error: templateError } = await supabase
          .from('sys_chassis_receival_templates')
          .select(`
            *,
            sys_chassis_receival_template_fields(*)
          `)
          .eq('id', data.template_id)
          .single();

        if (templateError) throw templateError;
        
        selectedTemplate = templateData;
        
        // Restore form data
        inspectionForm = {
          inspection_date: data.inspection_date,
          inspector_name: data.inspector_name,
          inspection_notes: data.inspection_notes || '',
          field_responses: data.field_responses || {}
        };
        
        // Restore field responses
        fieldResponses = data.field_responses || {};
        
        showInspectionModal = true;
      } else {
        // Start new inspection
        existingInspection = null;
        isResumingInspection = false;
        showTemplateModal = true;
      }
    } catch (error) {
      console.error('Error checking for existing inspection:', error);
      // Default to starting new inspection
      existingInspection = null;
      isResumingInspection = false;
      showTemplateModal = true;
    }
  }

  function handleTemplateSelect(template: any) {
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

  async function saveProgress() {
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
      const now = new Date().toISOString();

      if (existingInspection) {
        // Update existing inspection
        const { error } = await supabase
          .from('sales_chassis_receival_records')
          .update({
            inspection_date: inspectionForm.inspection_date,
            inspector_name: inspectionForm.inspector_name,
            inspection_status: 'ongoing',
            inspection_notes: inspectionForm.inspection_notes,
            field_responses: fieldResponses,
            modified_by: username,
            modified_dt: now
          })
          .eq('id', existingInspection.id);

        if (error) throw error;
      } else {
        // Create new inspection record
        const { error } = await supabase
          .from('sales_chassis_receival_records')
          .insert({
            sales_order_id: selectedWorkOrder.id,
            template_id: selectedTemplate.id,
            inspection_date: inspectionForm.inspection_date,
            inspector_name: inspectionForm.inspector_name,
            inspection_status: 'ongoing',
            inspection_notes: inspectionForm.inspection_notes,
            field_responses: fieldResponses,
            created_by: username,
            created_dt: now
          });

        if (error) throw error;
      }

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

  function validateInspectionForm(): string[] {
    const errors: string[] = [];

    // Validate basic inspection form fields
    if (!inspectionForm.inspection_date) {
      errors.push('• Inspection Date is required');
    }
    if (!inspectionForm.inspector_name?.trim()) {
      errors.push('• Inspector Name is required');
    }

    // Validate template fields
    if (selectedTemplate?.sys_chassis_receival_template_fields) {
      selectedTemplate.sys_chassis_receival_template_fields.forEach((field: any) => {
        if (field.is_required) {
          const fieldValue = fieldResponses[field.field_name];
          
          // Check if field is empty or only whitespace
          if (!fieldValue || (typeof fieldValue === 'string' && !fieldValue.trim())) {
            errors.push(`• ${field.field_label} is required`);
          }
          
          // Additional validation based on field type
          if (fieldValue && field.field_type === 'number') {
            const numValue = parseFloat(fieldValue);
            if (isNaN(numValue)) {
              errors.push(`• ${field.field_label} must be a valid number`);
            }
          }
          
          if (fieldValue && field.field_type === 'date') {
            const dateValue = new Date(fieldValue);
            if (isNaN(dateValue.getTime())) {
              errors.push(`• ${field.field_label} must be a valid date`);
            }
          }
        }
      });
    }

    return errors;
  }

  async function completeInspection() {
    try {
      // Validate mandatory fields before completion
      const validationErrors = validateInspectionForm();
      if (validationErrors.length > 0) {
        alert(`Please fill in all mandatory fields:\n${validationErrors.join('\n')}`);
        return;
      }

      const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
      const now = new Date().toISOString();

      if (existingInspection) {
        // Update existing inspection to completed
        const { error } = await supabase
          .from('sales_chassis_receival_records')
          .update({
            inspection_date: inspectionForm.inspection_date,
            inspector_name: inspectionForm.inspector_name,
            inspection_status: 'completed',
            inspection_notes: inspectionForm.inspection_notes,
            field_responses: fieldResponses,
            modified_by: username,
            modified_dt: now
          })
          .eq('id', existingInspection.id);

        if (error) throw error;
      } else {
        // Create new completed inspection record
        const { error } = await supabase
          .from('sales_chassis_receival_records')
          .insert({
            sales_order_id: selectedWorkOrder.id,
            template_id: selectedTemplate.id,
            inspection_date: inspectionForm.inspection_date,
            inspector_name: inspectionForm.inspector_name,
            inspection_status: 'completed',
            inspection_notes: inspectionForm.inspection_notes,
            field_responses: fieldResponses,
            created_by: username,
            created_dt: now
          });

        if (error) throw error;
      }

      // Update prdn_dates with actual chassis arrival date
      const { error: dateError } = await supabase
        .from('prdn_dates')
        .update({
          actual_date: inspectionForm.inspection_date,
          modified_by: username,
          modified_dt: now
        })
        .eq('sales_order_id', selectedWorkOrder.id)
        .eq('date_type', 'chassis_arrival');

      if (dateError) throw dateError;

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

  function getFieldValue(field: any): any {
    return fieldResponses[field.field_name] || '';
  }

  function setFieldValue(field: any, value: any) {
    fieldResponses[field.field_name] = value;
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
        <img src="/favicon.png" alt="Company Logo" class="h-8 w-auto" />
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
        {#if pendingWorkOrders.length > 0}
          <div class="theme-bg-primary rounded-lg shadow-lg">
            <div class="p-6 border-b theme-border">
              <h3 class="text-lg font-semibold theme-text-primary">Pending Chassis Receival ({pendingWorkOrders.length})</h3>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b theme-border">
                    <th class="px-4 py-3 text-left font-medium theme-text-primary">Work Order</th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary">PWO Number</th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary">Type</th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary">Model</th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary">Chassis</th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary">Wheel Base</th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary">Customer</th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary">Planned Date</th>
                    <th class="px-4 py-3 text-center font-medium theme-text-primary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {#each pendingWorkOrders as workOrder}
                    <tr class="border-b theme-border hover:theme-bg-secondary">
                      <td class="px-4 py-3 font-medium theme-text-primary">
                        {workOrder.wo_no}
                      </td>
                      <td class="px-4 py-3 theme-text-primary">
                        {workOrder.pwo_no || 'N/A'}
                      </td>
                      <td class="px-4 py-3 theme-text-primary">
                        {workOrder.wo_type || 'N/A'}
                      </td>
                      <td class="px-4 py-3 theme-text-primary">
                        {workOrder.wo_model || 'N/A'}
                      </td>
                      <td class="px-4 py-3 theme-text-primary">
                        {workOrder.wo_chassis || 'N/A'}
                      </td>
                      <td class="px-4 py-3 theme-text-primary">
                        {workOrder.wheel_base || 'N/A'}
                      </td>
                      <td class="px-4 py-3 theme-text-primary">
                        {workOrder.customer_name || 'N/A'}
                      </td>
                      <td class="px-4 py-3 theme-text-primary">
                        {workOrder.chassisArrivalDate ? new Date(workOrder.chassisArrivalDate).toLocaleDateString() : 'N/A'}
                      </td>
                      <td class="px-4 py-3 text-center">
                        <Button variant="primary" size="sm" on:click={() => handleStartInspection(workOrder)}>
                          {workOrder.hasOngoingInspection ? 'Continue Inspection' : 'Start Inspection'}
                        </Button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {:else}
          <div class="theme-bg-primary rounded-lg shadow-lg p-6 mb-6">
            <div class="text-center py-8">
              <p class="text-lg theme-text-secondary mb-4">No pending chassis receivals</p>
              <p class="text-sm theme-text-tertiary">All chassis receivals are up to date</p>
            </div>
          </div>
        {/if}
      {:else if activeTab === 'completed'}
        {#if completedWorkOrders.length > 0}
          <div class="theme-bg-primary rounded-lg shadow-lg">
            <div class="p-6 border-b theme-border">
              <h3 class="text-lg font-semibold theme-text-primary">Completed Chassis Receival ({completedWorkOrders.length})</h3>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b theme-border">
                    <th class="px-4 py-3 text-left font-medium theme-text-primary">Work Order</th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary">PWO Number</th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary">Type</th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary">Model</th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary">Chassis</th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary">Wheel Base</th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary">Customer</th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary">Planned Date</th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary">Actual Date</th>
                    <th class="px-4 py-3 text-left font-medium theme-text-primary">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {#each completedWorkOrders as workOrder}
                    {@const daysDiff = getDateDifference(workOrder.chassisArrival.planned_date, workOrder.chassisArrival.actual_date)}
                    {@const rowBgClass = getRowBackgroundColor(daysDiff)}
                    <tr class="border-b theme-border hover:theme-bg-secondary transition-colors" class:on-time={rowBgClass === 'on-time'} class:slight-delay={rowBgClass === 'slight-delay'} class:moderate-delay={rowBgClass === 'moderate-delay'} class:significant-delay={rowBgClass === 'significant-delay'}>
                      <td class="px-4 py-3 font-medium border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {workOrder.wo_no}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {workOrder.wo_type || 'N/A'}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {workOrder.wo_model}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {workOrder.chassis_no || 'N/A'}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {workOrder.wheel_base || 'N/A'}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {workOrder.customer_name || 'N/A'}
                      </td>
                      <td class="px-4 py-3 border theme-border {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                        {workOrder.chassisArrival.planned_date ? new Date(workOrder.chassisArrival.planned_date).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: '2-digit'
                        }) : 'N/A'}
                      </td>
                      <td class="px-4 py-3 border theme-border">
                        <span class="{getDateColor(daysDiff)}">
                          {workOrder.chassisArrival.actual_date ? new Date(workOrder.chassisArrival.actual_date).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: '2-digit'
                          }) : 'N/A'}
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
              <p class="text-lg theme-text-secondary mb-4">No completed chassis receivals</p>
              <p class="text-sm theme-text-tertiary">Complete some chassis receivals to see them here</p>
            </div>
          </div>
        {/if}
      {/if}
    {/if}
  </div>
</div>

<!-- Template Selection Modal -->
{#if showTemplateModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="fixed inset-0 bg-black bg-opacity-50" 
         role="button" 
         tabindex="0"
         on:click={() => showTemplateModal = false}
         on:keydown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && (showTemplateModal = false)}></div>
    <div class="relative theme-bg-primary rounded-lg shadow-xl p-6 w-full max-w-2xl mx-4">
      <h2 class="text-xl font-bold theme-text-primary mb-4">Select Inspection Template</h2>
      <p class="text-sm theme-text-secondary mb-6">
        Choose a template for work order: <strong>{selectedWorkOrder?.wo_no}</strong>
      </p>
      
      <div class="grid gap-4">
        {#each templates as template}
          <div class="border theme-border rounded-lg p-4 hover:theme-bg-secondary cursor-pointer" 
               role="button" 
               tabindex="0"
               on:click={() => handleTemplateSelect(template)}
               on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleTemplateSelect(template)}>
            <div class="flex justify-between items-start">
              <div>
                <h3 class="font-semibold theme-text-primary">{template.template_name}</h3>
                <p class="text-sm theme-text-secondary mt-1">{template.template_description || 'No description'}</p>
                <p class="text-xs theme-text-tertiary mt-2">
                  {template.sys_chassis_receival_template_fields?.length || 0} fields
                </p>
              </div>
              <Button variant="primary" size="sm">
                Select
              </Button>
            </div>
          </div>
        {/each}
      </div>
      
      <div class="mt-6 flex justify-end">
        <button
          class="px-4 py-2 theme-text-secondary hover:theme-text-primary transition-colors"
          on:click={() => showTemplateModal = false}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Inspection Modal -->
{#if showInspectionModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="fixed inset-0 bg-black bg-opacity-50" 
         role="button" 
         tabindex="0"
         on:click={() => showInspectionModal = false}
         on:keydown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && (showInspectionModal = false)}></div>
    <div class="relative theme-bg-primary rounded-lg shadow-xl p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
      <h2 class="text-xl font-bold theme-text-primary mb-4">
        {isResumingInspection ? 'Resume Chassis Receival Inspection' : 'Chassis Receival Inspection'}
      </h2>
      <p class="text-sm theme-text-secondary mb-6">
        Work Order: <strong>{selectedWorkOrder?.wo_no}</strong> | 
        Template: <strong>{selectedTemplate?.template_name}</strong>
        {#if isResumingInspection}
          <span class="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
            Ongoing
          </span>
        {/if}
      </p>
      
      <form>
        <!-- Inspection Details -->
        <div class="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <label for="inspection-date" class="block text-sm font-medium theme-text-primary mb-2">Inspection Date</label>
            <input
              id="inspection-date"
              type="date"
              bind:value={inspectionForm.inspection_date}
              required
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label for="inspector-name" class="block text-sm font-medium theme-text-primary mb-2">Inspector Name</label>
            <input
              id="inspector-name"
              type="text"
              bind:value={inspectionForm.inspector_name}
              required
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label for="inspection-status" class="block text-sm font-medium theme-text-primary mb-2">Status</label>
            <select
              id="inspection-status"
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled
            >
              <option>Completed</option>
            </select>
          </div>
        </div>
        
        <!-- Template Fields -->
        <div class="space-y-4 mb-6">
          <h3 class="text-lg font-semibold theme-text-primary">Inspection Checklist</h3>
          
          {#each selectedTemplate?.sys_chassis_receival_template_fields?.sort((a: any, b: any) => a.field_order - b.field_order) || [] as field}
            <div class="p-4 border theme-border rounded-lg">
              <label for="field-{field.field_name}" class="block text-sm font-medium theme-text-primary mb-2">
                {field.field_label}
                {#if field.is_required}
                  <span class="text-red-500">*</span>
                {/if}
              </label>
              
              {#if field.field_type === 'text'}
                <input
                  id="field-{field.field_name}"
                  type="text"
                  bind:value={fieldResponses[field.field_name]}
                  required={field.is_required}
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              {:else if field.field_type === 'textarea'}
                <textarea
                  id="field-{field.field_name}"
                  bind:value={fieldResponses[field.field_name]}
                  required={field.is_required}
                  rows="3"
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                ></textarea>
              {:else if field.field_type === 'number'}
                <input
                  id="field-{field.field_name}"
                  type="number"
                  bind:value={fieldResponses[field.field_name]}
                  required={field.is_required}
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              {:else if field.field_type === 'date'}
                <input
                  id="field-{field.field_name}"
                  type="date"
                  bind:value={fieldResponses[field.field_name]}
                  required={field.is_required}
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              {:else if field.field_type === 'checkbox'}
                <div class="flex items-center">
                  <input
                    id="field-{field.field_name}"
                    type="checkbox"
                    bind:checked={fieldResponses[field.field_name]}
                    class="mr-2"
                  />
                  <label for="field-{field.field_name}" class="text-sm theme-text-primary">Yes</label>
                </div>
              {:else if field.field_type === 'dropdown'}
                <select
                  id="field-{field.field_name}"
                  bind:value={fieldResponses[field.field_name]}
                  required={field.is_required}
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select an option</option>
                  {#each field.dropdown_options?.options || [] as option: string}
                    <option value={option}>{option}</option>
                  {/each}
                </select>
              {/if}
            </div>
          {/each}
        </div>
        
        <!-- Inspection Notes -->
        <div class="mb-6">
          <label for="inspection-notes" class="block text-sm font-medium theme-text-primary mb-2">Inspection Notes</label>
          <textarea
            id="inspection-notes"
            bind:value={inspectionForm.inspection_notes}
            rows="3"
            placeholder="Additional notes or observations..."
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          ></textarea>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex justify-between">
          <div class="flex items-center">
            {#if isResumingInspection}
              <span class="text-sm theme-text-secondary">
                📝 Resuming ongoing inspection
              </span>
            {/if}
          </div>
          <div class="flex gap-2">
            <Button variant="secondary" size="md" on:click={() => showInspectionModal = false}>
              Cancel
            </Button>
            <Button variant="primary" size="md" on:click={saveProgress}>
              Save Progress
            </Button>
            <Button variant="primary" size="md" on:click={completeInspection}>
              Complete Inspection
            </Button>
          </div>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Floating Theme Toggle -->
<FloatingThemeToggle />

<style>
  /* Row highlighting styles for chassis receival status */
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
