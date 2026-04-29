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
    loadManhourPivotReport,
    loadManhourReportStages,
    type ManhourPivotReport,
    type ManhourPivotRow
  } from './services/manhourReportService';
  import { exportManhourReportExcel } from './utils/exportManhourReportExcel';
  import { reportRowMatchesSearch } from '$lib/utils/reportTableSearch';

  let menus: any[] = [];
  let showSidebar = false;

  let fromDate = firstDayOfMonthIso();
  let toDate = todayIsoLocal();
  let selectedStage = '';
  let stageOptions: string[] = [];
  let report: ManhourPivotReport | null = null;
  let loading = false;
  let errorMessage = '';
  let tableSearch = '';
  let activeTab: 'consolidated' | 'details' = 'consolidated';

  onMount(async () => {
    try {
      const { getCurrentUsername } = await import('$lib/utils/userUtils');
      const username = getCurrentUsername();
      menus = await fetchUserMenus(username);
      stageOptions = await loadManhourReportStages();
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
    activeTab = 'consolidated';
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
      report = await loadManhourPivotReport(v.fromDate!, v.toDate!, selectedStage);
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
      exportManhourReportExcel(report, v.fromDate!, v.toDate!, selectedStage);
    } catch (e) {
      console.error(e);
      alert('Export failed. Please try again.');
    }
  }

  function rowMatchesSearch(row: ManhourPivotRow): boolean {
    if (!tableSearch.trim()) return true;
    return reportRowMatchesSearch(tableSearch, {
      workerId: row.workerId,
      workerName: row.workerName,
      skillShort: row.skillShort,
      totalHours: row.totalHours
    });
  }

  $: detailFilteredRows = report?.rows.filter((r) => rowMatchesSearch(r)) ?? [];
  $: dateTotals = Object.fromEntries(
    (report?.dates || []).map((d) => [d, detailFilteredRows.reduce((sum, r) => sum + (r.cells[d] ?? 0), 0)])
  ) as Record<string, number>;
  $: grandTotal = detailFilteredRows.reduce((sum, r) => sum + r.totalHours, 0);
  type SkillConsolidatedRow = { skillShort: string; byDate: Record<string, number>; total: number };
  $: consolidatedSkillRows = (() => {
    if (!report) return [] as SkillConsolidatedRow[];
    const grouped = new Map<string, SkillConsolidatedRow>();
    for (const r of report.rows) {
      const skill = (r.skillShort || 'Unspecified').trim() || 'Unspecified';
      if (!grouped.has(skill)) {
        const byDate: Record<string, number> = {};
        for (const d of report.dates) byDate[d] = 0;
        grouped.set(skill, { skillShort: skill, byDate, total: 0 });
      }
      const row = grouped.get(skill)!;
      for (const d of report.dates) {
        const value = r.cells[d] ?? 0;
        row.byDate[d] += value;
        row.total += value;
      }
    }
    return [...grouped.values()].sort((a, b) => a.skillShort.localeCompare(b.skillShort));
  })();
  $: consolidatedDateTotals = Object.fromEntries(
    (report?.dates || []).map((d) => [d, consolidatedSkillRows.reduce((sum, r) => sum + (r.byDate[d] ?? 0), 0)])
  ) as Record<string, number>;
  $: consolidatedGrandTotal = consolidatedSkillRows.reduce((sum, r) => sum + r.total, 0);
</script>

<svelte:head>
  <title>PMS - Manhour Report</title>
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
          <h1 class="text-xl font-semibold theme-text-primary">Manhour Report</h1>
          <p class="text-sm theme-text-secondary">
            Employee-wise daily manhours from work reporting (hours_worked_today)
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
        No work reporting rows match this range.
      </p>
    {/if}

    {#if !report && !loading && !errorMessage}
      <p class="theme-text-secondary mb-4 text-sm">
        Choose filters and click <strong>Generate Report</strong>. Rows are employee-wise and date columns show summed
        <strong>hours_worked_today</strong> as decimals.
      </p>
    {/if}

    {#if report && report.rows.length > 0}
      <section class="rounded-lg border theme-border theme-bg-primary p-4 shadow-sm">
        <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <h2 class="text-base font-semibold theme-text-primary">
            Results ({report.rows.length} row{report.rows.length === 1 ? '' : 's'})
          </h2>
          <div class="inline-flex rounded-md border theme-border overflow-hidden text-sm">
            <button
              type="button"
              class="px-3 py-1.5"
              class:theme-bg-tertiary={activeTab === 'consolidated'}
              class:theme-text-primary={activeTab === 'consolidated'}
              class:theme-text-secondary={activeTab !== 'consolidated'}
              on:click={() => (activeTab = 'consolidated')}
            >
              Consolidated
            </button>
            <button
              type="button"
              class="px-3 py-1.5 border-l theme-border"
              class:theme-bg-tertiary={activeTab === 'details'}
              class:theme-text-primary={activeTab === 'details'}
              class:theme-text-secondary={activeTab !== 'details'}
              on:click={() => (activeTab = 'details')}
            >
              Details
            </button>
          </div>
        </div>
        {#if activeTab === 'consolidated'}
          <div
            class="min-w-0 overflow-x-auto rounded-md border theme-border [-webkit-overflow-scrolling:touch]"
            role="region"
            aria-label="Manhour consolidated by skill table"
          >
            <table class="w-max min-w-full border-collapse text-xs">
              <thead>
                <tr class="theme-text-secondary border-b theme-border text-left">
                  <th class="px-2 py-2 font-medium whitespace-nowrap">Skill</th>
                  {#each report.dates as d}
                    <th class="px-2 py-2 font-medium whitespace-nowrap text-right min-w-[5rem]" title={d}>
                      {formatDdMmmYyyy(d)}
                    </th>
                  {/each}
                  <th class="px-2 py-2 font-medium whitespace-nowrap text-right min-w-[6rem]">Total</th>
                </tr>
              </thead>
              <tbody class="theme-text-primary">
                {#each consolidatedSkillRows as r}
                  <tr class="theme-border border-b align-top">
                    <td class="px-2 py-2 whitespace-nowrap">{r.skillShort}</td>
                    {#each report.dates as d}
                      <td class="px-2 py-2 text-right tabular-nums whitespace-nowrap">{(r.byDate[d] ?? 0).toFixed(2)}</td>
                    {/each}
                    <td class="px-2 py-2 text-right tabular-nums whitespace-nowrap font-semibold">{r.total.toFixed(2)}</td>
                  </tr>
                {/each}
              </tbody>
              <tfoot class="theme-text-primary font-semibold">
                <tr class="theme-border border-t">
                  <td class="px-2 py-2 whitespace-nowrap">Total</td>
                  {#each report.dates as d}
                    <td class="px-2 py-2 text-right tabular-nums whitespace-nowrap">{(consolidatedDateTotals[d] ?? 0).toFixed(2)}</td>
                  {/each}
                  <td class="px-2 py-2 text-right tabular-nums whitespace-nowrap">{consolidatedGrandTotal.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        {:else}
          <label class="mb-3 flex w-full min-w-0 flex-col gap-1 text-sm theme-text-secondary sm:max-w-md sm:flex-1">
            <span>Search table</span>
            <input
              type="search"
              bind:value={tableSearch}
              placeholder="Filter by employee/skill…"
              autocomplete="off"
              class="rounded-md border theme-border bg-white px-3 py-1.5 text-gray-900 dark:bg-gray-900 dark:text-gray-100"
            />
          </label>
          {#if detailFilteredRows.length === 0 && tableSearch.trim()}
            <p class="theme-text-secondary mb-3 text-sm">No rows match your search. Clear the box to show all rows.</p>
          {/if}
          <div
            class="min-w-0 overflow-x-auto rounded-md border theme-border [-webkit-overflow-scrolling:touch]"
            role="region"
            aria-label="Manhour report details table"
          >
            <table class="w-max min-w-full border-collapse text-xs">
              <thead>
                <tr class="theme-text-secondary border-b theme-border text-left">
                  <th class="px-2 py-2 font-medium whitespace-nowrap">Employee</th>
                  <th class="px-2 py-2 font-medium whitespace-nowrap">Skill</th>
                  {#each report.dates as d}
                    <th class="px-2 py-2 font-medium whitespace-nowrap text-right min-w-[5rem]" title={d}>
                      {formatDdMmmYyyy(d)}
                    </th>
                  {/each}
                  <th class="px-2 py-2 font-medium whitespace-nowrap text-right min-w-[6rem]">Total</th>
                </tr>
              </thead>
              <tbody class="theme-text-primary">
                {#each detailFilteredRows as r}
                  <tr class="theme-border border-b align-top">
                    <td class="px-2 py-2 whitespace-nowrap">
                      {r.workerName ?? '—'} <span class="theme-text-secondary">({r.workerId})</span>
                    </td>
                    <td class="px-2 py-2 whitespace-nowrap">{r.skillShort ?? '—'}</td>
                    {#each report.dates as d}
                      <td class="px-2 py-2 text-right tabular-nums whitespace-nowrap">{(r.cells[d] ?? 0).toFixed(2)}</td>
                    {/each}
                    <td class="px-2 py-2 text-right tabular-nums whitespace-nowrap font-semibold">{r.totalHours.toFixed(2)}</td>
                  </tr>
                {/each}
              </tbody>
              <tfoot class="theme-text-primary font-semibold">
                <tr class="theme-border border-t">
                  <td class="px-2 py-2 whitespace-nowrap">Total</td>
                  <td class="px-2 py-2"></td>
                  {#each report.dates as d}
                    <td class="px-2 py-2 text-right tabular-nums whitespace-nowrap">{(dateTotals[d] ?? 0).toFixed(2)}</td>
                  {/each}
                  <td class="px-2 py-2 text-right tabular-nums whitespace-nowrap">{grandTotal.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        {/if}
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
