<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import Button from '$lib/components/common/Button.svelte';
  import {
    loadPlanningDuplicates,
    loadReportingDuplicates,
    deletePlanningManpowerRows,
    deleteReportingManpowerRows,
    BLOCKED_SUBMISSION_STATUSES
  } from '$lib/services/duplicateAttendanceAdminService';
  import type { DuplicateGroupPlan, DuplicateGroupReport } from '$lib/services/duplicateAttendanceAdminService';

  export let show = false;
  export let onClose: () => void = () => {};

  let selectedDate = new Date().toISOString().split('T')[0];
  let activeTab: 'plan' | 'report' = 'plan';

  let planGroups: DuplicateGroupPlan[] = [];
  let reportGroups: DuplicateGroupReport[] = [];
  let loadError = '';
  let loading = false;
  let lastLoadedDate = '';

  let selectedPlanIds = new SvelteSet<number>();
  let selectedReportIds = new SvelteSet<number>();
  let actionError = '';
  let actionMessage = '';
  let deleteBusy = false;

  $: hasLoaded = lastLoadedDate !== '' && !loadError;

  function close() {
    onClose();
  }

  function resetSelections() {
    selectedPlanIds.clear();
    selectedReportIds.clear();
  }

  function togglePlan(id: number, deletable: boolean) {
    if (!deletable) return;
    if (selectedPlanIds.has(id)) selectedPlanIds.delete(id);
    else selectedPlanIds.add(id);
  }

  function toggleReport(id: number, deletable: boolean) {
    if (!deletable) return;
    if (selectedReportIds.has(id)) selectedReportIds.delete(id);
    else selectedReportIds.add(id);
  }

  async function loadDuplicates() {
    if (!selectedDate) {
      loadError = 'Select a date.';
      return;
    }
    loadError = '';
    actionError = '';
    actionMessage = '';
    loading = true;
    resetSelections();
    try {
      const [p, r] = await Promise.all([
        loadPlanningDuplicates(selectedDate),
        loadReportingDuplicates(selectedDate)
      ]);
      if (p.error) {
        loadError = p.error;
        planGroups = [];
        reportGroups = [];
        lastLoadedDate = '';
        return;
      }
      if (r.error) {
        loadError = r.error;
        planGroups = [];
        reportGroups = [];
        lastLoadedDate = '';
        return;
      }
      planGroups = p.groups;
      reportGroups = r.groups;
      lastLoadedDate = selectedDate;
    } finally {
      loading = false;
    }
  }

  async function confirmDeletePlan() {
    const ids = [...selectedPlanIds];
    if (ids.length === 0) {
      actionError = 'Select at least one row to delete.';
      return;
    }
    if (
      !confirm(
        `Permanently delete ${ids.length} planning manpower row(s) for date ${lastLoadedDate}? This cannot be undone.`
      )
    ) {
      return;
    }
    deleteBusy = true;
    actionError = '';
    actionMessage = '';
    try {
      const { error, deleted } = await deletePlanningManpowerRows(planGroups, ids);
      if (error) {
        actionError = error;
        return;
      }
      actionMessage = `Deleted ${deleted ?? ids.length} planning row(s).`;
      await loadDuplicates();
    } finally {
      deleteBusy = false;
    }
  }

  async function confirmDeleteReport() {
    const ids = [...selectedReportIds];
    if (ids.length === 0) {
      actionError = 'Select at least one row to delete.';
      return;
    }
    if (
      !confirm(
        `Permanently delete ${ids.length} reporting manpower row(s) for date ${lastLoadedDate}? This cannot be undone.`
      )
    ) {
      return;
    }
    deleteBusy = true;
    actionError = '';
    actionMessage = '';
    try {
      const { error, deleted } = await deleteReportingManpowerRows(reportGroups, ids);
      if (error) {
        actionError = error;
        return;
      }
      actionMessage = `Deleted ${deleted ?? ids.length} reporting row(s).`;
      await loadDuplicates();
    } finally {
      deleteBusy = false;
    }
  }
</script>

{#if show}
  <div
    class="fixed inset-0 z-[200] flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="dup-att-title"
  >
    <button
      type="button"
      class="absolute inset-0 z-0 border-none bg-black/50 p-0"
      aria-label="Close"
      on:click={close}
    ></button>
    <div
      class="relative z-10 flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border-2 border-slate-300 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900"
    >
      <div class="border-b border-slate-200 px-4 py-3 dark:border-slate-600 sm:px-6">
        <h2 id="dup-att-title" class="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Remove duplicate attendance
        </h2>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Load rows for a calendar day where the day falls in each record’s from–to range. Duplicates are employees
          with <strong>two or more</strong> rows in the same source (Plan or Report). Check different stages or shifts
          for the same person. Hard delete is blocked if the row’s submission is
          <code class="text-xs">{BLOCKED_SUBMISSION_STATUSES.join(' / ')}</code>. You must leave at least one row per
          employee in each group you change.
        </p>
      </div>

      <div class="shrink-0 space-y-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600 sm:px-6">
        <div class="flex flex-wrap items-end gap-3">
          <div>
            <label for="dup-date" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >Date</label
            >
            <input
              id="dup-date"
              type="date"
              bind:value={selectedDate}
              class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <Button variant="primary" size="sm" disabled={loading} on:click={loadDuplicates}>
            {loading ? 'Loading…' : 'Load duplicates'}
          </Button>
          <Button variant="secondary" size="sm" on:click={close}>Close</Button>
        </div>
        {#if loadError}
          <p class="text-sm text-red-600 dark:text-red-400" role="alert">{loadError}</p>
        {/if}
        {#if actionError}
          <p class="text-sm text-red-600 dark:text-red-400" role="alert">{actionError}</p>
        {/if}
        {#if actionMessage}
          <p class="text-sm text-green-700 dark:text-green-400" role="status">{actionMessage}</p>
        {/if}
      </div>

      <div class="shrink-0 border-b border-slate-200 px-4 dark:border-slate-600 sm:px-6">
        <div class="flex gap-1">
          <button
            type="button"
            class="border-b-2 px-3 py-2 text-sm font-medium transition-colors {activeTab === 'plan'
              ? 'border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400'}"
            on:click={() => (activeTab = 'plan')}
          >
            Plan ({planGroups.length} employees)
          </button>
          <button
            type="button"
            class="border-b-2 px-3 py-2 text-sm font-medium transition-colors {activeTab === 'report'
              ? 'border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400'}"
            on:click={() => (activeTab = 'report')}
          >
            Report ({reportGroups.length} employees)
          </button>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6">
        {#if !hasLoaded && !loading}
          <p class="text-sm text-slate-500 dark:text-slate-400">Choose a date and click “Load duplicates”.</p>
        {:else if activeTab === 'plan'}
          {#if planGroups.length === 0}
            <p class="text-sm text-slate-600 dark:text-slate-400">No duplicate planning manpower rows for this date.</p>
          {:else}
            {#each planGroups as g (g.empId)}
              <div class="mb-6 rounded-lg border border-slate-200 dark:border-slate-600">
                <div
                  class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  {g.empName}
                  <span class="font-normal text-slate-500 dark:text-slate-400">({g.empId}) · {g.rows.length} rows</span>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full min-w-[720px] text-left text-xs sm:text-sm">
                    <thead class="border-b border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900">
                      <tr>
                        <th class="w-10 px-2 py-2">Del</th>
                        <th class="px-2 py-2">Id</th>
                        <th class="px-2 py-2">Stage</th>
                        <th class="px-2 py-2">Shift</th>
                        <th class="px-2 py-2">From</th>
                        <th class="px-2 py-2">To</th>
                        <th class="px-2 py-2">Attendance</th>
                        <th class="px-2 py-2">Row status</th>
                        <th class="px-2 py-2">Submission</th>
                        <th class="px-2 py-2">Sub. status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each g.rows as row (row.id)}
                        <tr class="border-b border-slate-100 dark:border-slate-700">
                          <td class="px-2 py-2 align-top">
                            <input
                              type="checkbox"
                              checked={selectedPlanIds.has(row.id)}
                              disabled={!row.deletable || deleteBusy}
                              title={!row.deletable
                                ? 'Cannot delete: submission is approved or pending approval'
                                : ''}
                              on:change={() => togglePlan(row.id, row.deletable)}
                              aria-label="Select row {row.id} for deletion"
                            />
                          </td>
                          <td class="px-2 py-2 font-mono align-top">{row.id}</td>
                          <td class="px-2 py-2 align-top">{row.stage_code}</td>
                          <td class="px-2 py-2 align-top">{row.shift_code ?? '—'}</td>
                          <td class="px-2 py-2 align-top">{row.planning_from_date}</td>
                          <td class="px-2 py-2 align-top">{row.planning_to_date}</td>
                          <td class="px-2 py-2 align-top">{row.attendance_status ?? '—'}</td>
                          <td class="px-2 py-2 align-top">{row.status ?? '—'}</td>
                          <td class="px-2 py-2 align-top font-mono">{row.planning_submission_id ?? '—'}</td>
                          <td class="px-2 py-2 align-top">
                            {row.submission_status ?? '—'}
                            {#if !row.deletable}
                              <span class="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
                                >locked</span
                              >
                            {/if}
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              </div>
            {/each}
          {/if}
        {:else}
          {#if reportGroups.length === 0}
            <p class="text-sm text-slate-600 dark:text-slate-400">No duplicate reporting manpower rows for this date.</p>
          {:else}
            {#each reportGroups as g (g.empId)}
              <div class="mb-6 rounded-lg border border-slate-200 dark:border-slate-600">
                <div
                  class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  {g.empName}
                  <span class="font-normal text-slate-500 dark:text-slate-400">({g.empId}) · {g.rows.length} rows</span>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full min-w-[720px] text-left text-xs sm:text-sm">
                    <thead class="border-b border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900">
                      <tr>
                        <th class="w-10 px-2 py-2">Del</th>
                        <th class="px-2 py-2">Id</th>
                        <th class="px-2 py-2">Stage</th>
                        <th class="px-2 py-2">Shift</th>
                        <th class="px-2 py-2">From</th>
                        <th class="px-2 py-2">To</th>
                        <th class="px-2 py-2">Attendance</th>
                        <th class="px-2 py-2">Row status</th>
                        <th class="px-2 py-2">Submission</th>
                        <th class="px-2 py-2">Sub. status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each g.rows as row (row.id)}
                        <tr class="border-b border-slate-100 dark:border-slate-700">
                          <td class="px-2 py-2 align-top">
                            <input
                              type="checkbox"
                              checked={selectedReportIds.has(row.id)}
                              disabled={!row.deletable || deleteBusy}
                              title={!row.deletable
                                ? 'Cannot delete: submission is approved or pending approval'
                                : ''}
                              on:change={() => toggleReport(row.id, row.deletable)}
                              aria-label="Select row {row.id} for deletion"
                            />
                          </td>
                          <td class="px-2 py-2 font-mono align-top">{row.id}</td>
                          <td class="px-2 py-2 align-top">{row.stage_code}</td>
                          <td class="px-2 py-2 align-top">{row.shift_code ?? '—'}</td>
                          <td class="px-2 py-2 align-top">{row.reporting_from_date}</td>
                          <td class="px-2 py-2 align-top">{row.reporting_to_date}</td>
                          <td class="px-2 py-2 align-top">{row.attendance_status ?? '—'}</td>
                          <td class="px-2 py-2 align-top">{row.status ?? '—'}</td>
                          <td class="px-2 py-2 align-top font-mono">{row.reporting_submission_id ?? '—'}</td>
                          <td class="px-2 py-2 align-top">
                            {row.submission_status ?? '—'}
                            {#if !row.deletable}
                              <span class="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
                                >locked</span
                              >
                            {/if}
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              </div>
            {/each}
          {/if}
        {/if}
      </div>

      <div
        class="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-600 dark:bg-slate-800 sm:px-6"
      >
        {#if activeTab === 'plan' && hasLoaded && planGroups.length > 0}
          <span class="mr-auto text-xs text-slate-600 dark:text-slate-400">{selectedPlanIds.size} selected</span>
          <Button
            variant="primary"
            size="sm"
            disabled={deleteBusy || selectedPlanIds.size === 0}
            on:click={confirmDeletePlan}
          >
            {deleteBusy ? 'Working…' : 'Delete selected (Plan)'}
          </Button>
        {:else if activeTab === 'report' && hasLoaded && reportGroups.length > 0}
          <span class="mr-auto text-xs text-slate-600 dark:text-slate-400">{selectedReportIds.size} selected</span>
          <Button
            variant="primary"
            size="sm"
            disabled={deleteBusy || selectedReportIds.size === 0}
            on:click={confirmDeleteReport}
          >
            {deleteBusy ? 'Working…' : 'Delete selected (Report)'}
          </Button>
        {/if}
      </div>
    </div>
  </div>
{/if}
