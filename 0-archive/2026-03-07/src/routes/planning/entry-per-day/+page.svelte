<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import EntryPerDayHeader from '$lib/components/planning/EntryPerDayHeader.svelte';
  import ProductionPlansTable from '$lib/components/planning/ProductionPlansTable.svelte';
  import ProductionPlanHistoryTable from '$lib/components/planning/ProductionPlanHistoryTable.svelte';
  import AddProductionPlanModal from '$lib/components/planning/AddProductionPlanModal.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import { 
    fetchCurrentProductionPlanWithTimes,
    fetchProductionPlanHistory,
    saveProductionPlan, 
    updateProductionPlan,
    updateProductionPlanByDate,
    deleteProductionPlan, 
    type ProductionPlan,
    type ProductionPlanWithTimes,
    type ProductionPlanHistoryWithTimes
  } from '$lib/api/planning';
  import { formatDateLocal } from '$lib/utils/formatDate';

  let currentPlan: ProductionPlanWithTimes | null = null;
  let historyData: ProductionPlanHistoryWithTimes[] = [];
  let loading = true;
  let historyLoading = false;
  let error = '';
  let expandTable = false;
  let expandHistoryTable = false;
  let showAddModal = false;
  let selectedPlan: ProductionPlanWithTimes | null = null;
  let menus: any[] = [];
  let showSidebar = false;

  onMount(async () => {
    // Load menus in background without blocking the UI
    const username = localStorage.getItem('username') || 'admin';
    fetchUserMenus(username).then(menuData => {
      menus = menuData;
    }).catch(error => {
      console.error('Failed to load menus:', error);
    });
    
    await Promise.all([loadData(), loadHistoryData()]);
  });

  async function loadData() {
    try {
      loading = true;
      error = '';
      
      currentPlan = await fetchCurrentProductionPlanWithTimes();
    } catch (err) {
      console.error('Error loading production plan data:', err);
      error = 'Failed to load production plan data. Please try again.';
    } finally {
      loading = false;
    }
  }

  async function loadHistoryData() {
    try {
      historyLoading = true;
      historyData = await fetchProductionPlanHistory();
    } catch (err) {
      console.error('Error loading history data:', err);
      // Don't show error for history, just log it
    } finally {
      historyLoading = false;
    }
  }

  async function handleSavePlan(planData: any) {
    try {
      await saveProductionPlan(planData);
      await Promise.all([loadData(), loadHistoryData()]);
      showAddModal = false;
      alert('Production plan saved successfully!');
    } catch (err) {
      console.error('Error saving production plan:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save production plan. Please try again.';
      
      // Check if it's a duplicate date error
      if (errorMessage.includes('already exists for')) {
        const shouldUpdate = confirm(`${errorMessage}\n\nWould you like to update the existing plan instead?`);
        if (shouldUpdate) {
          try {
            await updateProductionPlanByDate(planData.dt_wef, planData);
            await Promise.all([loadData(), loadHistoryData()]);
            showAddModal = false;
            alert('Production plan updated successfully!');
            return;
          } catch (updateErr) {
            console.error('Error updating production plan:', updateErr);
            alert(`Error updating plan: ${updateErr instanceof Error ? updateErr.message : 'Unknown error'}`);
            return;
          }
        }
      }
      
      alert(`Error: ${errorMessage}`);
    }
  }

  async function handleDeletePlan(id: number) {
    try {
      await deleteProductionPlan(id);
      await loadData();
    } catch (err) {
      console.error('Error deleting production plan:', err);
      alert('Failed to delete production plan. Please try again.');
    }
  }

  function handleRowSelect(plan: ProductionPlanWithTimes) {
    selectedPlan = plan;
    console.log('Selected plan:', plan);
  }

  function handleEditPlan(plan: ProductionPlanWithTimes) {
    selectedPlan = plan;
    // TODO: Implement edit modal
    console.log('Edit plan:', plan);
  }

  function toggleSidebar() {
    showSidebar = !showSidebar;
  }

  function toggleTable() {
    expandTable = !expandTable;
  }

  function toggleHistoryTable() {
    expandHistoryTable = !expandHistoryTable;
  }
</script>

<svelte:head>
  <title>Production Plans Per Day - KNDY PMS</title>
</svelte:head>

<!-- Sidebar Overlay -->
{#if showSidebar}
  <div class="fixed inset-0 z-50">
    <button
      type="button"
      aria-label="Close sidebar overlay"
      class="fixed inset-0 bg-black bg-opacity-40 z-40"
      on:click={toggleSidebar}
      tabindex="0"
      on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleSidebar()}
      style="cursor: pointer; border: none; width: 100%; height: 100%; position: fixed; left: 0; top: 0; background-color: rgba(0,0,0,0.4);"
    ></button>
    <div class="fixed left-0 top-0 h-full w-64 z-50 theme-bg-primary shadow-lg">
      <Sidebar {menus} />
    </div>
  </div>
{/if}

<div class="flex flex-col h-full w-full theme-bg-secondary transition-colors duration-200" style="min-height: 100vh;">
  <div class="p-6">
      <!-- Header -->
      <EntryPerDayHeader 
        onSidebarToggle={toggleSidebar}
        onAddPlan={() => showAddModal = true}
      />

      <!-- Loading State -->
      {#if loading}
        <div class="flex items-center justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <span class="ml-3 theme-text-primary transition-colors duration-200">Loading production plans...</span>
        </div>
      {:else if error}
        <!-- Error State -->
        <div class="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 px-4 py-3 rounded mb-6">
          <div class="flex items-center">
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            {error}
          </div>
        </div>
      {:else}
        <!-- Content -->
        <div class="mt-6 space-y-6">
          <!-- Current Production Plan -->
          {#if currentPlan}
            <div class="theme-bg-primary rounded-xl shadow transition-colors duration-200 p-6">
              <div class="flex items-center justify-between mb-6">
                <h3 class="text-lg font-semibold theme-text-primary transition-colors duration-200">Current Production Plan</h3>
                <div class="flex items-center gap-2">
                  {#if currentPlan.dt_wef === new Date().toISOString().split('T')[0]}
                    <span class="px-2 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full">Today</span>
                  {:else}
                    <span class="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">Active</span>
                  {/if}
                </div>
              </div>
              
                         <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
             <div>
               <span class="block text-sm font-medium theme-text-secondary mb-1">Production Rate</span>
               <p class="text-2xl font-bold theme-text-primary">{currentPlan.production_rate} vehicles/day</p>
             </div>
             <div>
               <span class="block text-sm font-medium theme-text-secondary mb-1">Pattern</span>
               <p class="text-lg theme-text-primary">
                 [{currentPlan.pattern_data?.join(', ') || 'N/A'}] over {currentPlan.pattern_cycle || 1} days
               </p>
             </div>
             <div>
               <span class="block text-sm font-medium theme-text-secondary mb-1">Effective From</span>
               <p class="text-lg theme-text-primary">{new Date(currentPlan.dt_wef).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
             </div>
           </div>

                         <div>
             <h4 class="text-md font-medium theme-text-primary mb-3">Entry Times by Pattern Day</h4>
             <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {#if currentPlan.slot_configuration && currentPlan.slot_configuration.length > 0}
                 {#each currentPlan.slot_configuration as dayConfig, dayIndex}
                   <div class="theme-bg-secondary rounded-lg p-4">
                     <div class="mb-2">
                       <span class="text-sm font-medium theme-text-secondary">Day {dayConfig.day}</span>
                       <span class="text-xs theme-text-tertiary ml-2">({currentPlan.pattern_data[dayIndex]} vehicles)</span>
                     </div>
                     <div class="space-y-2">
                       {#each dayConfig.slots as slot}
                         <div class="flex items-center justify-between text-sm">
                           <span class="theme-text-secondary">Slot {slot.slot_order}</span>
                           <span class="font-medium theme-text-primary">{slot.entry_time}</span>
                         </div>
                       {/each}
                     </div>
                   </div>
                 {/each}
               {:else}
                 <!-- Fallback to old times format for backward compatibility -->
                 {#each currentPlan.times as time}
                   <div class="theme-bg-secondary rounded-lg p-4">
                     <div class="flex items-center justify-between">
                       <span class="text-sm font-medium theme-text-secondary">Slot {time.slot_order}</span>
                       <span class="text-lg font-semibold theme-text-primary">{time.entry_time}</span>
                     </div>
                   </div>
                 {/each}
               {/if}
             </div>
           </div>

                         <div class="mt-4 pt-4 border-t theme-border">
             <p class="text-sm theme-text-secondary">
               Created by: <span class="font-medium theme-text-primary">{currentPlan.created_by}</span> on {formatDateLocal(currentPlan.created_dt)}
             </p>
           </div>
            </div>
          {:else}
            <div class="theme-bg-primary rounded-xl shadow transition-colors duration-200 p-8">
              <div class="text-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <h3 class="text-lg font-medium theme-text-primary mb-2">No Production Plan Found</h3>
                <p class="text-sm theme-text-secondary">Create your first production plan to get started</p>
              </div>
            </div>
          {/if}

          <!-- Production Plan History Table -->
          <ProductionPlanHistoryTable
            historyData={historyData}
            expandTable={expandHistoryTable}
            onExpandToggle={toggleHistoryTable}
          />
        </div>
      {/if}
    </div>

    <!-- Add Production Plan Modal -->
    <AddProductionPlanModal
      showModal={showAddModal}
      onSave={handleSavePlan}
      onClose={() => showAddModal = false}
    />
  </div>

  <!-- Floating Theme Toggle -->
  <FloatingThemeToggle /> 