<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { X, AlertTriangle } from 'lucide-svelte';
  import { supabase } from '$lib/supabaseClient';
  import { removeWorkFromProduction } from '$lib/api/production';

  export let isOpen: boolean = false;
  export let work: any = null;
  export let stageCode: string = '';

  const dispatch = createEventDispatcher();

  let isLoading = false;
  let removalReason = '';
  let showConfirm = false;

  // Reset state when modal opens
  $: if (isOpen) {
    removalReason = '';
    showConfirm = false;
    isLoading = false;
  }

  function handleClose() {
    if (!isLoading) {
      removalReason = '';
      showConfirm = false;
      dispatch('close');
    }
  }

  function handleConfirm() {
    if (!removalReason.trim()) {
      alert('Please provide a reason for removing this work.');
      return;
    }
    showConfirm = true;
  }

  async function handleRemove() {
    if (!work || !removalReason.trim()) return;

    isLoading = true;
    try {
      const { getCurrentUsername } = await import('$lib/utils/userUtils');
      const currentUser = getCurrentUsername();
      const woDetailsId = work.wo_details_id;
      
      if (!woDetailsId) {
        alert('Error: Work order details ID not found. Cannot remove work.');
        isLoading = false;
        return;
      }
      
      // Determine if this is a non-standard work
      const isNonStandardWork = work.is_added_work || !work.std_work_type_details?.derived_sw_code;
      const derivedSwCode = isNonStandardWork ? null : (work.std_work_type_details?.derived_sw_code || null);
      const otherWorkCode = isNonStandardWork ? work.sw_code : null;
      
      const result = await removeWorkFromProduction(
        derivedSwCode,
        stageCode,
        woDetailsId,
        removalReason.trim(),
        currentUser,
        otherWorkCode
      );

      if (result.success) {
        alert('Work removed successfully.');
        dispatch('removed', { work });
        handleClose();
      } else {
        alert('Error removing work: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error removing work:', error);
      alert('Error removing work. Please try again.');
    } finally {
      isLoading = false;
    }
  }

  function handleCancelConfirm() {
    showConfirm = false;
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
    } catch {
      return dateStr;
    }
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 overflow-y-auto">
    <!-- Backdrop -->
    <div 
      class="fixed inset-0 bg-black bg-opacity-50 transition-opacity" 
      role="button"
      tabindex="-1"
      aria-label="Close modal"
      on:click={handleClose}
      on:keydown={(e) => e.key === 'Enter' || e.key === ' ' ? handleClose() : null}
    ></div>
    
    <!-- Modal -->
    <div class="flex min-h-full items-center justify-center p-4">
      <div class="relative w-full max-w-2xl theme-bg-primary rounded-lg shadow-xl border theme-border">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b theme-border">
          <div class="flex items-center gap-3">
            <AlertTriangle class="w-6 h-6 text-red-600 dark:text-red-400" />
            <div>
              <h2 class="text-2xl font-semibold theme-text-primary">Remove Work</h2>
              <p class="text-sm theme-text-secondary mt-1">Remove this work from production</p>
            </div>
          </div>
          <button
            on:click={handleClose}
            class="p-2 rounded-lg hover:theme-bg-secondary transition-colors"
            aria-label="Close"
            disabled={isLoading}
          >
            <X class="w-6 h-6 theme-text-secondary" />
          </button>
        </div>

        <!-- Content -->
        <div class="p-6">
          {#if !showConfirm}
            <!-- Work Details -->
            <div class="mb-6 p-4 theme-bg-secondary rounded-lg border theme-border">
              <h3 class="text-sm font-medium theme-text-secondary mb-3">Work Details</h3>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="theme-text-secondary">Work Code:</span>
                  <span class="theme-text-primary font-medium">
                    {work?.std_work_type_details?.derived_sw_code || work?.sw_code || 'N/A'}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="theme-text-secondary">Work Name:</span>
                  <span class="theme-text-primary font-medium">
                    {work?.sw_name || work?.std_work_type_details?.std_work_details?.sw_name || 'N/A'}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="theme-text-secondary">Stage:</span>
                  <span class="theme-text-primary font-medium">{stageCode}</span>
                </div>
                {#if work?.time_taken}
                  <div class="flex justify-between">
                    <span class="theme-text-secondary">Time Taken:</span>
                    <span class="theme-text-primary font-medium">
                      {work.time_taken ? `${Math.floor(work.time_taken)}h ${Math.round((work.time_taken % 1) * 60)}m` : '0h 0m'}
                    </span>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Removal Reason -->
            <div class="mb-6">
              <label for="removalReason" class="block text-sm font-medium theme-text-primary mb-2">
                Reason for Removal <span class="text-red-600">*</span>
              </label>
              <textarea
                id="removalReason"
                bind:value={removalReason}
                placeholder="Please provide a reason for removing this work..."
                rows="4"
                class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              ></textarea>
              <p class="text-xs theme-text-secondary mt-1">
                This reason will be recorded in the system for audit purposes.
              </p>
            </div>

            <!-- Warning -->
            <div class="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div class="flex items-start gap-3">
                <AlertTriangle class="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <div class="text-sm text-yellow-800 dark:text-yellow-200">
                  <p class="font-medium mb-1">Warning</p>
                  <p>Removing this work will:</p>
                  <ul class="list-disc list-inside mt-1 space-y-1">
                    <li>Mark the work as removed in the system</li>
                    <li>Record the removal reason, date, and user</li>
                    <li>Prevent the work from appearing in future planning</li>
                  </ul>
                </div>
              </div>
            </div>
          {:else}
            <!-- Confirmation -->
            <div class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div class="flex items-start gap-3">
                <AlertTriangle class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div class="text-sm text-red-800 dark:text-red-200">
                  <p class="font-medium mb-2">Are you sure you want to remove this work?</p>
                  <p class="mb-2">Reason: <span class="font-medium">{removalReason}</span></p>
                  <p>This action cannot be undone.</p>
                </div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 p-6 border-t theme-border">
          {#if !showConfirm}
            <Button variant="secondary" size="sm" on:click={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" on:click={handleConfirm} disabled={isLoading || !removalReason.trim()}>
              Continue
            </Button>
          {:else}
            <Button variant="secondary" size="sm" on:click={handleCancelConfirm} disabled={isLoading}>
              Back
            </Button>
            <Button variant="danger" size="sm" on:click={handleRemove} disabled={isLoading}>
              {isLoading ? 'Removing...' : 'Confirm Removal'}
            </Button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

