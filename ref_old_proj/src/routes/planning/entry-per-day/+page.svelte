<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { formatDate } from '$lib/utils/formatDate';
  import Button from '$lib/components/common/Button.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import { fetchUserMenus } from '$lib/api/menu';
  import {
    fetchLatestProductionPlanWithTimes,
    fetchProductionPlanHistory,
    updateProductionPlan,
    type ProductionPlanWithTimes,
    type ProductionPlanHistoryWithTimes,
    type ProductionTime
  } from '$lib/api/planning';
  import ProductionPlanHistory from '$lib/components/planning/ProductionPlanHistory.svelte';

  // Page state
  let productionData: ProductionPlanWithTimes | null = null;
  let planHistory: ProductionPlanHistoryWithTimes[] = [];
  let isLoading = false;
  let isHistoryLoading = false;
  let message = '';
  let messageType: 'success' | 'error' = 'success';

  // Edit state
  let isEditMode = false;
  let ppdCount = 1;
  let timeSlots: Array<{ slot_order: number; entry_time: string }> = [];

  // Sidebar state
  let showSidebar = false;
  let menus: any[] = [];

  // Get current user from session
  $: currentUser = $page.data.session?.user?.email || localStorage.getItem('username') || 'Unknown User';

  onMount(async () => {
    const username = localStorage.getItem('username');
    if (username) {
      menus = await fetchUserMenus();
    }
    await Promise.all([loadProductionData(), loadPlanHistory()]);
  });

  async function loadProductionData() {
    try {
      isLoading = true;
      productionData = await fetchLatestProductionPlanWithTimes();
      
      if (productionData) {
        ppdCount = productionData.plan.ppd_count;
        timeSlots = productionData.times.map(time => ({
          slot_order: time.slot_order,
          entry_time: time.entry_time
        }));
      } else {
        // Initialize with default values if no data exists
        ppdCount = 1;
        timeSlots = [{ slot_order: 1, entry_time: '09:00' }];
      }
    } catch (error) {
      showMessage('Error loading production data', 'error');
      console.error('Error loading production data:', error);
    } finally {
      isLoading = false;
    }
  }

  async function loadPlanHistory() {
    try {
      isHistoryLoading = true;
      planHistory = await fetchProductionPlanHistory();
    } catch (error) {
      console.error('Error loading plan history:', error);
    } finally {
      isHistoryLoading = false;
    }
  }

  function showMessage(msg: string, type: 'success' | 'error' = 'success') {
    message = msg;
    messageType = type;
    setTimeout(() => {
      message = '';
    }, 5000);
  }

  function handleEdit() {
    isEditMode = true;
  }

  function handleCancel() {
    isEditMode = false;
    // Reset to original values
    if (productionData) {
      ppdCount = productionData.plan.ppd_count;
      timeSlots = productionData.times.map(time => ({
        slot_order: time.slot_order,
        entry_time: time.entry_time
      }));
    }
  }

  function handlePpdCountChange() {
    // Update time slots based on new count
    const newTimeSlots = [];
    for (let i = 1; i <= ppdCount; i++) {
      if (i <= timeSlots.length) {
        newTimeSlots.push(timeSlots[i - 1]);
      } else {
        // Add new slot with default time
        const defaultTime = i === 1 ? '09:00' : 
                          i === 2 ? '12:00' : 
                          i === 3 ? '15:00' : 
                          i === 4 ? '18:00' : '21:00';
        newTimeSlots.push({
          slot_order: i,
          entry_time: defaultTime
        });
      }
    }
    timeSlots = newTimeSlots;
  }

  function updateTimeSlot(index: number, time: string) {
    timeSlots[index].entry_time = time;
    timeSlots = [...timeSlots];
  }

  async function handleSave() {
    if (ppdCount < 1) {
      showMessage('Production count must be at least 1', 'error');
      return;
    }

    if (timeSlots.length !== ppdCount) {
      showMessage('Time slots count must match production count', 'error');
      return;
    }

    // Validate time slots
    for (let i = 0; i < timeSlots.length; i++) {
      if (!timeSlots[i].entry_time) {
        showMessage(`Time is required for slot ${i + 1}`, 'error');
        return;
      }
    }

    try {
      isLoading = true;
      
      const today = new Date().toISOString().split('T')[0];
      const isUpdatingToday = productionData?.plan.dt_wef === today;
      
      await updateProductionPlan(
        productionData?.plan || null,
        ppdCount,
        timeSlots,
        currentUser
      );
      
      if (isUpdatingToday) {
        showMessage('Production plan updated successfully');
      } else {
        showMessage('New production plan created for today');
      }
      
      isEditMode = false;
      await Promise.all([loadProductionData(), loadPlanHistory()]);
    } catch (error) {
      showMessage('Error updating production plan', 'error');
      console.error('Error updating production plan:', error);
    } finally {
      isLoading = false;
    }
  }

  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }
</script>

<svelte:head>
  <title>Daily Production Entry - Production Management</title>
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
    title="Daily Production Entry"
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
          <p class="theme-text-primary">Loading production data...</p>
        </div>
      </div>
    {:else}
      <div class="max-w-4xl mx-auto">
        <!-- Current Plan Display -->
        <div class="theme-bg-primary rounded-lg shadow-lg p-6 mb-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold theme-text-primary">
              Current Production Plan
            </h2>
            {#if !isEditMode}
              <Button
                variant="primary"
                on:click={handleEdit}
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Plan
              </Button>
            {/if}
          </div>

                     {#if productionData}
             <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
               <div>
                 <span class="block text-sm font-medium theme-text-secondary mb-1">Production Count</span>
                 <p class="text-2xl font-bold theme-text-primary">{productionData.plan.ppd_count} vehicles/day</p>
               </div>
               <div>
                 <span class="block text-sm font-medium theme-text-secondary mb-1">Effective From</span>
                 <div class="flex items-center gap-2">
                   <p class="text-lg theme-text-primary">{formatDate(productionData.plan.dt_wef)}</p>
                   {#if productionData.plan.dt_wef === new Date().toISOString().split('T')[0]}
                     <span class="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Today</span>
                   {:else}
                     <span class="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Previous</span>
                   {/if}
                 </div>
               </div>
             </div>

            <div>
              <h3 class="text-lg font-medium theme-text-primary mb-3">Entry Times</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {#each productionData.times as time}
                  <div class="theme-bg-secondary rounded-lg p-4">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-medium theme-text-secondary">Slot {time.slot_order}</span>
                      <span class="text-lg font-semibold theme-text-primary">{time.entry_time}</span>
                    </div>
                  </div>
                {/each}
              </div>
            </div>

            <div class="mt-4 pt-4 border-t theme-border">
              <p class="text-sm theme-text-secondary">
                Created by: {productionData.plan.created_by} on {formatDate(productionData.plan.created_dt)}
              </p>
            </div>
          {:else}
            <div class="text-center py-8">
              <p class="text-lg theme-text-secondary mb-4">No production plan found</p>
              <p class="text-sm theme-text-tertiary">Click "Edit Plan" to create the first production plan</p>
            </div>
                   {/if}
       </div>

       <!-- Production Plan History -->
       <ProductionPlanHistory 
         plans={planHistory}
         isLoading={isHistoryLoading}
       />

       <!-- Edit Form -->
       {#if isEditMode}
          <div class="theme-bg-primary rounded-lg shadow-lg p-6">
            <h2 class="text-xl font-semibold theme-text-primary mb-6">
              {productionData ? 'Edit Production Plan' : 'Create Production Plan'}
            </h2>

            <form on:submit|preventDefault={handleSave} class="space-y-6">
              <!-- Production Count -->
              <div>
                <label for="ppdCount" class="block text-sm font-medium theme-text-primary mb-2">
                  Vehicles per Day *
                </label>
                <input
                  id="ppdCount"
                  type="number"
                  bind:value={ppdCount}
                  min="1"
                  max="10"
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  on:change={handlePpdCountChange}
                  required
                />
                <p class="mt-1 text-xs theme-text-secondary">
                  Number of vehicles to enter production per day (1-10)
                </p>
              </div>

              <!-- Time Slots -->
              <div>
                <label for="timeSlots" class="block text-sm font-medium theme-text-primary mb-3">
                  Entry Times *
                </label>
                <div class="space-y-3">
                  {#each timeSlots as slot, index}
                    <div class="flex items-center gap-4">
                      <span class="text-sm font-medium theme-text-secondary w-16">
                        Slot {slot.slot_order}
                      </span>
                      <input
                        type="time"
                        bind:value={slot.entry_time}
                        on:change={() => updateTimeSlot(index, slot.entry_time)}
                        class="px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                  {/each}
                </div>
                <p class="mt-2 text-xs theme-text-secondary">
                  Set the entry time for each production slot
                </p>
              </div>

              <!-- Action Buttons -->
              <div class="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  on:click={handleCancel}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isLoading}
                >
                  {#if isLoading}
                    <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  {:else}
                    Save Plan
                  {/if}
                </Button>
              </div>
            </form>
          </div>
        {/if}
             </div>
     {/if}
   </div>
</div>

<!-- Floating Theme Toggle -->
<FloatingThemeToggle /> 