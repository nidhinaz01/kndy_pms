<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ProductionEmployee } from '$lib/api/production';
  import {
    fetchEmployeePlanningWorksForDate,
    fetchEmployeeReportingWorksForDate,
    type EmployeeWorksModalRow
  } from '$lib/api/production/employeeWorksModalService';
  import { formatDate } from '$lib/utils/formatDate';

  export let showModal: boolean = false;
  export let employee: ProductionEmployee | null = null;
  export let selectedDate: string = '';
  export let mode: 'planning' | 'reporting' = 'planning';

  const dispatch = createEventDispatcher();

  let rows: EmployeeWorksModalRow[] = [];
  let loading = false;
  let loadError: string | null = null;
  let loadSeq = 0;

  function handleClose() {
    dispatch('close');
  }

  /** dd-MMM-yy; show em dash when missing or unparseable */
  function formatRowDate(value: string | undefined | null): string {
    if (value == null || String(value).trim() === '' || value === '—') return '—';
    const out = formatDate(value);
    return out === '-' ? '—' : out;
  }

  $: title = mode === 'planning' ? 'Works (Planning)' : 'Works (Reporting)';

  $: if (showModal && employee?.emp_id && selectedDate) {
    const seq = ++loadSeq;
    loading = true;
    loadError = null;
    rows = [];
    const empId = employee.emp_id;
    const date = selectedDate;
    const m = mode;
    (async () => {
      try {
        const data =
          m === 'planning'
            ? await fetchEmployeePlanningWorksForDate(empId, date)
            : await fetchEmployeeReportingWorksForDate(empId, date);
        if (seq === loadSeq) rows = data;
      } catch (e) {
        if (seq === loadSeq) {
          loadError = e instanceof Error ? e.message : 'Failed to load works';
          rows = [];
        }
      } finally {
        if (seq === loadSeq) loading = false;
      }
    })();
  } else if (!showModal) {
    loadSeq++;
    loading = false;
    loadError = null;
    rows = [];
  }
</script>

{#if showModal}
  <div
    class="fixed inset-0 z-[1000] flex items-center justify-center"
    style="background: rgba(0, 0, 0, 0.5);"
    role="presentation"
  >
    <div
      class="theme-bg-primary theme-border rounded-lg shadow-lg mx-4 flex flex-col max-h-[90vh]"
      style="min-width: min(900px, 96vw); max-width: 96vw;"
    >
      <div class="flex items-center gap-3 p-5 border-b theme-border shrink-0">
        <div
          class="bg-blue-500 rounded-full w-10 h-10 flex items-center justify-center text-white text-lg shrink-0"
        >
          📋
        </div>
        <div class="min-w-0">
          <h3 class="theme-text-primary text-lg font-semibold m-0">{title}</h3>
          {#if employee}
            <p class="theme-text-secondary text-sm m-1 mt-0 truncate">
              {employee.emp_name} ({employee.emp_id})
            </p>
          {/if}
        </div>
      </div>

      {#if employee}
        <div class="theme-bg-secondary theme-border rounded-lg mx-5 mt-4 px-4 py-3 shrink-0">
          <p class="theme-text-primary text-sm m-0">
            <strong>Date:</strong>
            {selectedDate
              ? new Date(selectedDate).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: '2-digit'
                })
              : '—'}
          </p>
          <p class="theme-text-secondary text-xs mt-1 mb-0">
            All stages and shifts for this worker on the selected date.
          </p>
        </div>

        <div class="p-5 flex-1 min-h-0 flex flex-col">
          {#if loading}
            <div class="flex items-center justify-center py-12 gap-3">
              <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
              <span class="theme-text-primary text-sm">Loading works…</span>
            </div>
          {:else if loadError}
            <div class="theme-bg-secondary theme-border rounded-lg p-4 text-center">
              <p class="text-red-600 dark:text-red-400 text-sm m-0">{loadError}</p>
            </div>
          {:else if rows.length === 0}
            <div class="theme-bg-secondary theme-border rounded-lg p-6 text-center">
              <p class="theme-text-secondary m-0">No works found for this employee on this date.</p>
            </div>
          {:else}
            <div class="overflow-auto rounded-lg border theme-border flex-1 min-h-0">
              <table class="w-full text-sm">
                <thead class="theme-bg-secondary sticky top-0 z-10">
                  <tr>
                    <th class="text-left px-3 py-2 font-medium theme-text-primary whitespace-nowrap"
                      >Work Order</th
                    >
                    <th class="text-left px-3 py-2 font-medium theme-text-primary whitespace-nowrap"
                      >Work Code</th
                    >
                    <th class="text-left px-3 py-2 font-medium theme-text-primary">Work Name</th>
                    <th class="text-left px-3 py-2 font-medium theme-text-primary whitespace-nowrap"
                      >From Date</th
                    >
                    <th class="text-left px-3 py-2 font-medium theme-text-primary whitespace-nowrap"
                      >From Time</th
                    >
                    <th class="text-left px-3 py-2 font-medium theme-text-primary whitespace-nowrap"
                      >To Date</th
                    >
                    <th class="text-left px-3 py-2 font-medium theme-text-primary whitespace-nowrap"
                      >To Time</th
                    >
                    {#if mode === 'reporting'}
                      <th class="text-left px-3 py-2 font-medium theme-text-primary whitespace-nowrap"
                        >Status</th
                      >
                    {/if}
                  </tr>
                </thead>
                <tbody class="divide-y theme-border theme-bg-primary">
                  {#each rows as r}
                    <tr class="hover:theme-bg-secondary">
                      <td class="px-3 py-2 theme-text-primary whitespace-nowrap">{r.workOrder}</td>
                      <td class="px-3 py-2 theme-text-primary whitespace-nowrap">{r.workCode}</td>
                      <td class="px-3 py-2 theme-text-primary">{r.workName}</td>
                      <td class="px-3 py-2 theme-text-secondary whitespace-nowrap">{formatRowDate(r.fromDate)}</td>
                      <td class="px-3 py-2 theme-text-secondary whitespace-nowrap">{r.fromTime}</td>
                      <td class="px-3 py-2 theme-text-secondary whitespace-nowrap">{formatRowDate(r.toDate)}</td>
                      <td class="px-3 py-2 theme-text-secondary whitespace-nowrap">{r.toTime}</td>
                      {#if mode === 'reporting'}
                        <td class="px-3 py-2 theme-text-secondary whitespace-nowrap">{r.status ?? '—'}</td>
                      {/if}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      {:else}
        <div class="text-center px-5 py-6">
          <p class="text-red-500 dark:text-red-400 text-sm m-0">No employee selected. Please try again.</p>
        </div>
      {/if}

      <div class="flex justify-center p-4 border-t theme-border shrink-0">
        <button
          type="button"
          class="theme-border theme-text-primary hover:theme-bg-secondary px-4 py-2 rounded border bg-transparent cursor-pointer"
          on:click={handleClose}
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if}
