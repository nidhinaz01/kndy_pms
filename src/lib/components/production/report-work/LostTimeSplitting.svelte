<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';
  import { Plus, Trash2 } from 'lucide-svelte';
  import { formatMinutes, calculateRemainingMinutes } from '$lib/utils/reportWorkUtils';
  import type { ReportWorkFormData, LostTimeChunk } from '$lib/types/reportWork';

  export let formData: ReportWorkFormData;
  export let standardTimeMinutes: number = 0;
  export let actualTimeMinutes: number = 0;
  export let onAddChunk: () => void = () => {};
  export let onRemoveChunk: (chunkId: string) => void = () => {};
  export let onUpdateChunkMinutes: (chunkId: string, minutes: number) => void = () => {};

  $: remainingMinutes = calculateRemainingMinutes(formData.totalLostTimeMinutes, formData.lostTimeChunks);
  $: allocatedMinutes = formData.lostTimeChunks.reduce((sum, chunk) => sum + chunk.minutes, 0);
</script>

<!-- Time Summary -->
<div class="theme-bg-blue-50 dark:theme-bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
  <h4 class="font-medium text-blue-800 dark:text-blue-200 mb-3">Time Summary</h4>
  <div class="grid grid-cols-2 gap-4 text-sm">
    <div>
      <span class="theme-text-secondary">Standard Time:</span>
      <span class="theme-text-primary font-medium ml-2">{formatMinutes(standardTimeMinutes)}</span>
    </div>
    <div>
      <span class="theme-text-secondary">Actual Time:</span>
      <span class="theme-text-primary font-medium ml-2">{formatMinutes(actualTimeMinutes)}</span>
    </div>
    <div>
      <span class="theme-text-secondary">Lost Time:</span>
      <span class="theme-text-primary font-medium ml-2">{formatMinutes(formData.totalLostTimeMinutes)} per worker</span>
    </div>
    <div>
      <span class="theme-text-secondary">Status:</span>
      <span class="theme-text-primary font-medium ml-2">
        {formData.completionStatus === 'C' ? 'Completed' : 'Not Completed'}
      </span>
    </div>
  </div>
</div>

<!-- Lost Time Splitting -->
<div class="theme-bg-orange-50 dark:theme-bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
  <div class="flex items-center justify-between mb-4">
    <h4 class="font-medium text-orange-800 dark:text-orange-200">Split Lost Time</h4>
    <Button 
      variant="secondary" 
      size="sm" 
      on:click={onAddChunk}
      disabled={remainingMinutes <= 0}
    >
      <Plus class="w-4 h-4 mr-1" />
      Add Chunk
    </Button>
  </div>

  <div class="text-sm mb-4 {remainingMinutes === 0 ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300'}">
    Total Lost Time: {formData.totalLostTimeMinutes} minutes | 
    Allocated: {allocatedMinutes} minutes | 
    Remaining: {remainingMinutes} minutes
    {#if remainingMinutes === 0}
      ✅ All minutes allocated
    {:else if remainingMinutes > 0}
      ⚠️ {remainingMinutes} minutes not allocated
    {/if}
  </div>

  {#if formData.lostTimeChunks.length === 0}
    <div class="text-center py-4 text-orange-600 dark:text-orange-400">
      <p>No lost time chunks added yet.</p>
      <p class="text-sm mt-1">Click "Add Chunk" to start splitting the lost time.</p>
    </div>
  {:else}
    <div class="space-y-3">
      {#each formData.lostTimeChunks as chunk, index}
        <div class="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800/50">
          <div class="w-8 text-sm font-medium text-gray-900 dark:text-gray-100">
            #{index + 1}
          </div>
          <div class="w-24">
            <input
              type="number"
              value={chunk.minutes}
              on:input={(e) => onUpdateChunkMinutes(chunk.id, parseInt((e.target as HTMLInputElement)?.value || '0'))}
              min="1"
              max={remainingMinutes + chunk.minutes}
              class="w-full px-3 py-2 border border-orange-300 dark:border-orange-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Minutes"
            />
          </div>
          <div class="flex-1 text-sm text-gray-900 dark:text-gray-100">
            {#if formData.currentStage >= 3}
              {chunk.reasonName || 'No reason assigned'}
              {#if chunk.reasonName}
                <span class="ml-2 text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                  ✓ Assigned
                </span>
              {/if}
            {:else}
              <span class="text-orange-600 dark:text-orange-400">Reason will be assigned in next step</span>
            {/if}
          </div>
          <div class="w-20 text-sm text-gray-900 dark:text-gray-100">
            {#if formData.currentStage >= 3}
              ₹{chunk.cost.toFixed(2)}
            {:else}
              <span class="text-orange-600 dark:text-orange-400">TBD</span>
            {/if}
          </div>
          <button
            type="button"
            on:click={() => onRemoveChunk(chunk.id)}
            class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

