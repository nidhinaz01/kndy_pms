<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';
  import {
    loadDuplicateDraftWorkPlans,
    loadDuplicateDraftWorkReports,
    deleteDraftWorkPlanRows,
    deleteDraftWorkReportRows
  } from '$lib/services/duplicateDraftWorkAdminService';
  import type {
    DraftWorkPlanDupGroup,
    DraftWorkReportDupGroup,
    DraftWorkPlanDupRow,
    DraftWorkReportDupRow
  } from '$lib/services/duplicateDraftWorkAdminService';

  function formatCell(v: unknown): string {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'object' && v !== null) {
      if (Array.isArray(v)) {
        try {
          return JSON.stringify(v);
        } catch {
          return String(v);
        }
      }
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return String(v);
  }

  /** Union of keys for all rows in a group; `id` first, join helpers last, rest sorted. */
  function columnKeysForGroup(rows: (DraftWorkPlanDupRow | DraftWorkReportDupRow)[]): string[] {
    const s = new Set<string>();
    for (const r of rows) {
      for (const k of Object.keys(r)) {
        s.add(k);
      }
    }
    const tail = ['planning_stage_code', 'planning_shift_code'];
    for (const t of tail) {
      s.delete(t);
    }
    const rest = [...s].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    const idIdx = rest.indexOf('id');
    if (idIdx > 0) {
      rest.splice(idIdx, 1);
      rest.unshift('id');
    }
    const out = [...rest];
    for (const t of tail) {
      if (rows.some((row) => t in row && row[t] !== undefined)) {
        out.push(t);
      }
    }
    return out;
  }

  export let show = false;
  export let onClose: () => void = () => {};

  let activeTab: 'plan' | 'report' = 'plan';

  let planGroups: DraftWorkPlanDupGroup[] = [];
  let reportGroups: DraftWorkReportDupGroup[] = [];
  let loadError = '';
  let loading = false;
  /** True after a successful load in this modal open cycle (not tied to a single date). */
  let loadSucceeded = false;

  let selectedPlanIds = new Set<number>();
  let selectedReportIds = new Set<number>();
  let actionError = '';
  let actionMessage = '';
  let deleteBusy = false;

  $: hasLoaded = loadSucceeded && !loadError;

  let wasOpen = false;
  $: {
    if (show && !wasOpen) {
      wasOpen = true;
      void loadDuplicates();
    }
    if (!show) wasOpen = false;
  }

  function close() {
    onClose();
  }

  function resetSelections() {
    selectedPlanIds = new Set();
    selectedReportIds = new Set();
  }

  function togglePlan(id: number) {
    const next = new Set(selectedPlanIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedPlanIds = next;
  }

  function toggleReport(id: number) {
    const next = new Set(selectedReportIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedReportIds = next;
  }

  async function loadDuplicates() {
    loadError = '';
    actionError = '';
    actionMessage = '';
    loading = true;
    loadSucceeded = false;
    resetSelections();
    try {
      const [p, r] = await Promise.all([loadDuplicateDraftWorkPlans(), loadDuplicateDraftWorkReports()]);
      if (p.error) {
        loadError = p.error;
        planGroups = [];
        reportGroups = [];
        return;
      }
      if (r.error) {
        loadError = r.error;
        planGroups = [];
        reportGroups = [];
        return;
      }
      planGroups = p.groups;
      reportGroups = r.groups;
      loadSucceeded = true;
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
        `Permanently delete ${ids.length} work planning row(s)? This cannot be undone. If reporting rows reference these plans, the database may reject the delete—remove duplicates on the Draft report tab first if needed.`
      )
    ) {
      return;
    }
    deleteBusy = true;
    actionError = '';
    actionMessage = '';
    try {
      const { error, deleted } = await deleteDraftWorkPlanRows(planGroups, ids);
      if (error) {
        actionError = error;
        return;
      }
      actionMessage = `Deleted ${deleted ?? ids.length} draft plan row(s).`;
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
        `Permanently delete ${ids.length} work reporting row(s)? This cannot be undone.`
      )
    ) {
      return;
    }
    deleteBusy = true;
    actionError = '';
    actionMessage = '';
    try {
      const { error, deleted } = await deleteDraftWorkReportRows(reportGroups, ids);
      if (error) {
        actionError = error;
        return;
      }
      actionMessage = `Deleted ${deleted ?? ids.length} draft report row(s).`;
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
    aria-labelledby="dup-draft-title"
  >
    <button
      type="button"
      class="absolute inset-0 z-0 border-none bg-black/50 p-0"
      aria-label="Close"
      on:click={close}
    ></button>
    <div
      class="relative z-10 flex max-h-[90vh] w-full max-w-[min(100%,96rem)] flex-col overflow-hidden rounded-lg border-2 border-slate-300 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900"
    >
      <div class="border-b border-slate-200 px-4 py-3 dark:border-slate-600 sm:px-6">
        <h2 id="dup-draft-title" class="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Remove duplicate draft plan / draft report rows
        </h2>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Tables list <strong>all columns</strong> from <code class="text-xs">prdn_work_planning</code> and
          <code class="text-xs">prdn_work_reporting</code> (plus <code class="text-xs">planning_stage_code</code> /
          <code class="text-xs">planning_shift_code</code> on the report tab from the planning join). Rows use the same load
          filters as the production Draft plan and Draft report tabs. A group appears only when two or more rows are
          <strong>exact copies of each other</strong>: same values in every column except <code class="text-xs">id</code>
          (created / modified audit fields are ignored so copies created at different times still match).
          Only rows with a valid <code class="text-xs">worker_id</code> are included in duplicate groups.
          <code class="text-xs">worker_name</code> is filled from <code class="text-xs">hr_emp</code> for display only (not part of the duplicate match).
          Leave at least one row per group when deleting.
        </p>
      </div>

      <div class="shrink-0 space-y-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600 sm:px-6">
        <div class="flex flex-wrap items-center gap-3">
          {#if loading}
            <span class="text-sm text-slate-600 dark:text-slate-400">Loading duplicate groups…</span>
          {/if}
          <Button variant="secondary" size="sm" disabled={loading} on:click={() => loadDuplicates()}>Refresh</Button>
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
            Draft plan ({planGroups.length})
          </button>
          <button
            type="button"
            class="border-b-2 px-3 py-2 text-sm font-medium transition-colors {activeTab === 'report'
              ? 'border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400'}"
            on:click={() => (activeTab = 'report')}
          >
            Draft report ({reportGroups.length})
          </button>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6">
        {#if loading}
          <p class="text-sm text-slate-500 dark:text-slate-400">Loading duplicate groups…</p>
        {:else if !hasLoaded}
          <p class="text-sm text-slate-500 dark:text-slate-400">
            {#if loadError}
              Fix the error above, then click Refresh.
            {:else}
              Preparing load…
            {/if}
          </p>
        {:else if activeTab === 'plan'}
          {#if planGroups.length === 0}
            <p class="text-sm text-slate-600 dark:text-slate-400">
              No duplicate work planning rows in the loaded set.
            </p>
          {:else}
            {#each planGroups as g (g.groupKey)}
              {@const planCols = columnKeysForGroup(g.rows)}
              <div class="mb-6 rounded-lg border border-slate-200 dark:border-slate-600">
                <div
                  class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  {g.headerLabel}
                  <span class="font-normal text-slate-500 dark:text-slate-400">· {g.rows.length} rows</span>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full min-w-[680px] text-left text-xs sm:text-sm">
                    <thead class="border-b border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900">
                      <tr>
                        <th class="sticky left-0 z-10 w-10 border-r border-slate-200 bg-white px-2 py-2 dark:border-slate-600 dark:bg-slate-900"
                          >Del</th
                        >
                        {#each planCols as col (col)}
                          <th class="whitespace-nowrap px-2 py-2 font-mono text-[10px] font-normal text-slate-600 dark:text-slate-400"
                            >{col}</th
                          >
                        {/each}
                      </tr>
                    </thead>
                    <tbody>
                      {#each g.rows as row (row.id)}
                        <tr class="border-b border-slate-100 dark:border-slate-700">
                          <td class="sticky left-0 z-10 border-r border-slate-100 bg-white px-2 py-2 align-top dark:border-slate-700 dark:bg-slate-900">
                            <input
                              type="checkbox"
                              checked={selectedPlanIds.has(row.id)}
                              disabled={deleteBusy}
                              on:change={() => togglePlan(row.id)}
                              aria-label="Select plan row {row.id} for deletion"
                            />
                          </td>
                          {#each planCols as col (col)}
                            <td class="max-w-[14rem] whitespace-pre-wrap break-words px-2 py-2 align-top font-mono text-[11px] leading-snug"
                              >{formatCell(row[col])}</td
                            >
                          {/each}
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
            <p class="text-sm text-slate-600 dark:text-slate-400">
              No duplicate work reporting rows in the loaded set.
            </p>
          {:else}
            {#each reportGroups as g (g.groupKey)}
              {@const reportCols = columnKeysForGroup(g.rows)}
              <div class="mb-6 rounded-lg border border-slate-200 dark:border-slate-600">
                <div
                  class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  {g.headerLabel}
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full min-w-[680px] text-left text-xs sm:text-sm">
                    <thead class="border-b border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900">
                      <tr>
                        <th class="sticky left-0 z-10 w-10 border-r border-slate-200 bg-white px-2 py-2 dark:border-slate-600 dark:bg-slate-900"
                          >Del</th
                        >
                        {#each reportCols as col (col)}
                          <th class="whitespace-nowrap px-2 py-2 font-mono text-[10px] font-normal text-slate-600 dark:text-slate-400"
                            >{col}</th
                          >
                        {/each}
                      </tr>
                    </thead>
                    <tbody>
                      {#each g.rows as row (row.id)}
                        <tr class="border-b border-slate-100 dark:border-slate-700">
                          <td class="sticky left-0 z-10 border-r border-slate-100 bg-white px-2 py-2 align-top dark:border-slate-700 dark:bg-slate-900">
                            <input
                              type="checkbox"
                              checked={selectedReportIds.has(row.id)}
                              disabled={deleteBusy}
                              on:change={() => toggleReport(row.id)}
                              aria-label="Select report row {row.id} for deletion"
                            />
                          </td>
                          {#each reportCols as col (col)}
                            <td class="max-w-[14rem] whitespace-pre-wrap break-words px-2 py-2 align-top font-mono text-[11px] leading-snug"
                              >{formatCell(row[col])}</td
                            >
                          {/each}
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
            {deleteBusy ? 'Working…' : 'Delete selected (Draft plan)'}
          </Button>
        {:else if activeTab === 'report' && hasLoaded && reportGroups.length > 0}
          <span class="mr-auto text-xs text-slate-600 dark:text-slate-400">{selectedReportIds.size} selected</span>
          <Button
            variant="primary"
            size="sm"
            disabled={deleteBusy || selectedReportIds.size === 0}
            on:click={confirmDeleteReport}
          >
            {deleteBusy ? 'Working…' : 'Delete selected (Draft report)'}
          </Button>
        {/if}
      </div>
    </div>
  </div>
{/if}
