<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';

  export let pattern: { cycle: number; pattern: number[] } = { cycle: 1, pattern: [1] };

  const dispatch = createEventDispatcher();

  let timeSlots: Array<{
    day: number;
    vehicles: number;
    slots: Array<{
      slot_order: number;
      entry_time: string;
    }>;
  }> = [];

  let errors: Record<string, string> = {};

  // Initialize time slots based on pattern
  $: if (pattern && pattern.pattern.length > 0) {
    timeSlots = pattern.pattern.map((vehicles, dayIndex) => ({
      day: dayIndex + 1,
      vehicles: vehicles,
      slots: Array.from({ length: vehicles }, (_, i) => ({
        slot_order: i + 1,
        entry_time: ''
      }))
    }));
  }

  function validateForm(): boolean {
    errors = {};

    for (let dayIndex = 0; dayIndex < timeSlots.length; dayIndex++) {
      const day = timeSlots[dayIndex];
      for (let slotIndex = 0; slotIndex < day.slots.length; slotIndex++) {
        const slot = day.slots[slotIndex];
        if (!slot.entry_time) {
          errors[`day${dayIndex}slot${slotIndex}`] = `Time required for Day ${dayIndex + 1}, Slot ${slotIndex + 1}`;
        }
      }
    }

    return Object.keys(errors).length === 0;
  }

  function handleNext() {
    if (!validateForm()) return;

    dispatch('next', {
      timeSlots
    });
  }

  function handleBack() {
    dispatch('back');
  }

  function addSlot(dayIndex: number) {
    const day = timeSlots[dayIndex];
    day.slots.push({
      slot_order: day.slots.length + 1,
      entry_time: ''
    });
    day.vehicles = day.slots.length;
    timeSlots = [...timeSlots]; // Trigger reactivity
  }

  function removeSlot(dayIndex: number, slotIndex: number) {
    const day = timeSlots[dayIndex];
    day.slots.splice(slotIndex, 1);
    day.slots.forEach((slot, index) => {
      slot.slot_order = index + 1;
    });
    day.vehicles = day.slots.length;
    timeSlots = [...timeSlots]; // Trigger reactivity
  }
</script>

<div class="space-y-6">
  <div class="text-center">
    <h2 class="text-2xl font-bold theme-text-primary mb-2">Step 4: Pattern-Based Time Slots</h2>
    <p class="text-gray-600 dark:text-gray-400">Configure entry time slots for each day in the pattern</p>
  </div>

  <!-- Pattern Summary -->
  <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800">
    <h3 class="font-medium text-blue-800 dark:text-blue-200 mb-2">Pattern Summary</h3>
    <div class="space-y-1 text-sm text-blue-700 dark:text-blue-300">
      <p>• Pattern: [{pattern.pattern.join(', ')}] vehicles per day</p>
      <p>• Cycle: {pattern.cycle} days</p>
      <p>• Total: {pattern.pattern.reduce((a, b) => a + b, 0)} vehicles over {pattern.cycle} days</p>
    </div>
  </div>

  <!-- Time Slots Configuration -->
  <div class="space-y-4">
    {#each timeSlots as day, dayIndex}
      <div class="p-4 border theme-border rounded-lg">
        <div class="flex items-center justify-between mb-4">
          <h4 class="text-lg font-medium theme-text-primary">
            Day {day.day} - {day.vehicles} vehicle{day.vehicles !== 1 ? 's' : ''}
          </h4>
          <button
            type="button"
            class="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors duration-200"
            on:click={() => addSlot(dayIndex)}
          >
            + Add Slot
          </button>
        </div>

        <div class="space-y-3">
          {#each day.slots as slot, slotIndex}
            <div class="flex items-center space-x-3">
              <span class="text-sm font-medium theme-text-secondary w-16">
                Slot {slot.slot_order}:
              </span>
              <input
                type="time"
                bind:value={slot.entry_time}
                class="px-3 py-2 border theme-border rounded-md theme-bg-secondary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {#if day.slots.length > 1}
                <button
                  type="button"
                  class="px-2 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors duration-200"
                  on:click={() => removeSlot(dayIndex, slotIndex)}
                >
                  Remove
                </button>
              {/if}
              {#if errors[`day${dayIndex}slot${slotIndex}`]}
                <span class="text-red-500 text-sm">{errors[`day${dayIndex}slot${slotIndex}`]}</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/each}
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