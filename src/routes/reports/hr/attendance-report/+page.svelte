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
  import {
    loadAttendancePivotReport,
    loadAttendanceReportStages,
    type AttendancePivotReport,
    type AttendancePivotRow
  } from './services/attendanceReportService';
  import { exportAttendanceReportExcel } from './utils/exportAttendanceReportExcel';
  import { reportRowMatchesSearch } from '$lib/utils/reportTableSearch';

  let menus: any[] = [];
  let showSidebar = false;

  let fromDate = firstDayOfMonthIso();
  let toDate = todayIsoLocal();
  let selectedStage = '';
  let stageOptions: string[] = [];
  let report: AttendancePivotReport | null = null;
  let loading = false;
  let errorMessage = '';
  let tableSearch = '';

  onMount(async () => {
    try {
      const { getCurrentUsername } = await import('$lib/utils/userUtils');
      const username = getCurrentUsername();
      menus = await fetchUserMenus(username);
      stageOptions = await loadAttendanceReportStages();
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
    report = null;
    if (!selectedStage) {
      const msg = 'Stage has to be selected.';
      errorMessage = msg;
      alert(msg);
      return;
    }
    const v = validateReportDateRange(fromDate, toDate);
    if (!v.ok) {
      errorMessage = v.error || 'Invalid dates.';
      return;
    }
    loading = true;
    try {
      report = await loadAttendancePivotReport(v.fromDate!, v.toDate!, selectedStage);
    } catch (e) {
      console.error(e);
      errorMessage = e instanceof Error ? e.message : 'Failed to generate report.';
    } finally {
      loading = false;
    }
  }

  function exportExcel() {
    if (!report || report.rows.length === 0) return;
    const v = validateReportDateRange(fromDate, toDate);
    if (!v.ok) {
      errorMessage = v.error || 'Fix dates before export.';
      return;
    }
    try {
      exportAttendanceReportExcel(report, v.fromDate!, v.toDate!);
    } catch (e) {
      console.error(e);
      alert('Export failed. Please try again.');
    }
  }

  function cellDisplay(iso: string, row: AttendancePivotRow): string {
    return row.cells[iso] ?? '';
  }

  function normalizedStatus(value: string | null | undefined): 'P' | 'A(I)' | 'A(U)' | null {
    const v = (value || '').trim().toUpperCase();
    if (v === 'P' || v === 'A(I)' || v === 'A(U)') return v;
    return null;
  }

  function rowStatusCount(row: AttendancePivotRow, status: 'P' | 'A(I)' | 'A(U)'): number {
    if (!report) return 0;
    let total = 0;
    for (const d of report.dates) {
      if (normalizedStatus(row.cells[d]) === status) total += 1;
    }
    return total;
  }

  function dateStatusCount(dateIso: string, status: 'P' | 'A(I)' | 'A(U)'): number {
    let total = 0;
    for (const row of filteredAttendanceRows) {
      if (normalizedStatus(row.cells[dateIso]) === status) total += 1;
    }
    return total;
  }

  $: filteredAttendanceRows =
    report?.rows.filter((r) => reportRowMatchesSearch(tableSearch, r)) ?? [];
  $: datePCounts = Object.fromEntries((report?.dates || []).map((d) => [d, dateStatusCount(d, 'P')])) as Record<string, number>;
  $: dateAICounts = Object.fromEntries((report?.dates || []).map((d) => [d, dateStatusCount(d, 'A(I)')])) as Record<string, number>;
  $: dateAUCounts = Object.fromEntries((report?.dates || []).map((d) => [d, dateStatusCount(d, 'A(U)')])) as Record<string, number>;
</script>

<svelte:head>
  <title>PMS - Attendance Report</title>
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
          <h1 class="text-xl font-semibold theme-text-primary">Attendance Report</h1>
          <p class="text-sm theme-text-secondary">
            Reporting manpower — one letter per calendar day (P / A(I) / A(U); max ~3 months)
          </p>
        </div>
      </div>
      <div class="flex flex-wrap items-end justify-end gap-3">
        <label class="flex flex-col gap-1 text-sm theme-text-secondary">
          <span>Stage</span>
          <select
            bind:value={selectedStage}
            class="rounded-md border theme-border bg-white px-2 py-1.5 text-gray-900 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="">--Select Stage--</option>
            <option value="All">All</option>
            {#each stageOptions as stage}
              <option value={stage}>{stage}</option>
            {/each}
          </select>
        </label>
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
        <Button variant="secondary" size="sm" on:click={exportExcel} disabled={!report || report.rows.length === 0}>
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

    {#if report && !report.rows.length && !loading}
      <p class="mb-4 rounded-lg border theme-border theme-bg-primary px-4 py-3 text-sm theme-text-secondary">
        No reporting manpower in this range.
      </p>
    {/if}

    {#if !report && !loading && !errorMessage}
      <p class="theme-text-secondary mb-4 text-sm">
        Choose <strong>from</strong> and <strong>to</strong> dates and click <strong>Generate Report</strong>. Each row is
        shift, stage, employee, and skill; date columns show attendance for days covered by the reporting window.
      </p>
    {/if}

    {#if report && report.rows.length > 0}
      <section class="rounded-lg border theme-border theme-bg-primary p-4 shadow-sm">
        <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <h2 class="text-base font-semibold theme-text-primary">
            Results ({filteredAttendanceRows.length}{#if tableSearch.trim() && report.rows.length > 0} of {report.rows.length}{/if} row{filteredAttendanceRows.length === 1 ? '' : 's'})
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
        {#if filteredAttendanceRows.length === 0 && tableSearch.trim()}
          <p class="theme-text-secondary mb-3 text-sm">No rows match your search. Clear the box to show all rows.</p>
        {/if}
        <div
          class="min-w-0 overflow-x-auto rounded-md border theme-border [-webkit-overflow-scrolling:touch]"
          role="region"
          aria-label="Attendance report table"
        >
          <table class="w-max min-w-full border-collapse text-xs">
            <thead>
              <tr class="theme-text-secondary border-b theme-border text-left">
                <th class="px-2 py-2 font-medium whitespace-nowrap">Shift</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">Stage</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">Employee</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">Skill</th>
                {#each report.dates as d}
                  <th class="px-2 py-2 font-medium whitespace-nowrap text-center min-w-[4.5rem]" title={d}>
                    {formatDdMmmYyyy(d)}
                  </th>
                {/each}
                <th class="px-2 py-2 font-medium whitespace-nowrap text-right min-w-[4rem]">P</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap text-right min-w-[4rem]">A(I)</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap text-right min-w-[4rem]">A(U)</th>
              </tr>
            </thead>
            <tbody class="theme-text-primary">
              {#each filteredAttendanceRows as r}
                <tr class="theme-border border-b align-top">
                  <td class="px-2 py-2 font-mono whitespace-nowrap">{r.shiftCode ?? '—'}</td>
                  <td class="px-2 py-2 font-mono whitespace-nowrap">{r.stageCode ?? '—'}</td>
                  <td class="px-2 py-2 whitespace-nowrap">
                    {r.empName ?? '—'} <span class="theme-text-secondary">({r.empId ?? '—'})</span>
                  </td>
                  <td class="px-2 py-2 whitespace-nowrap">{r.skillShort ?? '—'}</td>
                  {#each report.dates as d}
                    <td class="px-2 py-2 text-center tabular-nums whitespace-nowrap">{cellDisplay(d, r) || '—'}</td>
                  {/each}
                  <td class="px-2 py-2 text-right tabular-nums whitespace-nowrap">{rowStatusCount(r, 'P')}</td>
                  <td class="px-2 py-2 text-right tabular-nums whitespace-nowrap">{rowStatusCount(r, 'A(I)')}</td>
                  <td class="px-2 py-2 text-right tabular-nums whitespace-nowrap">{rowStatusCount(r, 'A(U)')}</td>
                </tr>
              {/each}
            </tbody>
            <tfoot class="theme-text-primary font-semibold">
              <tr class="theme-border border-t">
                <td class="px-2 py-2"></td>
                <td class="px-2 py-2"></td>
                <td class="px-2 py-2 whitespace-nowrap">P</td>
                <td class="px-2 py-2"></td>
                {#each report.dates as d}
                  <td class="px-2 py-2 text-center tabular-nums whitespace-nowrap">{datePCounts[d] ?? 0}</td>
                {/each}
                <td class="px-2 py-2"></td>
                <td class="px-2 py-2"></td>
                <td class="px-2 py-2"></td>
              </tr>
              <tr class="theme-border border-t">
                <td class="px-2 py-2"></td>
                <td class="px-2 py-2"></td>
                <td class="px-2 py-2 whitespace-nowrap">A(I)</td>
                <td class="px-2 py-2"></td>
                {#each report.dates as d}
                  <td class="px-2 py-2 text-center tabular-nums whitespace-nowrap">{dateAICounts[d] ?? 0}</td>
                {/each}
                <td class="px-2 py-2"></td>
                <td class="px-2 py-2"></td>
                <td class="px-2 py-2"></td>
              </tr>
              <tr class="theme-border border-t">
                <td class="px-2 py-2"></td>
                <td class="px-2 py-2"></td>
                <td class="px-2 py-2 whitespace-nowrap">A(U)</td>
                <td class="px-2 py-2"></td>
                {#each report.dates as d}
                  <td class="px-2 py-2 text-center tabular-nums whitespace-nowrap">{dateAUCounts[d] ?? 0}</td>
                {/each}
                <td class="px-2 py-2"></td>
                <td class="px-2 py-2"></td>
                <td class="px-2 py-2"></td>
              </tr>
              <tr class="theme-border border-t">
                <td class="px-2 py-2"></td>
                <td class="px-2 py-2"></td>
                <td class="px-2 py-2 whitespace-nowrap">Total</td>
                <td class="px-2 py-2"></td>
                {#each report.dates as d}
                  <td class="px-2 py-2 text-center tabular-nums whitespace-nowrap">{(datePCounts[d] ?? 0) + (dateAICounts[d] ?? 0) + (dateAUCounts[d] ?? 0)}</td>
                {/each}
                <td class="px-2 py-2"></td>
                <td class="px-2 py-2"></td>
                <td class="px-2 py-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
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
