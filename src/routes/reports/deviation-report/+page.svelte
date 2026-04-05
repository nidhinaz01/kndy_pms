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
  import { loadDeviationReport, type DeviationReportRow } from './services/deviationReportService';
  import { exportDeviationReportExcel } from './utils/exportDeviationReportExcel';

  let menus: any[] = [];
  let showSidebar = false;

  let fromDate = firstDayOfMonthIso();
  let toDate = todayIsoLocal();
  let rows: DeviationReportRow[] = [];
  let loading = false;
  let errorMessage = '';
  let lastRunSucceeded = false;

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
    rows = [];
    lastRunSucceeded = false;
    const v = validateReportDateRange(fromDate, toDate);
    if (!v.ok) {
      errorMessage = v.error || 'Invalid dates.';
      return;
    }
    loading = true;
    try {
      rows = await loadDeviationReport(v.fromDate!, v.toDate!);
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
      exportDeviationReportExcel(rows, v.fromDate!, v.toDate!);
    } catch (e) {
      console.error(e);
      alert('Export failed. Please try again.');
    }
  }
</script>

<svelte:head>
  <title>Deviation Report</title>
</svelte:head>

<div class="flex min-h-screen flex-col theme-bg-secondary transition-colors duration-200">
  <div class="theme-bg-primary border-b theme-border">
    <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <div class="flex items-center gap-3">
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
          <h1 class="text-xl font-semibold theme-text-primary">Deviation Report</h1>
          <p class="text-sm theme-text-secondary">
            Plan and reporting deviations overlapping the selected date window (max ~3 months)
          </p>
        </div>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <label class="flex flex-col gap-1 text-sm theme-text-secondary">
          <span>From date</span>
          <input
            type="date"
            bind:value={fromDate}
            disabled={loading}
            class="rounded-md border theme-border bg-white px-2 py-1.5 text-gray-900 dark:bg-gray-900 dark:text-gray-100 disabled:opacity-60"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm theme-text-secondary">
          <span>To date</span>
          <input
            type="date"
            bind:value={toDate}
            disabled={loading}
            class="rounded-md border theme-border bg-white px-2 py-1.5 text-gray-900 dark:bg-gray-900 dark:text-gray-100 disabled:opacity-60"
          />
        </label>
        <Button variant="primary" size="sm" on:click={generateReport} disabled={loading}>
          {loading ? 'Generating…' : 'Generate Report'}
        </Button>
        <Button variant="secondary" size="sm" on:click={exportExcel} disabled={loading || rows.length === 0}>
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
        No deviation rows match this range and filters.
      </p>
    {/if}

    {#if !rows.length && !loading && !errorMessage && !lastRunSucceeded}
      <p class="theme-text-secondary text-sm mb-4">
        Choose dates and click <strong>Generate Report</strong>. Deviations stored on the planning table (including
        <code class="text-xs">trainee_addition</code>) appear as one <strong>Plan</strong> context line. Deviations stored
        on the reporting table appear as <strong>two</strong> lines each: <strong>Plan</strong> (planned window/worker
        and standard time from skill master) and <strong>Report</strong> (reported window/worker and
        <code class="text-xs">pr_std_time</code> when present). Windows overlap your range by
        <code class="text-xs">from_date</code> / <code class="text-xs">to_date</code>.
      </p>
    {/if}

    {#if rows.length > 0}
      <section class="rounded-lg border theme-border theme-bg-primary p-4 shadow-sm">
        <h2 class="mb-3 text-base font-semibold theme-text-primary">
          Results ({rows.length} row{rows.length === 1 ? '' : 's'})
        </h2>
        <div
          class="min-w-0 overflow-x-auto rounded-md border theme-border [-webkit-overflow-scrolling:touch]"
          role="region"
          aria-label="Deviation report table"
        >
          <table class="w-max min-w-full border-collapse text-xs">
            <thead>
              <tr class="border-b theme-border theme-text-secondary text-left">
                <th class="sticky left-0 z-10 bg-inherit px-2 py-2 font-medium theme-bg-primary">Stage</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">Shift</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">Date</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">Context</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">Type</th>
                <th class="px-2 py-2 font-medium min-w-[12rem]">Reason</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">Work order</th>
                <th class="px-2 py-2 font-medium min-w-[8rem]">Work code</th>
                <th class="px-2 py-2 font-medium min-w-[10rem]">Work name + details</th>
                <th class="px-2 py-2 font-medium min-w-[8rem]">Skill competency</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">Std time</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">Worker</th>
              </tr>
            </thead>
            <tbody class="theme-text-primary">
              {#each rows as r}
                <tr class="border-b theme-border align-top">
                  <td class="sticky left-0 z-10 bg-inherit px-2 py-2 font-medium theme-bg-primary whitespace-nowrap font-mono">{r.stageCode ?? '—'}</td>
                  <td class="px-2 py-2 whitespace-nowrap font-mono">{r.shiftCode ?? '—'}</td>
                  <td class="px-2 py-2 whitespace-nowrap">{formatDdMmmYyyy(r.dateIso) || '—'}</td>
                  <td class="px-2 py-2 whitespace-nowrap font-medium">{r.rowContext}</td>
                  <td class="px-2 py-2 whitespace-nowrap font-mono">{r.deviationType}</td>
                  <td class="px-2 py-2 max-w-xs break-words">{r.reason}</td>
                  <td class="px-2 py-2 whitespace-nowrap">{r.woNo ?? '—'}</td>
                  <td class="px-2 py-2 whitespace-nowrap font-mono">{r.workCode ?? '—'}</td>
                  <td class="px-2 py-2 max-w-[14rem] break-words">{r.workNameDetails ?? '—'}</td>
                  <td class="px-2 py-2 max-w-[10rem] break-words">{r.skillCompetency ?? '—'}</td>
                  <td class="px-2 py-2 whitespace-nowrap">{r.stdTimeDisplay ?? '—'}</td>
                  <td class="px-2 py-2 whitespace-nowrap">{r.workerName ?? r.workerId ?? '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="mt-2 text-xs theme-text-secondary">
          <strong>Date</strong> = context window start (plan or report <code class="text-xs">from_date</code>).
          <strong>Skill competency</strong> lists all active mappings for the standard work (not
          <code class="text-xs">sc_required</code> alone). <strong>Std time</strong> uses skill standard minutes, then
          vehicle flow estimate, then planned hours (as minutes). <strong>Export Excel</strong> adds customer, codes,
          report status, and audit fields.
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
