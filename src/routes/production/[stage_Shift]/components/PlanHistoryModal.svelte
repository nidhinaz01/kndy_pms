<script lang="ts">
  import { X, History } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { theme } from '$lib/stores/theme';

  export let isOpen: boolean = false;
  export let stageCode: string = '';
  export let planningDate: string = '';

  let submissionHistory: any[] = [];
  let isLoading: boolean = false;

  // Reactive theme-based classes
  $: isDark = $theme === 'dark';
  $: iconColor = isDark ? 'theme-text-secondary' : 'theme-accent';
  $: spinnerColor = isDark ? 'border-blue-400' : 'border-blue-500';

  $: if (isOpen && stageCode && planningDate) {
    loadHistory();
  }

  async function loadHistory() {
    if (!stageCode || !planningDate) return;
    
    isLoading = true;
    try {
      let dateStr: string;
      if (typeof planningDate === 'string') {
        dateStr = planningDate.split('T')[0];
      } else if (planningDate && typeof planningDate === 'object' && 'toISOString' in planningDate) {
        dateStr = (planningDate as Date).toISOString().split('T')[0];
      } else {
        dateStr = String(planningDate || '').split('T')[0];
      }

      const { data, error } = await supabase
        .from('prdn_planning_submissions')
        .select('*')
        .eq('stage_code', stageCode)
        .eq('planning_date', dateStr)
        .eq('is_deleted', false)
        .order('submitted_dt', { ascending: false });

      if (error) throw error;

      submissionHistory = data || [];
    } catch (error) {
      console.error('Error loading plan history:', error);
      submissionHistory = [];
    } finally {
      isLoading = false;
    }
  }

  function formatDateTime(dateStr: string | null): string {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'pending_approval':
        return { text: 'Pending Approval', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' };
      case 'approved':
        return { text: 'Approved', color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' };
      case 'rejected':
        return { text: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' };
      default:
        return { text: status, color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400' };
    }
  }

  function handleClose() {
    isOpen = false;
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
      <div class="relative w-full max-w-4xl theme-bg-primary rounded-lg shadow-xl border theme-border max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b theme-border sticky top-0 theme-bg-primary z-10">
          <div class="flex items-center gap-3">
            <History class="w-6 h-6 {iconColor}" />
            <div>
              <h2 class="text-2xl font-semibold theme-text-primary">Plan History</h2>
              <p class="text-sm theme-text-secondary mt-1">
                Submission history for {stageCode} on {planningDate ? new Date(planningDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
              </p>
            </div>
          </div>
          <button
            on:click={handleClose}
            class="p-2 rounded-lg hover:theme-bg-secondary transition-colors"
            aria-label="Close"
          >
            <X class="w-6 h-6 theme-text-secondary" />
          </button>
        </div>

        <!-- Content -->
        <div class="p-6">
          {#if isLoading}
            <div class="flex items-center justify-center py-12">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 {spinnerColor} mr-3"></div>
              <span class="theme-text-secondary">Loading history...</span>
            </div>
          {:else if submissionHistory.length === 0}
            <div class="text-center py-12">
              <div class="text-6xl mb-4">📋</div>
              <p class="theme-text-secondary text-lg">No submission history found</p>
            </div>
          {:else}
            <div class="space-y-4">
              {#each submissionHistory as submission, index}
                <div class="border theme-border rounded-lg p-4 theme-bg-secondary">
                  <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center gap-3">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusBadge(submission.status).color}">
                        {getStatusBadge(submission.status).text}
                      </span>
                      <span class="text-sm theme-text-secondary">
                        Submission #{submissionHistory.length - index}
                      </span>
                    </div>
                    <span class="text-xs theme-text-secondary">
                      {formatDateTime(submission.submitted_dt)}
                    </span>
                  </div>

                  <div class="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <span class="font-medium theme-text-primary">Submitted by:</span>
                      <span class="ml-2 theme-text-secondary">{submission.submitted_by || 'N/A'}</span>
                    </div>
                    <div>
                      <span class="font-medium theme-text-primary">Submitted on:</span>
                      <span class="ml-2 theme-text-secondary">{formatDateTime(submission.submitted_dt)}</span>
                    </div>
                    {#if submission.reviewed_dt}
                      <div>
                        <span class="font-medium theme-text-primary">Reviewed by:</span>
                        <span class="ml-2 theme-text-secondary">{submission.reviewed_by || 'N/A'}</span>
                      </div>
                      <div>
                        <span class="font-medium theme-text-primary">Reviewed on:</span>
                        <span class="ml-2 theme-text-secondary">{formatDateTime(submission.reviewed_dt)}</span>
                      </div>
                    {/if}
                  </div>

                  {#if submission.status === 'rejected' && submission.rejection_reason}
                    <div class="mt-3 p-3 theme-bg-secondary border theme-border rounded-lg">
                      <h4 class="text-sm font-medium theme-text-primary mb-2">
                        Rejection Reason:
                      </h4>
                      <p class="text-sm theme-text-secondary whitespace-pre-wrap">
                        {submission.rejection_reason}
                      </p>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

