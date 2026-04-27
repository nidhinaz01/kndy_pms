<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { X, AlertTriangle, Loader } from 'lucide-svelte';
  import { removeWorkFromProduction } from '$lib/api/production';
  import { getWorkDisplayCode, getWorkDisplayName } from '$lib/utils/workDisplayUtils';

  export let isOpen: boolean = false;
  export let works: any[] = [];
  export let stageCode: string = '';

  const dispatch = createEventDispatcher();

  let isLoading = false;
  let removalReason = '';
  let showConfirm = false;
  let showProgressOverlay = false;
  let progressMessage = '';

  $: if (isOpen) {
    removalReason = '';
    showConfirm = false;
    isLoading = false;
    showProgressOverlay = false;
    progressMessage = '';
  }

  function handleClose() {
    if (!isLoading && !showProgressOverlay) {
      removalReason = '';
      showConfirm = false;
      dispatch('close');
    }
  }

  function handleConfirm() {
    if (!removalReason.trim()) {
      alert('Please provide a reason for removing these works.');
      return;
    }
    showConfirm = true;
  }

  function getRemovalCodes(work: any) {
    const isNonStandardWork = Boolean(
      work.other_work_code || work.is_added_work || !work.std_work_type_details?.derived_sw_code
    );
    const derivedSwCode = isNonStandardWork ? null : work.std_work_type_details?.derived_sw_code || null;
    const otherWorkCode = isNonStandardWork ? work.other_work_code || work.sw_code || null : null;
    return { derivedSwCode, otherWorkCode };
  }

  async function executeBulkRemove() {
    if (!works?.length || !removalReason.trim()) return;

    const { getCurrentUsername } = await import('$lib/utils/userUtils');
    const currentUser = getCurrentUsername();
    const reason = removalReason.trim();
    const total = works.length;

    isLoading = true;
    showProgressOverlay = true;

    const failures: { code: string; error: string }[] = [];
    let successCount = 0;

    try {
      for (let i = 0; i < works.length; i++) {
        const work = works[i];
        progressMessage = `Removing works… ${i + 1} of ${total}`;
        const woDetailsId = work.wo_details_id || work.prdn_wo_details_id;
        if (!woDetailsId) {
          failures.push({
            code: getWorkDisplayCode(work) || '?',
            error: 'Missing work order details ID'
          });
          continue;
        }
        const { derivedSwCode, otherWorkCode } = getRemovalCodes(work);
        if (!derivedSwCode && !otherWorkCode) {
          failures.push({
            code: getWorkDisplayCode(work) || '?',
            error: 'Could not resolve work code'
          });
          continue;
        }

        const result = await removeWorkFromProduction(
          derivedSwCode,
          stageCode,
          woDetailsId,
          reason,
          currentUser,
          otherWorkCode
        );

        if (result.success) {
          successCount++;
        } else {
          failures.push({
            code: getWorkDisplayCode(work) || '?',
            error: result.error || 'Unknown error'
          });
        }
      }

      if (failures.length === 0) {
        alert(`Successfully removed ${successCount} work(s).`);
      } else if (successCount > 0) {
        const detail = failures.map((f) => `${f.code}: ${f.error}`).join('\n');
        alert(
          `Removed ${successCount} of ${total} work(s).\n\nFailed:\n${detail}`
        );
      } else {
        const detail = failures.map((f) => `${f.code}: ${f.error}`).join('\n');
        alert(`Could not remove works.\n\n${detail}`);
      }

      dispatch('completed', { successCount, failures });
    } catch (e) {
      console.error('Bulk remove error:', e);
      alert('An unexpected error occurred while removing works.');
    } finally {
      isLoading = false;
      showProgressOverlay = false;
      progressMessage = '';
    }
  }

  function handleCancelConfirm() {
    showConfirm = false;
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 overflow-y-auto">
    <div
      class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
      role="button"
      tabindex="-1"
      aria-label="Close modal"
      on:click={handleClose}
      on:keydown={(e) => e.key === 'Enter' || e.key === ' ' ? handleClose() : null}
    ></div>

    <div class="flex min-h-full items-center justify-center p-4">
      <div class="relative w-full max-w-2xl theme-bg-primary rounded-lg shadow-xl border theme-border">
        <div class="flex items-center justify-between p-6 border-b theme-border">
          <div class="flex items-center gap-3">
            <AlertTriangle class="w-6 h-6 text-red-600 dark:text-red-400" />
            <div>
              <h2 class="text-2xl font-semibold theme-text-primary">Remove Selected Works</h2>
              <p class="text-sm theme-text-secondary mt-1">
                {works.length} work(s) — same reason applied to each
              </p>
            </div>
          </div>
          <button
            type="button"
            on:click={handleClose}
            class="p-2 rounded-lg hover:theme-bg-secondary transition-colors"
            aria-label="Close"
            disabled={isLoading || showProgressOverlay}
          >
            <X class="w-6 h-6 theme-text-secondary" />
          </button>
        </div>

        <div class="p-6">
          {#if !showConfirm}
            <div class="mb-6 max-h-48 overflow-y-auto p-4 theme-bg-secondary rounded-lg border theme-border">
              <h3 class="text-sm font-medium theme-text-secondary mb-2">Works to remove</h3>
              <ul class="space-y-2 text-sm">
                {#each works as w}
                  <li class="flex justify-between gap-4 border-b theme-border pb-2 last:border-0">
                    <span class="theme-text-primary font-medium">{getWorkDisplayCode(w) || 'N/A'}</span>
                    <span class="theme-text-secondary truncate">{getWorkDisplayName(w) || ''}</span>
                  </li>
                {/each}
              </ul>
            </div>

            <div class="mb-6">
              <label for="bulkRemovalReason" class="block text-sm font-medium theme-text-primary mb-2">
                Reason for removal <span class="text-red-600">*</span>
              </label>
              <textarea
                id="bulkRemovalReason"
                bind:value={removalReason}
                placeholder="Reason recorded for every selected work…"
                rows="4"
                class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              ></textarea>
            </div>

            <div class="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p class="text-sm text-yellow-800 dark:text-yellow-200">
                Each work will be marked <strong>Removed</strong>, planning lines soft-deleted, and a removal audit
                row created—same as single-work remove.
              </p>
            </div>
          {:else}
            <div class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p class="text-sm text-red-800 dark:text-red-200 font-medium mb-2">
                Remove {works.length} work(s) at {stageCode}?
              </p>
              <p class="text-sm text-red-800 dark:text-red-200">Reason: <span class="font-medium">{removalReason}</span></p>
            </div>
          {/if}
        </div>

        <div class="flex items-center justify-end gap-3 p-6 border-t theme-border">
          {#if !showConfirm}
            <Button variant="secondary" size="sm" on:click={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              on:click={handleConfirm}
              disabled={isLoading || !removalReason.trim()}
            >
              Continue
            </Button>
          {:else}
            <Button variant="secondary" size="sm" on:click={handleCancelConfirm} disabled={isLoading}>
              Back
            </Button>
            <Button variant="danger" size="sm" on:click={executeBulkRemove} disabled={isLoading}>
              {isLoading ? 'Removing…' : 'Confirm removal'}
            </Button>
          {/if}
        </div>
      </div>
    </div>
  </div>

  {#if showProgressOverlay}
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div class="theme-bg-primary rounded-lg border theme-border shadow-xl px-6 py-5 min-w-[280px]">
        <div class="flex items-center gap-3">
          <Loader class="w-5 h-5 animate-spin text-blue-600" />
          <p class="theme-text-primary font-medium">{progressMessage || 'Removing works…'}</p>
        </div>
      </div>
    </div>
  {/if}
{/if}
