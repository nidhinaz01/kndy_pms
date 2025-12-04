<script lang="ts">
  import type { ReportWorkFormData, LostTimeChunk } from '$lib/types/reportWork';
  import type { LostTimeReason } from '$lib/api/lostTimeReasons';

  export let formData: ReportWorkFormData;
  export let lostTimeReasons: LostTimeReason[] = [];
  export let currentChunk: LostTimeChunk | null = null;
  export let onAssignReason: (reasonId: number) => void = () => {};
</script>

{#if currentChunk}
  <div class="theme-bg-green-50 dark:theme-bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
    <div class="flex items-center justify-between mb-4">
      <h4 class="font-medium text-green-800 dark:text-green-200">
        Assign Reason - Chunk {formData.currentChunkIndex + 1} of {formData.lostTimeChunks.length}
      </h4>
      <div class="text-sm text-gray-600 dark:text-gray-400">
        {formData.currentChunkIndex + 1} / {formData.lostTimeChunks.length}
      </div>
    </div>

    <!-- Current Chunk Info -->
    <div class="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-600">
      <div class="grid grid-cols-3 gap-4 text-sm">
        <div>
          <span class="text-gray-600 dark:text-gray-400">Minutes:</span>
          <span class="text-gray-900 dark:text-gray-100 font-medium ml-2">{currentChunk?.minutes || 0}</span>
        </div>
        <div>
          <span class="text-gray-600 dark:text-gray-400">Current Reason:</span>
          <span class="text-gray-900 dark:text-gray-100 font-medium ml-2">{currentChunk?.reasonName || 'None'}</span>
        </div>
        <div>
          <span class="text-gray-600 dark:text-gray-400">Cost:</span>
          <span class="text-gray-900 dark:text-gray-100 font-medium ml-2">₹{currentChunk?.cost?.toFixed(2) || '0.00'}</span>
        </div>
      </div>
    </div>

    <!-- Reason Selection -->
    <div>
      <label for="reason-select" class="block text-sm font-medium theme-text-primary mb-2">
        Select Lost Time Reason
      </label>
      <select
        id="reason-select"
        value={currentChunk?.reasonId || ''}
        on:change={(e) => onAssignReason(parseInt(e.currentTarget.value) || 0)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-green-500 focus:border-transparent"
      >
        <option value="">Choose a reason...</option>
        {#each lostTimeReasons as reason}
          <option value={reason.id}>
            {reason.lost_time_reason} ({reason.p_head})
          </option>
        {/each}
      </select>
      
      {#if currentChunk?.reasonName}
        <div class="mt-2 text-sm text-green-700 dark:text-green-300">
          ✓ Reason assigned: {currentChunk.reasonName}
          {#if currentChunk.isPayable}
            <span class="ml-2 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs">
              Payable
            </span>
          {:else}
            <span class="ml-2 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs">
              Non-Payable
            </span>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

