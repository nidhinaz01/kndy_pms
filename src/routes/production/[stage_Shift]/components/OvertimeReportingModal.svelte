<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { X } from 'lucide-svelte';
  import type { WorkerOvertime } from '$lib/services/overtimeCalculationService';
  import { formatTime } from '../utils/timeUtils';

  export let isOpen: boolean = false;
  export let overtimeData: WorkerOvertime[] = [];
  export let isLoading: boolean = false;

  const dispatch = createEventDispatcher();

  function handleClose() {
    dispatch('close');
  }

  function handleConfirm() {
    dispatch('confirm');
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  function minutesToHours(minutes: number): number {
    return minutes / 60;
  }

  $: totalOvertimeMinutes = overtimeData.reduce((sum, worker) => sum + worker.overtimeMinutes, 0);
  $: totalOvertimeAmount = overtimeData.reduce((sum, worker) => sum + worker.overtimeAmount, 0);
</script>

{#if isOpen}
  <!-- Modal backdrop -->
  <button 
    class="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 z-[9999] w-full h-full border-none p-0"
    on:click={handleClose}
    aria-label="Close modal"
  ></button>
  
  <!-- Modal content -->
  <div class="fixed inset-0 z-[10000] flex items-center justify-center p-4">
    <div class="theme-bg-primary rounded-lg shadow-2xl dark:shadow-black/50 border-2 border-gray-300 dark:border-gray-600 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="px-6 py-4 border-b theme-border sticky top-0 theme-bg-primary">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold theme-text-primary">⏰ Overtime Reporting</h3>
            <p class="text-sm theme-text-secondary mt-1">
              Review and confirm overtime hours and amounts
            </p>
          </div>
          <button
            type="button"
            class="theme-text-secondary hover:theme-text-primary transition-colors"
            on:click={handleClose}
          >
            <X class="w-6 h-6" />
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="px-6 py-4 space-y-6">
        {#if isLoading}
          <div class="text-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p class="theme-text-secondary">Calculating overtime...</p>
          </div>
        {:else if overtimeData.length === 0}
          <div class="text-center py-12">
            <p class="theme-text-secondary text-lg">No overtime detected</p>
          </div>
        {:else}
          <!-- Summary -->
          <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div class="flex flex-wrap gap-4 text-sm">
              <div class="theme-text-primary">
                <span class="font-medium">Total Workers with OT:</span> {overtimeData.length}
              </div>
              <div class="theme-text-primary">
                <span class="font-medium">Total OT Hours:</span> {formatTime(minutesToHours(totalOvertimeMinutes))}
              </div>
              <div class="theme-text-primary">
                <span class="font-medium">Total OT Amount:</span> {formatCurrency(totalOvertimeAmount)}
              </div>
            </div>
          </div>

          <!-- Worker Details -->
          {#each overtimeData as worker}
            <div class="border theme-border rounded-lg p-4 space-y-3">
              <!-- Worker Header -->
              <div class="flex items-center justify-between pb-2 border-b theme-border">
                <div>
                  <h4 class="font-semibold theme-text-primary">{worker.workerName} ({worker.workerId})</h4>
                  <p class="text-sm theme-text-secondary">
                    Shift: {worker.shiftCode} ({worker.shiftStartTime} - {worker.shiftEndTime})
                  </p>
                </div>
                <div class="text-right">
                  <div class="text-sm theme-text-secondary">Total OT</div>
                  <div class="text-lg font-semibold text-orange-600 dark:text-orange-400">
                    {formatTime(minutesToHours(worker.overtimeMinutes))}
                  </div>
                  <div class="text-sm font-medium text-orange-600 dark:text-orange-400">
                    {formatCurrency(worker.overtimeAmount)}
                  </div>
                </div>
              </div>

              <!-- Worker Summary -->
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <div class="theme-text-secondary text-xs">Total Worked</div>
                  <div class="font-medium theme-text-primary">
                    {formatTime(worker.totalWorkedMinutes / 60)}
                  </div>
                </div>
                <div>
                  <div class="theme-text-secondary text-xs">Shift Time</div>
                  <div class="font-medium theme-text-primary">
                    {formatTime(worker.shiftMinutes / 60)}
                  </div>
                </div>
                <div>
                  <div class="theme-text-secondary text-xs">Break Time</div>
                  <div class="font-medium theme-text-primary">
                    {formatTime(worker.breakMinutes / 60)}
                  </div>
                </div>
                <div>
                  <div class="theme-text-secondary text-xs">Available Work</div>
                  <div class="font-medium theme-text-primary">
                    {formatTime(worker.availableWorkMinutes / 60)}
                  </div>
                </div>
              </div>

              <!-- Works with OT -->
              <div class="mt-3">
                <div class="text-sm font-medium theme-text-secondary mb-2">Works with Overtime:</div>
                <div class="overflow-x-auto">
                  <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead class="theme-bg-secondary">
                      <tr>
                        <th class="px-3 py-2 text-left text-xs font-medium theme-text-secondary uppercase">Work Code</th>
                        <th class="px-3 py-2 text-left text-xs font-medium theme-text-secondary uppercase">Work Name</th>
                        <th class="px-3 py-2 text-left text-xs font-medium theme-text-secondary uppercase">Time</th>
                        <th class="px-3 py-2 text-left text-xs font-medium theme-text-secondary uppercase">Hours Worked</th>
                        <th class="px-3 py-2 text-right text-xs font-medium theme-text-secondary uppercase">OT Hours</th>
                        <th class="px-3 py-2 text-right text-xs font-medium theme-text-secondary uppercase">OT Amount</th>
                      </tr>
                    </thead>
                    <tbody class="theme-bg-primary divide-y divide-gray-200 dark:divide-gray-700">
                      {#each worker.works as work}
                        <tr>
                          <td class="px-3 py-2 text-sm theme-text-primary">{work.workCode}</td>
                          <td class="px-3 py-2 text-sm theme-text-primary">{work.workName}</td>
                          <td class="px-3 py-2 text-sm theme-text-secondary">
                            {work.fromTime} - {work.toTime}
                          </td>
                          <td class="px-3 py-2 text-sm theme-text-primary">
                            {formatTime(work.hoursWorkedToday)}
                          </td>
                          <td class="px-3 py-2 text-sm text-right font-medium text-orange-600 dark:text-orange-400">
                            {formatTime(minutesToHours(work.overtimeMinutes))}
                          </td>
                          <td class="px-3 py-2 text-sm text-right font-medium text-orange-600 dark:text-orange-400">
                            {formatCurrency(work.overtimeAmount)}
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                    <tfoot class="theme-bg-secondary">
                      <tr>
                        <td colspan="4" class="px-3 py-2 text-sm font-medium theme-text-primary text-right">
                          Total:
                        </td>
                        <td class="px-3 py-2 text-sm font-semibold text-orange-600 dark:text-orange-400 text-right">
                          {formatTime(minutesToHours(worker.overtimeMinutes))}
                        </td>
                        <td class="px-3 py-2 text-sm font-semibold text-orange-600 dark:text-orange-400 text-right">
                          {formatCurrency(worker.overtimeAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t theme-border sticky bottom-0 theme-bg-primary flex items-center justify-between">
        <div class="text-sm theme-text-secondary">
          {#if overtimeData.length > 0}
            <p>Please review the overtime details above and confirm to proceed.</p>
          {/if}
        </div>
        <div class="flex items-center space-x-3">
          <Button variant="secondary" size="sm" on:click={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            size="sm" 
            on:click={handleConfirm}
            disabled={isLoading || overtimeData.length === 0}
          >
            {isLoading ? 'Processing...' : 'Confirm & Save OT'}
          </Button>
        </div>
      </div>
    </div>
  </div>
{/if}

