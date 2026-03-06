<script lang="ts">
  import type { ProductionPlanFormData, SlotConfig } from '$lib/api/planning';
  import { calculatePattern, validatePattern } from '$lib/api/planning';

  export let showModal: boolean;
  export let onSave: (plan: ProductionPlanFormData) => void;
  export let onClose: () => void;

  let productionRate = 1.0;
  let dtWef = '';
  let patternCycle = 1;
  let patternData: number[] = [1];
  let slotConfiguration: SlotConfig[] = [{ day: 1, slots: [{ slot_order: 1, entry_time: '09:00' }] }];
  let calculatedPattern = { cycle: 1, pattern: [1] };
  let showPatternEditor = false;
  let manualPatternInput = '';

  function handleSubmit() {
    if (!productionRate || Number(productionRate) <= 0) {
      alert('Please enter the production rate');
      return;
    }

    if (!dtWef || dtWef.trim() === '') {
      alert('Please select the effective date');
      return;
    }

    // Check if the date is in the past
    const selectedDate = new Date(dtWef);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      alert('Please select a future date for the production plan');
      return;
    }

    const rate = Number(productionRate);
    if (isNaN(rate) || rate <= 0) {
      alert('Production rate must be a positive number');
      return;
    }

    // Validate pattern
    if (!validatePattern(patternData, patternCycle)) {
      alert('Invalid pattern configuration');
      return;
    }

    // Validate slot configuration
    for (let i = 0; i < slotConfiguration.length; i++) {
      const dayConfig = slotConfiguration[i];
      if (dayConfig.slots.length !== patternData[i]) {
        alert(`Day ${i + 1} should have ${patternData[i]} slots`);
        return;
      }
      for (let j = 0; j < dayConfig.slots.length; j++) {
        if (!dayConfig.slots[j].entry_time) {
          alert(`Time is required for day ${i + 1}, slot ${j + 1}`);
          return;
        }
      }
    }

    const planData: ProductionPlanFormData = {
      production_rate: rate,
      dt_wef: dtWef,
      pattern_cycle: patternCycle,
      pattern_data: patternData,
      slot_configuration: slotConfiguration
    };

    onSave(planData);
    resetForm();
  }

  function resetForm() {
    productionRate = 1.0;
    dtWef = '';
    patternCycle = 1;
    patternData = [1];
    slotConfiguration = [{ day: 1, slots: [{ slot_order: 1, entry_time: '09:00' }] }];
    calculatedPattern = { cycle: 1, pattern: [1] };
    showPatternEditor = false;
    manualPatternInput = '';
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function handleProductionRateChange() {
    const rate = Number(productionRate) || 0;
    if (rate > 0) {
      // Calculate pattern
      calculatedPattern = calculatePattern(rate);
      patternCycle = calculatedPattern.cycle;
      patternData = calculatedPattern.pattern;
      
      // Update slot configuration
      updateSlotConfiguration();
    }
  }

  function updateSlotConfiguration() {
    const newSlotConfiguration: SlotConfig[] = [];
    for (let day = 1; day <= patternCycle; day++) {
      const slotCount = patternData[day - 1];
      const existingDay = slotConfiguration.find(d => d.day === day);
      
      const slots = [];
      for (let slot = 1; slot <= slotCount; slot++) {
        const existingSlot = existingDay?.slots.find(s => s.slot_order === slot);
        const defaultTime = slot === 1 ? '09:00' : 
                          slot === 2 ? '12:00' : 
                          slot === 3 ? '15:00' : 
                          slot === 4 ? '18:00' : '21:00';
        slots.push({
          slot_order: slot,
          entry_time: existingSlot?.entry_time || defaultTime
        });
      }
      
      newSlotConfiguration.push({
        day: day,
        slots: slots
      });
    }
    
    slotConfiguration = newSlotConfiguration;
  }

  function handleManualPatternChange() {
    try {
      // Parse manual pattern input (e.g., "1,2" or "[1,2]")
      let patternStr = manualPatternInput.trim();
      if (patternStr.startsWith('[') && patternStr.endsWith(']')) {
        patternStr = patternStr.slice(1, -1);
      }
      
      const newPattern = patternStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      
      if (newPattern.length > 0 && newPattern.every(n => n >= 0)) {
        const totalVehicles = newPattern.reduce((a, b) => a + b, 0);
        const expectedTotal = Math.round(Number(productionRate) * newPattern.length);
        
        if (totalVehicles !== expectedTotal) {
          const confirmed = confirm(
            `Warning: Your pattern [${newPattern.join(',')}] totals ${totalVehicles} vehicles over ${newPattern.length} days, ` +
            `but the production rate ${productionRate} suggests ${expectedTotal} vehicles. ` +
            `Do you want to continue with this pattern?`
          );
          if (!confirmed) return;
        }
        
        patternData = newPattern;
        patternCycle = newPattern.length;
        updateSlotConfiguration();
        showPatternEditor = false;
      } else {
        alert('Please enter valid numbers (e.g., 1,2 or [1,2])');
      }
    } catch (error) {
      alert('Invalid pattern format. Please use format like "1,2" or "[1,2]"');
    }
  }

  function togglePatternEditor() {
    if (showPatternEditor) {
      // Cancel editing - revert to calculated pattern
      calculatedPattern = calculatePattern(Number(productionRate));
      patternCycle = calculatedPattern.cycle;
      patternData = calculatedPattern.pattern;
      updateSlotConfiguration();
    } else {
      // Start editing - populate input with current pattern
      manualPatternInput = patternData.join(',');
    }
    showPatternEditor = !showPatternEditor;
  }
</script>

{#if showModal}
  <div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 transition-opacity duration-200">
    <div class="theme-bg-primary rounded-2xl shadow-2xl p-8 w-[32rem] animate-fade-in transition-colors duration-200">
      <div class="flex items-center justify-between mb-6">
        <div class="font-bold text-lg text-blue-700 dark:text-blue-300 flex items-center gap-2 transition-colors duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Production Plan
        </div>
        <button 
          class="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors duration-200" 
          on:click={handleClose} 
          aria-label="Close modal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form on:submit|preventDefault={handleSubmit} class="space-y-6">
        <!-- Production Rate -->
        <div>
          <label for="productionRate" class="block text-sm font-medium theme-text-primary mb-2">Production Rate (vehicles/day) *</label>
          <input
            type="number"
            id="productionRate"
            bind:value={productionRate}
            min="0.1"
            max="10"
            step="0.1"
            class="w-full px-3 py-2 border theme-border rounded theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
            placeholder="Enter production rate (e.g., 1.5)"
            on:change={handleProductionRateChange}
            required
          />
          <p class="mt-1 text-xs theme-text-secondary">Decimal values supported (e.g., 1.5 = 3 vehicles every 2 days)</p>
        </div>

        <!-- Pattern Display -->
        {#if calculatedPattern.cycle > 1}
          <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-sm font-medium text-blue-800 dark:text-blue-200">Production Pattern</h4>
              <button
                type="button"
                class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline"
                on:click={togglePatternEditor}
              >
                {showPatternEditor ? 'Cancel Edit' : 'Edit Pattern'}
              </button>
            </div>
            
            {#if showPatternEditor}
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <input
                    type="text"
                    bind:value={manualPatternInput}
                    class="flex-1 px-2 py-1 text-sm border border-blue-300 dark:border-blue-600 rounded theme-bg-secondary theme-text-primary"
                    placeholder="e.g., 1,2 or [1,2]"
                  />
                  <button
                    type="button"
                    class="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    on:click={handleManualPatternChange}
                  >
                    Apply
                  </button>
                </div>
                <p class="text-xs text-blue-600 dark:text-blue-400">
                  Enter pattern as comma-separated numbers (e.g., "1,2" for [1,2])
                </p>
              </div>
            {:else}
              <p class="text-sm text-blue-700 dark:text-blue-300">
                {patternData.reduce((a, b) => a + b, 0)} vehicles every {patternCycle} days
              </p>
              <p class="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Pattern: [{patternData.join(', ')}] over {patternCycle} days
              </p>
            {/if}
          </div>
        {/if}

        <!-- Effective Date -->
        <div>
          <label for="dtWef" class="block text-sm font-medium theme-text-primary mb-2">Effective From *</label>
          <input
            type="date"
            id="dtWef"
            bind:value={dtWef}
            class="w-full px-3 py-2 border theme-border rounded theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
            required
          />
          <p class="mt-1 text-xs theme-text-secondary">Date from which this production plan will be effective</p>
        </div>

        <!-- Pattern-based Time Slots -->
        <div>
          <span class="block text-sm font-medium theme-text-primary mb-3">Entry Times by Pattern Day *</span>
          <div class="space-y-4">
            {#each slotConfiguration as dayConfig, dayIndex}
              <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <h5 class="text-sm font-medium theme-text-primary mb-2">
                  Day {dayConfig.day} ({patternData[dayIndex]} {patternData[dayIndex] === 1 ? 'vehicle' : 'vehicles'})
                </h5>
                <div class="space-y-2">
                  {#each dayConfig.slots as slot, slotIndex}
                    <div class="flex items-center gap-4">
                      <label for="timeSlot{dayConfig.day}_{slot.slot_order}" class="text-sm font-medium theme-text-secondary w-16">
                        Slot {slot.slot_order}
                      </label>
                      <input
                        type="time"
                        id="timeSlot{dayConfig.day}_{slot.slot_order}"
                        bind:value={slot.entry_time}
                        class="px-3 py-2 border theme-border rounded theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
                        required
                      />
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
          <p class="mt-2 text-xs theme-text-secondary">
            Configure entry times for each day in the production pattern.
          </p>
        </div>

        <!-- Action Buttons -->
        <div class="flex justify-end gap-3 pt-4">
          <button
            type="button"
            class="px-4 py-2 bg-gray-500 text-white rounded-lg border-2 border-gray-500 shadow hover:bg-gray-600 hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-800 active:bg-gray-700 active:border-gray-700 transition-all duration-200"
            on:click={handleClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-4 py-2 bg-blue-500 text-white rounded-lg border-2 border-blue-500 shadow hover:bg-blue-600 hover:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 active:bg-blue-700 active:border-blue-700 transition-all duration-200"
          >
            Save Plan
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fade-in 0.2s ease;
  }
</style> 