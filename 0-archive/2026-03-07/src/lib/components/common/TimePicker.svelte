<script lang="ts">
  import { Clock } from 'lucide-svelte';
  
  export let value: string = ''; // 24-hour format (HH:MM)
  export let label: string = 'Time';
  
  // Convert 24-hour to 12-hour components
  function parseTime(time24: string): { hour: number; minute: number; ampm: 'AM' | 'PM' } {
    if (!time24 || !time24.includes(':')) {
      return { hour: 12, minute: 0, ampm: 'AM' };
    }
    
    const [hours, minutes] = time24.split(':');
    const hour24 = parseInt(hours, 10) || 0;
    const minute = parseInt(minutes, 10) || 0;
    
    let hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm: 'AM' | 'PM' = hour24 < 12 ? 'AM' : 'PM';
    
    return { hour: hour12, minute, ampm };
  }
  
  // Convert 12-hour components to 24-hour format
  function formatTime24(hour12: number, minute: number, ampm: 'AM' | 'PM'): string {
    let hour24 = hour12;
    if (ampm === 'AM') {
      hour24 = hour12 === 12 ? 0 : hour12;
    } else {
      hour24 = hour12 === 12 ? 12 : hour12 + 12;
    }
    return `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }
  
  let { hour, minute, ampm } = parseTime(value);
  let showPicker = false;
  let buttonId = `time-picker-${Math.random().toString(36).slice(2, 11)}`;
  
  // Update when value prop changes
  $: {
    const parsed = parseTime(value);
    hour = parsed.hour;
    minute = parsed.minute;
    ampm = parsed.ampm;
  }
  
  function updateTime(newHour?: number, newMinute?: number, newAmpm?: 'AM' | 'PM') {
    if (newHour !== undefined) hour = newHour;
    if (newMinute !== undefined) minute = newMinute;
    if (newAmpm !== undefined) ampm = newAmpm;
    
    value = formatTime24(hour, minute, ampm);
  }
  
  function togglePicker() {
    showPicker = !showPicker;
  }
  
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.time-picker-container')) {
      showPicker = false;
    }
  }
  
  // Generate hour options (1-12)
  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  
  // Generate minute options (0-59, in 5-minute increments for better UX)
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);
  
  function getDisplayTime(): string {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${ampm}`;
  }
</script>

<div class="time-picker-container relative">
  <label for={buttonId} class="block text-sm font-medium theme-text-primary mb-2">
    {label}
  </label>
  <button
    id={buttonId}
    type="button"
    on:click={togglePicker}
    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
  >
    <span class="flex items-center">
      <Clock class="w-4 h-4 mr-2 theme-text-secondary" />
      <span>{value ? getDisplayTime() : 'Select time...'}</span>
    </span>
    <span class="text-xs theme-text-secondary">▼</span>
  </button>
  
  {#if showPicker}
    <div
      role="dialog"
      aria-label="Time picker"
      tabindex="-1"
      class="absolute z-50 mt-1 w-full theme-bg-primary border theme-border rounded-lg shadow-lg p-4"
      on:click|stopPropagation
      on:keydown={(e) => {
        if (e.key === 'Escape') {
          showPicker = false;
        }
      }}
    >
      <div class="grid grid-cols-3 gap-2">
        <!-- Hour Selection -->
        <div>
          <div class="text-xs font-medium theme-text-secondary mb-2 text-center">Hour</div>
          <div class="max-h-48 overflow-y-auto space-y-1">
            {#each hours as h}
              <button
                type="button"
                on:click={() => updateTime(h)}
                class="w-full px-2 py-1 text-sm rounded {hour === h ? 'bg-blue-500 text-white' : 'theme-bg-secondary theme-text-primary hover:bg-gray-200 dark:hover:bg-gray-700'} transition-colors"
              >
                {h}
              </button>
            {/each}
          </div>
        </div>
        
        <!-- Minute Selection -->
        <div>
          <div class="text-xs font-medium theme-text-secondary mb-2 text-center">Minute</div>
          <div class="max-h-48 overflow-y-auto space-y-1">
            {#each minutes as m}
              <button
                type="button"
                on:click={() => updateTime(undefined, m)}
                class="w-full px-2 py-1 text-sm rounded {minute === m ? 'bg-blue-500 text-white' : 'theme-bg-secondary theme-text-primary hover:bg-gray-200 dark:hover:bg-gray-700'} transition-colors"
              >
                {m.toString().padStart(2, '0')}
              </button>
            {/each}
          </div>
        </div>
        
        <!-- AM/PM Selection -->
        <div>
          <div class="text-xs font-medium theme-text-secondary mb-2 text-center">Period</div>
          <div class="space-y-1">
            <button
              type="button"
              on:click={() => updateTime(undefined, undefined, 'AM')}
              class="w-full px-2 py-3 text-sm rounded {ampm === 'AM' ? 'bg-blue-500 text-white' : 'theme-bg-secondary theme-text-primary hover:bg-gray-200 dark:hover:bg-gray-700'} transition-colors"
            >
              AM
            </button>
            <button
              type="button"
              on:click={() => updateTime(undefined, undefined, 'PM')}
              class="w-full px-2 py-3 text-sm rounded {ampm === 'PM' ? 'bg-blue-500 text-white' : 'theme-bg-secondary theme-text-primary hover:bg-gray-200 dark:hover:bg-gray-700'} transition-colors"
            >
              PM
            </button>
          </div>
        </div>
      </div>
      
      <!-- Display Selected Time -->
      <div class="mt-4 pt-4 border-t theme-border text-center">
        <div class="text-lg font-medium theme-text-primary">
          {getDisplayTime()}
        </div>
        <button
          type="button"
          on:click={() => { showPicker = false; }}
          class="mt-2 w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
        >
          Done
        </button>
      </div>
    </div>
  {/if}
</div>

<svelte:window on:click={handleClickOutside} />

<style>
  .time-picker-container {
    position: relative;
  }
</style>

