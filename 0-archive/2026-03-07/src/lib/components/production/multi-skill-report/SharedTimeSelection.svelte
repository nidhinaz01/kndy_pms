<script lang="ts">
  import { Clock } from 'lucide-svelte';
  import { formatMinutes } from '$lib/utils/multiSkillReportUtils';
  import type { MultiSkillReportFormData } from '$lib/types/multiSkillReport';

  export let formData: MultiSkillReportFormData;
  export let actualTimeMinutes: number = 0;
  export let onDateChange: (field: string, value: string) => void = () => {};
  export let onTimeChange: (field: string, value: string) => void = () => {};
  export let onStatusChange: (value: 'C' | 'NC') => void = () => {};
</script>

<div>
  <h4 class="font-medium theme-text-primary mb-3">Shared Time Range</h4>
  <div class="grid grid-cols-2 gap-4">
    <div>
      <label for="from-date" class="block text-sm font-medium theme-text-primary mb-2">
        From Date
      </label>
      <input
        id="from-date"
        type="date"
        value={formData.fromDate}
        on:change={(e) => onDateChange('fromDate', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
    <div>
      <label for="from-time" class="block text-sm font-medium theme-text-primary mb-2">
        From Time
      </label>
      <input
        id="from-time"
        type="time"
        value={formData.fromTime}
        on:change={(e) => onTimeChange('fromTime', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
    <div>
      <label for="to-date" class="block text-sm font-medium theme-text-primary mb-2">
        To Date
      </label>
      <input
        id="to-date"
        type="date"
        value={formData.toDate}
        on:change={(e) => onDateChange('toDate', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
    <div>
      <label for="to-time" class="block text-sm font-medium theme-text-primary mb-2">
        To Time
      </label>
      <input
        id="to-time"
        type="time"
        value={formData.toTime}
        on:change={(e) => onTimeChange('toTime', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  </div>

  {#if actualTimeMinutes > 0}
    <div class="mt-4 theme-bg-blue-50 dark:theme-bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
      <div class="flex items-center">
        <Clock class="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
        <span class="text-sm font-medium text-blue-800 dark:text-blue-200">
          Actual Time: {formatMinutes(actualTimeMinutes)}
        </span>
      </div>
    </div>
  {/if}

  <div class="mt-4">
    <div class="block text-sm font-medium theme-text-primary mb-2">Work Status</div>
    <div class="flex space-x-4">
      <label for="status-completed" class="flex items-center">
        <input
          id="status-completed"
          type="radio"
          checked={formData.completionStatus === 'C'}
          on:change={() => onStatusChange('C')}
          class="mr-2"
        />
        <span class="theme-text-primary">Completed (C)</span>
      </label>
      <label for="status-not-completed" class="flex items-center">
        <input
          id="status-not-completed"
          type="radio"
          checked={formData.completionStatus === 'NC'}
          on:change={() => onStatusChange('NC')}
          class="mr-2"
        />
        <span class="theme-text-primary">Not Completed (NC)</span>
      </label>
    </div>
  </div>
</div>

