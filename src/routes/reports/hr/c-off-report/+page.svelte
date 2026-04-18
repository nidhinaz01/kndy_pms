<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import {
    firstDayOfMonthIso,
    todayIsoLocal,
    validateReportDateRange,
    formatDdMmmYyyy
  } from '$lib/utils/reportDateRange';
  import { loadCOffReport, type COffReportRow } from './services/cOffReportService';
  import { exportCOffReportExcel } from './utils/exportCOffReportExcel';
  import { reportRowMatchesSearch } from '$lib/utils/reportTableSearch';

  let menus: any[] = [];
  let showSidebar = false;

  let fromDate = firstDayOfMonthIso();
  let toDate = todayIsoLocal();
  let rows: COffReportRow[] = [];
  let loading = false;
  let errorMessage = '';
  let lastRunSucceeded = false;
  let tableSearch = '';

  onMount(async () => {
    try {
      const { getCurrentUsername } = await import('$lib/utils/userUtils');
      const username = getCurrentUsername();
      menus = await fetchUserMenus(username);
    } catch (e) {
      console.error('Failed to load menus:', e);
    }
  });

  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }

  async function generateReport() {
    errorMessage = '';
    tableSearch = '';
    rows = [];
    lastRunSucceeded = false;
    const v = validateReportDateRange(fromDate, toDate);
    if (!v.ok) {
      errorMessage = v.error || 'Invalid dates.';
      return;
    }
    loading = true;
    try {
      rows = await loadCOffReport(v.fromDate!, v.toDate!);
      lastRunSucceeded = true;
    } catch (e) {
      console.error(e);
      errorMessage = e instanceof Error ? e.message : 'Failed to generate report.';
    } finally {
      loading = false;
    }
  }

  function exportExcel() {
    if (rows.length === 0) return;
    const v = validateReportDateRange(fromDate, toDate);
    if (!v.ok) {
      errorMessage = v.error || 'Fix dates before export.';
      return;
    }
    try {
      exportCOffReportExcel(rows, v.fromDate!, v.toDate!);
    } catch (e) {
      console.error(e);
      alert('Export failed. Please try again.');
    }
  }

  $: filteredRows = rows.filter((r) => reportRowMatchesSearch(tableSearch, r));
</script>

<svelte:head>
  <title>C-Off Report</title>
</svelte:head>

<div class="flex min-h-screen flex-col theme-bg-secondary transition-colors duration-200">
  <div class="theme-bg-primary border-b theme-border">
    <div class="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6">
      <div class="flex min-w-0 items-center gap-3">
        <button
          type="button"
          class="rounded-lg p-2 hover:theme-bg-tertiary transition-colors"
          aria-label="Show sidebar"
          on:click={handleSidebarToggle}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 theme-text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div>
          <h1 class="text-xl font-semibold theme-text-primary">C-Off Report</h1>
          <p class="text-sm theme-text-secondary">
            Planning and reporting manpower with C-Off (overlaps date window; max ~3 months)
          </p>
        </div>
      </div>
      <div class="flex flex-wrap items-end justify-end gap-3">
        <label class="flex flex-col gap-1 text-sm theme-text-secondary">
          <span>From date</span>
          <input
            type="date"
            bind:value={fromDate}
            class="rounded-md border theme-border bg-white px-2 py-1.5 text-gray-900 dark:bg-gray-900 dark:text-gray-100"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm theme-text-secondary">
          <span>To date</span>
          <input
            type="date"
            bind:value={toDate}
            class="rounded-md border theme-border bg-white px-2 py-1.5 text-gray-900 dark:bg-gray-900 dark:text-gray-100"
          />
        </label>
        <Button variant="primary" size="sm" on:click={generateReport} disabled={loading}>
          {loading ? 'Generating…' : 'Generate Report'}
        </Button>
        <Button variant="secondary" size="sm" on:click={exportExcel} disabled={rows.length === 0}>
          Export Excel
        </Button>
        <button
          type="button"
          on:click={() => goto('/dashboard')}
          class="flex shrink-0 items-center self-center hover:opacity-80 transition-opacity"
          aria-label="Go to dashboard"
        >
          <img src="/favicon.png" alt="Company Logo" class="h-8 w-auto" />
        </button>
      </div>
    </div>
  </div>

  <main class="mx-auto min-w-0 w-full max-w-[100rem] flex-1 px-4 py-6 sm:px-6">
    {#if errorMessage}
      <div
        class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
      >
        {errorMessage}
      </div>
    {/if}

    {#if loading}
      <p class="mb-4 text-sm font-medium theme-text-primary" role="status" aria-live="polite">Generating report…</p>
    {/if}

    {#if lastRunSucceeded && !rows.length && !loading}
      <p class="mb-4 rounded-lg border theme-border theme-bg-primary px-4 py-3 text-sm theme-text-secondary">
        No data in this range.
      </p>
    {/if}

    {#if !rows.length && !loading && !errorMessage && !lastRunSucceeded}
      <p class="theme-text-secondary mb-4 text-sm">
        Choose dates and click <strong>Generate Report</strong>. Includes planning and reporting attendance whose
        window overlaps the range and where <strong>C-Off value is &gt; 0</strong> or a <strong>C-Off from date</strong> is set.
      </p>
    {/if}

    {#if rows.length > 0}
      <section class="rounded-lg border theme-border theme-bg-primary p-4 shadow-sm">
        <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <h2 class="text-base font-semibold theme-text-primary">
            Results ({filteredRows.length}{#if tableSearch.trim() && rows.length > 0} of {rows.length}{/if} row{filteredRows.length === 1 ? '' : 's'})
          </h2>
          <label class="flex w-full min-w-0 flex-col gap-1 text-sm theme-text-secondary sm:max-w-md sm:flex-1">
            <span>Search table</span>
            <input
              type="search"
              bind:value={tableSearch}
              placeholder="Filter by any column…"
              autocomplete="off"
              class="rounded-md border theme-border bg-white px-3 py-1.5 text-gray-900 dark:bg-gray-900 dark:text-gray-100"
            />
          </label>
        </div>
        {#if filteredRows.length === 0 && tableSearch.trim()}
          <p class="theme-text-secondary mb-3 text-sm">No rows match your search. Clear the box to show all rows.</p>
        {/if}
        <div
          class="min-w-0 overflow-x-auto rounded-md border theme-border [-webkit-overflow-scrolling:touch]"
          role="region"
          aria-label="C-Off report table"
        >
          <table class="w-max min-w-full border-collapse text-xs">
            <thead>
              <tr class="theme-text-secondary border-b theme-border text-left">
                <th class="theme-bg-primary sticky left-0 z-10 px-2 py-2 font-medium">Source</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">Shift</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">Stage</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">Employee</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">Skill</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">Attendance</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">Window</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">Times</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">Planned h</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">Actual h</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">C-Off (d)</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">C-Off window</th>
                <th class="px-2 py-2 font-medium min-w-[8rem]">Notes</th>
              </tr>
            </thead>
            <tbody class="theme-text-primary">
              {#each filteredRows as r}
                <tr class="theme-border border-b align-top">
                  <td class="theme-bg-primary sticky left-0 z-10 px-2 py-2 font-medium whitespace-nowrap">{r.source}</td>
                  <td class="px-2 py-2 whitespace-nowrap font-mono">{r.shiftCode ?? '—'}</td>
                  <td class="px-2 py-2 whitespace-nowrap font-mono">{r.stageCode ?? '—'}</td>
                  <td class="px-2 py-2 whitespace-nowrap">{r.empName ?? '—'} <span class="theme-text-secondary">({r.empId ?? '—'})</span></td>
                  <td class="px-2 py-2 whitespace-nowrap">{r.skillShort ?? '—'}</td>
                  <td class="px-2 py-2 whitespace-nowrap">{r.attendanceStatus ?? '—'}</td>
                  <td class="px-2 py-2 whitespace-nowrap">
                    {formatDdMmmYyyy(r.windowFrom) || '—'} → {formatDdMmmYyyy(r.windowTo) || '—'}
                  </td>
                  <td class="px-2 py-2 whitespace-nowrap tabular-nums">
                    {r.attendanceFromTime ?? '—'} – {r.attendanceToTime ?? '—'}
                  </td>
                  <td class="px-2 py-2 whitespace-nowrap tabular-nums">{r.plannedHours ?? '—'}</td>
                  <td class="px-2 py-2 whitespace-nowrap tabular-nums">{r.actualHours ?? '—'}</td>
                  <td class="px-2 py-2 whitespace-nowrap tabular-nums">{r.cOffValue ?? '—'}</td>
                  <td class="px-2 py-2 whitespace-nowrap text-[11px]">
                    {#if r.cOffFromDate}
                      {formatDdMmmYyyy(r.cOffFromDate)} {r.cOffFromTime ?? ''} → {formatDdMmmYyyy(r.cOffToDate) || '—'}
                      {r.cOffToTime ?? ''}
                    {:else}
                      —
                    {/if}
                  </td>
                  <td class="px-2 py-2 max-w-[14rem] break-words">{r.notes ?? '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="theme-text-secondary mt-2 text-xs">
          <strong>Export Excel</strong> includes record status and audit fields.
        </p>
      </section>
    {/if}
  </main>

  <FloatingThemeToggle />

  {#if showSidebar}
    <div class="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close sidebar overlay"
        class="fixed inset-0 z-40 bg-black bg-opacity-40"
        on:click={handleSidebarToggle}
        tabindex="0"
        on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSidebarToggle()}
        style="cursor: pointer; border: none; width: 100%; height: 100%; position: fixed; left: 0; top: 0;"
      ></button>
      <div class="fixed left-0 top-0 z-50 h-full w-64 shadow-lg theme-bg-primary">
        <Sidebar {menus} />
      </div>
    </div>
  {/if}
</div>
