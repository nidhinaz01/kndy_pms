<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { Plus, Trash2 } from 'lucide-svelte';
  import type { LostTimeReason } from '$lib/api/lostTimeReasons';

  export let lostTimeReasons: LostTimeReason[] = [];
  export let totalLostTimeMinutes: number = 0;
  export let employeeSalary: number = 0;

  const dispatch = createEventDispatcher();

  // Lost time breakdown items
  let breakdownItems: Array<{
    id: string;
    reasonId: number;
    minutes: number;
    cost: number;
  }> = [];
  
  // Force reactivity trigger
  let breakdownItemsVersion = 0;

  // Add new breakdown item
  function addBreakdownItem() {
    console.log('Adding new breakdown item. Current items:', breakdownItems.length);
    const newItem = {
      id: `item_${Date.now()}`,
      reasonId: 0,
      minutes: 0,
      cost: 0
    };
    breakdownItems = [...breakdownItems, newItem];
    breakdownItemsVersion++;
    console.log('Added new breakdown item. Total items:', breakdownItems.length);
    // Force reactivity by triggering calculateTotals
    calculateTotals();
  }

  // Remove breakdown item
  function removeBreakdownItem(itemId: string) {
    console.log('Removing breakdown item:', itemId);
    breakdownItems = breakdownItems.filter(item => item.id !== itemId);
    breakdownItemsVersion++;
    console.log('Removed breakdown item. Remaining items:', breakdownItems.length);
    calculateTotals();
  }

  // Update breakdown item - optimized to prevent performance issues
  let updateTimeout: ReturnType<typeof setTimeout> | null = null;
  
  function updateBreakdownItem(itemId: string, field: string, value: any) {
    // Check for duplicate reasons when reasonId is being changed
    if (field === 'reasonId' && value) {
      const reasonIdNum = typeof value === 'string' ? parseInt(value) : value;
      const isDuplicate = breakdownItems.some(item => 
        item.id !== itemId && item.reasonId === reasonIdNum
      );
      
      if (isDuplicate) {
        const reason = lostTimeReasons.find(r => r.id === reasonIdNum);
        const reasonName = reason ? reason.lost_time_reason : 'Unknown';
        alert(`Duplicate reason detected!\n\n"${reasonName}" is already used in another breakdown item.\n\nPlease select a different reason.`);
        return; // Don't update if duplicate
      }
    }

    // Update the item immediately for UI responsiveness
    breakdownItems = breakdownItems.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, [field]: value };
        
        // Calculate cost when minutes or reason changes
        if (field === 'minutes' || field === 'reasonId') {
          const reasonIdNum = field === 'reasonId' ? (typeof value === 'string' ? parseInt(value) : value) : updatedItem.reasonId;
          const reason = lostTimeReasons.find(r => r.id === reasonIdNum);
          const isPayable = reason?.p_head === 'Payable';
          
          if (isPayable && updatedItem.minutes > 0) {
            // Calculate salary per minute: salary / (days in month) / 480
            const currentDate = new Date();
            const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
            const salaryPerMinute = (employeeSalary || 0) / daysInMonth / 480;
            updatedItem.cost = updatedItem.minutes * salaryPerMinute;
          } else {
            // Non-payable lost time has zero cost
            updatedItem.cost = 0;
          }
        }
        
        return updatedItem;
      }
      return item;
    });
    
    breakdownItemsVersion++;
    
    // Debounce calculateTotals to prevent performance issues
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    updateTimeout = setTimeout(() => {
      calculateTotals();
      updateTimeout = null;
    }, 200); // 200ms debounce - increased to prevent rapid-fire updates
  }

  // Calculate totals
  function calculateTotals() {
    const totalMinutes = breakdownItems.reduce((sum, item) => sum + item.minutes, 0);
    const totalCost = breakdownItems.reduce((sum, item) => sum + item.cost, 0);
    
    // Debug logging
    console.log(`LostTimeBreakdown - Employee Salary: ₹${employeeSalary}, Total Cost: ₹${totalCost}`);
    
    dispatch('totalsChanged', {
      totalMinutes,
      totalCost,
      breakdownItems: breakdownItems.map(item => ({
        reasonId: item.reasonId,
        minutes: item.minutes,
        cost: item.cost
      }))
    });
  }

  // Get reason name
  function getReasonName(reasonId: number): string {
    const reason = lostTimeReasons.find(r => r.id === reasonId);
    return reason ? `${reason.lost_time_reason} (${reason.p_head})` : 'Select reason...';
  }

  // Get remaining minutes - optimized to prevent unnecessary recalculations
  let cachedRemainingMinutes = 0;
  let cachedBreakdownSum = -1;
  
  $: {
    const currentSum = breakdownItems.reduce((sum, item) => sum + item.minutes, 0);
    if (currentSum !== cachedBreakdownSum) {
      cachedBreakdownSum = currentSum;
      cachedRemainingMinutes = totalLostTimeMinutes - currentSum;
    }
  }
  
  $: remainingMinutes = cachedRemainingMinutes;

  // Track previous salary to avoid infinite loops
  let previousSalary = 0;
  let isRecalculating = false;
  let salaryUpdateTimeout: ReturnType<typeof setTimeout> | null = null;

  // Recalculate costs when employee salary changes - debounced to prevent performance issues
  $: if (employeeSalary > 0 && employeeSalary !== previousSalary && !isRecalculating) {
    previousSalary = employeeSalary;
    
    // Clear any pending updates
    if (salaryUpdateTimeout) {
      clearTimeout(salaryUpdateTimeout);
    }
    
    // Debounce the recalculation
    salaryUpdateTimeout = setTimeout(() => {
      isRecalculating = true;
      
      // Recalculate costs for all items
      const updatedItems = breakdownItems.map(item => {
        if (item.reasonId > 0 && item.minutes > 0) {
          const reason = lostTimeReasons.find(r => r.id === item.reasonId);
          const isPayable = reason?.p_head === 'Payable';
          
          if (isPayable) {
            const currentDate = new Date();
            const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
            const salaryPerMinute = employeeSalary / daysInMonth / 480;
            const newCost = item.minutes * salaryPerMinute;
            
            // Only update if cost actually changed
            if (Math.abs(newCost - item.cost) > 0.01) {
              return { ...item, cost: newCost };
            }
          } else if (item.cost !== 0) {
            return { ...item, cost: 0 };
          }
        }
        
        return item;
      });
      
      // Only update if items actually changed
      const hasChanges = updatedItems.some((item, index) => 
        item.cost !== breakdownItems[index]?.cost
      );
      
      if (hasChanges) {
        breakdownItems = updatedItems;
        breakdownItemsVersion++;
        calculateTotals();
      }
      
      isRecalculating = false;
      salaryUpdateTimeout = null;
    }, 150); // 150ms debounce for salary updates
  }
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h4 class="font-medium text-orange-800 dark:text-orange-200">Lost Time Breakdown</h4>
    <Button 
      variant="secondary" 
      size="sm" 
      on:click={addBreakdownItem}
      disabled={remainingMinutes <= 0}
    >
      <Plus class="w-4 h-4 mr-1" />
      Add Reason
    </Button>
  </div>

  <div class="text-sm {remainingMinutes === 0 ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300'}">
    Total Lost Time: {totalLostTimeMinutes} minutes | 
    Allocated: {breakdownItems.reduce((sum, item) => sum + item.minutes, 0)} minutes | 
    Remaining: {remainingMinutes} minutes
    {#if remainingMinutes === 0}
      ✅ All minutes allocated
    {:else if remainingMinutes > 0}
      ⚠️ {remainingMinutes} minutes not allocated
    {/if}
  </div>

  {#if remainingMinutes < 0}
    <div class="text-red-600 dark:text-red-400 text-sm font-medium">
      ⚠️ Total allocated minutes ({breakdownItems.reduce((sum, item) => sum + item.minutes, 0)}) exceeds lost time ({totalLostTimeMinutes} minutes)
    </div>
  {/if}

  <div class="space-y-3">
    {#each breakdownItems as item, index (item.id)}
      <div class="flex items-center space-x-3 p-3 border border-orange-200 dark:border-orange-700 rounded-lg bg-orange-50 dark:bg-orange-900/20">
        <div class="flex-1">
          <select
            value={item.reasonId}
            on:change={(e) => {
              const target = e.target as HTMLSelectElement;
              const newValue = parseInt(target?.value || '0');
              if (newValue !== item.reasonId) {
                updateBreakdownItem(item.id, 'reasonId', newValue);
              }
            }}
            class="w-full px-3 py-2 border border-orange-300 dark:border-orange-600 rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="">Select reason...</option>
            {#each lostTimeReasons as reason}
              {@const isAlreadyUsed = breakdownItems.some(breakdownItem => breakdownItem.id !== item.id && breakdownItem.reasonId === reason.id)}
              <option value={reason.id} disabled={isAlreadyUsed}>
                {reason.lost_time_reason} ({reason.p_head}){isAlreadyUsed ? ' - Already used' : ''}
              </option>
            {/each}
          </select>
        </div>
        
        <div class="w-24">
          <input
            type="number"
            value={item.minutes}
            on:input={(e) => {
              const target = e.target as HTMLInputElement;
              const newValue = parseInt(target?.value || '0');
              if (newValue !== item.minutes) {
                updateBreakdownItem(item.id, 'minutes', newValue);
              }
            }}
            min="1"
            max={totalLostTimeMinutes}
            class="w-full px-3 py-2 border border-orange-300 dark:border-orange-600 rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Minutes"
          />
        </div>
        
        <div class="w-20 text-sm theme-text-primary">
          ₹{item.cost.toFixed(2)}
        </div>
        
        <button
          type="button"
          on:click={() => removeBreakdownItem(item.id)}
          class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
        >
          <Trash2 class="w-4 h-4" />
        </button>
      </div>
    {/each}
  </div>

  {#if breakdownItems.length === 0}
    <div class="text-center py-4 text-orange-600 dark:text-orange-400">
      No reasons added yet. Click "Add Reason" to start breaking down the lost time.
    </div>
  {/if}

  {#if breakdownItems.length > 0}
    <div class="border-t border-orange-200 dark:border-orange-700 pt-3">
      <div class="flex justify-between text-sm font-medium">
        <span class="theme-text-primary">Total Allocated:</span>
        <span class="theme-text-primary">
          {breakdownItems.reduce((sum, item) => sum + item.minutes, 0)} minutes | 
          ₹{breakdownItems.reduce((sum, item) => sum + item.cost, 0).toFixed(2)}
        </span>
      </div>
    </div>
  {/if}
</div>
