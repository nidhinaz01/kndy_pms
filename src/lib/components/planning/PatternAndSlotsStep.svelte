<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { timeToMinutes } from '$lib/utils/planWorkUtils';

  export let shifts: any[] = [];
  export let shiftDistribution: any[] = [];
  export let ppdCount: number = 0;

  const dispatch = createEventDispatcher();

  let pattern = { cycle: 1, pattern: [1] };
  let selectedPatternIndex = 0;
  let patternTimeSlots: Array<{
    day: number;
    vehicles: number;
    slots: Array<{
      slot_order: number;
      entry_time: string;
    }>;
  }> = [];
  let errors: Record<string, string> = {};

  function calculatePattern(rate: number): { cycle: number; pattern: number[] } {
    if (rate <= 0) {
      return { cycle: 1, pattern: [0] };
    }

    // Handle simple cases
    if (rate === Math.floor(rate)) {
      return { cycle: 1, pattern: [rate] };
    }

    // Convert decimal to fraction approximation
    const precision = 100;
    const numerator = Math.round(rate * precision);
    const denominator = precision;
    
    // Find the simplest fraction
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(numerator, denominator);
    const simplifiedNum = numerator / divisor;
    const simplifiedDen = denominator / divisor;

    // Generate pattern
    const pattern: number[] = [];
    for (let i = 0; i < simplifiedDen; i++) {
      pattern.push(Math.floor(simplifiedNum / simplifiedDen) + (i < simplifiedNum % simplifiedDen ? 1 : 0));
    }

    return { cycle: simplifiedDen, pattern };
  }

  function generatePermutations(arr: number[]): number[][] {
    if (arr.length <= 1) return [arr];
    
    const perms: number[][] = [];
    for (let i = 0; i < arr.length; i++) {
      const current = arr[i];
      const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
      const remainingPerms = generatePermutations(remaining);
      
      for (const perm of remainingPerms) {
        perms.push([current, ...perm]);
      }
    }
    
    // Remove duplicates
    const uniquePerms = perms.filter((perm, index, self) => 
      index === self.findIndex(p => JSON.stringify(p) === JSON.stringify(perm))
    );
    
    return uniquePerms;
  }

  // Calculate pattern based on daily production count
  $: if (ppdCount > 0) {
    pattern = calculatePattern(ppdCount);
  }

  // Update time slots when pattern selection changes
  $: if (ppdCount > 0) {
    if (pattern.cycle > 1 && selectedPatternIndex >= 0) {
      // For fractional rates, use selected pattern permutation
      const permutations = generatePermutations(pattern.pattern);
      const selectedPattern = permutations[selectedPatternIndex] || pattern.pattern;
      
      patternTimeSlots = selectedPattern.map((vehicles, dayIndex) => ({
        day: dayIndex + 1,
        vehicles: vehicles,
        slots: Array.from({ length: vehicles }, (_, i) => ({
          slot_order: i + 1,
          entry_time: ''
        }))
      }));
    } else if (pattern.cycle === 1) {
      // For whole number rates, create single day with all vehicles
      patternTimeSlots = [{
        day: 1,
        vehicles: pattern.pattern[0],
        slots: Array.from({ length: pattern.pattern[0] }, (_, i) => ({
          slot_order: i + 1,
          entry_time: ''
        }))
      }];
    }
  }

  function validateForm(): boolean {
    errors = {};

    // Validate time slots for any rate > 0
    if (ppdCount > 0 && patternTimeSlots.length > 0) {
      for (let dayIndex = 0; dayIndex < patternTimeSlots.length; dayIndex++) {
        const day = patternTimeSlots[dayIndex];
        for (let slotIndex = 0; slotIndex < day.slots.length; slotIndex++) {
          const slot = day.slots[slotIndex];
          if (!slot.entry_time) {
            errors[`day${dayIndex}slot${slotIndex}`] = `Time required for Day ${dayIndex + 1}, Slot ${slotIndex + 1}`;
          } else {
            // Validate that entry time is within shift timings
            const slotTimeValidation = validateSlotTime(slot.entry_time);
            if (!slotTimeValidation.isValid && slotTimeValidation.error) {
              errors[`day${dayIndex}slot${slotIndex}`] = slotTimeValidation.error;
            }
          }
        }
      }
    }

    return Object.keys(errors).length === 0;
  }

  function validateSlotTime(entryTime: string): { isValid: boolean; error?: string } {
    if (!entryTime || !shifts.length) {
      return { isValid: true };
    }

    // Convert entry time to minutes for comparison
    const entryMinutes = timeToMinutes(entryTime);

    // Check if entry time falls within any of the active shifts
    const validShifts = shifts.filter(shift => {
      const shiftData = shift.hr_shift_master;
      const startMinutes = timeToMinutes(shiftData.start_time);
      const endMinutes = timeToMinutes(shiftData.end_time);
      
      // Handle overnight shifts (end time is next day)
      if (endMinutes < startMinutes) {
        return entryMinutes >= startMinutes || entryMinutes <= endMinutes;
      } else {
        return entryMinutes >= startMinutes && entryMinutes <= endMinutes;
      }
    });

    if (validShifts.length === 0) {
      const shiftRanges = shifts.map(shift => {
        const shiftData = shift.hr_shift_master;
        return `${shiftData.shift_name} (${shiftData.start_time} - ${shiftData.end_time})`;
      }).join(', ');
      
      return {
        isValid: false,
        error: `Entry time ${entryTime} is outside shift timings: ${shiftRanges}`
      };
    }

    return { isValid: true };
  }

  function handleNext() {
    if (!validateForm()) return;

    // Get selected pattern permutation
    const permutations = generatePermutations(pattern.pattern);
    const selectedPattern = permutations[selectedPatternIndex] || pattern.pattern;

    dispatch('next', {
      pattern: {
        cycle: pattern.cycle,
        pattern: selectedPattern
      },
      patternTimeSlots
    });
  }

  function handleBack() {
    dispatch('back');
  }

  function addSlot(dayIndex: number) {
    const day = patternTimeSlots[dayIndex];
    day.slots.push({
      slot_order: day.slots.length + 1,
      entry_time: ''
    });
    day.vehicles = day.slots.length;
    patternTimeSlots = [...patternTimeSlots]; // Trigger reactivity
  }

  function removeSlot(dayIndex: number, slotIndex: number) {
    const day = patternTimeSlots[dayIndex];
    day.slots.splice(slotIndex, 1);
    day.slots.forEach((slot, index) => {
      slot.slot_order = index + 1;
    });
    day.vehicles = day.slots.length;
    patternTimeSlots = [...patternTimeSlots]; // Trigger reactivity
  }
</script>

<div class="space-y-6">
  <div class="text-center">
    <h2 class="text-2xl font-bold theme-text-primary mb-2">Step 4: Pattern Selection & Entry Slots</h2>
    <p class="text-gray-600 dark:text-gray-400">Select pattern and configure entry time slots</p>
  </div>

  <!-- Shift Distribution Summary -->
  <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800">
    <h3 class="font-medium text-blue-800 dark:text-blue-200 mb-2">Shift Distribution Summary</h3>
    <div class="space-y-1 text-sm text-blue-700 dark:text-blue-300">
      <p>• Daily target: {ppdCount} vehicles per day</p>
      <p>• Active shifts: {shifts.length} shifts</p>
      {#each shiftDistribution as shift}
        <p>• Shift {shift.shift_id}: {shift.target_quantity} vehicles</p>
      {/each}
    </div>
  </div>

  <!-- Pattern Selection -->
  {#if pattern.cycle > 1}
    <div class="p-4 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-800">
      <h3 class="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Production Pattern</h3>
      <div class="space-y-1 text-sm text-yellow-700 dark:text-yellow-300 mb-4">
        <p>• {ppdCount} vehicles/day converts to pattern over {pattern.cycle} days</p>
        <p>• Total: {pattern.pattern.reduce((a, b) => a + b, 0)} vehicles over {pattern.cycle} days</p>
      </div>
      
      <!-- Pattern Selection -->
      <div>
        <div class="block text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
          Select Pattern Distribution:
        </div>
        <div class="grid grid-cols-2 gap-2">
          {#each generatePermutations(pattern.pattern) as perm, i}
            <label class="flex items-center p-2 border rounded cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-800/30 {selectedPatternIndex === i ? 'bg-yellow-200 dark:bg-yellow-800/50 border-yellow-400' : 'border-yellow-300'}">
              <input
                type="radio"
                name="pattern"
                value={i}
                bind:group={selectedPatternIndex}
                class="mr-2"
                id={`pattern-${i}`}
              />
              <span class="text-sm">[{perm.join(', ')}]</span>
            </label>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <!-- Available Shift Timings -->
  {#if shifts.length > 0}
    <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800">
      <h3 class="font-medium text-blue-800 dark:text-blue-200 mb-2">Available Shift Timings</h3>
      <div class="space-y-1 text-sm text-blue-700 dark:text-blue-300">
        {#each shifts as shift}
          <p>• {shift.hr_shift_master.shift_name}: {shift.hr_shift_master.start_time} - {shift.hr_shift_master.end_time}</p>
        {/each}
      </div>
      <p class="text-xs text-blue-600 dark:text-blue-400 mt-2">
        Entry times must fall within these shift timings.
      </p>
    </div>
  {/if}

  <!-- Pattern Time Slots Configuration -->
  {#if patternTimeSlots.length > 0}
    <div class="space-y-4">
      <h3 class="text-lg font-medium theme-text-primary">Configure Entry Time Slots</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        Define the entry times for each vehicle slot. All slots must have an entry time specified and must fall within the shift timings above.
      </p>
      
      {#each patternTimeSlots as day, dayIndex}
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
  {/if}

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