<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { generateDefaultEntrySlots } from '$lib/api/productionPlanService';

  export let shifts: any[] = [];
  export let entrySlots: any[] = [];

  const dispatch = createEventDispatcher();

  let errors: Record<string, string> = {};

  // Generate default entry slots when component loads
  $: if (shifts.length > 0 && entrySlots.length === 0) {
    entrySlots = generateDefaultEntrySlots(shifts);
  }

  function validateForm(): boolean {
    errors = {};

    // Check if each shift has at least one slot
    const shiftsWithoutSlots = shifts.filter(shift => {
      const shiftSlots = entrySlots.find(es => es.shift_id === shift.shift_id);
      return !shiftSlots || shiftSlots.slots.length === 0;
    });

    if (shiftsWithoutSlots.length > 0) {
      errors.slots = 'Each shift must have at least one entry slot';
    }

    // Check for duplicate entry times within each shift
    const duplicateTimes = entrySlots.filter(shiftSlot => {
      const times = shiftSlot.slots.map((slot: any) => slot.entry_time);
      return new Set(times).size !== times.length;
    });

    if (duplicateTimes.length > 0) {
      errors.duplicate = 'Each shift cannot have duplicate entry times';
    }

    return Object.keys(errors).length === 0;
  }

  function handleNext() {
    if (!validateForm()) return;

    dispatch('next', {
      entrySlots
    });
  }

  function handleBack() {
    dispatch('back');
  }

  function addSlot(shiftId: number) {
    const shiftSlots = entrySlots.find(es => es.shift_id === shiftId);
    if (shiftSlots) {
      const newSlotOrder = Math.max(...shiftSlots.slots.map((s: any) => s.slot_order), 0) + 1;
      shiftSlots.slots.push({
        entry_time: '09:00',
        slot_order: newSlotOrder
      });
      entrySlots = [...entrySlots]; // Trigger reactivity
    }
  }

  function removeSlot(shiftId: number, slotIndex: number) {
    const shiftSlots = entrySlots.find(es => es.shift_id === shiftId);
    if (shiftSlots && shiftSlots.slots.length > 1) {
      shiftSlots.slots.splice(slotIndex, 1);
      // Reorder remaining slots
      shiftSlots.slots.forEach((slot: any, index: number) => {
        slot.slot_order = index + 1;
      });
      entrySlots = [...entrySlots]; // Trigger reactivity
    }
  }

  function updateSlotTime(shiftId: number, slotIndex: number, newTime: string) {
    const shiftSlots = entrySlots.find(es => es.shift_id === shiftId);
    if (shiftSlots) {
      shiftSlots.slots[slotIndex].entry_time = newTime;
      entrySlots = [...entrySlots]; // Trigger reactivity
    }
  }

  function resetToDefaults() {
    entrySlots = generateDefaultEntrySlots(shifts);
  }
</script>

<div class="space-y-6">
  <div class="text-center">
    <h2 class="text-2xl font-bold theme-text-primary mb-2">Step 4: Entry Time Slots</h2>
    <p class="text-gray-600 dark:text-gray-400">Define entry time slots for each shift</p>
  </div>

  <div class="space-y-4">
    <!-- Instructions -->
    <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800">
      <h3 class="font-medium text-blue-800 dark:text-blue-200 mb-2">Instructions</h3>
      <div class="space-y-1 text-sm text-blue-700 dark:text-blue-300">
        <p>• Define when vehicles should enter production for each shift</p>
        <p>• Each shift must have at least one entry slot</p>
        <p>• Entry times should be within the shift's time range</p>
        <p>• You can add multiple slots per shift if needed</p>
      </div>
    </div>

    <!-- Entry Slots for Each Shift -->
    <div class="space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="text-lg font-medium theme-text-primary">Entry Slots</h3>
        <button
          on:click={resetToDefaults}
          class="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:text-blue-400 dark:hover:text-blue-200 dark:hover:bg-blue-900 rounded transition-colors duration-200"
        >
          Reset to Defaults
        </button>
      </div>

      {#each shifts as shift}
        {@const shiftSlots = entrySlots.find(es => es.shift_id === shift.shift_id)}
        <div class="p-4 border theme-border rounded-lg theme-bg-secondary">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h4 class="font-medium theme-text-primary">{shift.hr_shift_master.shift_name}</h4>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {shift.hr_shift_master.start_time} - {shift.hr_shift_master.end_time}
              </p>
            </div>
            <button
              on:click={() => addSlot(shift.shift_id)}
              class="px-3 py-1 text-sm bg-green-600 text-white hover:bg-green-700 rounded transition-colors duration-200"
            >
              Add Slot
            </button>
          </div>

          {#if shiftSlots}
            <div class="space-y-2">
              {#each shiftSlots.slots as slot, slotIndex}
                <div class="flex items-center gap-3">
                  <span class="text-sm theme-text-secondary w-16">Slot {slot.slot_order}:</span>
                  <input
                    type="time"
                    value={slot.entry_time}
                    on:change={(e) => updateSlotTime(shift.shift_id, slotIndex, (e.target as HTMLInputElement).value)}
                    class="px-3 py-2 border theme-border rounded-md theme-bg-primary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {#if shiftSlots.slots.length > 1}
                    <button
                      on:click={() => removeSlot(shift.shift_id, slotIndex)}
                      class="px-2 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-100 dark:text-red-400 dark:hover:text-red-200 dark:hover:bg-red-900 rounded transition-colors duration-200"
                    >
                      Remove
                    </button>
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-sm text-gray-500 dark:text-gray-400">No entry slots defined</p>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Validation Errors -->
    {#if errors.slots}
      <div class="p-3 bg-red-100 border border-red-400 text-red-700 rounded dark:bg-red-900 dark:border-red-800 dark:text-red-200">
        {errors.slots}
      </div>
    {/if}

    {#if errors.duplicate}
      <div class="p-3 bg-red-100 border border-red-400 text-red-700 rounded dark:bg-red-900 dark:border-red-800 dark:text-red-200">
        {errors.duplicate}
      </div>
    {/if}

    <!-- Summary -->
    {#if entrySlots.length > 0}
      <div class="p-4 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/20 dark:border-green-800">
        <h3 class="font-medium text-green-800 dark:text-green-200 mb-2">Entry Slots Summary</h3>
        <div class="space-y-1 text-sm text-green-700 dark:text-green-300">
          {#each entrySlots as shiftSlot}
            {@const shift = shifts.find(s => s.shift_id === shiftSlot.shift_id)}
            <p>• {shift?.hr_shift_master.shift_name}: {shiftSlot.slots.length} slot(s)</p>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <!-- Actions -->
  <div class="flex justify-between pt-4">
    <Button
      variant="secondary"
      on:click={handleBack}
    >
      Back
    </Button>
    <Button
      variant="primary"
      on:click={handleNext}
    >
      Next
    </Button>
  </div>
</div> 